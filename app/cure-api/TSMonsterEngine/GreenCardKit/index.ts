// GreenCardKit — fair-play animation, adjusted to each region's rules.
//
// Flash limit: every profile uses at most 3 flashes per second (WCAG 2.3.1, which is
// referenced by EN 301 549 in the EU and Section 508 in the US; Japanese broadcasters
// follow the same 3-per-second guideline). Reduced-motion preferences are always honoured.
// Notices are informational templates, not legal advice.

export type Region = 'JP' | 'EU' | 'US' | 'GLOBAL';

export type RegionRule = {
  maxFlashHz: number;
  notice: string;
  frameworks: string[];
};

export const REGION_RULES: Record<Region, RegionRule> = {
  JP: { maxFlashHz: 3, notice: '本表示はシミュレーションであり、投資助言・売買推奨ではありません。', frameworks: ['WCAG 2.3.1', '放送の点滅ガイドライン', '金融商品取引法（助言規制）'] },
  EU: { maxFlashHz: 3, notice: 'Simulation only — not investment advice. Crypto-assets are high-risk and you may lose all the money you invest.', frameworks: ['WCAG 2.3.1 / EN 301 549', 'MiCA (risk warnings)'] },
  US: { maxFlashHz: 3, notice: 'Simulation only. Not investment advice or a recommendation to buy or sell.', frameworks: ['WCAG 2.3.1 / Section 508'] },
  GLOBAL: { maxFlashHz: 3, notice: 'Simulation only — not investment advice.', frameworks: ['WCAG 2.3.1'] },
};

const EU = new Set(['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE']);

export function regionFromLocale(locale?: string): Region {
  if (!locale) return 'GLOBAL';
  const [lang, country] = locale.split('-').map((part) => part.toUpperCase());
  if (country === 'JP' || (!country && lang === 'JA')) return 'JP';
  if (country === 'US') return 'US';
  if (country && EU.has(country)) return 'EU';
  return 'GLOBAL';
}

export type Regulation = { strobeIntervalMs: number; motionScale: number; flashHz: number; adjusted: boolean; notes: string[] };

/** Clamp a strobe / flicker interval and motion scale to the region's fair-play limits. */
export function regulateAnimation(input: { region: Region; strobeIntervalMs: number; prefersReducedMotion?: boolean; motionScale?: number }): Regulation {
  const rule = REGION_RULES[input.region];
  const notes: string[] = [];
  const minInterval = Math.ceil(1000 / rule.maxFlashHz);
  let strobeIntervalMs = Math.max(1, input.strobeIntervalMs);
  let motionScale = input.motionScale ?? 1;
  if (strobeIntervalMs < minInterval) {
    notes.push(`flash ${(1000 / strobeIntervalMs).toFixed(1)} Hz → ${rule.maxFlashHz} Hz`);
    strobeIntervalMs = minInterval;
  }
  if (input.prefersReducedMotion) {
    notes.push('reduced motion');
    strobeIntervalMs = Math.max(strobeIntervalMs, 1000);
    motionScale = Math.min(motionScale, 0.2);
  }
  return { strobeIntervalMs, motionScale, flashHz: 1000 / strobeIntervalMs, adjusted: notes.length > 0, notes };
}

export type FairPlayReport = { ok: boolean; checks: { rule: string; pass: boolean }[] };

/** Fair-play checks for a two-option prompt: no preselection, balanced options, reversible. */
export function fairPlayCheck(input: { a: string; b: string; preselected?: 'A' | 'B' | null; canDismiss: boolean; canChooseAgain: boolean }): FairPlayReport {
  const ratio = Math.max(input.a.length, input.b.length) / Math.max(1, Math.min(input.a.length, input.b.length));
  const checks = [
    { rule: 'どちらの選択肢も既定（フォーカス・強調）にしない', pass: !input.preselected },
    { rule: '2 つの文言の長さが極端に偏らない（2 倍以内）', pass: ratio <= 2 },
    { rule: '選ばずに閉じられる', pass: input.canDismiss },
    { rule: 'いつでも選び直せる', pass: input.canChooseAgain },
  ];
  return { ok: checks.every((c) => c.pass), checks };
}
