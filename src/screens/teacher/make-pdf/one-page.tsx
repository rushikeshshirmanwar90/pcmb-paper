import { useRef, useState } from 'react';
import { View } from 'react-native';
import { Button, Notice, Segmented } from '@/components/kit';
import { confirmAction } from '@/components/confirm-action';
import { DropdownSelect } from '@/components/dropdown-select';
import { verifyBankQuestions } from '@/services/pdf-questions';
import { bankBody, CLASSES, COMPETITIVE_EXAMS, COURSES, subjectsOf, withClass, withCourse, withExam, type BankScope, type Course } from './bank-scope';
import type { PdfKind } from './model';
import { StepLayout } from './ui';
import { SubjectSelector } from '@/screens/teacher/question-selection/subject-selector';
import { selectedQuestions, selectionProblem, type SubjectSelection } from '@/screens/teacher/question-selection/model';
import type { Question } from '@/types/pcmb';

/** Setup remains in the existing PDF flow; each subject uses the shared browser. */
export function OnePageSelect({ kind, onKind, scope, onScope, sessions, onSessions, count, onContinue, bottomInset }: {
  kind: PdfKind; onKind: (kind: PdfKind) => void;
  scope: BankScope; onScope: (scope: BankScope) => void;
  sessions: SubjectSelection[]; onSessions: (sessions: SubjectSelection[]) => void;
  count: number; onContinue: (questions: Question[]) => void; bottomInset: number;
}) {
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const busy = useRef(false);
  const ready = !!scope.course && !!scope.standard && (scope.course !== 'Competitive' || !!scope.exam);
  const change = (next: BankScope) => {
    const apply = () => { onScope(next); onSessions([]); setError(null); };
    if (selectedQuestions(sessions).length) confirmAction('Change academic scope?', 'This clears questions selected for the previous course, class or exam.', 'Change scope', apply);
    else apply();
  };
  const generate = async () => {
    if (busy.current) return;
    const problem = selectionProblem(sessions);
    if (problem) return setError(problem);
    busy.current = true; setWorking(true); setError(null);
    try {
      // Verify membership without browsing filters: changing filters never deletes picks.
      const checked = await Promise.all(sessions.filter(s => s.questions.length).map(async s => {
        const result = await verifyBankQuestions(bankBody({ ...s.scope, source: 'regular', sources: ['regular'], chapters: [], topics: [], years: [], search: '' }), s.questions.map(q => q._id));
        if (result.dropped) throw new Error(`${s.subject}: some questions are no longer available. Review and remove or replace them.`);
        return result.questions;
      }));
      onContinue(checked.flat());
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not verify questions. Try again.'); }
    finally { busy.current = false; setWorking(false); }
  };
  return <StepLayout inset={bottomInset} footer={<Button label="Continue to PDF Settings" loading={working} disabled={working} onPress={() => void generate()} />}>
    <View style={{ gap: 14 }}>
      <Segmented options={[{ value: 'exam' as const, label: 'Exam PDF' }, { value: 'smart' as const, label: 'Smart PDF' }]} value={kind} onChange={onKind} />
      <DropdownSelect label="Course" options={[...COURSES]} selected={scope.course} onSelect={course => change(withCourse(scope, course as Course))} />
      {scope.course ? <DropdownSelect label="Class" options={[...CLASSES[scope.course]]} selected={scope.standard} onSelect={standard => change(withClass(scope, standard))} /> : null}
      {scope.course === 'Competitive' ? <DropdownSelect label="Exam" options={[...COMPETITIVE_EXAMS]} selected={scope.exam} onSelect={exam => change(withExam(scope, exam as 'JEE' | 'NEET'))} /> : null}
      {ready ? <SubjectSelector sessions={sessions} onChange={onSessions} subjects={subjectsOf(scope)} base={scope} total={count} label="Select Subjects" searchable /> : null}
      {error ? <Notice tone="danger" text={error} /> : null}
    </View>
  </StepLayout>;
}
