import { useLocalSearchParams } from 'expo-router';
import { StudentFormScreen } from '@/screens/tuition/student-form-screen';
export default function AddStudentRoute() {
  const { batchId } = useLocalSearchParams<{ batchId?: string }>();
  return <StudentFormScreen mode="new" batchId={batchId} />;
}
