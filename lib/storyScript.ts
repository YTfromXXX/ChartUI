// The 200-beat script, written in batches. Each beat is a question with 2 or 4 choices; every choice
// has its own answer. Some beats are quizzes that teach one true thing (correct answers build a combo).
// After each answer, BA-xxxx and PE-xxxx react in a stream-style chat (the presentation for gamers).
// Batch 1: the Garage Island prologue (P1–P8, not counted in the 200) and year 1 (beats 1–14).
// Rules: no real person speaks or appears; nothing here has a price; Stoic never smokes.

export type ChatLine = { who: string; text: string };
export type Choice = { label: string; reply: string[]; correct?: boolean; chat?: ChatLine[] };
export type Beat = {
  id: string; part: 'prologue' | 'y1'; no: number | null; place: string; speaker: string;
  text: string[]; q: string; choices: Choice[]; code?: string[]; fact?: string;
};

const BA = 'BA-80BF'; const BA2 = 'BA-52FF'; const PE = 'PE-05F0'; const PE2 = 'PE-4970';

export const SCRIPT: Beat[] = [
  // ---------- prologue: Garage Island (young Stoic, the poet) ----------
  { id: 'P1', part: 'prologue', no: null, place: 'ガレージアイランドの桟橋', speaker: 'アリミノガール（語り）',
    text: ['ずっと昔。ハニカムアイランドの隣に、ガレージアイランドという島があった。島の言葉は「自由」。', '一艘の小舟から、細い青年が降りてくる。若いストイックだ。'],
    q: '若いストイックは、このころ何をしていた？',
    choices: [
      { label: '詩人', correct: true, reply: ['そう、詩人だった。学者になるのは、ずっと後のこと。', '彼には一つ誓いがあった。自分の詩を売らない。名声と引き換えにしない。'], chat: [{ who: BA, text: '詩人ストイック、初耳' }, { who: PE, text: 'しじん！ しじん！' }] },
      { label: '学者', correct: false, reply: ['いいえ。学者になるのは、ずっと後。このころの彼は詩人だった。', '自分の詩を売らない、という誓いを守っていた。'], chat: [{ who: PE, text: 'まだ学者じゃないってｗ' }] },
    ] },
  { id: 'P2', part: 'prologue', no: null, place: 'ガレージランドの農園', speaker: 'アリミノガール（語り）',
    text: ['父が持つガレージランドには、「酔いどれ草」の農園が広がっていた。タバコのおどけた呼び名だ。', 'ストイックは葉には手を触れず、帳面だけを抱えて畑の道を歩いた。'],
    q: '農園で最初に出会ったのは？',
    choices: [
      { label: 'BA-80BF（サルの一匹）', reply: ['木の上から、機械のような声がした。「キミ、ダレ」', 'のちにリトルの連れになるサル達の、最初の一匹だった。'], chat: [{ who: BA, text: 'おれ、出演してる' }] },
      { label: 'PE-05F0（緑の小さな一団）', reply: ['足元を、緑の小さな一団が走り抜けた。「たから？ たから？」', 'ストイックは帳面をそっと胸に抱き直した。'], chat: [{ who: PE, text: 'たからじゃなかった' }] },
      { label: '農園の案内人', reply: ['帽子を目深にかぶった案内人が、にこにこと手を差し出した。', 'その笑顔が、この島で最初の騙し合いの始まりだった。'], chat: [{ who: BA2, text: 'その笑顔、あやしい' }] },
      { label: '誰もいない', reply: ['誰もいなかった。風だけが、葉を揺らしていた。', '……と思ったら、背中の帳面が少し軽くなっていた。'], chat: [{ who: PE2, text: 'だれか取った？' }, { who: BA, text: '犯人わかってる' }] },
    ] },
  { id: 'P3', part: 'prologue', no: null, place: '農園の小屋', speaker: '案内人',
    text: ['「この契約書に署名すれば、農園の帳簿は全部あなたのものだ」', '紙には、細かい字がびっしり並んでいた。'],
    q: '署名する？',
    choices: [
      { label: '署名しない', correct: true, reply: ['ストイックは首を振った。「読んでいない紙に、名前は書かない」', 'のちの彼が「署名が示すのは、その鍵で署名されたことだけ」と書く、その最初の一歩だった。'], chat: [{ who: BA, text: '賢い' }, { who: PE, text: 'よまずにかかない！' }] },
      { label: '署名する', correct: false, reply: ['ペンを取った瞬間、紙の端から別の一枚がのぞいた。帳簿ではなく、農園の借金の証文だった。', 'ストイックはペンを置いた。危ないところだった。'], chat: [{ who: BA2, text: 'あぶねえ' }, { who: PE2, text: 'うらに もういちまい' }] },
    ] },
  { id: 'P4', part: 'prologue', no: null, place: '農園の夜', speaker: 'アリミノガール（語り）',
    text: ['夜になると、農園の人々は焚き火を囲んで物語を語った。一夜に一つ、話の中にまた話がある。'],
    q: '今夜は、どの話を聞く？',
    choices: [
      { label: '海を渡った硬貨の話', reply: ['名前のない硬貨が、手から手へ渡るたびに、渡った記録だけが増えていく話。', '最後に誰の手にあるかより、どの手を通ったかが大事な話だった。'], chat: [{ who: BA, text: '伏線くさい' }] },
      { label: '空を回り続ける鳥の話', reply: ['一羽の鳥が、島の上を同じ輪で回り続ける。降りる場所を忘れてしまったから。', 'ストイックはその夜、眠れなかった。'], chat: [{ who: PE, text: 'それ旋回では' }] },
      { label: '数を数える番人の話', reply: ['番人は、夜ごとに星を数える。数え終わると朝が来る。', 'でも、どうしても最後の一つが数えられない。'], chat: [{ who: BA2, text: 'ストイックっぽい' }] },
      { label: '箱の中の部屋の話', reply: ['小さな箱を開けると、中に部屋がある。部屋の机の上に、また小さな箱がある。', '物語の中に物語がある、この夜そのものの話だった。'], chat: [{ who: PE2, text: 'はこのなかに へや' }] },
    ] },
  { id: 'P5', part: 'prologue', no: null, place: 'ガレージの作業台', speaker: 'アリミノガール（語り）',
    text: ['ガレージの奥に、古い計算機があった。ストイックは、詩の代わりに、初めてコードを書いてみた。'],
    code: ['// 旋回（はじめての版）', 'const center = island;', 'let angle = 0;', 'while (someoneIsCounting()) {', '  angle += step;', '  fly(center, radius, angle);', '}'],
    q: '「radius」の代わりに付けるなら、どの名前？',
    choices: [
      { label: 'distance', reply: ['「近づきもせず、離れもせず」。ストイックは distance と書いて、消して、また書いた。'], chat: [{ who: BA, text: '迷ってるの草' }, { who: PE, text: 'けして かいて' }] },
      { label: 'longing', reply: ['ストイックは longing と書いた。詩人のくせが、まだ指に残っていた。'], chat: [{ who: BA2, text: '詩人が出てる' }] },
      { label: 'orbit', reply: ['orbit。いちばん正確な名前だった。ストイックは少し誇らしげに、保存した。'], chat: [{ who: PE2, text: 'えらい' }] },
      { label: 'radius のまま', reply: ['名前を変えないのも、一つの決め方だった。radius のまま、保存。'], chat: [{ who: BA, text: '無難' }] },
    ] },
  { id: 'P6', part: 'prologue', no: null, place: 'ガレージの作業台', speaker: 'BA と PE たち',
    text: ['夜更け。コードが動かない。ストイックは頭を抱えた。', '作業台のまわりに、BA と PE たちが集まってきた。'],
    q: 'みんなで、どう励ます？',
    choices: [
      { label: '「いったん寝よう」', reply: ['翌朝、ストイックは一行目で、閉じかっこを一つ書き忘れていたのに気づいた。'], chat: [{ who: BA, text: 'あるある' }, { who: PE, text: 'かっこ だいじ' }] },
      { label: '「声に出して読んでみて」', reply: ['声に出して読むと、詩のように一行ずつ意味が立ち上がった。三行目で、ストイックは笑った。'], chat: [{ who: BA2, text: 'ラバーダック方式' }] },
      { label: '「ぼくらが数えるよ」', reply: ['someoneIsCounting() は、誰かが数えていないと false になる。BA と PE が声をそろえて数え始めると、コードは動き出した。'], chat: [{ who: PE2, text: 'いち に さん！' }, { who: BA, text: 'おれらが条件だった' }] },
      { label: '何も言わずに、お茶を置く', reply: ['湯気の向こうで、ストイックはしばらく黙ってから、またキーを打ち始めた。'], chat: [{ who: PE, text: 'やさしい' }] },
    ] },
  { id: 'P7', part: 'prologue', no: null, place: '農園の門', speaker: '案内人',
    text: ['「その計算機の決まり、島じゅうに売れるぞ。詩人さん、有名になれる」'],
    q: 'ストイックの答えは？',
    choices: [
      { label: '「売らない」', correct: true, reply: ['ストイックは帳面を閉じた。「詩も、決まりも、売らない。そういう誓いだ」', '案内人は肩をすくめ、門の向こうへ消えた。'], chat: [{ who: BA, text: 'ブレない' }, { who: PE, text: 'ちかい まもった' }] },
      { label: '「考えておく」', correct: false, reply: ['「考えておく」と言ったきり、ストイックは一晩じゅう考えた。', '朝、彼は案内人に一言だけ伝えた。「やっぱり、売らない」'], chat: [{ who: BA2, text: '結局売らないｗ' }] },
    ] },
  { id: 'P8', part: 'prologue', no: null, place: 'ガレージアイランドの桟橋', speaker: 'アリミノガール（語り）',
    text: ['ストイックは、旋回のコードを帳面に書き写して、島を去った。', 'その決まりが、のちに十二年も島の上を回り続けることを、まだ誰も知らなかった。'],
    q: '帳面のいちばん最後に、ストイックは何と書いた？',
    choices: [
      { label: '「数える者がいるかぎり」', reply: ['それが、決まりの条件であり、のちの穴になる言葉だった。'], chat: [{ who: BA, text: 'ここで本編へ' }] },
      { label: '「自由」', reply: ['島の言葉を、一つだけ持ち帰った。のちに彼は、その言葉が飛ぶほど重くなることを知る。'], chat: [{ who: PE, text: 'じゆう おもい' }] },
    ] },

  // ---------- year 1: the harbour (beats 1–14) ----------
  { id: 'Y1-01', part: 'y1', no: 1, place: '本土の港町', speaker: 'アリミノガール（語り）',
    text: ['追放から一年。本土の港町。ストイックの部屋の壁には、布をかけた紙が掛かっている。'],
    q: '最初に見るのは？',
    choices: [
      { label: '壁の布', reply: ['布の端が、少しだけ持ち上がっている。中に何か描いてある。'], chat: [{ who: BA, text: '気になる' }] },
      { label: '窓の外の港', reply: ['港では、アリミノボーイが手紙の束を数えていた。'], chat: [{ who: PE, text: 'てがみ いっぱい' }] },
    ] },
  { id: 'Y1-02', part: 'y1', no: 2, place: 'ストイックの部屋', speaker: 'ストイック',
    text: ['「見なくていい。ただの古い紙だ」'],
    q: 'どう返す？',
    choices: [
      { label: 'うなずく', reply: ['ストイックは布をまっすぐに直した。少しだけ、ほっとした顔をした。'], chat: [{ who: BA2, text: '大人の対応' }] },
      { label: '「何の線？」と聞く', reply: ['ストイックは答えなかった。代わりに、窓の外を見た。', 'その横顔は、何かを数えているようだった。'], chat: [{ who: PE2, text: 'むし された' }] },
    ] },
  { id: 'Y1-03', part: 'y1', no: 3, place: '港', speaker: 'アリミノガール（語り）',
    text: ['アリミノボーイは手紙を数えては、最初からやり直していた。父親とよく似た癖だった。'],
    q: '声をかける？',
    choices: [
      { label: '「手伝おうか」', reply: ['「ありがとう。でも、数えるのは一人じゃないと、ずれるんだ」', '彼はそう言って、また最初から数え始めた。'], chat: [{ who: BA, text: 'ずれるんだ…' }] },
      { label: '黙って隣に座る', reply: ['しばらくして、アリミノボーイは数えるのをやめて、海を見た。「島って、どのくらい遠いのかな」'], chat: [{ who: PE, text: 'いいふんいき' }] },
    ] },
  { id: 'Y1-04', part: 'y1', no: 4, place: '港の桟橋', speaker: 'アリミノボーイ',
    text: ['「島は、ここからどのくらい？」と聞くと、アリミノボーイは少し考えてから答えた。', '「たぶん {～} のあいだ。正確には分からないが——」'],
    q: '～に入るのは？',
    choices: [
      { label: 'a. 満ち潮と、次の満ち潮', reply: ['「島が近いのか遠いのか、潮しか知らない」'], chat: [{ who: BA, text: '詩的' }] },
      { label: 'b. 父さんが眠れなくなった夜と、その次の朝', reply: ['「あの夜から、父さんは壁の紙を見なくなった」'], chat: [{ who: PE2, text: 'おもい' }] },
      { label: 'c. 一通目の手紙と、二通目の手紙', reply: ['「二通目には、一通目の指紋を書き写すはずなんだ」'], chat: [{ who: BA2, text: 'ブロックチェーンの気配' }] },
      { label: 'd. リトルの飛行機が島を一周するのと、もう一周するの', reply: ['「誰も止め方を知らない。一周の長さだけは、毎回同じなんだ」'], chat: [{ who: PE, text: 'せんかい！' }] },
    ] },
  { id: 'Y1-05', part: 'y1', no: 5, place: '港の露店', speaker: 'アリミノボーイ',
    text: ['アリミノボーイは、露店でシアンの小瓶を並べていた。自分で作ったヘアスタイリング剤だという。'],
    q: '瓶を手に取って、どうする？',
    choices: [
      { label: '光にかざす', reply: ['シアンの中に、細かい泡が螺旋を描いて上っていった。「固める力が強いんだ。雲みたいな髪も、高いまま保てる」'], chat: [{ who: BA, text: 'ほしい' }] },
      { label: '香りをかぐ', reply: ['潮と、少しだけ柑橘の匂いがした。「アリミノガールの瓶はオレンジなんだ。あっちは、まとめる力」'], chat: [{ who: PE, text: 'おれんじも ほしい' }] },
    ] },
  { id: 'Y1-06', part: 'y1', no: 6, place: '港', speaker: 'アリミノガール（語り）',
    text: ['島から届いた最初の手紙は、とても短かった。'],
    q: '一通目に書いてあったのは？',
    fact: 'ビットコインのホワイトペーパー（2008）の 1 章は「はじめに」。物語の島でも、一通目は短い。',
    choices: [
      { label: '日付と、島の名前だけ', correct: true, reply: ['正解。日付と、島の名前だけ。差出人の名前はなかった。'], chat: [{ who: BA, text: '正解！' }, { who: PE, text: 'なまえ ない' }] },
      { label: '前の手紙の指紋', correct: false, reply: ['それは二通目から。一通目には、まだ前の手紙がない。'], chat: [{ who: BA2, text: '一通目に前はないｗ' }] },
      { label: '積んだ石の数', correct: false, reply: ['石を積むのは四年目から。一通目は、日付と島の名前だけ。'], chat: [{ who: PE2, text: 'まだ はやい' }] },
      { label: '何も書いていない', correct: false, reply: ['白紙に見えたけれど、隅に小さく日付と島の名前があった。'], chat: [{ who: BA, text: '見落とし' }] },
    ] },
  { id: 'Y1-07', part: 'y1', no: 7, place: '浜', speaker: 'アリミノガール（語り）',
    text: ['浜で、BA-80BF が流れ着いた瓶を抱えて走っていった。'],
    q: 'どうする？',
    choices: [
      { label: '追いかけて、返してもらう', reply: ['BA-80BF は瓶を返してくれた。「ナカミ、ヨメナイ。イラナイ」'], chat: [{ who: BA, text: '読めないから返した' }] },
      { label: '行き先を見張る', reply: ['BA-80BF は、岩の陰に瓶を一本ずつ並べていた。数えているようだった。'], chat: [{ who: PE, text: 'かぞえてる！' }, { who: BA2, text: 'みんな数えるじゃん' }] },
    ] },
  { id: 'Y1-08', part: 'y1', no: 8, place: 'ストイックの部屋・夜', speaker: 'アリミノガール（語り）',
    text: ['夜。ストイックは布の前で、小さな声で数えていた。一、二、三……。'],
    q: '数は、いくつで止まると思う？',
    choices: [
      { label: '3', reply: ['数は、いつも同じところで止まった。それがいくつなのかは、布の下にしか書いていない。'], chat: [{ who: BA, text: '答え教えて' }] },
      { label: '7', reply: ['数は、いつも同じところで止まった。七つの節を持つ誰かの髪が、ふと頭に浮かんだ。'], chat: [{ who: PE, text: 'ぽにーてーる？' }] },
      { label: '12', reply: ['数は、いつも同じところで止まった。十二という数は、この物語ではよく出てくる。'], chat: [{ who: BA2, text: '12 年、12 章' }] },
      { label: '22', reply: ['数は、いつも同じところで止まった。二十二。どこかで聞いた数だった。'], chat: [{ who: PE2, text: 'エーリアルのかず' }] },
    ] },
  { id: 'Y1-09', part: 'y1', no: 9, place: 'ストイックの部屋・夜', speaker: 'アリミノガール（語り）',
    text: ['ストイックが眠ったあと、布の端が、すきま風で揺れていた。'],
    q: '布を、そっとめくる？',
    choices: [
      { label: 'めくる', reply: ['ある一晩のチャートだった。はじめは穏やかで、途中から、線が下を向き始めていた。', '線はそこで途切れていた。ストイックが数えるのをやめたところで、線も止まっていた。'], chat: [{ who: BA, text: '見ちゃった' }, { who: PE, text: 'しーっ' }] },
      { label: 'めくらない', reply: ['布はそのまま。見ないでおくことも、一つの答えだった。', '十二年後に、全部が見える日が来る。'], chat: [{ who: BA2, text: '待つのも大事' }] },
    ] },
  { id: 'Y1-10', part: 'y1', no: 10, place: 'ストイックの部屋', speaker: 'アリミノガール（語り）',
    text: ['布の端から見えた線を、思い出してみる。'],
    q: 'その線は、どちらを向いていた？',
    fact: 'このアプリのチャートでは、下げは赤、上げは緑。物語の作りもののチャートも同じ決まり。',
    choices: [
      { label: '下', correct: true, reply: ['下だった。赤い線が、途中から下を向き始めていた。'], chat: [{ who: BA, text: '覚えてた' }] },
      { label: '上', correct: false, reply: ['上ではなかった。線は、途中から下を向き始めていた。'], chat: [{ who: PE2, text: 'したでした' }] },
    ] },
  { id: 'Y1-11', part: 'y1', no: 11, place: '港', speaker: 'アリミノガール（語り）',
    text: ['一年前、追放の小舟が出るとき、わたしはこっそり荷物を積んだ。'],
    q: '何を積んだと思う？',
    choices: [
      { label: '書物', correct: true, reply: ['書物。その中に、二冊の紙があった……いいえ、このときはまだ一冊だけ。', '去った書き手の紙。「サトシの書」と、みんなは呼んでいた。'], chat: [{ who: BA, text: '一冊目きた' }] },
      { label: '食べ物', correct: true, reply: ['食べ物も、積んだ。でも本当に大事だったのは、その下に入れた一冊の書物だった。'], chat: [{ who: PE, text: 'ごはん だいじ' }] },
      { label: '鍵', correct: false, reply: ['鍵は積まなかった。鍵は、島で自分で作るものだから。'], chat: [{ who: BA2, text: '鍵は自分で' }] },
      { label: '石', correct: false, reply: ['石は島にいくらでもある。積んだのは、書物と食べ物だった。'], chat: [{ who: PE2, text: 'いし いらない' }] },
    ] },
  { id: 'Y1-12', part: 'y1', no: 12, place: '島（語り）', speaker: 'アリミノガール（語り）',
    text: ['島でネフェリムは、一年に一章ずつ、その書物を読むことにした。'],
    q: '一年目に読んだ第一章の題は？',
    fact: 'ビットコインのホワイトペーパーは 12 の節：はじめに、取引、タイムスタンプサーバー、プルーフ・オブ・ワーク、ネットワーク、インセンティブ、ディスク容量の回収、簡易な支払い検証、価値の結合と分割、プライバシー、計算、結論。',
    choices: [
      { label: 'はじめに', correct: true, reply: ['正解。第一章は「はじめに」。十二章を十二年で読む旅が始まった。'], chat: [{ who: BA, text: '12 章 = 12 年' }, { who: PE, text: 'せいかい！' }] },
      { label: '取引', correct: false, reply: ['取引は第二章。二年目に読む。'], chat: [{ who: BA2, text: '来年な' }] },
      { label: '計算', correct: false, reply: ['計算は第十一章。ずっと先。'], chat: [{ who: PE2, text: 'とおい' }] },
      { label: '結論', correct: false, reply: ['結論は最後の第十二章。嵐の年に読む。'], chat: [{ who: BA, text: 'ネタバレ' }] },
    ] },
  { id: 'Y1-13', part: 'y1', no: 13, place: '港・夕方', speaker: 'アリミノボーイ',
    text: ['「父さんが数えるのには、理由があると思うんだ」'],
    q: 'その理由を予想するなら？',
    choices: [
      { label: '数えていないと、何かが止まってしまう', reply: ['「……それ、父さんの昔のコードに、似たようなことが書いてあった気がする」'], chat: [{ who: BA, text: 'プロローグ回収' }] },
      { label: '数えると、落ち着くから', reply: ['「そうかもしれない。ぼくも、手紙を数えると落ち着く」'], chat: [{ who: PE, text: 'おちつく' }] },
      { label: '数えるのをやめた夜があったから', reply: ['アリミノボーイは、しばらく黙った。「……布の下の、あの夜のことかな」'], chat: [{ who: BA2, text: '核心' }] },
      { label: '分からない', reply: ['「ぼくも分からない。でも、いつか聞いてみる」'], chat: [{ who: PE2, text: 'いつか きく' }] },
    ] },
  { id: 'Y1-14', part: 'y1', no: 14, place: '港・年の終わり', speaker: 'アリミノガール（語り）',
    text: ['一年目が終わる。二年目には、二通目の手紙を書く。一通目の指紋を書き写して。'],
    q: '二年目に持っていくものは？',
    choices: [
      { label: '一通目の指紋を写した紙', reply: ['四文字の、短い指紋。8 と B、0 と D。似た字に気をつけて。', '二年目のミニゲーム「指紋の書き写し」へ。'], chat: [{ who: BA, text: '次ミニゲームだ' }, { who: PE, text: 'がんばれ！' }] },
      { label: '新しいペン', reply: ['よく書けるペンは、書き写しの味方。', '二年目のミニゲーム「指紋の書き写し」へ。'], chat: [{ who: BA2, text: 'ペン大事' }] },
    ] },
];

export const WRITTEN_MAIN = SCRIPT.filter((b) => b.no !== null).length;
