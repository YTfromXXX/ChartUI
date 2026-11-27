// Activist sugoroku: an activist campaign as a 19-square board game, played with car pieces.
//
// Why a game: while trading, the player should keep turning their eyes to the next name, and the
// reasons to do so are fundamental — news, filings, board fights. An activist campaign is a natural
// sugoroku: buy a stake, cross the 5 % line, write the public letter, fight for proxies, win seats,
// settle, and move on. (Inspired by reading "アクティビスト 取締役会の野蛮な侵入者", Owen Walker; no text
// of the book is used. All companies and people here are fictional; figures are synthetic.)
//
// The board is the skeleton: 19 squares = 19 bones (1/19 … 19/19). Every square produces a news
// item, and the news passes through three filters (the "(3) filter"):
//   事実 (fact)    — numbers and filings  → patience
//   噂 (rumour)    — unconfirmed talk     → boldness
//   感情 (feeling) — people and pride     → charm
// Whatever a filter recovers is stored on the bone where it happened, and it updates the
// personality of the driver who landed there.
//
// Turns work like git: commands are staged as commits, and `git push` moves every car at once.
// Two cars pushing to the same square is a merge conflict: both are rejected and stay put.
// Virtual Gemini and virtual Claude are simulated advisers with canned, rule-based replies — they
// are not the real products and make no calls to them.

export type Team = { id: string; logo: string; colour: string; driver: string };
export const TEAMS: Team[] = [
  { id: 'btc', logo: '₿', colour: '#f7931a', driver: 'ナギ' },
  { id: 'usd', logo: '$', colour: '#22c55e', driver: 'ルカ' },
  { id: 'jpy', logo: '¥', colour: '#ef4444', driver: 'ミオ' },
  { id: 'xau', logo: 'Au', colour: '#eab308', driver: 'ソウ' },
];

export type Company = { ticker: string; name: string; pbr: number; cashRatio: number; crossHoldings: number };
/** Fictional targets. Activists look for low PBR, idle cash and cross-shareholdings. */
export const COMPANIES: Company[] = [
  { ticker: 'MNT', name: 'ミナト重工', pbr: 0.62, cashRatio: 0.41, crossHoldings: 0.18 },
  { ticker: 'KZE', name: 'カゼノ電機', pbr: 0.88, cashRatio: 0.33, crossHoldings: 0.25 },
  { ticker: 'HSG', name: 'ホシガネ化学', pbr: 1.35, cashRatio: 0.12, crossHoldings: 0.05 },
  { ticker: 'TKR', name: 'タカラ食品', pbr: 0.71, cashRatio: 0.52, crossHoldings: 0.31 },
];
/** How attractive a target is to an activist (0–1): cheap, cash-rich, tied up in cross-holdings. */
export const targetScore = (c: Company) => Math.max(0, Math.min(1, 0.45 * Math.max(0, 1.2 - c.pbr) / 1.2 + 0.35 * c.cashRatio / 0.6 + 0.2 * c.crossHoldings / 0.35));

export type Filter = 'fact' | 'rumour' | 'feeling';
export type Square = { no: number; title: string; kind: Filter; effect: { stake?: number; seats?: number; cash?: number; fame?: number }; headline: string };
// headline placeholders: {team} {driver} {name} {ticker}
export const SQUARES: Square[] = [
  { no: 1, title: '銘柄スクリーニング', kind: 'fact', effect: {}, headline: '{team} が PBR 1 倍割れ・現金の多い会社を洗い出し。候補に {name}' },
  { no: 2, title: '株の買い集め', kind: 'fact', effect: { stake: 2, cash: -20 }, headline: '{name}（{ticker}）の出来高が急増、買い手は不明' },
  { no: 3, title: '5% の線：大量保有報告書', kind: 'fact', effect: { stake: 3, cash: -25 }, headline: '{team} が {name} 株の 5% 超を保有と報告' },
  { no: 4, title: '非公開の対話', kind: 'feeling', effect: {}, headline: '{driver} と {name} 経営陣が非公開で面談、「率直な対話」' },
  { no: 5, title: '公開書簡', kind: 'feeling', effect: { fame: 2 }, headline: '{team}、{name} に公開書簡「余剰資金を株主へ」' },
  { no: 6, title: 'メディア取材', kind: 'rumour', effect: { fame: 3 }, headline: '関係者によると {team} は {name} の取締役の入れ替えを狙う' },
  { no: 7, title: '経営陣の反論', kind: 'feeling', effect: { fame: -1 }, headline: '{name} 社長「短期的な要求には応じない」' },
  { no: 8, title: '他のファンドが同調', kind: 'rumour', effect: { stake: 1 }, headline: '別のファンドも {name} 株を買い増しか' },
  { no: 9, title: '株主提案', kind: 'fact', effect: {}, headline: '{team} が {name} に増配と社外取締役 2 名を株主提案' },
  { no: 10, title: '委任状争奪戦', kind: 'feeling', effect: { cash: -30 }, headline: '{name} の委任状争奪戦、{driver} が個人株主に直接訴え' },
  { no: 11, title: '議決権行使助言会社の推奨', kind: 'fact', effect: { seats: 1 }, headline: '助言会社、{team} 提案の候補 1 名に賛成を推奨' },
  { no: 12, title: 'ホワイトナイト', kind: 'rumour', effect: { stake: -1 }, headline: '{name} に友好的な買い手が現れるとの観測' },
  { no: 13, title: '和解交渉', kind: 'feeling', effect: { seats: 1 }, headline: '{team} と {name}、取締役 1 名の受け入れで歩み寄り' },
  { no: 14, title: '取締役の席', kind: 'fact', effect: { seats: 1 }, headline: '{name} 取締役会に {team} 推薦の社外取締役' },
  { no: 15, title: '株主総会', kind: 'feeling', effect: { fame: 2 }, headline: '{name} 総会、{driver} の質問に会場がざわめく' },
  { no: 16, title: '自社株買い・増配', kind: 'fact', effect: { cash: 40 }, headline: '{name}、過去最大の自社株買いと増配を発表' },
  { no: 17, title: '次の銘柄へ視野をまわす', kind: 'rumour', effect: {}, headline: '{team} の次の標的は {name} か — 市場で観測' },
  { no: 18, title: '振り返り（git log）', kind: 'feeling', effect: { fame: 1 }, headline: '{driver}「この一年をコミットごとに振り返る」' },
  { no: 19, title: '決着', kind: 'fact', effect: {}, headline: '{team} の {name} キャンペーンが決着' },
];

export type Traits = { patience: number; boldness: number; charm: number };
export type Car = { team: Team; number: number; pos: number; stake: number; seats: number; cash: number; fame: number; traits: Traits; target: string; done: boolean };
export type News = { turn: number; square: number; team: string; text: string; kind: Filter; mentions: string[] };
export type State = {
  turn: number; cars: Car[]; staged: { team: string; steps: number; msg: string }[]; log: { turn: number; hash: string; msg: string }[];
  news: News[]; bones: { fact: string[]; rumour: string[]; feeling: string[] }[]; romance: number; seed: number; drama: string[];
};

export function rng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const shortHash = (s: string) => { let h = 2166136261; for (const ch of s) { h ^= ch.codePointAt(0) ?? 0; h = Math.imul(h, 16777619); } return (h >>> 0).toString(16).padStart(8, '0').slice(0, 7); };

export function newGame(seed = 7): State {
  const ranked = [...COMPANIES].sort((a, b) => targetScore(b) - targetScore(a));
  return {
    turn: 1, staged: [], log: [], news: [], romance: 0.3, seed, drama: ['ナギ（₿）とルカ（$）は、同じタクシー会社の元同僚。いまは別のチームの運転手。'],
    bones: SQUARES.map(() => ({ fact: [], rumour: [], feeling: [] })),
    cars: TEAMS.map((team, i) => ({ team, number: [17, 22, 7, 3][i], pos: 0, stake: 0, seats: 0, cash: 100, fame: 0, traits: { patience: 0.5, boldness: 0.5, charm: 0.5 }, target: ranked[i % ranked.length].ticker, done: false })),
  };
}

const fill = (tpl: string, car: Car) => { const c = COMPANIES.find((x) => x.ticker === car.target) as Company; return tpl.replace(/{team}/g, `チーム${car.team.logo}`).replace(/{driver}/g, car.team.driver).replace(/{name}/g, c.name).replace(/{ticker}/g, c.ticker); };
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/** Land a car on a square: apply the effect, write the news, run it through the 3 filters into the bone. */
function land(s: State, car: Car) {
  const sq = SQUARES[car.pos - 1]; const e = sq.effect;
  car.stake = Math.max(0, car.stake + (e.stake ?? 0)); car.seats += e.seats ?? 0; car.cash += e.cash ?? 0; car.fame += e.fame ?? 0;
  if (sq.no === 17) { const others = COMPANIES.filter((c) => c.ticker !== car.target).sort((a, b) => targetScore(b) - targetScore(a)); car.target = others[0].ticker; }
  const text = fill(sq.headline, car);
  s.news.unshift({ turn: s.turn, square: sq.no, team: car.team.id, text, kind: sq.kind, mentions: [car.team.logo, car.team.driver] });
  s.bones[sq.no - 1][sq.kind].push(text);
  const t = car.traits; const d = 0.08;
  if (sq.kind === 'fact') t.patience = clamp01(t.patience + d); if (sq.kind === 'rumour') t.boldness = clamp01(t.boldness + d); if (sq.kind === 'feeling') t.charm = clamp01(t.charm + d);
  if (sq.no === 19) car.done = true;
}

export type Output = { lines: string[]; state: State };
/** A car piece moves 1–4 squares (a d4), so a campaign takes about ten turns and visits most bones. */
export const DIE = 4;

/** Plan a CPU move: bolder drivers roll more aggressively (higher of two dice). */
function cpuSteps(car: Car, r: () => number) { const a = 1 + Math.floor(r() * DIE); const b = 1 + Math.floor(r() * DIE); return car.traits.boldness > 0.6 ? Math.max(a, b) : car.traits.patience > 0.6 ? Math.min(a, b) : a; }

/** git push: every staged move (the player's and the CPUs') lands at the same time. */
export function push(s0: State): Output {
  const s: State = structuredClone(s0); const r = rng(s.seed * 1000 + s.turn); const lines: string[] = [];
  const moves = new Map<string, { steps: number; msg: string }>();
  for (const st of s.staged) moves.set(st.team, { steps: st.steps, msg: st.msg });
  for (const car of s.cars) if (!car.done && !moves.has(car.team.id) && car.team.id !== 'btc') moves.set(car.team.id, { steps: cpuSteps(car, r), msg: `${car.team.driver} の一手` });
  const dest = new Map<string, number>(); for (const car of s.cars) { const m = moves.get(car.team.id); if (m && !car.done) dest.set(car.team.id, Math.min(19, car.pos + m.steps)); }
  const byDest = new Map<number, string[]>(); for (const [id, d] of dest) byDest.set(d, [...(byDest.get(d) ?? []), id]);
  const conflicted = new Set<string>(); for (const [d, ids] of byDest) if (ids.length > 1 && d < 19) ids.forEach((id) => conflicted.add(id));
  for (const car of s.cars) {
    const d = dest.get(car.team.id); if (d === undefined) continue; const m = moves.get(car.team.id) as { steps: number; msg: string };
    if (conflicted.has(car.team.id)) { lines.push(`! [rejected] チーム${car.team.logo} → マス ${d}（merge conflict：同じマスに 2 台）`); continue; }
    car.pos = d; land(s, car); const hash = shortHash(`${s.turn}${car.team.id}${d}${m.msg}`);
    s.log.unshift({ turn: s.turn, hash, msg: `[${car.team.logo}#${car.number}] ${m.msg} → ${d}/19 ${SQUARES[d - 1].title}` });
    lines.push(`   ${hash}  チーム${car.team.logo} → ${d}/19 ${SQUARES[d - 1].title}`);
  }
  // Drama: the two old colleagues (only when one of them moved this turn).
  const nagi = s.cars[0]; const luka = s.cars[1];
  if (!dest.has('btc') && !dest.has('usd')) { /* both parked: no scene */ } else if (conflicted.has('btc') && conflicted.has('usd')) { s.romance = clamp01(s.romance - 0.1); s.drama.unshift('同じマスでぶつかったナギとルカ。「またあなた？」— 目をそらしたのはどちらが先だったか。'); }
  else if (Math.abs(nagi.pos - luka.pos) <= 1 && nagi.pos > 0) { s.romance = clamp01(s.romance + 0.12); s.drama.unshift(`マス ${nagi.pos} と ${luka.pos}。隣り合わせに停めたタクシーの窓越しに、ルカが缶コーヒーを差し出した。`); }
  else if (SQUARES[Math.max(0, nagi.pos - 1)].kind === 'feeling' && nagi.pos > 0) { s.drama.unshift(`${SQUARES[nagi.pos - 1].title}のあと、ナギはルカのチームのニュースを検索してしまう。`); }
  if (s.drama.length > 1 && s.drama[0] === s.drama[1]) s.drama.shift(); // the same scene twice in a row reads as a glitch
  s.staged = []; s.turn += 1;
  return { lines: [`To board.git`, ...lines, `   ターン ${s.turn - 1} を push しました`], state: s };
}

/** Ego search: news that mentions a team, counted by filter. */
export function egoSearch(s: State, query: string) {
  const hits = s.news.filter((n) => n.mentions.some((m) => query.includes(m)) || n.text.includes(query));
  return { hits, fact: hits.filter((h) => h.kind === 'fact').length, rumour: hits.filter((h) => h.kind === 'rumour').length, feeling: hits.filter((h) => h.kind === 'feeling').length };
}

/** Simulated advisers (rule-based, not the real products). */
export function advise(who: 'gemini' | 'claude', s: State, question: string): string[] {
  const me = s.cars[0]; const c = COMPANIES.find((x) => x.ticker === me.target) as Company; const next = SQUARES[Math.min(18, me.pos)];
  if (who === 'gemini') return [
    `仮想Gemini（シミュレーション）: ${c.name} は PBR ${c.pbr} 倍、現金比率 ${(c.cashRatio * 100).toFixed(0)}%。標的としての点数 ${(targetScore(c) * 100).toFixed(0)}。`,
    `仮想Gemini: 次は「${next.title}」。大きく出目を狙う手もあります — 大胆さ ${me.traits.boldness.toFixed(2)}。`,
  ];
  return [
    `仮想Claude（シミュレーション）: 「${question || '…'}」について。いま分かっている事実は ${s.bones.reduce((a, b) => a + b.fact.length, 0)} 件、噂は ${s.bones.reduce((a, b) => a + b.rumour.length, 0)} 件です。噂だけで動くのは避けたいところです。`,
    me.pos < 10 ? `仮想Claude: 現金は ${me.cash}。委任状争奪戦（マス 10）は 30 かかります。そこまでに何を確かめたいですか？` : `仮想Claude: 現金は ${me.cash}、席は ${me.seats}。決着（マス 19）までに、どの事実をもう一度確かめますか？`,
  ];
}

const HELP = [
  'roll                 サイコロを振って、手をステージする（git commit 相当）',
  'git commit -m "…"    メッセージ付きでサイコロを振ってステージ',
  'git push             全員の手を同時に盤へ（同じマスは merge conflict）',
  'git log              これまでのコミット',
  'egosearch <語>       ニュースの中の自分（例：egosearch ₿）',
  'ask gemini|claude …  仮想アドバイザー（シミュレーション）',
  'bones <n>            骨格 n/19 に回収されたテキスト（3 つのフィルター別）',
  'status               各車の位置・持ち株・席・性格',
  'help',
];

/** Run one line of the player's .sh-style command. */
export function run(s0: State, line: string): Output {
  const s: State = structuredClone(s0); const cmd = line.trim(); const me = s.cars[0]; const r = rng(s.seed * 7919 + s.turn * 31 + s.staged.length);
  if (!cmd) return { lines: [], state: s };
  if (cmd === 'help') return { lines: HELP, state: s };
  if (cmd === 'roll' || cmd.startsWith('git commit')) {
    if (me.done) return { lines: ['このキャンペーンは決着済みです'], state: s };
    if (s.staged.some((x) => x.team === 'btc')) return { lines: ['このターンはもうコミット済み — git push で盤へ'], state: s };
    const msg = cmd.match(/-m\s+["“](.+?)["”]/)?.[1] ?? 'roll'; const steps = 1 + Math.floor(r() * DIE);
    s.staged.push({ team: 'btc', steps, msg });
    return { lines: [`[turn-${s.turn} ${shortHash(msg + steps)}] ${msg}`, ` 出目 ${steps} → マス ${Math.min(19, me.pos + steps)}（${SQUARES[Math.min(19, me.pos + steps) - 1].title}）をステージ`], state: s };
  }
  if (cmd === 'git push') { if (!s.staged.length && !me.done) return { lines: ['ステージされた手がありません（roll か git commit）'], state: s }; return push(s); }
  if (cmd === 'git log') return { lines: s.log.slice(0, 12).map((l) => `${l.hash}  (t${l.turn}) ${l.msg}`), state: s };
  if (cmd.startsWith('egosearch')) { const q = cmd.slice(9).trim() || '₿'; const e = egoSearch(s, q); return { lines: [`"${q}" の記事 ${e.hits.length} 件 — 事実 ${e.fact} · 噂 ${e.rumour} · 感情 ${e.feeling}`, ...e.hits.slice(0, 5).map((h) => `  t${h.turn} [${h.kind}] ${h.text}`)], state: s }; }
  const ask = cmd.match(/^ask\s+(gemini|claude)\s*(.*)$/i); if (ask) return { lines: advise(ask[1].toLowerCase() as 'gemini' | 'claude', s, ask[2].replace(/^["“]|["”]$/g, '')), state: s };
  const bones = cmd.match(/^bones\s+(\d+)/); if (bones) { const n = Math.max(1, Math.min(19, Number(bones[1]))); const b = s.bones[n - 1]; return { lines: [`骨格 ${n}/19 ${SQUARES[n - 1].title}`, `  事実: ${b.fact.length} 件`, ...b.fact.slice(0, 2).map((x) => `    ${x}`), `  噂: ${b.rumour.length} 件`, ...b.rumour.slice(0, 2).map((x) => `    ${x}`), `  感情: ${b.feeling.length} 件`, ...b.feeling.slice(0, 2).map((x) => `    ${x}`)], state: s }; }
  if (cmd === 'status') return { lines: s.cars.map((c) => `${c.team.logo}#${c.number} ${c.team.driver} マス ${c.pos}/19 · ${c.target} 持ち株 ${c.stake}% · 席 ${c.seats} · 現金 ${c.cash} · 忍耐 ${c.traits.patience.toFixed(2)} 大胆 ${c.traits.boldness.toFixed(2)} 魅力 ${c.traits.charm.toFixed(2)}`), state: s };
  return { lines: [`command not found: ${cmd.split(/\s+/)[0]}（help で一覧）`], state: s };
}

/** Final score: seats count most, then stake, cash and fame. */
export const score = (c: Car) => c.seats * 100 + c.stake * 10 + c.cash + c.fame * 5;
