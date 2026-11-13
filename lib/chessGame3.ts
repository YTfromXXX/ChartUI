// Physical prompt chess, game 3: "the chalk room" (meta view).
// Each turn a plain, universal news item is taken apart into its parts (who / what / when / where /
// why / number), each part passing one of the three filters (fact / rumour / feeling). Short-video SNS
// posts about it are read by the staff, who try to do fundamental analysis from them.
// RULE: every move must come from a prompt sent from a DEVICE or a META VIEW (phone, terminal, radio,
// or one of the 22 Ariel cameras). Nothing moves by itself.
// Harmony: two different devices reading the same news without colliding adds harmony; a crash takes it away.
// All companies, people, posts and numbers are fictional; nothing has a price; no advice to buy or sell.
import type { Color } from '@/lib/promptChess';
import type { Theme } from '@/lib/syntheticSymbols';

export type Filter = '事実' | '噂' | '感情';
export type Device = { id: string; icon: string; name: string; meta?: boolean };
export const DEVICES: Device[] = [
  { id: 'phone', icon: '📱', name: 'スマホ（SNS）' },
  { id: 'terminal', icon: '🖥', name: 'ターミナル' },
  { id: 'radio', icon: '📻', name: '無線' },
  { id: 'ariel', icon: '👁', name: 'エーリアルのメタ視点', meta: true },
  { id: 'brain', icon: '🧠', name: 'XR ブレインインターフェース' },
];

export type Person = { id: string; name: string; role: string; attire: string; filter: Filter; act: string[] };
export const PEOPLE: Record<string, Person> = {
  W1: { id: 'W1', name: 'アナ', role: 'リサーチ', attire: '眼鏡を頭の上、紺のスーツ', filter: '事実', act: ['眼鏡を下ろして、年次報告書を一枚めくった', '数字に赤い鉛筆で小さな丸をつけた', '画面の再生数を、そっと手で隠した'] },
  W2: { id: 'W2', name: 'イシドロ', role: '法務', attire: '袖のボタンを外した紺のスーツ', filter: '事実', act: ['真鍮の天秤を、机の端に置き直した', '公開の手紙の下書きに、一行だけ足した', '届け出の日付を、指で二回なぞった'] },
  W3: { id: 'W3', name: 'ラモン', role: '運転手', attire: '白い手袋、社用車の鍵', filter: '噂', act: ['車の窓を少し開けて、港の噂を聞いた', '信号待ちのあいだに、短い動画を三本見た', 'ミラー越しに、後部座席の誰もいない席を見た'] },
  W4: { id: 'W4', name: '11 脚目の椅子', role: '長机の設備', attire: '黒い革。一脚だけ窓を向いている', filter: '感情', act: ['ほんの少しだけ、窓の方へ回った', '誰も座らないまま、きしんだ', '窓の外の朝の港を、ずっと向いていた'] },
  B1: { id: 'B1', name: 'ペルペトゥア', role: '庭師', attire: '作業着、胸ポケットに万年筆', filter: '感情', act: ['剪定ばさみを止めて、温室の葉を一枚なでた', '土の湿り気を、指で確かめた', '手入れされていない庭の写真を、じっと見た'] },
  B2: { id: 'B2', name: 'オスバルド', role: '建築家', attire: 'ゴム長靴、製図板', filter: '事実', act: ['製図板の上で、六角の線を一本引き直した', '建物の図面の、住む人の数を数えた', '窓の数を、図面と写真で見比べた'] },
  B3: { id: 'B3', name: 'ニエベス', role: '住人', attire: 'カーディガン、ハンモック', filter: '噂', act: ['ハンモックの上で、短い動画を逆さまに見た', '近所の人の投稿に、いいねを押しかけてやめた', '住んでいる人の声だけを、メモに書き写した'] },
  B4: { id: 'B4', name: 'チェロ', role: '番人', attire: '鍵束（指紋の鎖でできている）', filter: '事実', act: ['鍵束の鎖を、一つずつ確かめた', '投稿の日付が前の投稿を指しているか見た', '門の外の人の数を、静かに数えた'] },
};

export type Part = { label: string; text: string; filter: Filter };
export type Post = { handle: string; text: string; views: string; kind: Filter };
/** A scene shown with the news: mannequin still frames, ad-realism, or a switch from one to the other. */
export type Look = 'mannequin' | 'ad';
export type Frame = { pose: string; lines: [string, string][]; style?: Look };
export type Scene = { style: Look | 'switch'; frames: Frame[] };
export type News = { headline: string; parts: Part[]; posts: Post[]; harmony: string; theme?: Theme; scene?: Scene };
export const NEWS: News[] = [
  { headline: 'ある港町で、雨の日が十日続いた', theme: 'ホテル',
    parts: [{ label: '何が', text: '雨が十日続いた', filter: '事実' }, { label: 'どこで', text: 'ある港町', filter: '事実' }, { label: 'なぜ', text: '海の上の空気が、いつもより湿っている', filter: '噂' }, { label: 'どう感じる', text: '洗濯物が乾かない', filter: '感情' }],
    posts: [{ handle: '@port_umbrella', text: '傘が売り切れてた。港の店、全部。', views: '1.2万回', kind: '事実' }, { handle: '@hotel_breakfast_fan', text: '雨の日のホテルの朝食、窓際が埋まるの早い', views: '8,400回', kind: '噂' }, { handle: '@laundry_blues', text: '十日目。もう笑うしかない', views: '3.1万回', kind: '感情' }],
    harmony: '同じ雨を、傘の数で読む人と、朝食の席で読む人と、洗濯物で読む人がいる。' },
  { headline: '港の古い倉庫が一つ、売りに出た', theme: '港',
    parts: [{ label: '誰が', text: '古い倉庫の持ち主', filter: '事実' }, { label: '何を', text: '倉庫を売りに出した', filter: '事実' }, { label: 'なぜ', text: '後継ぎがいない、という話', filter: '噂' }, { label: 'どう感じる', text: '子どものころ遊んだ場所がなくなる', filter: '感情' }],
    posts: [{ handle: '@warehouse_walk', text: '倉庫の前、看板が立ってた。写真だけ撮った', views: '5,600回', kind: '事実' }, { handle: '@harbor_rumor', text: 'ホテルになるらしいよ（たぶん）', views: '2.4万回', kind: '噂' }, { handle: '@old_port_kid', text: 'ここで鬼ごっこした。さみしい', views: '9,900回', kind: '感情' }],
    harmony: '売りに出た倉庫を、看板として見る人、未来のホテルとして見る人、思い出として見る人。' },
  { headline: '短い動画で、あるホテルの朝食が話題になった', theme: '動画',
    parts: [{ label: '何が', text: 'ホテルの朝食の動画', filter: '事実' }, { label: 'どれだけ', text: '再生回数が三日で百万回', filter: '事実' }, { label: 'なぜ', text: '窓から見える島がきれいだから、らしい', filter: '噂' }, { label: 'どう感じる', text: '行ってみたい', filter: '感情' }],
    posts: [{ handle: '@noche_morning', text: '窓の外の島、ほんとにこの色だった', views: '100万回', kind: '感情' }, { handle: '@data_hotel', text: '動画は百万回。でも予約サイトの空室は変わってない', views: '4,200回', kind: '事実' }, { handle: '@island_rumor', text: '来月から値上げするって聞いた', views: '6.7万回', kind: '噂' }],
    harmony: '百万回の再生と、変わらない空室。注目は、まだ値段にも予約にもなっていない。' },
  { headline: '朝の電車の始発が、一本増えた', theme: '鉄道',
    parts: [{ label: '何が', text: '始発が一本増えた', filter: '事実' }, { label: 'いつ', text: '来月の一日から', filter: '事実' }, { label: 'なぜ', text: '工場の駅で降りる人が戻ってきたから、という話', filter: '噂' }, { label: 'どう感じる', text: '少し早く起きなきゃ', filter: '感情' }],
    posts: [{ handle: '@first_train', text: '始発、ほんとに増えてる。時刻表を撮った', views: '7,300回', kind: '事実' }, { handle: '@factory_station', text: '工場の駅、最近ちょっと混んでる気がする', views: '1.5万回', kind: '噂' }, { handle: '@sleepy_commuter', text: '早起きがつらい人、手を挙げて', views: '4.4万回', kind: '感情' }],
    harmony: '一本の電車を、時刻表で読む人、駅の混み具合で読む人、眠気で読む人。' },
  { headline: 'ある会社の社長が、交代した', theme: '準備の金庫',
    parts: [{ label: '誰が', text: '社長', filter: '事実' }, { label: '何を', text: '交代した', filter: '事実' }, { label: 'なぜ', text: '取締役会で意見が割れた、という噂', filter: '噂' }, { label: 'どう感じる', text: '新しい社長は、窓のある部屋で話すだろうか', filter: '感情' }],
    posts: [{ handle: '@filings_daily', text: '届け出、出てた。日付は昨日', views: '3,800回', kind: '事実' }, { handle: '@boardroom_whisper', text: '総会の前に、もう決まってたらしい', views: '5.2万回', kind: '噂' }, { handle: '@window_watcher', text: '前の社長、窓の外を一度も見なかったよね', views: '1.1万回', kind: '感情' }],
    harmony: '同じ交代を、届け出の日付で読む人と、総会の前の空気で読む人と、窓で読む人。' },
  { headline: '島の天気予報が、外れた', theme: '温室',
    parts: [{ label: '何が', text: '晴れの予報が、雨になった', filter: '事実' }, { label: 'どこで', text: '島', filter: '事実' }, { label: 'なぜ', text: '予報の機械が、古い紙のデータを読んでいた、という話', filter: '噂' }, { label: 'どう感じる', text: '外れた日のほうが、覚えている', filter: '感情' }],
    posts: [{ handle: '@island_weather', text: '予報：晴れ。実際：雨。記録として残す', views: '2,900回', kind: '事実' }, { handle: '@old_data', text: '予報の機械、古いチャートを読んでるらしい', views: '3.3万回', kind: '噂' }, { handle: '@rainy_memory', text: '外れた日の雨って、なんか忘れない', views: '2.2万回', kind: '感情' }],
    harmony: '外れた予報を、記録として残す人、機械を疑う人、思い出にする人。全部、同じ雨。' },
];

export const TURNS = NEWS.length;
/** Room labels chalked on the floors (x, y, floor) → name. */
export const ROOMS: { x: number; y: number; f: number; name: string }[] = [
  { x: 2, y: 0, f: 0, name: '長机' }, { x: 0, y: 2, f: 0, name: '受付' }, { x: 4, y: 2, f: 0, name: '窓（港）' },
  { x: 1, y: 2, f: 1, name: '帳簿の部屋' }, { x: 3, y: 2, f: 1, name: '動画の壁' }, { x: 2, y: 4, f: 1, name: '金庫室' },
  { x: 2, y: 2, f: 2, name: '温室の入口' }, { x: 0, y: 4, f: 2, name: '庭' }, { x: 4, y: 0, f: 2, name: '窓（島）' },
];
export const sideName = (c: Color) => (c === 'white' ? 'アクティブギャング' : 'サンクチュアリ');
