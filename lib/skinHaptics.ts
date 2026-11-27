// PowerPoint B — the three skin items connected to haptic output (API-B).
//
// Each skin item's analysis becomes part of one vibration pattern, weighted by the API-B split
// [2:4:6:7] (lib/cureSplit): #20 化粧水 → amplitude (its sensitivity), #21 毛髪 → a light pulse
// train (antenna-like passive vibration), #22 砂時計 → the period of the whole pattern.
// Output goes to the Web Vibration API (phones) and, when a gamepad is connected, its dual-rumble
// actuator. Both are optional browser features; the waveform preview always works.

import { MUSEUM } from '@/LAB/colorcube/museum';
import { CURE_SPLIT, SPLIT_TOTAL } from '@/lib/cureSplit';

export type HapticSegment = { on: number; off: number; strength: number; source: string };

export function skinPattern(): { segments: HapticSegment[]; periodMs: number; mapping: { kit: string; value: string; becomes: string }[] } {
  const skin = MUSEUM.filter((r) => r.wing === '内部棟');
  const [lotion, hair, hourglass] = skin;
  const sensitivity = 1 - lotion.oxidation;
  const hairPulses = 2 + Math.round((1 - hair.oxidation) * 4);
  const periodMs = Math.round(900 + hourglass.oxidation * 1400);
  // API-B split weights each part's share of the period.
  const weights = CURE_SPLIT.map((p) => p.layer / SPLIT_TOTAL);
  const segments: HapticSegment[] = [];
  // relax (2): one long soft press.
  segments.push({ on: Math.round(periodMs * weights[0]), off: 60, strength: 0.35 * sensitivity, source: CURE_SPLIT[0].title });
  // drift (4): the hair's pulse train.
  const train = Math.round((periodMs * weights[1]) / hairPulses);
  for (let i = 0; i < hairPulses; i += 1) segments.push({ on: Math.round(train * 0.45), off: Math.round(train * 0.55), strength: 0.5 * sensitivity, source: CURE_SPLIT[1].title });
  // counter (6): a firm counter-press.
  segments.push({ on: Math.round(periodMs * weights[2] * 0.6), off: Math.round(periodMs * weights[2] * 0.4), strength: 0.85 * sensitivity, source: CURE_SPLIT[2].title });
  // oracle loop (7): fading taps back to API-A.
  for (let i = 0; i < 3; i += 1) segments.push({ on: Math.round(periodMs * weights[3] * 0.12), off: Math.round(periodMs * weights[3] * 0.2), strength: (0.7 - i * 0.2) * sensitivity, source: CURE_SPLIT[3].title });
  return {
    segments,
    periodMs,
    mapping: [
      { kit: `#${lotion.kit.id} ${lotion.kit.name}`, value: `感度 ${sensitivity.toFixed(2)}`, becomes: '振動の強さ（全体のゲイン）' },
      { kit: `#${hair.kit.id} ${hair.kit.name}`, value: `パルス ${hairPulses} 回`, becomes: 'ズレ知覚の帯の細かい連打' },
      { kit: `#${hourglass.kit.id} ${hourglass.kit.name}`, value: `周期 ${periodMs} ms`, becomes: 'パターン全体の長さ（呼吸の周期）' },
    ],
  };
}

/** Web Vibration API pattern: [on, off, on, off, …] in ms (it has no strength, so weak parts are shortened). */
export function vibrationPattern(segments: HapticSegment[]): number[] {
  return segments.flatMap((s) => [Math.max(10, Math.round(s.on * (0.4 + 0.6 * s.strength))), s.off]);
}

/** Play on the phone and/or a connected gamepad. Returns what was used. */
export async function playHaptics(segments: HapticSegment[]): Promise<string[]> {
  const used: string[] = [];
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function' && navigator.vibrate(vibrationPattern(segments))) used.push('Vibration API');
  const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
  for (const pad of pads) {
    const act = (pad as (Gamepad & { vibrationActuator?: { playEffect?: (type: string, p: object) => Promise<unknown> } }) | null)?.vibrationActuator;
    if (!act?.playEffect) continue;
    let delay = 0;
    for (const s of segments) {
      void act.playEffect('dual-rumble', { startDelay: delay, duration: s.on, strongMagnitude: s.strength, weakMagnitude: s.strength * 0.6 });
      delay += s.on + s.off;
    }
    used.push(`Gamepad: ${pad!.id}`);
  }
  return used;
}
