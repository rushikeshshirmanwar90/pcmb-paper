import { Stack, useGlobalSearchParams } from 'expo-router';
import { CreateTestLeaveGuard, CreateTestProvider } from '@/screens/teacher/create-test/draft';

/** The two full-screen Create Test pages share one draft, so going back and forth keeps everything. */
export default function CreateTestLayout() {
  // ?batchId= (Set a test from a batch's page) starts the draft with that batch picked.
  const { batchId } = useGlobalSearchParams<{ batchId?: string }>();
  return (
    <CreateTestProvider initialBatchIds={typeof batchId === 'string' && batchId ? [batchId] : []}>
      <CreateTestLeaveGuard>
        <Stack screenOptions={{ headerShown: false }} />
      </CreateTestLeaveGuard>
    </CreateTestProvider>
  );
}
