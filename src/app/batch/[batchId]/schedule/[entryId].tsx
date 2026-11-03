import { useLocalSearchParams } from 'expo-router';
import { ScheduleFormScreen } from '@/screens/tuition/schedule-form';

export default function Route() {
  const { batchId, entryId } = useLocalSearchParams<{ batchId: string; entryId: string }>();
  return <ScheduleFormScreen batchId={batchId} entryId={entryId} />;
}
