import { useState } from 'react';
import { Button, Notice } from '@/components/kit';
import { EMPTY_BANK_SCOPE } from '@/screens/teacher/make-pdf/bank-scope';
import { StepLayout } from '@/screens/teacher/make-pdf/ui';
import { SubjectSelector } from './subject-selector';
import { selectedQuestions, selectionProblem, type SubjectSelection } from './model';
import type { Question } from '@/types/pcmb';

/** Existing Test Management uses this adapter only for combined-subject tests. */
export function TestEditSelection({ questions, subjects, exam, standard, onChange, onNext }: {
  questions: Question[]; subjects: string[]; exam: 'JEE' | 'NEET'; standard: string;
  onChange: (questions: Question[]) => void; onNext: () => void;
}) {
  const base = { ...EMPTY_BANK_SCOPE, course: 'Competitive' as const, exam, standard };
  const [sessions, setSessions] = useState<SubjectSelection[]>(() => subjects.map(subject => {
    const picked = questions.filter(q => q.subject === subject || subject === 'Biology' && ['Botany', 'Zoology'].includes(q.subject));
    return { subject, target: picked.length, scope: { ...base, subject }, questions: picked };
  }));
  const [error, setError] = useState<string | null>(null);
  return <StepLayout inset={0} footer={<Button label="Next: marking and timing" onPress={() => {
    const issue = selectionProblem(sessions);
    if (issue) setError(issue); else onNext();
  }} />}>
    <SubjectSelector base={base} subjects={subjects} sessions={sessions} onChange={next => {
      setSessions(next); onChange(selectedQuestions(next)); setError(null);
    }} />
    {error ? <Notice tone="danger" text={error} /> : null}
  </StepLayout>;
}
