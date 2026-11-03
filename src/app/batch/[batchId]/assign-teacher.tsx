import { useLocalSearchParams } from 'expo-router';
import { AssignTeacherScreen } from '@/screens/tuition/batch-screens';

export default function Route() {
  const { batchId, teacherId } = useLocalSearchParams<{ batchId: string; teacherId?: string }>();
  return <AssignTeacherScreen batchId={batchId} teacherId={teacherId} />;
}
