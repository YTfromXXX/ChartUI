// TSMonsterEngine — the Cure-API engine that surfaces the 『A or B』 text parameters.
//
// Pipeline: SensorySpiceKit (form -> sensory profile)
//        -> ChoiceForgeKit (spice -> wording of both sides)
//        -> GreenCardKit   (region rules, flash limit, fair-play check)
// SugorokuKit is used by the retro-grid board game.

import type { Pattern } from '@/lib/cureKit';
import type { OddField } from '@/lib/cureOrbit';
import { forgeChoice, type ForgedChoice } from './ChoiceForgeKit';
import { REGION_RULES, fairPlayCheck, regionFromLocale, regulateAnimation, type FairPlayReport, type Region, type Regulation } from './GreenCardKit';
import { senseSpice, type SensoryProfile } from './SensorySpiceKit';

export * as SensorySpiceKit from './SensorySpiceKit';
export * as GreenCardKit from './GreenCardKit';
export * as ChoiceForgeKit from './ChoiceForgeKit';
export * as SugorokuKit from './SugorokuKit';

export type MonsterInput = {
  pattern: Pattern;
  oddField: OddField | null;
  locale?: string;
  prefersReducedMotion?: boolean;
  /** Animation strobe of the surface the choice appears on. */
  strobeIntervalMs?: number;
};

export type MonsterOutput = {
  region: Region;
  sensory: SensoryProfile;
  choice: ForgedChoice;
  regulation: Regulation;
  notice: string;
  fairPlay: FairPlayReport;
};

export function runMonsterEngine(input: MonsterInput): MonsterOutput {
  const region = regionFromLocale(input.locale);
  const sensory = senseSpice({ pattern: input.pattern, tension: input.oddField?.tension, oddRatio: input.oddField?.oddRatio });
  const choice = forgeChoice(input.pattern, sensory.spice);
  const regulation = regulateAnimation({ region, strobeIntervalMs: input.strobeIntervalMs ?? 1000 / Math.max(0.05, sensory.pulseHz), prefersReducedMotion: input.prefersReducedMotion });
  const fairPlay = fairPlayCheck({ a: choice.a.text, b: choice.b.text, preselected: null, canDismiss: true, canChooseAgain: true });
  return { region, sensory, choice, regulation, notice: REGION_RULES[region].notice, fairPlay };
}
