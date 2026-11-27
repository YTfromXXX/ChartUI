// Text → scene in one step. A keyword table turns a scenario's title and description into a
// scene spec (world, time of day, interior or exterior, props, the main subject). There is no
// network and no model in the loop, so the picture appears within a single frame.

import type { World } from '@/lib/relayFlight';

export type Prop =
  | 'mosque' | 'palace' | 'bazaar' | 'sea' | 'desert' | 'desk' | 'lamp' | 'carpet' | 'book'
  | 'teatable' | 'clock' | 'rabbit' | 'cat' | 'cards' | 'crown' | 'forest' | 'mushroom' | 'tunnel' | 'door' | 'hat' | 'sword';
export type Time = 'night' | 'dusk' | 'day';
export type SceneSpec = { world: World; time: Time; interior: boolean; props: Prop[]; subject: Prop; seed: number };

const TABLE: [RegExp, Prop][] = [
  [/モスク|清真寺|ミナレット|ドーム/, 'mosque'],
  [/宮殿|スルタン|玉座|ハレム/, 'palace'],
  [/バザール|市場|商人|香辛料|キャラバン/, 'bazaar'],
  [/海|ボスポラス|港|船/, 'sea'],
  [/砂漠|オアシス|砂/, 'desert'],
  [/工房|細密画|筆|インク|設計図|写本|帳簿/, 'desk'],
  [/ランプ|灯|蝋燭/, 'lamp'],
  [/絨毯|祈り/, 'carpet'],
  [/本|書物|書|法典|クルアーン/, 'book'],
  [/お茶会|紅茶|ティー|カップ|ポット|タルト/, 'teatable'],
  [/時計|時間/, 'clock'],
  [/ウサギ|うさぎ|兎/, 'rabbit'],
  [/猫|チェシャ/, 'cat'],
  [/トランプ|兵|カード/, 'cards'],
  [/女王|王冠|王様|王/, 'crown'],
  [/森|木/, 'forest'],
  [/キノコ|芋虫/, 'mushroom'],
  [/穴|落下|落ち/, 'tunnel'],
  [/扉|鍵|小瓶/, 'door'],
  [/帽子/, 'hat'],
  [/剣|戦|兵士/, 'sword'],
];
const INTERIOR = /工房|部屋|広間|お茶会|室|法廷|宮殿の中|書斎|テーブル|祈りの絨毯/;
const SUBJECT_ORDER: Prop[] = ['cat', 'rabbit', 'teatable', 'clock', 'crown', 'hat', 'lamp', 'mosque', 'book', 'sword', 'mushroom', 'door', 'palace', 'bazaar', 'desk', 'carpet', 'cards', 'forest', 'tunnel', 'sea', 'desert'];
export const SUBJECT_LABEL: Record<Prop, string> = {
  cat: 'cat', rabbit: 'rabbit', teatable: 'teacup', clock: 'clock', crown: 'crown', hat: 'hat', lamp: 'lamp', mosque: 'mosque', book: 'book', sword: 'sword',
  mushroom: 'mushroom', door: 'door', palace: 'palace', bazaar: 'lantern', desk: 'lamp', carpet: 'carpet', cards: 'card', forest: 'tree', tunnel: 'tunnel', sea: 'moon', desert: 'dune',
};

const hash = (s: string) => { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0; return h; };

export function sceneSpec(text: string, world: World): SceneSpec {
  let props = TABLE.filter(([re]) => re.test(text)).map(([, p]) => p);
  // Every scene gets something to look at in its own world.
  if (!props.length) props = world === 'ottoman' ? ['mosque', 'lamp'] : ['teatable', 'clock'];
  if (world === 'ottoman' && !props.some((p) => ['mosque', 'palace', 'bazaar', 'sea', 'desert', 'desk'].includes(p))) props.push('mosque');
  if (world === 'wonderland' && !props.some((p) => ['teatable', 'forest', 'tunnel', 'mushroom', 'cards'].includes(p))) props.push('forest');
  const time: Time = /夜|月|星|闇|深夜/.test(text) ? 'night' : /夕|黄昏|日没/.test(text) ? 'dusk' : world === 'ottoman' ? 'dusk' : 'day';
  const interior = INTERIOR.test(text) || props.includes('desk') || props.includes('teatable');
  const subject = SUBJECT_ORDER.find((p) => props.includes(p)) ?? props[0];
  return { world, time, interior, props: [...new Set(props)].slice(0, 6), subject, seed: hash(text) };
}
