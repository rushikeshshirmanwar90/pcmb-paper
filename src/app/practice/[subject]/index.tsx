import { useLocalSearchParams } from 'expo-router';
import { PracticeSubjectScreen } from '@/screens/student/practice/practice-screens';

/** Topic practice: a subject's chapters. */
export default function PracticeSubjectRoute() {
  const { subject } = useLocalSearchParams<{ subject: string }>();
  return <PracticeSubjectScreen key={subject} subjectParam={subject} />;
}
