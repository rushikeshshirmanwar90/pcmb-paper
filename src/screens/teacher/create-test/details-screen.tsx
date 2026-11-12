import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { confirmAction } from '@/components/account-section';
import { MultiSelectDropdown } from '@/components/multi-select-dropdown';
import { Button, DetailRow, ErrorView, Field, Muted, Notice, SectionTitle, SkeletonCards, useLoad } from '@/components/kit';
import { useCacheKeys } from '@/hooks/use-cache-keys';
import { FlowPage } from '@/screens/teacher/create-test/flow-page';
import { useLeaveCreateTest, useTestDraft } from '@/screens/teacher/create-test/draft';
import { SubjectSelector } from '@/screens/teacher/question-selection/subject-selector';
import { selectedQuestions, selectionProblem } from '@/screens/teacher/question-selection/model';
import { deriveScope, isDerived, scopeId, uniqueLabels } from '@/screens/teacher/create-test/scope';
import { EMPTY_BANK_SCOPE, type BankScope } from '@/screens/teacher/make-pdf/bank-scope';
import { schoolApi } from '@/services/school-api';

/** Create Test, page 1 of 2: the test's name, batches and subject, and its questions. */
export function DetailsScreen() {
  const router = useRouter();
  const { draft, update } = useTestDraft();
  const leave = useLeaveCreateTest();
  // Shared by both pages of Create Test: the second page doesn't ask again.
  const { testBatches: batchesKey } = useCacheKeys();
  const batches = useLoad(() => schoolApi.testBatches(), [batchesKey], { cacheKey: batchesKey });
  const [tried, setTried] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const all = batches.data ?? [];
  const labels = uniqueLabels(all);
  const chosen = all.filter((b) => draft.batchIds.includes(b.id));
  const derivation = deriveScope(chosen);
  const derived = isDerived(derivation) ? derivation : null;

  const onBatches = (labelsPicked: string[]) => {
    const ids = labels.filter((l) => labelsPicked.includes(l.label)).map((l) => l.id);
    const next = deriveScope(all.filter((b) => ids.includes(b.id)));
    const nextDerived = isDerived(next) ? next : null;
    const baseChanged = scopeId(nextDerived, '') !== scopeId(derived, '');
    const changed = baseChanged || draft.selections.some(s => !nextDerived?.subjects.includes(s.subject));
    const audienceChanged = ids.length !== draft.batchIds.length || ids.some(id => !draft.batchIds.includes(id));
    const apply = () => {
      const selections = baseChanged ? [] : draft.selections.filter(s => nextDerived?.subjects.includes(s.subject));
      update({ batchIds: ids, ...(audienceChanged ? { studentIds: [], excludedStudentIds: [] } : {}), ...(changed ? { selections, questions: selectedQuestions(selections), subject: selections.map(s => s.subject).join(', '), chapters: [], topics: [], years: [] } : {}) });
      setNotice(changed ? 'Choose subjects for the new batch scope.' : null);
    };
    if (changed && draft.questions.length) confirmAction('Change batch scope?', 'This clears selected questions because the exam, class or permitted subjects changed.', 'Change batches', apply);
    else apply();
  };

  const problem = !draft.title.trim()
    ? 'Give the test a name.'
    : !draft.batchIds.length ? 'Select at least one batch.'
    : !derived ? (isDerived(derivation) || !derivation ? 'Select at least one batch.' : derivation.error)
    : draft.selections.some(s => !derived.subjects.includes(s.subject)) ? 'Select subjects allowed by every chosen batch.'
    : selectionProblem(draft.selections);

  const next = () => {
    setTried(true);
    if (problem) return;
    router.push('/create-test/setup' as Href);
  };

  const scope: BankScope | null = derived
    ? { ...EMPTY_BANK_SCOPE, course: derived.course, standard: derived.standard, exam: derived.exam }
    : null;

  return (
    <FlowPage
      title="Create Test (1 of 2)"
      subtitle="Details and questions"
      onBack={leave}
      error={tried ? problem : null}
      footer={<Button label="Next: Test Setup" onPress={next} />}
    >
      <SectionTitle title="Test details" />
      <Field label="Test Name" value={draft.title} onChangeText={(title) => update({ title })} placeholder="Enter test name" maxLength={120} returnKeyType="done" error={tried && !draft.title.trim() ? 'Give the test a name.' : null} />

      {batches.loading && !batches.data ? <SkeletonCards count={1} lines={1} label="Loading batches" /> : null}
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
          <DetailRow label="Course / Exam / Class" value={derived.label} />
        </>
      ) : null}
      {notice ? <Notice tone="info" text={notice} live onDismiss={() => setNotice(null)} /> : null}

      {scope ? (
        <>
          <SectionTitle title="Select questions" />
          <SubjectSelector sessions={draft.selections} base={scope} subjects={derived?.subjects ?? []} total={draft.count}
            onChange={selections => {
              const subjectsChanged = selections.length !== draft.selections.length || selections.some(s => !draft.selections.some(old => old.subject === s.subject));
              update({ selections, questions: selectedQuestions(selections), subject: selections.map(s => s.subject).join(', '), ...(subjectsChanged ? { studentIds: [], excludedStudentIds: [] } : {}) });
            }} />
        </>
      ) : derived ? <Muted>Choose a subject to pick questions.</Muted> : null}
    </FlowPage>
  );
}
