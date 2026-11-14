import { useRef, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { Button, Muted, Notice } from '@/components/kit';
import { confirmAction } from '@/components/confirm-action';
import { DropdownSelect } from '@/components/dropdown-select';
import { verifyBankQuestions } from '@/services/pdf-questions';
import { bankBody, CLASSES, COMPETITIVE_EXAMS, COURSES, subjectsOf, withClass, withCourse, withExam, type BankScope, type Course } from './bank-scope';
import type { PdfKind } from './model';
import { ChoiceCard, Group, StepLayout } from './ui';
import { SubjectSelector } from '@/screens/teacher/question-selection/subject-selector';
import { keepEdits } from '@/screens/teacher/question-selection/question-edit';
import { selectedQuestions, selectionProblem, type SubjectSelection } from '@/screens/teacher/question-selection/model';
import type { Question } from '@/types/pcmb';

// Make a paper, steps 1 to 3 of 4, each with one job: the class, then the
// questions (the shared subject browser), then what to make of them (an exam
// paper or classroom slides, each saying what it is). Step 4, the details, is
// exam-settings.tsx or the slides' own settings.

/** What each kind of paper is, in a teacher's words. */
export const KIND_INFO: Record<PdfKind, { title: string; text: string }> = {
  exam: { title: 'Exam paper', text: 'A question paper to print or share, with an answer key.' },
  smart: { title: 'Classroom slides', text: 'One question per slide, to show and solve in class.' },
};

/** Whether the class is fully chosen (course, class and, for Competitive, the exam). */
export const scopeReady = (scope: BankScope) => !!scope.course && !!scope.standard && (scope.course !== 'Competitive' || !!scope.exam);

/** Step 1: which class the paper is for. */
export function PaperClassStep({ scope, onScope, sessions, onSessions, onNext, bottomInset }: {
  scope: BankScope; onScope: (scope: BankScope) => void;
  sessions: SubjectSelection[]; onSessions: (sessions: SubjectSelection[]) => void;
  onNext: () => void; bottomInset: number;
}) {
  const ready = scopeReady(scope);
  const missing = !scope.course ? 'Choose a course to go on.' : !scope.standard ? 'Choose a class to go on.' : !ready ? 'Choose JEE or NEET to go on.' : null;
  const change = (next: BankScope) => {
    const apply = () => { onScope(next); onSessions([]); };
    if (selectedQuestions(sessions).length) confirmAction('Change the class?', 'This clears the questions you chose for the previous course, class or exam.', 'Change', apply);
    else apply();
  };
  return <StepLayout inset={bottomInset} footer={<>
    <Button label="Next: choose questions" disabled={!ready} onPress={onNext} />
    {missing ? <Muted>{missing}</Muted> : null}
  </>}>
    <Group title="Which class is it for?" hint="The questions come from this class's question bank.">
      <DropdownSelect label="Course" options={[...COURSES]} selected={scope.course} onSelect={course => change(withCourse(scope, course as Course))} />
      {scope.course ? <DropdownSelect label="Class" options={[...CLASSES[scope.course]]} selected={scope.standard} onSelect={standard => change(withClass(scope, standard))} /> : null}
      {scope.course === 'Competitive' ? <DropdownSelect label="Exam" options={[...COMPETITIVE_EXAMS]} selected={scope.exam} onSelect={exam => change(withExam(scope, exam as 'JEE' | 'NEET'))} /> : null}
    </Group>
  </StepLayout>;
}

/** Step 3: what to make of the questions. The summary of what was picked scrolls with the page. */
export function PaperFormatStep({ kind, onKind, summary, onNext, bottomInset }: {
  kind: PdfKind; onKind: (kind: PdfKind) => void;
  /** What was picked (subjects and counts), with its way back to change it. */
  summary: ReactNode;
  onNext: () => void; bottomInset: number;
}) {
  return <StepLayout inset={bottomInset} footer={<Button label={kind === 'smart' ? 'Next: slide settings' : 'Next: paper details'} onPress={onNext} />}>
    {summary}
    <Group title="What do you want to make?" hint="Both use the questions you chose.">
      <View accessibilityRole="radiogroup" style={{ gap: 10 }}>
        <ChoiceCard icon={{ ios: 'doc.text', android: 'description' }} title={KIND_INFO.exam.title} text={KIND_INFO.exam.text} selected={kind === 'exam'} onPress={() => onKind('exam')} />
        <ChoiceCard icon={{ ios: 'rectangle.on.rectangle', android: 'slideshow' }} title={KIND_INFO.smart.title} text={KIND_INFO.smart.text} selected={kind === 'smart'} onPress={() => onKind('smart')} />
      </View>
    </Group>
  </StepLayout>;
}

/** Step 2: the subjects and their questions, checked against the bank before going on. */
export function PaperQuestionsStep({ scope, sessions, onSessions, onContinue, bottomInset }: {
  scope: BankScope;
  sessions: SubjectSelection[]; onSessions: (sessions: SubjectSelection[]) => void;
  onContinue: (questions: Question[]) => void; bottomInset: number;
}) {
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const busy = useRef(false);
  const total = selectedQuestions(sessions).length;
  const next = async () => {
    if (busy.current) return;
    const problem = selectionProblem(sessions);
    if (problem) return setError(problem);
    busy.current = true; setWorking(true); setError(null);
    try {
      // Verify membership without browsing filters: changing filters never deletes picks.
      const checked = await Promise.all(sessions.filter(s => s.questions.length).map(async s => {
        const result = await verifyBankQuestions(bankBody({ ...s.scope, source: 'regular', sources: ['regular'], chapters: [], topics: [], years: [], levels: [], search: '' }), s.questions.map(q => q._id));
        if (result.dropped) throw new Error(`${s.subject}: some questions are no longer available. Review and remove or replace them.`);
        // The bank's copies, except where the teacher edited a question for this paper.
        return keepEdits(result.questions, s.questions);
      }));
      onContinue(checked.flat());
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not check the questions. Try again.'); }
    finally { busy.current = false; setWorking(false); }
  };
  return <StepLayout inset={bottomInset} footer={<>
    {error ? <Notice tone="danger" text={error} live /> : null}
    <Button label={total ? `Next · ${total} question${total === 1 ? '' : 's'}` : 'Next'} loading={working} disabled={working} onPress={() => void next()} />
  </>}>
    <Group title="Choose the questions" hint="Pick the subjects, then open each one to choose its questions.">
      <SubjectSelector sessions={sessions} onChange={next => { onSessions(next); setError(null); }} subjects={subjectsOf(scope)} base={scope} label="Select Subjects" searchable allowReplace={false} />
    </Group>
  </StepLayout>;
}
