import { useLocalSearchParams } from 'expo-router';
import { TeachBatchScreen } from '@/screens/teacher/teach-batch-screen';

/** A batch the teacher teaches: Syllabus · Students · Tests. */
export default function TeachBatchRoute() {
  const { batchId } = useLocalSearchParams<{ batchId: string }>();
  return <TeachBatchScreen key={batchId} batchId={batchId} />;
}
