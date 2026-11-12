import { useLocalSearchParams } from 'expo-router';
import { PracticeSessionScreen } from '@/screens/student/practice/practice-screens';

/** A topic practice session, as a page of its own. */
export default function PracticeSessionRoute() {
  const params = useLocalSearchParams<{ subject?: string; standard?: string; chapter?: string; topic?: string; mode?: string }>();
  return <PracticeSessionScreen key={`${params.subject}|${params.standard}|${params.chapter}|${params.topic ?? ''}|${params.mode}`} {...params} />;
}
