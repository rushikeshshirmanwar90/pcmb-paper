import type { Question } from '../../../types/pcmb';

/** Read the stored key only. Never infer an answer from the solution or option text. */
export function answerOf(question: Pick<Question, 'correctAnswer' | 'answerType' | 'optionA' | 'optionB' | 'optionC' | 'optionD' | 'optionDiagramUrls'>) {
  const raw = typeof question.correctAnswer === 'string' ? question.correctAnswer.trim() : '';
  const unavailable = { options: [] as string[], summary: 'Answer unavailable' };
  if (!raw || /^(?:n\/?a|unknown|unavailable|null|undefined|-)$/i.test(raw)) return unavailable;
  if (question.answerType === 'Numerical') return { options: [] as string[], summary: `Expected answer: ${raw}` };
  if (question.answerType && question.answerType !== 'MCQ') return unavailable;
  const key = raw.toUpperCase();
  if (!/^[ABCD](?:[\s,;/&+]*[ABCD])*$/.test(key)) return unavailable;
  const options = [...new Set((key.match(/[ABCD]/g) ?? []) as ('A' | 'B' | 'C' | 'D')[])];
  if (options.some(option => !question[`option${option}`]?.trim() && !question.optionDiagramUrls?.[option]?.length)) return unavailable;
  return { options, summary: `Correct: ${options.join(', ')}` };
}
