import { useLocalSearchParams } from 'expo-router';
import { TeacherDetailsScreen } from '@/screens/tuition/teacher-details-screen';
export default function TeacherDetailsRoute() {
  const { teacherId } = useLocalSearchParams<{ teacherId: string }>();
  return <TeacherDetailsScreen key={teacherId} teacherId={teacherId} />;
}
