import { Stack } from 'expo-router';
import { CreateTestProvider } from '@/screens/teacher/create-test/draft';

/** The two full-screen Create Test pages share one draft, so going back and forth keeps everything. */
export default function CreateTestLayout() {
  return (
    <CreateTestProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </CreateTestProvider>
  );
}
