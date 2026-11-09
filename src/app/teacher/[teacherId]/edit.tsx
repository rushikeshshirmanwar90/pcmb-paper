import { useLocalSearchParams } from 'expo-router';
import { TeacherFormScreen } from '@/screens/tuition/teacher-form-screen';
export default function EditTeacherRoute() {
  const { teacherId } = useLocalSearchParams<{ teacherId: string }>();
  return <TeacherFormScreen key={teacherId} teacherId={teacherId} />;
}
