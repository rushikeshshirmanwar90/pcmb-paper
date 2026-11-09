import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { Button, ErrorView, LoadingView, Muted, Notice, usePalette } from '@/components/kit';
import { DropdownSelect } from '@/components/dropdown-select';
import { MultiSelectDropdown } from '@/components/multi-select-dropdown';
import { EXAM_IDS, EXAMS, isExamId } from '@/shared/exam-bank';
import { questionCount, scopeReady, withChapters, withExam, withSubject, type Scope } from '@/screens/teacher/make-pdf/model';
import { Group, StepLayout } from '@/screens/teacher/make-pdf/ui';
import type { ScopeLoad } from '@/screens/teacher/make-pdf/use-scope-options';

const EXAM_OPTIONS = [...EXAM_IDS] as string[];

/** What the chosen chapters hold: all of the subject's when none is picked. */
export function availableCount(load: ScopeLoad, scope: Scope): number {
  if (load.status !== 'ready') return 0;
  const { chapterCounts, ordered } = load.data;
  return (scope.chapters.length ? scope.chapters : ordered).reduce((sum, chapter) => sum + (chapterCounts[chapter] ?? 0), 0);
}

/**
 * Exam, subject, then chapters (and topics). Exam and subject are each exactly
 * one choice; chapters may be one or many (none means all of them). Changing
 * an earlier choice clears what no longer fits (model.ts).
 */
export function ScopeStep({
  scope,
  load,
  onScope,
  onNext,
  bottomInset,
}: {
  scope: Scope;
  load: ScopeLoad;
  onScope: (scope: Scope) => void;
  onNext: () => void;
  bottomInset: number;
}) {
  const palette = usePalette();
  const subjects = isExamId(scope.exam) ? [...EXAMS[scope.exam].subjects] : [];
  const data = load.status === 'ready' ? load.data : null;

  // Topics of the picked chapters (every chapter's when none is picked), each under its chapter.
  const topicSections = useMemo(() => {
    if (!data) return [];
    const chapters = scope.chapters.length ? scope.chapters : data.ordered;
    return chapters.map((title) => ({ title, options: data.chapterTopics[title] ?? [] })).filter((section) => section.options.length > 0);
  }, [data, scope.chapters]);
  const topicOptions = useMemo(() => [...new Set(topicSections.flatMap((section) => section.options))], [topicSections]);

  const total = availableCount(load, scope);
  const ready = scopeReady(scope) && load.status === 'ready' && total > 0;

  return (
    <StepLayout
      inset={bottomInset}
      footer={
        <>
          <Button label="Next: how to choose questions" icon={{ ios: 'arrow.right', android: 'arrow_forward' }} disabled={!ready} onPress={onNext} />
          {!ready ? (
            <Muted>{!scope.exam ? 'Choose an exam to continue.' : !scope.subject ? 'Choose a subject to continue.' : load.status === 'loading' ? 'Loading chapters…' : 'No questions to choose from yet.'}</Muted>
          ) : null}
        </>
      }
    >
        <Group title="Choose the questions" hint="Pick the exam, then its subject and chapters. Only that exam's questions are used.">
          <View>
            <DropdownSelect
              label="Exam"
              required
              options={EXAM_OPTIONS}
              selected={scope.exam}
              placeholder="Select exam"
              onSelect={(exam) => onScope(withExam(scope, exam, isExamId(exam) ? EXAMS[exam].subjects : []))}
              icon={{ ios: 'graduationcap', android: 'school', web: 'school' }}
            />
            <Muted>The question bank covers JEE and NEET. MHT-CET, HSC Science and other programs have no question bank yet.</Muted>
          </View>
          <DropdownSelect
            label="Subject"
            required
            options={subjects}
            selected={scope.subject}
            placeholder={scope.exam ? 'Select subject' : 'Select an exam first'}
            emptyText={scope.exam ? undefined : 'Choose an exam first'}
            onSelect={(subject) => onScope(withSubject(scope, subject))}
            icon={{ ios: 'atom', android: 'science', web: 'science' }}
          />
        </Group>

        {scopeReady(scope) ? (
          <Group title="Chapters" hint="Pick one or more. Leave it empty to use every chapter.">
            {load.status === 'loading' ? <LoadingView label="Loading this exam's chapters…" /> : null}
            {load.status === 'error' ? <ErrorView message={load.message} onRetry={load.reload} /> : null}
            {data ? (
              <>
                <MultiSelectDropdown
                  label="Chapters"
                  options={data.ordered}
                  counts={data.chapterCounts}
                  selected={scope.chapters}
                  onSelect={(chapters) => onScope(withChapters(scope, data.ordered.filter((name) => chapters.includes(name)), data.chapterTopics))}
                  placeholder="All chapters"
                  emptyText={`No ${EXAMS[scope.exam as keyof typeof EXAMS].label} ${scope.subject} questions yet`}
                  allWhenNone
                  searchable
                  icon={{ ios: 'book', android: 'menu_book', web: 'menu_book' }}
                />
                {topicOptions.length > 0 ? (
                  <MultiSelectDropdown
                    label="Topics"
                    options={topicOptions}
                    sections={topicSections}
                    counts={data.topicCounts}
                    selected={scope.topics}
                    onSelect={(topics) => onScope({ ...scope, topics: topicOptions.filter((topic) => topics.includes(topic)) })}
                    placeholder="All topics"
                    emptyText="No topics for these chapters"
                    allWhenNone
                    searchable
                    icon={{ ios: 'list.bullet', android: 'list', web: 'list' }}
                  />
                ) : null}
                {total > 0 ? (
                  <Text accessibilityLiveRegion="polite" style={{ color: palette.mutedForeground, fontSize: 13 }}>
                    {questionCount(total)} available in{' '}
                    {scope.chapters.length === 0 ? 'every chapter' : scope.chapters.length === 1 ? 'this chapter' : `these ${scope.chapters.length} chapters`}
                  </Text>
                ) : (
                  <Notice
                    tone="warning"
                    title={`No ${EXAMS[scope.exam as keyof typeof EXAMS].label} ${scope.subject} questions yet`}
                    text="The question bank has none for this exam and subject. Choose another subject or exam."
                  />
                )}
              </>
            ) : null}
          </Group>
        ) : null}
    </StepLayout>
  );
}
