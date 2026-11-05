import { ErrorView, LoadingView, useLoad } from '@/components/kit';
import { StackScreen, useGoBack } from '@/components/stack-screen';
import { useDataVersion } from '@/context/data-version';
import { tuitionOnly } from '@/screens/tuition/batch-screens';
import { TeacherDetailsContent } from '@/screens/tuition/tuition-teachers';
import { tuitionApi } from '@/services/tuition-api';

export const TeacherDetailsScreen = tuitionOnly(function TeacherDetailsScreen({ teacherId }: { teacherId: string }) {
  const version = useDataVersion();
  const goBack = useGoBack();
  const teacher = useLoad(() => tuitionApi.teacher(teacherId), [teacherId, version]);
  if (!teacher.data) return <StackScreen title="Teacher details">
    {teacher.loading ? <LoadingView label="Loading teacher..." /> : <ErrorView message={teacher.error ?? 'Teacher unavailable.'} onRetry={teacher.reload} />}
  </StackScreen>;
  return <TeacherDetailsContent key={teacherId} teacher={teacher.data} onClose={goBack} onRefresh={teacher.refresh} refreshing={teacher.refreshing} feedbackView={teacher.error ? <ErrorView message={`Could not refresh teacher: ${teacher.error}`} onRetry={teacher.reload} /> : undefined} />;
}, 'People');
