// Subject sections of a test, for the exam runner. Derived from each question's
// existing `subject` field and the order the server sent: nothing is stored or
// sent anywhere. No React here, so it can be tested on its own
// (tests/exam-sections.test.mjs).

export interface ExamSection {
  key: string;
  label: string;
  /** Places in the questions array, in the order the server sent them. */
  positions: number[];
}

const NO_SUBJECT = 'General';

/** Subjects in order of first appearance; a question without a subject goes under "General". */
export function buildSections(questions: readonly { subject?: string | null }[]): ExamSection[] {
  const sections: ExamSection[] = [];
  const byKey = new Map<string, ExamSection>();
  questions.forEach((q, position) => {
    const label = (q.subject ?? '').trim() || NO_SUBJECT;
    const key = label.toLowerCase();
    let section = byKey.get(key);
    if (!section) {
      section = { key, label, positions: [] };
      byKey.set(key, section);
      sections.push(section);
    }
    section.positions.push(position);
  });
  return sections;
}

/** The walking order: each subject's questions together. Equal to the server's order when subjects are already grouped. */
export const walkOrder = (sections: readonly ExamSection[]): number[] => sections.flatMap((s) => s.positions);

/** The place one step from `position` in the walking order, or null at either end. Crosses subjects freely. */
export function stepFrom(order: readonly number[], position: number, delta: 1 | -1): number | null {
  const at = order.indexOf(position);
  if (at < 0) return null;
  return order[at + delta] ?? null;
}

export const sectionOf = (sections: readonly ExamSection[], position: number): ExamSection | undefined => sections.find((s) => s.positions.includes(position));

/** Where tapping a subject lands: the last question visited there, else its first. */
export function landingFor(section: ExamSection, lastVisited: ReadonlyMap<string, number>): number {
  const last = lastVisited.get(section.key);
  return last !== undefined && section.positions.includes(last) ? last : section.positions[0];
}

export function answeredIn(section: ExamSection, isAnswered: (position: number) => boolean): number {
  return section.positions.filter(isAnswered).length;
}
