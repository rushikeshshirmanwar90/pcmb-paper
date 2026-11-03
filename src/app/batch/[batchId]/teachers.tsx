import { useLocalSearchParams } from 'expo-router';
import { BatchTeachersScreen } from '@/screens/tuition/batch-screens';

export default function Route() {
  const { batchId } = useLocalSearchParams<{ batchId: string }>();
  return <BatchTeachersScreen batchId={batchId} />;
}
