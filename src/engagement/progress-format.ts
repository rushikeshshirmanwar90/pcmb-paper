// Numbers and words for the progress header. Only shows what the server sent;
// nothing here computes XP, streaks or levels. Plain TypeScript, unit-tested.
import type { MeSnapshot } from './engagement-store';

/** Below this window width (dp), or from this text size up, the chips wrap: level goes on its own row. */
export const STACK_BELOW_WIDTH = 360;
export const STACK_FROM_FONT_SCALE = 1.3;

export const shouldStack = (width: number, fontScale: number) => width < STACK_BELOW_WIDTH || fontScale >= STACK_FROM_FONT_SCALE;

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0);

/** How full the goal ring is, 0–1 (full once the goal is met, even past it). */
export const goalFill = (today: MeSnapshot['today']) => (today.goalMet ? 1 : today.goal > 0 ? clamp01(today.xp / today.goal) : 0);

/** "60/100" */
export const goalText = (today: MeSnapshot['today']) => `${Math.max(0, today.xp)}/${today.goal}`;

/** The level bar, 0–1. */
export const levelFill = (xp: MeSnapshot['xp']) => clamp01(xp.progress);

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** The streak chip's caption. */
export const streakCaption = (streak: MeSnapshot['streak']) => (streak.current > 0 ? 'day streak' : 'No streak yet');

/** What a screen reader says for each chip. */
export function streakLabel(streak: MeSnapshot['streak']) {
  const freezes = streak.freezes > 0 ? `, ${plural(streak.freezes, 'streak freeze')} saved` : '';
  if (streak.current <= 0) return `No streak yet. Meet today's goal to start one${freezes}.`;
  return `${streak.current}-day streak${streak.securedToday ? ', today counted' : ''}${freezes}.`;
}

export function goalLabel(today: MeSnapshot['today']) {
  return today.goalMet ? `Today's goal done: ${today.xp} of ${today.goal} XP.` : `Today's goal: ${today.xp} of ${today.goal} XP.`;
}

export function levelLabel(xp: MeSnapshot['xp']) {
  return `Level ${xp.level}, ${xp.toNext} XP to level ${xp.level + 1}.`;
}

/** "140 XP to L4" */
export const levelCaption = (xp: MeSnapshot['xp']) => `${xp.toNext} XP to L${xp.level + 1}`;
