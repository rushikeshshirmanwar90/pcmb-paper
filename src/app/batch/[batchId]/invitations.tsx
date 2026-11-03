import { useLocalSearchParams } from 'expo-router';
import { BatchInvitationsScreen } from '@/screens/tuition/batch-invitations';

export default function Route() {
  const { batchId } = useLocalSearchParams<{ batchId: string }>();
  return <BatchInvitationsScreen batchId={batchId} />;
}
