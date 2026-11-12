import { useLocalSearchParams } from 'expo-router';
import { AssessmentPage } from '@/screens/student/practice/assessment-page';

/** Self-assessment (list, new, one assessment and its result), as a page of its own. */
export default function AssessmentRoute() {
  const params = useLocalSearchParams<{ id?: string; new?: string; topics?: string }>();
  return <AssessmentPage key={`${params.id ?? ''}|${params.new ?? ''}|${params.topics ?? ''}`} {...params} />;
}
