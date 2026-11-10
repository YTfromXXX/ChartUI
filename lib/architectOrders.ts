// Inside the orders (教団内部) — "architect structure" with adjustable manual points.
//
// Four communities, each turned into clothing, rooms and furniture, plus image-generation
// prompts. A is the Pythagorean school (historical reconstruction). B–D are design languages
// treated as fictional orders: they describe an aesthetic or an ethos and never depict, or name
// in the prompt, a real person (B: fluid parametric architecture, C: grunge-meets-luxury
// fashion atelier, D: an AI-safety research community).
// The TODAY event picks an order and a GALAXY from the date; the manual points reshape the
// floor plan and are written into the prompts.

import { moonPhase } from '@/lib/moonSneaker';

export type OrderKey = 'A' | 'B' | 'C' | 'D';

export type ArchitectParams = {
  /** Long side ÷ short side of the plan and the table. */
  ratio: number;
  /** n-fold symmetry of the plan (0 = none). */
  symmetry: number;
  /** Skylight altitude in degrees. */
  skylight: number;
  /** Radius of the listening / lecture space, metres. */
  acoustic: number;
  /** 0 = straight lines and right angles … 1 = continuous curves. */
  curvature: number;
};

export type Order = {
  key: OrderKey;
  name: string;
  basis: string;
  clothing: string[];
  rooms: string[];
  furniture: string[];
  defaults: ArchitectParams;
  /** Historical or framing notes. */
  notes: string[];
  scene1: (p: ArchitectParams) => string;
  scene2: (p: ArchitectParams) => string;
};

const fmt = (p: ArchitectParams) => `${p.ratio.toFixed(3)}:1 proportions, ${p.symmetry ? `${p.symmetry}-fold symmetry` : 'asymmetric flow'}, skylight at ${Math.round(p.skylight)} degrees, ${p.acoustic.toFixed(1)} m acoustic radius`;

export const ORDERS: readonly Order[] = [
  {
    key: 'A',
    name: 'ピタゴラス教団（ピタゴラス派）',
    basis: '古代ギリシア（前 6〜5 世紀、クロトン）の考古学的知見と古代の伝記資料に基づく再構成',
    clothing: [
      '純白の亜麻布（リネン）のキトン、その上にヒマティオン。華美な染色は避ける',
      '美は幾何学的な織りパターンと、比率を感じさせる規則正しい襞（ドレープ）で表す',
      '足元は素足、または植物性素材（パピルス・木皮）で編んだ簡素なサンダル',
    ],
    rooms: [
      '正方形・黄金比の長方形・正円を基準にした対称性の高い平面',
      '音楽による魂の治療（弦の比率の響き）のため、反響を抑えつつ音が通る円形／半円形の講義室',
      '装飾を排した白い漆喰の壁に、計算された天窓から一筋の光が幾何学的な影を落とす',
    ],
    furniture: [
      '椅子：曲線のクリスモスより、背もたれのない 4 本脚のディフロス（予測）。脚の断面は正方形または円柱、動物脚の彫刻はなし',
      '机：数式を砂に書き写し、モノコード（一弦琴）を置く簡素な長方形のトラペザ。天板の縦横比は 1:√2 または黄金比',
    ],
    defaults: { ratio: 1.618, symmetry: 4, skylight: 60, acoustic: 4.5, curvature: 0.1 },
    notes: [
      '羊毛を避けリネンを着たという伝承は、アプレイウス（『弁明』56）やヘロドトス（2.81、ウールでの埋葬の禁忌）などに見える一方、ディオゲネス・ラエルティオス（8.19）は寝具に白い羊毛を用いたと書く。資料により揺れがある',
      '「トーガ」はローマの衣服。ギリシアならキトンとヒマティオン',
      '教団内の区分は「アクースマティコイ（聴聞派）」と「マテーマティコイ（学問派）」。家具の好みは資料のない予測',
    ],
    scene1: (p) => `A high-resolution, historically grounded cinematic shot of a 6th-century BC Pythagorean school interior in Croton. Architecture structured on sacred geometry, ${fmt(p)}. Minimalist white stucco walls with sharp linear shadows cast by a single high skylight. In the center, a plain rectangular wooden table (trapeza) with precise mathematical proportions and no carvings; beside it a geometric four-legged stool (diphros) with straight square-cut legs. A philosopher stands near the table in a crisp pure white linen chiton with a himation draped in orderly, evenly spaced folds, no jewelry, simple woven plant-fibre sandals. On the table an ancient monochord and a wax tablet with the tetractys drawn in dots. Serene, contemplative atmosphere, soft natural light, volumetric dust motes, photorealistic, 8k.`,
    scene2: (p) => `Ultra-detailed macro shot of ancient Greek furniture reconstructed from Pythagorean ideals: a minimalist dark oak trapeza table and a matching four-legged diphros stool against a sun-drenched white stone wall. Straight geometric lines, right angles, no animal or decorative carvings; ${fmt(p)}. A faint geometric calculation incised in the wood grain. Sunlight at ${Math.round(p.skylight)} degrees throws bold geometric shadows on a polished stone floor; raw linen cloth draped on the seat. Archaeological reconstruction, hyper-realistic textures, 35mm lens, photorealistic.`,
  },
  {
    key: 'B',
    name: '流体のパラメトリック教団',
    basis: '脱構築から流体へ向かう現代建築の造形言語（実在の建築家個人は描かない）',
    clothing: [
      '縫い目のない白いテクニカルファブリック。体の動きの流線に沿ったプリーツが連続する',
      '色は白とオフホワイト、光沢の差だけで層をつくる',
      '足元は一枚の曲面から成形した継ぎ目のないシューズ',
    ],
    rooms: [
      '直角を持たない連続曲面。床が壁へ、壁が天井へ折り返す',
      '講義室は貝殻のように内側へ巻き込む曲面で、音を中心へ集める',
      '光は曲面に沿って走るスリットから入り、影も曲線になる',
    ],
    furniture: [
      '椅子：床から立ち上がる一枚の曲面がそのまま座面になる、脚のないベンチ',
      '机：片持ちで宙に伸びるモノリシックな天板。縁は薄く、根元は厚い',
    ],
    defaults: { ratio: 2.4, symmetry: 0, skylight: 35, acoustic: 7, curvature: 0.95 },
    notes: ['人物の肖像や名前はプロンプトに入れず、造形の特徴だけで記述する'],
    scene1: (p) => `A cinematic interior of a fictional contemplative order housed in fluid parametric architecture: continuous white surfaces where floor folds into wall and ceiling, no right angles, ${fmt(p)}. Light enters through long curving slits, casting curved shadows. Members wear seamless white technical fabric with flowing pleats that follow body movement. A sculpted bench rises out of the floor; a cantilevered monolithic table floats nearby. Calm, futuristic, gallery-like, soft global illumination, photorealistic, 8k.`,
    scene2: (p) => `Product-style close-up of furniture grown from one continuous surface: a legless bench rising from a glossy white floor and a cantilevered table with a razor-thin edge thickening toward its root, ${fmt(p)}. Smooth solid-surface material, subtle reflections, curved shadow lines from a slit skylight. Minimal, sculptural, photorealistic, 50mm lens.`,
  },
  {
    key: 'C',
    name: 'グランジ・ラグジュアリーの服飾教団',
    basis: '1990 年代以降のグランジと高級服の混成、ポップな遊び心という服飾の造形言語（実在のデザイナー個人は描かない）',
    clothing: [
      '重ね着が教義：チェック柄、色落ちしたニット、仕立ての良いコートを同時に着る',
      'オーバーサイズとミニマルの対比。高価な素材と古着の混在',
      '足元は厚底のブーツ、またはわざと崩したレザーシューズ',
    ],
    rooms: [
      '長いランウェイが部屋の背骨。両側に生地の棚とトルソー',
      'むき出しのコンクリートに、巨大なポップアートのオブジェがひとつ',
      '光は舞台照明のように一方向から強く、残りは影に沈む',
    ],
    furniture: [
      '椅子：古いアームチェアを派手な色で張り替えた、座る人を選ぶオブジェ',
      '机：裁断用の長い作業台。天板には型紙と布の切れ端が散らばる',
    ],
    defaults: { ratio: 3.2, symmetry: 2, skylight: 20, acoustic: 3, curvature: 0.35 },
    notes: ['人物の肖像やブランドのロゴは入れず、服と空間の特徴だけで記述する'],
    scene1: (p) => `A cinematic interior of a fictional fashion order in a raw concrete atelier: a long runway as the spine of the room, rolling racks and dress forms on both sides, one oversized pop-art sculpture, ${fmt(p)}. Members in layered grunge-meets-luxury looks: plaid shirts, faded knits and impeccably tailored coats worn together, oversized against minimal, chunky boots. Hard directional stage light, deep shadows, editorial photography, film grain, 8k.`,
    scene2: (p) => `Close-up of an atelier still life: a long cutting table scattered with paper patterns, chalk and fabric offcuts, beside a vintage armchair reupholstered in a loud saturated color, ${fmt(p)}. Raw concrete wall, single hard light from the side, editorial product photography, 35mm, photorealistic.`,
  },
  {
    key: 'D',
    name: 'AI 安全研究の共同体',
    basis: '慎重さ・透明性・内部の解釈可能性を重んじる研究の倫理（実在の人物は描かない）',
    clothing: [
      '落ち着いた無地の普段着。ロゴも制服もない',
      '長い議論に耐える柔らかい素材、温かい中間色',
      '足元は静かに歩ける柔らかい靴',
    ],
    rooms: [
      'ガラスの壁で区切られた小部屋が中央の図書室を囲む（透明性）',
      '壁一面のホワイトボードに、ネットワークの内部を描いた回路図のような図',
      '自然光が多く、静かで、議論の声が通る程度の残響',
    ],
    furniture: [
      '椅子：長時間座っても疲れない、簡素な木と布の椅子',
      '机：大勢で囲む長い共有テーブル。端に紙のノートと付箋',
    ],
    defaults: { ratio: 1.414, symmetry: 8, skylight: 50, acoustic: 5, curvature: 0.25 },
    notes: ['特定の企業や人物の肖像・ロゴは入れず、研究文化の空気だけを描く'],
    scene1: (p) => `A calm, sunlit interior of a fictional AI-safety research community: small glass-walled rooms arranged around a central library, ${fmt(p)}. Whiteboards covered with careful circuit-like diagrams of neural network internals, sticky notes, printed papers. People in plain, unbranded, comfortable clothing in warm neutral tones discuss quietly around a long shared wooden table. Natural light, plants, transparent and thoughtful mood, documentary photography, photorealistic, 8k.`,
    scene2: (p) => `Close-up of a long shared wooden table in a research library: open paper notebooks, a printed paper with hand-drawn annotations, coffee cups, a simple wood-and-fabric chair pulled up, ${fmt(p)}. Soft daylight through glass walls, shallow depth of field, documentary style, 35mm, photorealistic.`,
  },
];

export const orderOf = (key: OrderKey) => ORDERS.find((o) => o.key === key)!;

/** TODAY event: the date picks the order and the day's GALAXY (arms from the day, twist from the moon). */
export function todayEvent(date = new Date()) {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const day = Math.floor((date.getTime() - start) / 86_400_000);
  const { illumination, age } = moonPhase(date);
  return {
    date: date.toISOString().slice(0, 10),
    day,
    order: (['A', 'B', 'C', 'D'] as const)[day % 4],
    galaxy: { arms: 1 + (day % 4), twist: 0.4 + illumination * 1.2, moonAge: age },
  };
}

type Pt = [number, number];

/** Floor plan (in a 300 × 200 frame) for an order under the given manual points. */
export function floorPlan(key: OrderKey, p: ArchitectParams): { outline: string; features: { d: string; label?: string; href?: string }[] } {
  const W = 300; const H = 200; const cx = W / 2; const cy = H / 2;
  const h = Math.min(170, 280 / p.ratio); const w = Math.min(280, h * p.ratio);
  // A rectangle whose corners round off with the curvature.
  const r = Math.min(w, h) / 2 * p.curvature;
  const rect = (x: number, y: number, ww: number, hh: number, rr: number) => `M${x + rr},${y} H${x + ww - rr} Q${x + ww},${y} ${x + ww},${y + rr} V${y + hh - rr} Q${x + ww},${y + hh} ${x + ww - rr},${y + hh} H${x + rr} Q${x},${y + hh} ${x},${y + hh - rr} V${y + rr} Q${x},${y} ${x + rr},${y} Z`;
  const outline = rect(cx - w / 2, cy - h / 2, w, h, r);
  const circle = (x: number, y: number, rr: number) => `M${x - rr},${y} a${rr},${rr} 0 1,0 ${rr * 2},0 a${rr},${rr} 0 1,0 ${-rr * 2},0`;
  const ar = Math.min(h / 2 - 6, p.acoustic * 7);
  const features: { d: string; label?: string; href?: string }[] = [];
  const spiralStair = (x: number, y: number, rr: number, turns = 2.5) => {
    const pts: string[] = [];
    for (let i = 0; i <= 60; i += 1) { const t = i / 60; const a = t * Math.PI * 2 * turns; const r2 = rr * (0.25 + 0.75 * t); pts.push(`${(x + Math.cos(a) * r2).toFixed(1)},${(y + Math.sin(a) * r2).toFixed(1)}`); }
    return `M${pts.join(' L')}`;
  };
  if (key === 'A') {
    features.push({ d: circle(cx + w / 2 - ar - 8, cy, ar), label: '講義室' });
    features.push({ d: rect(cx - w / 2 + 14, cy - 14, 28 * p.ratio, 28, 0), label: 'トラペザ' });
  } else if (key === 'B') {
    const pts: Pt[] = Array.from({ length: 7 }, (_, i) => [cx - w / 2 + 20 + (i * (w - 40)) / 6, cy + Math.sin(i * 1.3) * h * 0.25 * p.curvature]);
    features.push({ d: `M${pts.map((q) => q.join(',')).join(' T')}`, label: '連続曲面のベンチ' });
    features.push({ d: circle(cx + w * 0.2, cy - h * 0.15, ar * 0.8), label: '巻き込む講義室' });
  } else if (key === 'C') {
    features.push({ d: rect(cx - w / 2 + 10, cy - 8, w - 20, 16, 4 * p.curvature), label: 'ランウェイ' });
    features.push({ d: circle(cx - w * 0.05, cy - h * 0.28, 12), label: 'ポップ彫刻' });
    features.push({ d: rect(cx + w * 0.1, cy + h * 0.18, w * 0.3, 18, 2), label: '裁断台' });
    // Spiral staircases on both sides of the runway: up to the library and the museum.
    features.push({ d: spiralStair(cx - w / 2 + 26, cy - 30, 15), label: '螺旋階段 → 図書館', href: '/lab/library' });
    features.push({ d: spiralStair(cx + w / 2 - 26, cy + 30, 15), label: '螺旋階段 → 博物館（GALAXY）', href: '/lab/colorcube?event=GALAXY' });
  } else {
    features.push({ d: circle(cx, cy, ar), label: '中央図書室' });
    const n = Math.max(4, p.symmetry || 6);
    for (let i = 0; i < n; i += 1) {
      const a = (i / n) * Math.PI * 2; const x = cx + Math.cos(a) * (ar + 24); const y = cy + Math.sin(a) * Math.min(h / 2 - 14, ar + 18);
      features.push({ d: rect(x - 10, y - 8, 20, 16, 2) });
    }
  }
  // Symmetry axes.
  for (let i = 0; i < p.symmetry; i += 1) {
    const a = (i / p.symmetry) * Math.PI;
    features.push({ d: `M${cx - Math.cos(a) * w / 2},${cy - Math.sin(a) * h / 2} L${cx + Math.cos(a) * w / 2},${cy + Math.sin(a) * h / 2}` });
  }
  return { outline, features };
}
