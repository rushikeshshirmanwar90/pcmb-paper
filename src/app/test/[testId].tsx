import { useLocalSearchParams } from 'expo-router';
import { TestManagementScreen } from '@/screens/teacher/test-management-screen';

export default function TestManagementRoute() {
  const { testId } = useLocalSearchParams<{ testId: string }>();
  return <TestManagementScreen key={testId} testId={testId} />;
}
