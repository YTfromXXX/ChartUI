// Mente-style nudge: when the player seems lost, a soft popup offers "アリミノボーイに聞く".
// Only what happens on this page is used (time on a choice, very fast picks, restarts,
// misses in a row). Nothing is stored or sent. At most one nudge every few beats.
export type NudgeEvent = { t: number; type: 'shown' | 'picked' | 'restart' | 'miss' | 'hit' };
export type NudgeReason = 'hesitating' | 'rushing' | 'restarting' | 'missing';

export const RULES = {
  hesitateMs: 45_000,   // looking at one choice for 45 s
  rushMs: 1_200,        // picked within 1.2 s of the choice appearing…
  rushRun: 3,           // …three times in a row
  restartWindowMs: 120_000, restarts: 2, // two restarts within two minutes
  missRun: 3,           // three misses in a row in a mini-game
  cooldownBeats: 5,     // no second nudge within 5 beats
};

export const REASON_TEXT: Record<NudgeReason, string> = {
  hesitating: 'ずっと同じところで考えているみたい。',
  rushing: 'すごい速さで進んでいるね。',
  restarting: '何度か最初からやり直したね。',
  missing: '少し、書き写しにくそうだね。',
};

/** Decide whether to nudge now. `beatsSinceLast` counts beats since the previous nudge. */
export function shouldNudge(events: NudgeEvent[], now: number, beatsSinceLast: number): NudgeReason | null {
  if (beatsSinceLast < RULES.cooldownBeats) return null;
  const last = events[events.length - 1];
  if (last?.type === 'shown' && now - last.t >= RULES.hesitateMs) return 'hesitating';
  const restarts = events.filter((e) => e.type === 'restart' && now - e.t <= RULES.restartWindowMs).length;
  if (restarts >= RULES.restarts) return 'restarting';
  let misses = 0; for (let i = events.length - 1; i >= 0 && events[i].type !== 'hit'; i -= 1) if (events[i].type === 'miss') misses += 1;
  if (misses >= RULES.missRun) return 'missing';
  let rush = 0;
  for (let i = events.length - 1; i > 0; i -= 1) {
    if (events[i].type !== 'picked') break;
    const shown = events[i - 1]; if (shown.type !== 'shown' || events[i].t - shown.t > RULES.rushMs) break;
    rush += 1; i -= 1;
  }
  if (rush >= RULES.rushRun) return 'rushing';
  return null;
}
