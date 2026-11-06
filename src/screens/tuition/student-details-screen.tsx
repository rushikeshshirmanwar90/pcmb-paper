import { ErrorView, LoadingView, useLoad } from '@/components/kit';
import { StackScreen, useGoBack } from '@/components/stack-screen';
import { useDataVersion } from '@/context/data-version';
import { tuitionOnly } from '@/screens/tuition/batch-screens';
import { StudentDetailsContent } from '@/screens/tuition/tuition-students';
import { tuitionApi } from '@/services/tuition-api';

export const StudentDetailsScreen = tuitionOnly(function StudentDetailsScreen({ studentId }: { studentId: string }) {
  const version = useDataVersion();
  const goBack = useGoBack();
  const student = useLoad(() => tuitionApi.student(studentId), [studentId, version]);
  const batches = useLoad(() => tuitionApi.batches(), [version]);
  if (!student.data) return (
    <StackScreen title="Student details">
      {student.loading ? <LoadingView label="Loading student..." /> : <ErrorView message={student.error ?? 'Student unavailable.'} onRetry={student.reload} />}
    </StackScreen>
  );
  return <StudentDetailsContent key={studentId} student={student.data} batches={batches.data ?? []} onChanged={(saved) => student.setData(() => saved)} onClose={goBack} onRefresh={() => { student.refresh(); batches.refresh(); }} refreshing={student.refreshing || batches.refreshing} feedbackView={<>
    {student.error ? <ErrorView message={`Could not refresh student: ${student.error}`} onRetry={student.reload} /> : null}
    {batches.error ? <ErrorView message={`Could not load batch information: ${batches.error}`} onRetry={batches.reload} /> : null}
  </>} />;
}, 'People');
