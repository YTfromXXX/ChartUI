'use client';

import { useEffect, useState } from 'react';
import { useCureAPIStore, type PlaceholderState } from '@/lib/cureApiStore';

type Cert = {
  type: 'A' | 'B';
  qpu: string;
  mode: string;
  dest: string;
  path: string;
} | null;

type Phase = 'menu' | 'ex_pending' | 'done';

/** Map PlaceholderState → terminal user token */
function toUser(ps: PlaceholderState): string {
  if (ps === 'idle') return 'guest';
  if (ps === '⚪︎') return 'circle';
  if (ps === '◻︎') return 'square';
  return ps.replace(/[()]/g, '');
}

/** Derive status label from exParameter (0–1) */
function toStatus(ex: number): string {
  if (ex > 0.7) return 'active';
  if (ex > 0.3) return 'hold';
  return 'low';
}

/** Derive device label from simulationMode */
function toDevice(mode: string): string {
  if (mode === 'hypothesisA') return 'expand';
  if (mode === 'hypothesisB') return 'extend';
  return 'base';
}

export default function CureOsTerminal() {
  const placeholderState = useCureAPIStore((s) => s.placeholderState);
  const exParameter     = useCureAPIStore((s) => s.exParameter);
  const arcanaParameters = useCureAPIStore((s) => s.arcanaParameters);
  const simulationMode  = useCureAPIStore((s) => s.simulationMode);

  const [cert, setCert]       = useState<Cert>(null);
  const [phase, setPhase]     = useState<Phase>('menu');
  const [countdown, setCountdown] = useState(90);

  // Build terminal prompt tokens from store
  const user   = toUser(placeholderState);
  const angles = arcanaParameters.slice(0, 4).map((a) => a.angle.toFixed(0));
  const device = toDevice(simulationMode);
  const status = toStatus(exParameter);

  // Python version: 3.11.x where x tracks exParameter
  const pyPatch   = Math.round(exParameter * 10);
  const pyVersion = `3.11.${pyPatch}`;

  // Countdown timer while ex_pending
  useEffect(() => {
    if (phase !== 'ex_pending') return;
    if (countdown <= 0) { setPhase('menu'); return undefined; }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, countdown]);

  function startEx() {
    setPhase('ex_pending');
    setCountdown(90);
    setCert(null);
  }

  function handleAuth(type: 'A' | 'B') {
    const isA = type === 'A';
    setCert({
      type,
      qpu:  isA ? '1011·0010·01101' : '0100·1101·10010',
      mode: isA ? 'NORMAL' : 'OS_ELEVATED',
      dest: isA ? '育成フィールド' : 'MothBlast',
      path: isA ? 'ドアノブ' : 'バスボム',
    });
    setPhase('done');
  }

  const aUnlocked = cert?.type === 'A';
  const bUnlocked = cert?.type === 'B';

  return (
    <div className="rounded-lg border border-cyan-200/15 bg-black/55 overflow-hidden">

      {/* ── Title bar ── */}
      <div className="flex items-center gap-2 border-b border-white/[0.07] bg-[#0b1420] px-3 py-2">
        <span className="flex gap-1.5" aria-hidden>
          <span className="block h-2.5 w-2.5 rounded-full bg-rose-400/55" />
          <span className="block h-2.5 w-2.5 rounded-full bg-amber-400/55" />
          <span className="block h-2.5 w-2.5 rounded-full bg-emerald-400/55" />
        </span>
        <span className="ml-1 font-mono text-[9px] tracking-[0.18em] text-slate-400">
          Cure-OS Terminal — Python {pyVersion}
        </span>
      </div>

      {/* ── Terminal body ── */}
      <div className="space-y-[2px] p-3 font-mono text-[11px] leading-[1.65]">

        {/* Shell prompt */}
        <p className="text-cyan-300">
          [[&quot;{user} : darwin&quot;]@&#123;[{angles.join(',')}]&#125;-&#123;{device}&#125;-&#123;{status}&#125; ~]$ python
        </p>
        <p className="text-slate-400">Python {pyVersion} (darwin)</p>
        <p>
          <span className="text-cyan-400">&gt;&gt;&gt;</span>
          {' '}<span className="text-white">import cure_oracle</span>
        </p>
        <p className="text-slate-500"># 総合メニュー (インタラクティブモード)</p>
        <p>
          <span className="text-cyan-400">&gt;&gt;&gt;</span>
          {' '}<span className="text-white">cure_oracle.menu()</span>
        </p>

        {/* Menu box */}
        <p className="mt-1 text-slate-500">
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        </p>
        <p className="font-semibold text-amber-300">
          {'   '}CURE-API 総合メニュー{'  '}v0.3.2
        </p>
        <p className="text-slate-500">
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        </p>

        {/* [ex] row */}
        <button
          type="button"
          onClick={phase === 'menu' ? startEx : undefined}
          disabled={phase !== 'menu'}
          className="block w-full rounded px-1 text-left transition-colors hover:bg-cyan-200/[0.06] disabled:opacity-40 disabled:cursor-default"
        >
          <span className="text-cyan-400">[ex]</span>
          <span className="text-white">{' '}Cure-API 署名認証</span>
          <span className="text-slate-500">{'      '}← ロータリーポップアップ</span>
        </button>

        {/* [A] row */}
        <button
          type="button"
          onClick={aUnlocked ? () => {} : undefined}
          disabled={!aUnlocked}
          className="block w-full rounded px-1 text-left transition-colors hover:bg-cyan-200/[0.04] disabled:opacity-35 disabled:cursor-default"
        >
          <span className="text-slate-400">[ A]</span>
          <span className="text-white">{' '}育成フィールド</span>
          {'  '}
          {aUnlocked
            ? <span className="text-cyan-300">✓ 解錠済</span>
            : <span>🔒</span>}
        </button>

        {/* [B] row */}
        <button
          type="button"
          onClick={bUnlocked ? () => {} : undefined}
          disabled={!bUnlocked}
          className="block w-full rounded px-1 text-left transition-colors hover:bg-orange-200/[0.04] disabled:opacity-35 disabled:cursor-default"
        >
          <span className="text-slate-400">[ B]</span>
          <span className="text-white">{' '}MothBlast</span>
          {'              '}
          {bUnlocked
            ? <span className="text-orange-300">✓ 解錠済</span>
            : <span>🔒</span>}
        </button>

        {/* [q] row */}
        <p className="px-1 text-slate-500">
          <span className="text-slate-400">[ q]</span>{' '}終了
        </p>

        <p className="pb-1 text-slate-500">
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        </p>

        {/* ── ex pending ── */}
        {phase === 'ex_pending' && (
          <div className="space-y-[2px]">
            <p>
              <span className="text-cyan-400">選択</span>
              <span className="text-white"> &gt; ex</span>
            </p>
            <p className="text-slate-400">
              {'  '}→ ブラウザ起動: [http://127.0.0.1:8420/]
            </p>
            <p className="text-amber-300">
              {'  '}→ 認証待機中... ({countdown}秒)
            </p>
            <p className="pt-1 text-slate-500"># A または B を選択して認証</p>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleAuth('A')}
                className="rounded border border-cyan-400/40 px-3 py-1 text-[10px] text-cyan-300 transition-colors hover:bg-cyan-400/10"
              >
                A → ドアノブ
              </button>
              <button
                type="button"
                onClick={() => handleAuth('B')}
                className="rounded border border-orange-400/40 px-3 py-1 text-[10px] text-orange-300 transition-colors hover:bg-orange-400/10"
              >
                B → バスボム
              </button>
            </div>
          </div>
        )}

        {/* ── Certificate display ── */}
        {cert && (
          <div className="space-y-[2px]">
            <p className="pt-1 text-slate-500">
              # ユーザーがダイヤルを操作して {cert.type}認証
            </p>
            <p className={cert.type === 'A' ? 'text-cyan-300' : 'text-orange-300'}>
              ✓ 認証完了: {cert.type}型 / {cert.path} → {cert.dest}
            </p>
            <p className={cert.type === 'A' ? 'text-cyan-200' : 'text-amber-200'}>
              CureCertificate(type=&apos;{cert.type}&apos;, qpu=&apos;{cert.qpu}&apos;,
            </p>
            <p className={cert.type === 'A' ? 'text-cyan-200' : 'text-amber-200'}>
              {'  '}mode=&apos;{cert.mode}&apos;, dest=&apos;{cert.dest}&apos;)
            </p>

            {/* Unlock confirmation line */}
            <p className="pt-1 px-1">
              {cert.type === 'B'
                ? <><span className="text-slate-400">[ B]</span><span className="text-white"> MothBlast</span>{'   '}<span className="text-orange-300">✓ 解錠済</span></>
                : <><span className="text-slate-400">[ A]</span><span className="text-white"> 育成フィールド</span>{'   '}<span className="text-cyan-300">✓ 解錠済</span></>
              }
            </p>

            {/* Go command */}
            <p className="pt-1">
              <span className="text-cyan-400">選択</span>
              <span className="text-white"> &gt; {cert.type.toLowerCase()}</span>
            </p>
            {cert.type === 'B' ? (
              <>
                <p className="text-slate-400">{'  '}→ MothBlast起動 (OS昇格)</p>
                <p className="text-slate-400">
                  {'  '}→ cure_oracle.elevate(cert){' '}
                  <span className="text-slate-600"># QPU スケジューラ接続</span>
                </p>
              </>
            ) : (
              <>
                <p className="text-slate-400">{'  '}→ 育成フィールド起動</p>
                <p className="text-slate-400">{'  '}→ cure_oracle.launch_field(cert)</p>
              </>
            )}

            {/* Mechanism notes */}
            <div className="mt-2 space-y-[2px] border-t border-white/[0.06] pt-2">
              <p className="text-slate-500">ポップアップ発動メカニズム:</p>
              <p className="text-slate-500">1. http.server.HTTPServer(&apos;127.0.0.1&apos;, 8420) 起動</p>
              <p className="text-slate-500">2. webbrowser.open(&apos;http://127.0.0.1:8420/&apos;) → ブラウザ起動</p>
              <p className="text-slate-500">3. HTML内JavaScript が認証後に POST /auth → Python受信</p>
              <p className="text-slate-500">4. threading.Event.wait(timeout=90) でブロック</p>
              <p className="text-slate-500">5. 証明書受取後 httpd.shutdown() → CureCertificate return</p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
