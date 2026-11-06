import { useLocalSearchParams } from 'expo-router';
import { StudentFormScreen } from '@/screens/tuition/student-form-screen';
export default function StudentBatchRoute() {
  const { studentId } = useLocalSearchParams<{ studentId: string }>();
  return <StudentFormScreen key={studentId} studentId={studentId} mode="batch" />;
}
