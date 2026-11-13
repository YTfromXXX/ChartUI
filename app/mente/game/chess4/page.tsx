'use client';

import ChalkRoomGame from '@/components/chess/ChalkRoomGame';
import { NEWS4 } from '@/lib/chessGame4';

/** Game 4: the meme-coin field — attention grows, value does not. */
export default function ChessGame4() {
  return <ChalkRoomGame gameNo={4} title="ミームコインの野 — 注目は値段ではない" news={NEWS4} prefer="ミーム" allowArchitect attention intro="架空のミームコインのニュースを解体する。PE 群の注目は増えるが、駒の強さも、銘柄の値打ちも変わらない。鎖（記録）を読む人が、いちばん冷静でいられる。" />;
}
