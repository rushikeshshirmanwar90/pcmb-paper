import { useLocalSearchParams } from 'expo-router';
import { BatchSettingsScreen } from '@/screens/tuition/batch-screens';

export default function Route() {
  const { batchId } = useLocalSearchParams<{ batchId: string }>();
  return <BatchSettingsScreen batchId={batchId} />;
}
