// Which option rows a multiple-choice question shows. Display only: answering,
// saving and marking are unchanged.
//
// Every option up to the last one that has text or a figure is shown, so a
// gap in the data (A and C filled, B empty) still shows B, and True/False
// questions keep just A and B. With the answer revealed, the keyed option is
// shown even if its text is missing. A question with no option text at all
// shows A–D, so it can still be answered. Empty ones are marked `missing`.

export const OPTION_KEYS = ['A', 'B', 'C', 'D'] as const;
export type OptionKey = (typeof OPTION_KEYS)[number];

export const MISSING_OPTION_NOTE = 'Option text missing (your teacher will check this question)';

export interface OptionSource {
  optionA?: string;
  optionB?: string;
  optionC?: string;
  optionD?: string;
  optionDiagramUrls?: Partial<Record<OptionKey, string[]>>;
}

export function optionSlots(question: OptionSource, revealedKey?: string | null): { key: OptionKey; text: string; figures: string[]; missing: boolean }[] {
  const all = OPTION_KEYS.map((key) => {
    const text = question[`option${key}`] ?? '';
    const figures = question.optionDiagramUrls?.[key] ?? [];
    return { key, text, figures, missing: !text.trim() && !figures.length };
  });
  let last = -1;
  all.forEach((o, i) => {
    if (!o.missing) last = i;
  });
  const keyed = OPTION_KEYS.indexOf((revealedKey ?? '').trim().toUpperCase() as OptionKey);
  const end = last < 0 ? OPTION_KEYS.length - 1 : Math.max(last, keyed);
  return all.slice(0, end + 1);
}
