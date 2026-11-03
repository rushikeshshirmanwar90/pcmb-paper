import { useLocalSearchParams } from 'expo-router';
import { BatchDetailsScreen } from '@/screens/tuition/batch-screens';

export default function Route() {
  const { batchId } = useLocalSearchParams<{ batchId: string }>();
  return <BatchDetailsScreen batchId={batchId} />;
}
