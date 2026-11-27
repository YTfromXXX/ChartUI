'use client';

import ChalkRoomGame from '@/components/chess/ChalkRoomGame';
import { NEWS } from '@/lib/chessGame3';

/** Game 3: the chalk room — SNS readings; join as the architect (drafting board) if you like. */
export default function ChessGame3() {
  return <ChalkRoomGame gameNo={3} title="チョークの部屋 — ニュースを解体して、調和を探す" news={NEWS} allowArchitect intro="短い動画の SNS から、ファンダメンタルを読み取ろうとする。建築家（製図板）として参加すると、駒が掴みにいく銘柄の選択案を確かめられる。" />;
}
