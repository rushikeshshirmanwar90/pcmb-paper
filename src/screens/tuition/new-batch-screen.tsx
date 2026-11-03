import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Badge, Button, Card, Chips, ErrorText, ErrorView, Field, LoadingView, Muted, MultiChips, Notice, SectionTitle, useLoad } from '@/components/kit';
import {
  academicYearChoices,
  academicYearOf,
  formatAcademicYear,
  OFFERED_PROGRAMS,
  PROGRAM_INFO,
  PROGRAM_LABELS,
  SCHOOL_STANDARDS,
  subjectProblem,
  type Program,
  type SchoolStandard,
  type SchoolSubject,
} from '@/constants/school';
import { bumpDataVersion } from '@/context/data-version';
import { useTabNavigation } from '@/context/tab-context';
import { StackScreen, useDiscardGuard, useGoBack } from '@/components/stack-screen';
import { suggestBatchName } from '@/screens/tuition/admin-filters';
import { InfoRow, programTone } from '@/screens/tuition/admin-ui';
import { batchHref } from '@/screens/tuition/batch-nav';
import { showStudents } from '@/screens/tuition/people-nav';
import { bankNote, classLabel, SetupActions, SubjectHint, TextLink, yearLabel } from '@/screens/tuition/tuition-batches';
import { tuitionApi, type Batch } from '@/services/tuition-api';

const yearLabels = (years: string[]) => Object.fromEntries(years.map((y) => [y, formatAcademicYear(y)]));

/** Loads the existing batch names first, so the suggested name and the duplicate check see them. */
export function NewBatchScreen() {
  const goBack = useGoBack();
  const { data, error, loading, reload } = useLoad(() => tuitionApi.batches(), []);
  if (loading) {
    return (
      <StackScreen title="Create Batch" onBack={goBack}>
        <LoadingView label="Loading…" />
      </StackScreen>
    );
  }
  if (!data) {
    return (
      <StackScreen title="Create Batch" onBack={goBack}>
        <ErrorView message={`Couldn't load the batches. ${error ?? ''}`} onRetry={reload} />
      </StackScreen>
    );
  }
  return <NewBatchForm batches={data} />;
}

/**
 * Making a batch in one short form: program, class, academic year, a
 * suggested name and the program's subjects. Teachers, the classroom and
 * timings come after, from the next steps it shows. "Create another batch"
 * keeps the program, class and year and suggests the next name.
 */
function NewBatchForm({ batches }: { batches: Batch[] }) {
  const router = useRouter();
  const goBack = useGoBack();
  const { goToTab } = useTabNavigation();
  const currentYear = academicYearOf();
  const years = academicYearChoices(currentYear);
  const [program, setProgram] = useState<Program | null>(null);
  const [standard, setStandard] = useState<SchoolStandard | null>(null);
  const [academicYear, setAcademicYear] = useState(currentYear);
  /** The name typed; null while the suggestion is used. */
  const [typedName, setTypedName] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<SchoolSubject[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** The batches made on this screen; the last one shows after creating it. */
  const [made, setMade] = useState<Batch[]>([]);
  const [showingMade, setShowingMade] = useState(false);

  const taken = [...batches, ...made].map((b) => b.name);
  const suggestion = program && standard ? suggestBatchName(`${PROGRAM_INFO[program].label} ${standard}`, taken) : '';
  const name = typedName ?? suggestion;
  const problem = program ? subjectProblem(program, subjects) : null;
  const last = made[made.length - 1];

  // After "Create another" the program, class and year are kept, so only edits since then count.
  const subjectsEdited = program !== null && subjects.join() !== PROGRAM_INFO[program].subjects.join();
  const dirty = !showingMade && (made.length ? typedName !== null || subjectsEdited : !!(program || standard) || typedName !== null || academicYear !== currentYear);
  const allowLeave = useDiscardGuard(dirty && !saving, 'Discard batch draft?', 'Your unsaved batch details will be lost.');

  const pickProgram = (next: Program) => {
    setProgram(next);
    setSubjects([...PROGRAM_INFO[next].subjects]);
    setError(null);
  };

  const create = async () => {
    if (!program) return setError('Choose the program.');
    if (!standard) return setError('Choose the class: 11th or 12th.');
    if (!name.trim()) return setError('Enter a batch name.');
    if (problem) return setError(problem);
    setSaving(true);
    setError(null);
    try {
      const batch = await tuitionApi.createBatch({ program, standard, academicYear, name: name.trim(), subjects });
      bumpDataVersion();
      setMade((m) => [...m, batch]);
      setShowingMade(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create the batch.");
    } finally {
      setSaving(false);
    }
  };

  // Same program, class and year; the next free name; the program's subjects again.
  const another = () => {
    setShowingMade(false);
    setTypedName(null);
    if (program) setSubjects([...PROGRAM_INFO[program].subjects]);
    setError(null);
  };

  /** Swaps this screen for the batch (or one of its screens), so the form isn't left in the history. */
  const open = (id: string, page?: 'teachers' | 'schedule') => {
    allowLeave();
    router.replace(batchHref(id, page));
  };

  if (showingMade && last) {
    return (
      <StackScreen
        title="Batch created"
        onBack={goBack}
        footer={
          <>
            <Button label="Open the batch" icon={{ ios: 'square.grid.2x2', android: 'grid_view' }} onPress={() => open(last.id)} />
            <Button label="Create another batch" variant="tonal" onPress={another} />
            <Button label="Done" variant="secondary" onPress={goBack} />
          </>
        }
      >
        <Notice
          tone="success"
          title={`${last.name} created`}
          text={made.length > 1 ? `${made.length} batches created: ${made.map((b) => b.name).join(', ')}.` : "It's on your Batches list now."}
          live
        />
        <Card style={styles.listCard}>
          <View style={styles.detailBadges}>
            <Badge label={PROGRAM_LABELS[last.program]} tone={programTone(last.program)} />
            <Badge label={classLabel(last)} />
            {yearLabel(last) ? <Badge label={yearLabel(last)!} /> : null}
          </View>
          <InfoRow icon={{ ios: 'book', android: 'menu_book' }} label="Subjects" value={last.subjects.join(', ')} last />
        </Card>
        <SectionTitle title="Next steps, when you're ready" />
        <SetupActions
          batch={last}
          steps={['teachers', 'students', 'timings']}
          onTeachers={() => open(last.id, 'teachers')}
          onStudents={() => {
            showStudents(last.id);
            goBack();
            goToTab('people');
          }}
          onTimings={() => open(last.id, 'schedule')}
        />
      </StackScreen>
    );
  }

  return (
    <StackScreen
      title="Create Batch"
      onBack={goBack}
      keyboard
      footer={
        <>
          <ErrorText message={error} />
          <Button label="Create Batch" onPress={() => void create()} loading={saving} />
        </>
      }
    >
      <View style={styles.group}>
        <Muted>Fields marked * are required.</Muted>
        <Chips label="Program *" choices={OFFERED_PROGRAMS} selected={program} onChange={pickProgram} labels={PROGRAM_LABELS} />
        {program ? <Muted>{bankNote(program)}</Muted> : null}
        <Chips label="Class *" choices={SCHOOL_STANDARDS} selected={standard} onChange={setStandard} />
        <Chips label="Academic year" choices={years} selected={academicYear} onChange={setAcademicYear} labels={yearLabels(years)} />
        <Field
          label="Batch name *"
          value={name}
          onChangeText={setTypedName}
          placeholder={program && standard ? suggestion : 'e.g. NEET 11th A'}
          hint={typedName === null ? (suggestion ? 'Suggested from the program and class. You can change it.' : 'Pick the program and class for a suggested name.') : undefined}
          maxLength={80}
        />
        {typedName !== null && suggestion && typedName !== suggestion ? <TextLink label={`Use “${suggestion}”`} onPress={() => setTypedName(null)} /> : null}
        {program ? (
          <>
            <MultiChips label={`Select Subjects * · ${subjects.length} selected`} choices={PROGRAM_INFO[program].allowed} selected={subjects} onChange={setSubjects} />
            <SubjectHint program={program} problem={problem} />
          </>
        ) : (
          <Muted>Pick a program to see its subjects.</Muted>
        )}
        <Muted>Add teachers, a classroom and sessions after creating the batch.</Muted>
      </View>
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  group: { gap: 12 },
  listCard: { paddingVertical: 0 },
  detailBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingVertical: 12 },
});
