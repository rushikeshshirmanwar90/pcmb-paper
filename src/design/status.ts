// The status words students see on cards (clarity rule 1: colour + word +
// icon, never colour alone). One table, so "Due today" looks the same on
// every screen. Calm: nothing here is alarm red. Pure, unit-tested.

export type StatusKind = 'live' | 'due' | 'new' | 'upcoming' | 'done' | 'missed' | 'locked';

/** A colour from the student look (tokens.ts NeoColors) that carries dark ink text. */
export type StatusTone = 'primary' | 'success' | 'violet' | 'successSoft' | 'dangerSoft' | 'subtle';

export interface StatusLook {
  word: string;
  tone: StatusTone;
  /** SF Symbol (iOS) and Material Symbol (Android) names. */
  icon: { ios: string; android: string };
}

export const STATUS: Record<StatusKind, StatusLook> = {
  live: { word: 'Live now', tone: 'success', icon: { ios: 'dot.radiowaves.left.and.right', android: 'sensors' } },
  due: { word: 'Due today', tone: 'primary', icon: { ios: 'clock', android: 'schedule' } },
  new: { word: 'New', tone: 'violet', icon: { ios: 'sparkles', android: 'auto_awesome' } },
  upcoming: { word: 'Upcoming', tone: 'subtle', icon: { ios: 'calendar', android: 'calendar_month' } },
  done: { word: 'Done', tone: 'successSoft', icon: { ios: 'checkmark.circle', android: 'check_circle' } },
  missed: { word: 'Missed', tone: 'dangerSoft', icon: { ios: 'calendar.badge.exclamationmark', android: 'event_busy' } },
  locked: { word: 'Locked', tone: 'subtle', icon: { ios: 'lock', android: 'lock' } },
};

/** The status as read out: "Due today" (or a custom word, e.g. "Due 5 PM"). */
export const statusWord = (kind: StatusKind, word?: string) => (word?.trim() ? word.trim() : STATUS[kind].word);
