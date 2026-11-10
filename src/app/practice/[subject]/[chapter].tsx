import { useLocalSearchParams } from 'expo-router';
import { PracticeChapterScreen } from '@/screens/student/practice/practice-screens';

/** Topic practice: a chapter's topics, or with ?topic= one topic (or the whole chapter) and its actions. */
export default function PracticeChapterRoute() {
  const { subject, chapter, standard, topic } = useLocalSearchParams<{ subject: string; chapter: string; standard?: string; topic?: string }>();
  return <PracticeChapterScreen key={`${subject}|${chapter}|${standard ?? ''}|${topic ?? ''}`} subjectParam={subject} chapterParam={chapter} standardParam={standard} topicParam={topic} />;
}
