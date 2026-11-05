import { useState } from 'react';
import { Card, ErrorView, LoadingView, Muted, Notice, SectionTitle, useLoad } from '@/components/kit';
import { StackScreen, useGoBack } from '@/components/stack-screen';
import { bumpDataVersion } from '@/context/data-version';
import { tuitionOnly } from '@/screens/tuition/batch-screens';
import { groupTeacherBatches } from '@/screens/tuition/admin-filters';
import { PersonFormPage } from '@/screens/tuition/person-form-page';
import { usePersonFormGuard } from '@/screens/tuition/person-form-guard';
import { usePersonFeedback } from '@/screens/tuition/person-notice';
import { TeacherProfileFields, teacherFieldErrors, type TeacherFieldErrors } from '@/screens/tuition/tuition-teachers';
import { tuitionApi, type Teacher } from '@/services/tuition-api';

export const TeacherFormScreen = tuitionOnly(function TeacherFormScreen({ teacherId }: { teacherId: string }) {
  const teacher = useLoad(() => tuitionApi.teacher(teacherId), [teacherId]);
  if (!teacher.data) return <StackScreen title="Edit teacher">
    {teacher.loading ? <LoadingView label="Loading teacher..." /> : <ErrorView message={teacher.error ?? 'Teacher unavailable.'} onRetry={teacher.reload} />}
  </StackScreen>;
  return <TeacherEditForm key={teacherId} teacher={teacher.data} />;
}, 'People');

function TeacherEditForm({ teacher }: { teacher: Teacher }) {
  const goBack = useGoBack();
  const [initial] = useState(() => ({ name: teacher.name, email: teacher.email, phone: teacher.phone, subjects: [...teacher.subjects].sort() }));
  const [name, setName] = useState(initial.name);
  const [email, setEmail] = useState(initial.email);
  const [phone, setPhone] = useState(initial.phone);
  const [subjects, setSubjects] = useState(initial.subjects);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<TeacherFieldErrors>({});
  const dirty = JSON.stringify({ name, email, phone, subjects: [...subjects].sort() }) !== JSON.stringify(initial);
  const feedback = usePersonFeedback('teacher', teacher.id);
  const allowLeave = usePersonFormGuard(dirty, saving);
  const batches = groupTeacherBatches(teacher.batches);
  const outsideProfile = teacher.batches.some((assignment) => !subjects.includes(assignment.subject));
  const save = async () => {
    if (saving) return;
    const problems = teacherFieldErrors({ name, email, password: '', needsPassword: false });
    setFieldErrors(problems ?? {});
    if (problems) return;
    setSaving(true);
    setError(null);
    try {
      // Profile only: batch links and login permissions are deliberately not part of this request.
      await tuitionApi.updateTeacher(teacher.id, { name: name.trim(), email: email.trim(), phone: phone.trim(), subjects });
      bumpDataVersion();
      feedback('Teacher details saved. Batch assignments retained.');
      allowLeave();
      goBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the teacher.");
    } finally { setSaving(false); }
  };
  return <PersonFormPage title={`Edit ${teacher.name}`} onBack={goBack} submitLabel="Save changes" onSubmit={save} submitting={saving} error={error}>
    <TeacherProfileFields name={name} email={email} phone={phone} subjects={subjects} errors={fieldErrors}
      setName={(v) => { setName(v); setFieldErrors((e) => ({ ...e, name: null })); }}
      setEmail={(v) => { setEmail(v); setFieldErrors((e) => ({ ...e, email: null })); }}
      setPhone={setPhone} setSubjects={setSubjects} editing />
    <SectionTitle title="Assigned batches" />
    <Card>
      {batches.length ? batches.map((batch) => <Muted key={batch.id}>{batch.name}: {batch.subjects.join(', ')}</Muted>) : <Muted>No batch assignments yet.</Muted>}
    </Card>
    {outsideProfile ? <Notice tone="warning" text="Some batch assignments use subjects outside this profile. Saving keeps those assignments. Change them separately from Teacher details." /> : null}
  </PersonFormPage>;
}
