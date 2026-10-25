// What a tuition teaches. Mirrors papers/src/lib/school.ts on the server.

export type Role = 'tuition' | 'teacher' | 'student';

/** NEET = Physics, Chemistry, Biology; JEE = Physics, Chemistry, Maths; General = all four. */
export const TRACKS = ['NEET', 'JEE', 'General'] as const;
export type Track = (typeof TRACKS)[number];

export const SCHOOL_SUBJECTS = ['Physics', 'Chemistry', 'Mathematics', 'Biology'] as const;
export type SchoolSubject = (typeof SCHOOL_SUBJECTS)[number];

export const SUBJECTS_BY_TRACK: Record<Track, SchoolSubject[]> = {
  NEET: ['Physics', 'Chemistry', 'Biology'],
  JEE: ['Physics', 'Chemistry', 'Mathematics'],
  General: ['Physics', 'Chemistry', 'Mathematics', 'Biology'],
};

export const SCHOOL_STANDARDS = ['11th', '12th'] as const;
export type SchoolStandard = (typeof SCHOOL_STANDARDS)[number];

export const TRACK_LABELS: Record<Track, string> = {
  NEET: 'NEET',
  JEE: 'JEE',
  General: 'General (PCMB)',
};

export const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
