// TypeScript side of the initial customer analysis — contract "cure-initial/1".
// Mirrors cure_initial.py: same schema, same maths (half-up rounding on both sides), checked
// against tests/fixtures/cure_initial_cases.json. The client asks the FastAPI endpoint and falls
// back to the identical local computation when the API is unreachable, so the initial page works
// offline. Wallet-free: no account, wallet or address is sent; raw signals are never stored.

export const SCHEMA_VERSION = 'cure-initial/1' as const;
export type Grade = 'A' | 'B' | 'C' | 'D';
export type Component = 'header' | 'bottom' | 'side' | 'popup';

export type InitialSignals = {
  schema_version?: typeof SCHEMA_VERSION;
  consent: boolean;
  first_click_ms?: number | null; // A · time to the first click
  click_rate?: number | null; // A · clicks per second
  handle_torque?: number | null; // B · tiny pointer/handle movements, 0–1
  panel_depth?: number | null; // C · parameter panels opened, 0–10
  eyes_closed_ms?: number | null; // D · time with the eyes closed
  haptic_budget_ms?: number; // API-B budget split 2:4:6:7
};
export type SyncDirective = { component: Component; grade: Grade; action: string; value: number };
export type SplitPart = { key: 'relax' | 'drift' | 'counter' | 'oracle'; layer: 2 | 4 | 6 | 7; title: string; share: number; budget_ms: number };
export type InitialAnalysis = {
  schema_version: typeof SCHEMA_VERSION; grade: Grade; level: string; style: string; processing: string; confidence: number;
  scores: Record<Grade, number>; sync: SyncDirective[]; split: SplitPart[]; wallet_free: true; stored: false;
  /** Where the answer came from (client-side only, not part of the API). */
  source?: 'api' | 'local';
};

export const COMPONENT_OF: Record<Grade, Component> = { A: 'header', B: 'bottom', C: 'side', D: 'popup' };
export const GRADE_INFO: Record<Grade, { level: string; style: string; processing: string; sync: string }> = {
  A: { level: '高', style: 'マクロ追従型', processing: '歪みパルスの初期バッファリング', sync: '長期予測のフレーム固定' },
  B: { level: '中', style: 'スキャルピング型', processing: 'グラフ縦回転の初期同期ズレ感知', sync: '短期パルス群の振幅調整' },
  C: { level: '低', style: 'ガイダンス型', processing: 'Cure-API 並列チャートの負荷テスト', sync: 'インターフェースの減衰制御' },
  D: { level: '極', style: '直感・完全同調型', processing: '皮膚感覚（API-B）閾値の自動計測', sync: '心臓拍動（オラクル同期）パルス' },
};
const SPLIT: [SplitPart['key'], SplitPart['layer'], string][] = [
  ['relax', 2, '基礎緊張緩和（境界解体）'], ['drift', 4, '縦回転グラフのズレ知覚'],
  ['counter', 6, 'ハンドル微動へのカウンター・フィードバック'], ['oracle', 7, 'API-A 最優先調整ループ'],
];
const SPLIT_TOTAL = 19;

const clamp = (v: number) => Math.max(0, Math.min(1, v));
/** Half-up rounding, identical to cure_initial._round. */
export const roundHalfUp = (x: number, digits = 0) => { const k = 10 ** digits; return Math.floor(x * k + 0.5) / k; };

export function scoresOf(s: InitialSignals): Record<Grade, number> {
  let a = 0;
  if (s.first_click_ms !== null && s.first_click_ms !== undefined) a = clamp((6000 - s.first_click_ms) / 5600) * 0.7 + clamp((s.click_rate ?? 0) / 3) * 0.3;
  const b = clamp(s.handle_torque ?? 0);
  const c = clamp((s.panel_depth ?? 0) / 4);
  const d = clamp(Math.log1p((s.eyes_closed_ms ?? 0) / 1000) / Math.log1p(8));
  return { A: roundHalfUp(a, 6), B: roundHalfUp(b, 6), C: roundHalfUp(c, 6), D: roundHalfUp(d, 6) };
}

/** The same analysis as the API, computed in the browser. */
export function analyseLocal(s: InitialSignals): InitialAnalysis {
  if (!s.consent) throw new Error('consent is required');
  const sc = scoresOf(s);
  const order = (['A', 'B', 'C', 'D'] as Grade[]).sort((x, y) => sc[y] - sc[x] || 'ABCD'.indexOf(x) - 'ABCD'.indexOf(y));
  const grade: Grade = sc[order[0]] > 0 ? order[0] : 'C';
  const budget = s.haptic_budget_ms ?? 16;
  const info = GRADE_INFO[grade];
  return {
    schema_version: SCHEMA_VERSION, grade, level: info.level, style: info.style, processing: info.processing,
    confidence: roundHalfUp(sc[order[0]] - sc[order[1]], 6), scores: sc,
    sync: [
      { component: 'header', grade: 'A', action: '長期予測のフレーム固定（本数）', value: roundHalfUp(20 + 180 * sc.A) },
      { component: 'bottom', grade: 'B', action: '短期パルス群の振幅', value: roundHalfUp(0.2 + 0.8 * sc.B, 4) },
      { component: 'side', grade: 'C', action: 'インターフェースの減衰（0 = 減衰なし）', value: roundHalfUp(1 - sc.C, 4) },
      { component: 'popup', grade: 'D', action: '心臓拍動パルス（bpm）', value: roundHalfUp(60 + 40 * sc.D) },
    ],
    split: SPLIT.map(([key, layer, title]) => ({ key, layer, title, share: roundHalfUp(layer / SPLIT_TOTAL, 6), budget_ms: roundHalfUp((budget * layer) / SPLIT_TOTAL, 4) })),
    wallet_free: true, stored: false,
  };
}

/** Ask the Cure-API (FastAPI) and fall back to the local computation. */
export async function requestInitialAnalysis(s: InitialSignals, opts: { baseUrl?: string; timeoutMs?: number; fetchImpl?: typeof fetch } = {}): Promise<InitialAnalysis> {
  const base = opts.baseUrl ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
  const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 1500);
  try {
    const res = await (opts.fetchImpl ?? fetch)(`${base}/api/v1/cure/initial-analysis`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...s, schema_version: SCHEMA_VERSION }), signal: ctrl.signal,
    });
    if (res.status === 422) throw new Error('rejected: consent or a signal is invalid');
    if (!res.ok) throw new Error(String(res.status));
    const body = (await res.json()) as InitialAnalysis;
    if (body.schema_version !== SCHEMA_VERSION) throw new Error(`schema mismatch: ${body.schema_version}`);
    return { ...body, source: 'api' };
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('rejected')) throw e; // do not hide a consent/validation error
    return { ...analyseLocal(s), source: 'local' };
  } finally { clearTimeout(timer); }
}
