import { useLocalSearchParams } from 'expo-router';
import { StudentDetailsScreen } from '@/screens/tuition/student-details-screen';

export default function StudentDetailsRoute() {
  const { studentId } = useLocalSearchParams<{ studentId: string }>();
  return <StudentDetailsScreen key={studentId} studentId={studentId} />;
}
