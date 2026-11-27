// ChartUI ホワイトアウト版 (./menu) — the retest simulation.
//
//   retest === () => { VR/MR: "e-mail address" }
//   if (e-mail address) too many === 「ChartUI ホワイトアウト版をもう一度 retest する」
//
// SNS account IDs are turned into fictional e-mail addresses on the reserved `.example`
// top-level domain (RFC 2606), which can never deliver mail to anyone. Anything that looks
// like a deliverable address is treated as real: it is never stored, sent or shown in full,
// and the run branches to splitting the Fami ports into design cases and the Mente front end.

import { FAMI_PORTS, type FamiPort } from '@/lib/idlecrash';

export const FICTIONAL_DOMAIN = 'whiteout.example';
/** Above this many addresses the run offers a retest instead. */
export const TOO_MANY = 7;

const RESERVED = [/\.example$/i, /\.invalid$/i, /\.test$/i, /\.localhost$/i, /^example\.(com|net|org)$/i];
const EMAIL = /^[^\s@]+@([^\s@]+\.[^\s@]+)$/;
/** An address anywhere in the line ("mail: \"x@y.com\"", "ab: x@y.com", "<x@y.com>"), so a prefix cannot smuggle a real one through. */
const EMAIL_INSIDE = /[^\s@"'<>()[\],;:]+@([^\s@"'<>()[\],;:]+\.[^\s@"'<>()[\],;:]+)/;

export type Entry =
  | { kind: 'fictional'; input: string; address: string }
  | { kind: 'real'; masked: string }
  | { kind: 'invalid'; input: string };

export function slugify(id: string) {
  const slug = id.normalize('NFKC').replace(/^@+/, '').toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^[-.]+|[-.]+$/g, '');
  return slug.slice(0, 32);
}

export function maskEmail(email: string) {
  const [local, domain] = email.split('@');
  const [host, ...rest] = domain.split('.');
  return `${local[0] ?? '*'}***@${host[0] ?? '*'}***.${rest.join('.') || '*'}`;
}

export function classify(line: string): Entry | null {
  const input = line.trim();
  if (!input) return null;
  const email = input.match(EMAIL);
  if (email) {
    return RESERVED.some((r) => r.test(email[1])) ? { kind: 'fictional', input, address: input.toLowerCase() } : { kind: 'real', masked: maskEmail(input) };
  }
  const inside = input.match(EMAIL_INSIDE);
  if (inside && !RESERVED.some((r) => r.test(inside[1]))) return { kind: 'real', masked: maskEmail(inside[0]) };
  const slug = slugify(input);
  return slug ? { kind: 'fictional', input, address: `${slug}@${FICTIONAL_DOMAIN}` } : { kind: 'invalid', input };
}

export type RetestResult = {
  entries: Entry[];
  fictional: Extract<Entry, { kind: 'fictional' }>[];
  realCount: number;
  tooMany: boolean;
  /** What the run does next. */
  next: 'receive' | 'retest' | 'split-to-mente' | 'idle';
};

export function retest(text: string): RetestResult {
  const entries = text.split(/[\n,]+/).map(classify).filter((e): e is Entry => e !== null);
  const fictional = entries.filter((e): e is Extract<Entry, { kind: 'fictional' }> => e.kind === 'fictional');
  const realCount = entries.filter((e) => e.kind === 'real').length;
  const tooMany = fictional.length + realCount > TOO_MANY;
  const next = realCount > 0 ? 'split-to-mente' : tooMany ? 'retest' : fictional.length ? 'receive' : 'idle';
  return { entries, fictional, realCount, tooMany, next };
}

/** When a real address appears: the Fami ports split into design-in-progress cases; Mente front end first. */
export const DESIGN_CASES: { title: string; ports: number[]; note: string }[] = [
  { title: 'Mente フロントエンド（先行）', ports: [17, 4, 18], note: 'チャット・通知・保健室。本物のアドレスはここで扱わず、アプリ内の通知に置き換える' },
  { title: '計測・解析', ports: [2, 6, 13, 19, 9], note: 'シンクロ計測、動物行動予測、記号変換、クイズクオンタム、老婆の柱' },
  { title: 'ゲーム・ループ', ports: [1, 5, 7, 10, 11, 12, 14, 16], note: 'idlecrash を軸にした無限ループ群' },
  { title: 'Dual・パチスロ（慎重に）', ports: [3, 8, 15, 20, 21, 22], note: '2 択とスロット。双六のマス目に従い、金銭・オッズを持ち込まない' },
];

export const portsOf = (nos: number[]): FamiPort[] => nos.map((no) => FAMI_PORTS[no - 1]);

/** Permanent knight on the 11 × 2 binder: a knight moves to the other row, two columns away. */
export function knightMoves(index: number): number[] {
  const row = index < 11 ? 0 : 1;
  const col = index % 11;
  return [col - 2, col + 2].filter((c) => c >= 0 && c < 11).map((c) => (1 - row) * 11 + c);
}
