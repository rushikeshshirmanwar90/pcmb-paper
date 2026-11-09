import { useNavigation, usePreventRemove, useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { DropdownSelect } from '@/components/dropdown-select';
import { confirmAction } from '@/components/account-section';
import { MultiSelectDropdown } from '@/components/multi-select-dropdown';
import { Button, DetailRow, ErrorView, Field, LoadingView, Muted, Notice, SectionTitle, useLoad } from '@/components/kit';
import { FlowPage } from '@/screens/teacher/create-test/flow-page';
import { useTestDraft, type TestDraft } from '@/screens/teacher/create-test/draft';
import { QuestionPicker } from '@/screens/teacher/create-test/question-picker';
import { deriveScope, isDerived, scopeId, uniqueLabels } from '@/screens/teacher/create-test/scope';
import type { BankScope } from '@/screens/teacher/make-pdf/bank-scope';
import { schoolApi } from '@/services/school-api';

/** What no longer applies once the batches or subject change: filters, picked questions and student choices. */
const CLEARED: Partial<TestDraft> = { chapters: [], topics: [], years: [], questions: [], studentIds: [], excludedStudentIds: [] };

/** Create Test, page 1 of 2: the test's name, batches and subject, and its questions. */
export function DetailsScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { draft, update, dirty } = useTestDraft();
  const batches = useLoad(() => schoolApi.testBatches(), []);
  const [tried, setTried] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const all = batches.data ?? [];
  const labels = uniqueLabels(all);
  const chosen = all.filter((b) => draft.batchIds.includes(b.id));
  const derivation = deriveScope(chosen);
  const derived = isDerived(derivation) ? derivation : null;
  const subject = derived?.subjects.includes(draft.subject) ? draft.subject : '';

  usePreventRemove(dirty, ({ data }) => confirmAction('Discard this test?', 'Nothing has been created yet.', 'Discard', () => navigation.dispatch(data.action)));

  const onBatches = (labelsPicked: string[]) => {
    const ids = labels.filter((l) => labelsPicked.includes(l.label)).map((l) => l.id);
    const next = deriveScope(all.filter((b) => ids.includes(b.id)));
    const nextDerived = isDerived(next) ? next : null;
    const keepSubject = nextDerived?.subjects.includes(draft.subject) ? draft.subject : '';
    const changed = scopeId(nextDerived, keepSubject) !== scopeId(derived, subject);
    if (changed && (draft.questions.length || draft.chapters.length)) setNotice('The batches changed what can be asked, so the picked questions and filters were cleared.');
    else setNotice(null);
    const audienceChanged = ids.length !== draft.batchIds.length || ids.some(id => !draft.batchIds.includes(id));
    update({ batchIds: ids, subject: keepSubject, ...(audienceChanged ? { studentIds: [], excludedStudentIds: [] } : {}), ...(changed ? CLEARED : {}) });
  };

  const onSubject = (value: string) => {
    if (value === subject) return;
    setNotice(draft.questions.length ? 'The subject changed, so the picked questions were cleared.' : null);
    update({ subject: value, ...CLEARED });
  };

  const problem = !draft.title.trim()
    ? 'Give the test a name.'
    : !draft.batchIds.length ? 'Select at least one batch.'
    : !derived ? (isDerived(derivation) || !derivation ? 'Select at least one batch.' : derivation.error)
    : !subject ? 'Select a subject.'
    : !draft.questions.length ? 'Select at least one question.'
    : null;

  const next = () => {
    setTried(true);
    if (problem) return;
    router.push('/create-test/setup' as Href);
  };

  const scope: BankScope | null = derived && subject
    ? { course: derived.course, standard: derived.standard, exam: derived.exam, subject, source: draft.source, chapters: draft.chapters, topics: draft.topics, years: draft.years }
    : null;

  return (
    <FlowPage
      title="Create Test (1 of 2)"
      subtitle="Details and questions"
      onBack={() => router.back()}
      error={tried ? problem : null}
      footer={<Button label="Next: Test Setup" onPress={next} />}
    >
      <SectionTitle title="Test details" />
      <Field label="Test Name" value={draft.title} onChangeText={(title) => update({ title })} placeholder="Enter test name" maxLength={120} returnKeyType="done" error={tried && !draft.title.trim() ? 'Give the test a name.' : null} />

      {batches.loading && !batches.data ? <LoadingView label="Loading batches…" /> : null}
      {batches.error && !batches.data ? <ErrorView message={batches.error} onRetry={batches.reload} /> : null}
      {batches.data && !all.length ? <Notice tone="warning" title="No batches yet" text="Your tuition has no batches, so a test can't be set yet." /> : null}
      {all.length ? (
        <MultiSelectDropdown
          label="Select Batches"
          options={labels.map((l) => l.label)}
          selected={labels.filter((l) => draft.batchIds.includes(l.id)).map((l) => l.label)}
          onSelect={onBatches}
          placeholder="Select multiple"
          selectedLabel={(n) => `${n} Batch${n === 1 ? '' : 'es'} Selected`}
          applyOnDone searchable showSelectedChips
          icon={{ ios: 'person.3', android: 'groups', web: 'groups' }}
        />
      ) : null}
      {derivation && !derived && 'error' in derivation ? <Notice tone="warning" text={derivation.error} live /> : null}

      {derived ? (
        <>
          <DropdownSelect label="Subject" required options={derived.subjects} selected={subject} placeholder="Select Subject" emptyText="No subject shared by these batches" onSelect={onSubject} searchable={false} />
          <DetailRow label="Course / Exam / Class" value={derived.label} />
        </>
      ) : null}
      {notice ? <Notice tone="info" text={notice} live onDismiss={() => setNotice(null)} /> : null}

      {scope ? (
        <>
          <SectionTitle title="Select questions" />
          <QuestionPicker
            key={scopeId(derived, subject)}
            scope={scope}
            onScope={(s) => update({ source: s.source, chapters: s.chapters, topics: s.topics, years: s.years })}
            selected={draft.questions}
            onSelected={(questions) => update({ questions })}
            count={draft.count}
            onCount={(count) => update({ count })}
          />
        </>
      ) : derived ? <Muted>Choose a subject to pick questions.</Muted> : null}
    </FlowPage>
  );
}
