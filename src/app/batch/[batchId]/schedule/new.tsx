import { useLocalSearchParams } from 'expo-router';
import { ScheduleFormScreen } from '@/screens/tuition/schedule-form';

export default function Route() {
  const { batchId } = useLocalSearchParams<{ batchId: string }>();
  return <ScheduleFormScreen batchId={batchId} />;
}
