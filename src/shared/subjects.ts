// A test's or paper's subjects, from the one text the server keeps for them
// ("Physics, Chemistry" for a multi-subject test). Pure, unit-tested.

/** "Physics, Chemistry" / "Physics + Chemistry" / "Physics & Chemistry" → ["Physics", "Chemistry"], in order, no repeats. */
export function subjectsOf(text: string | null | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of (text ?? '').split(/\s*[,+&/|]\s*/)) {
    const name = part.trim();
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

/** The chips to show (at most `max`) and how many more there are. */
export function chipsFor(subjects: string[], max = 3): { shown: string[]; more: number } {
  return { shown: subjects.slice(0, max), more: Math.max(0, subjects.length - max) };
}

/** What a screen reader says: "Subjects: Physics and Chemistry". */
export function subjectsLabel(subjects: string[]): string {
  if (!subjects.length) return 'No subject';
  if (subjects.length === 1) return `Subject: ${subjects[0]}`;
  return `Subjects: ${subjects.slice(0, -1).join(', ')} and ${subjects[subjects.length - 1]}`;
}
