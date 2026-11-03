import { useLocalSearchParams } from 'expo-router';
import { BatchStudentsScreen } from '@/screens/tuition/batch-screens';

export default function Route() {
  const { batchId } = useLocalSearchParams<{ batchId: string }>();
  return <BatchStudentsScreen batchId={batchId} />;
}
