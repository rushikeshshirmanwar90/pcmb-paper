import { useLocalSearchParams } from 'expo-router';
import { ScheduleOverviewScreen } from '@/screens/tuition/schedule-overview';

export default function Route() {
  const { batchId } = useLocalSearchParams<{ batchId: string }>();
  return <ScheduleOverviewScreen batchId={batchId} />;
}
