import { ErrorView, LoadingView, useLoad } from '@/components/kit';
import { StackScreen, useGoBack } from '@/components/stack-screen';
import { tuitionOnly } from '@/screens/tuition/batch-screens';
import { StudentBatchForm, StudentForm } from '@/screens/tuition/tuition-students';
import { tuitionApi } from '@/services/tuition-api';

export const StudentFormScreen = tuitionOnly(function StudentFormScreen({ studentId, batchId, mode = 'edit' }: { studentId?: string; batchId?: string; mode?: 'edit' | 'batch' | 'new' }) {
  const goBack = useGoBack();
  // Mount the form only once all starting values are available. Background refreshes cannot overwrite a draft.
  const load = useLoad(async () => {
    const [student, batches] = await Promise.all([studentId ? tuitionApi.student(studentId) : undefined, tuitionApi.batches()]);
    return { student, batches };
  }, [studentId, mode]);
  if (!load.data) return <StackScreen title={mode === 'new' ? 'Add student' : mode === 'batch' ? 'Manage student batch' : 'Edit student'}>
    {load.loading ? <LoadingView /> : <ErrorView message={load.error ?? 'Student unavailable.'} onRetry={load.reload} />}
  </StackScreen>;
  if (mode === 'batch' && load.data.student) return <StudentBatchForm key={studentId} student={load.data.student} batches={load.data.batches} onClose={goBack} onSaved={() => {}} />;
  return <StudentForm key={studentId ?? 'new'} student={load.data.student} batches={load.data.batches} initialBatchId={batchId} onClose={goBack} />;
}, 'People');
