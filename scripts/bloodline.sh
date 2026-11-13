#!/usr/bin/env bash
# The bloodline (a game script): the cypherpunk lineage flows down one vein, each line carrying the
# fingerprint (SHA-256) of the line before it — the idea of a chain, not Satoshi's code (that was C++).
# Then the quantum test: hashes hold (Grover halves the bits), signatures must move (Shor).
# Usage: bash scripts/bloodline.sh        (BLOODLINE_SLOW=1 for a gentle pace; NO_COLOR=1 for plain text)
set -euo pipefail

red=$'\e[31m'; dim=$'\e[2m'; off=$'\e[0m'
if [[ -n "${NO_COLOR:-}" || ! -t 1 ]]; then red=''; dim=''; off=''; fi
pace() { [[ -n "${BLOODLINE_SLOW:-}" ]] && sleep 0.6 || true; }
fp() { printf '%s' "$1" | sha256sum | cut -c1-8; }

vein=(
  "1976|公開鍵"
  "1982|ブラインド署名"
  "1985|楕円曲線"
  "1991|PGP"
  "1992|サイファーパンク"
  "1997|ハッシュキャッシュ"
  "1998|b-money と bit gold"
  "2004|RPOW"
  "2008|ホワイトペーパー"
  "2009|最初のブロック"
  "2013|Ethereum"
)

prev="00000000"
echo "${red}  ║${off}  血脈 — 一行ずつ、前の指紋を抱いて流れる"
for row in "${vein[@]}"; do
  year=${row%%|*}; name=${row#*|}
  now=$(fp "$prev|$year|$name")
  printf '%s  ╠══%s %s %s  %s← %s%s\n' "$red" "$off" "$year" "$name" "$dim" "$prev" "$off"
  printf '%s  ║%s        指紋 %s\n' "$red" "$off" "$now"
  prev=$now; pace
done

echo "${red}  ║${off}"
echo "${red}  ╠══${off} ⚛ 量子の試練"
echo "${red}  ║${off}     ハッシュ（SHA-256）: グローバーで 256 → 約 128 ビット。血は流れ続ける。"
echo "${red}  ║${off}     署名（楕円曲線）  : ショアで解ける（大きな量子計算機ができたら）。まだ、ない。"
echo "${red}  ║${off}     移り先            : ML-DSA・SLH-DSA（NIST 2024）。鎖への移り方は、まだ提案。"
pace
last=$(fp "$prev|2026|サンクチュアリ構想")
echo "${red}  ╚══${off} ◇ 2026 サンクチュアリ構想（ゲームの中の構想）  指紋 $last"
echo
echo "${dim}一行でも書き換えると、その下の指紋が全部変わる。それが鎖。${off}"
