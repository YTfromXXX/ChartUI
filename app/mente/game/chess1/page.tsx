'use client';

import ChalkRoomGame from '@/components/chess/ChalkRoomGame';
import { NEWS1 } from '@/lib/chessGame1';

/** Game 1, continued in the chalk room: finding the hotel stock, with synthetic symbols to drop on pieces and teams. */
export default function ChessGame1() {
  return <ChalkRoomGame gameNo={1} title="ホテルの銘柄を探せ — チョークの部屋で" news={NEWS1} prefer="ホテル" intro="合成の銘柄（右の無限スクロール）を、駒やチームにドラッグ＆ドロップすると、少しだけ影響する。テクニカルの合図と、駒の読み方（事実・噂・感情）がそろうかどうか。" />;
}
