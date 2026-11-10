import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import { Card, EmptyView, ErrorView, Muted, useLoad } from '@/components/kit';
import { SkeletonCard, StaleNotice } from '@/components/states';
import { StackScreen } from '@/components/stack-screen';
import { programOf, programSubjects, questionBankOf, SCHOOL_SUBJECTS, type SchoolStandard, type SchoolSubject } from '@/constants/school';
import { useSignedInUser } from '@/context/auth-context';
import { bumpDataVersion, useTabDataVersion } from '@/context/data-version';
import { ChapterList, ChapterView, NodeView, PracticeUnavailable } from '@/screens/student/practice/practice-parts';
import { findChapter, findTopic, practiceChapterHref, saveLastPractised, WHOLE_CHAPTER } from '@/screens/student/practice/practice-links';
import { PRACTICE_TAB } from '@/screens/student/student-practice';
import { TopicPracticeSheet } from '@/screens/student/topic-practice-sheet';
import { applyAnswer, coverageLabel, nextPlace, statsAt, type PracticeMode, type PracticeNode } from '@/screens/student/topic-practice';
import { studentApi, type PracticeTree } from '@/services/student-api';

// Topic practice as pushed screens: /practice/[subject] lists a subject's
// chapters; /practice/[subject]/[chapter] shows the chapter's topics, or, with
// ?topic=, one topic (or the whole chapter) with its actions. Both read the
// same subject tree, shared through the load cache.

const asSubject = (s: string | undefined): SchoolSubject | null => ((SCHOOL_SUBJECTS as readonly string[]).includes(s ?? '') ? (s as SchoolSubject) : null);

/** The subject's practice tree, shared by every practice screen of that subject. */
function usePracticeTree(subject: SchoolSubject | null, enabled: boolean) {
  const version = useTabDataVersion(PRACTICE_TAB);
  return useLoad(() => (subject ? studentApi.practiceTree(subject) : Promise.resolve(null)), [subject, version], {
    enabled: enabled && !!subject,
    cacheKey: subject ? `practice-tree:${subject}` : undefined,
  });
}

/** Whether this student can practise this subject at all (program has a bank, subject is theirs). */
function useAccess(subjectParam: string | undefined) {
  const user = useSignedInUser();
  const program = programOf(user);
  const subject = asSubject(subjectParam);
  const allowed = !!subject && programSubjects(program).includes(subject);
  return { user, program, subject: allowed ? subject : null, hasBank: questionBankOf(program) !== null };
}

export function PracticeSubjectScreen({ subjectParam }: { subjectParam: string | undefined }) {
  const router = useRouter();
  const { program, subject, hasBank } = useAccess(subjectParam);
  const trees = usePracticeTree(subject, hasBank);
  const tree = trees.data && trees.data.subject === subject ? (trees.data as PracticeTree) : null;
  const unavailable = !hasBank || tree?.available === false;

  return (
    <StackScreen title={subject ?? 'Practice'} subtitle="Past-year questions by chapter" onRefresh={unavailable ? undefined : trees.refresh} refreshing={trees.refreshing}>
      {!subject ? (
        <NotFound text="This subject isn't in your syllabus." />
      ) : unavailable ? (
        <PracticeUnavailable program={program} />
      ) : !tree ? (
        trees.error && !trees.loading ? <ErrorView message={trees.error} onRetry={trees.reload} /> : <SkeletonCard rows={5} label={`${subject} chapters`} />
      ) : (
        <>
          {trees.error ? <StaleNotice message={trees.error} onRetry={trees.reload} /> : null}
          <ChapterList tree={tree} onOpen={(c) => router.push(practiceChapterHref({ subject, chapter: c.chapter, standard: c.standard }))} />
        </>
      )}
    </StackScreen>
  );
}

export function PracticeChapterScreen({
  subjectParam,
  chapterParam,
  standardParam,
  topicParam,
}: {
  subjectParam: string | undefined;
  chapterParam: string | undefined;
  standardParam: string | undefined;
  topicParam: string | undefined;
}) {
  const router = useRouter();
  const { user, program, subject, hasBank } = useAccess(subjectParam);
  const trees = usePracticeTree(subject, hasBank);
  const tree = trees.data && trees.data.subject === subject ? (trees.data as PracticeTree) : null;
  const [session, setSession] = useState<{ node: PracticeNode; mode: PracticeMode } | null>(null);
  const unavailable = !hasBank || tree?.available === false;

  const chapter = tree && chapterParam ? findChapter(tree.chapters, chapterParam, standardParam) : null;
  const hasTopics = !!chapter?.topics.length;
  const topic = chapter && topicParam && topicParam !== WHOLE_CHAPTER ? findTopic(chapter.topics, topicParam) : null;
  // A topic list, unless a topic (or the whole chapter) was picked, or the chapter has no named topics.
  const atNode = !!chapter && (!hasTopics || topicParam === WHOLE_CHAPTER || !!topic);

  const title = topic?.topic ?? chapter?.chapter ?? chapterParam ?? 'Chapter';
  const start = (node: PracticeNode, mode: PracticeMode) => {
    setSession({ node, mode });
    // Remembered for "Continue" on Home and the Practice tab.
    void saveLastPractised(user.id, { subject: node.subject, standard: node.standard, chapter: node.chapter, topic: node.topic, at: Date.now() });
  };

  let body: React.ReactNode;
  if (!subject) body = <NotFound text="This subject isn't in your syllabus." />;
  else if (unavailable) body = <PracticeUnavailable program={program} />;
  else if (!tree) body = trees.error && !trees.loading ? <ErrorView message={trees.error} onRetry={trees.reload} /> : <SkeletonCard rows={4} label={title} />;
  else if (!chapter) body = <NotFound text={`${chapterParam ?? 'This chapter'} isn't in your ${subject} syllabus any more.`} />;
  else if (!atNode) {
    body = <ChapterView chapter={chapter} hasBatch={tree.hasBatch} onOpen={(t) => router.push(practiceChapterHref({ subject, chapter: chapter.chapter, standard: chapter.standard, topic: t ?? WHOLE_CHAPTER }))} />;
  } else {
    const node: PracticeNode = { subject, standard: chapter.standard as SchoolStandard, chapter: chapter.chapter, topic: topic ? topic.topic : null };
    const next = nextPlace(tree.chapters, node);
    body = (
      <NodeView
        node={node}
        stats={topic ?? chapter}
        coveredOn={topic ? topic.coveredOn : hasTopics ? null : chapter.coveredOn}
        coverage={topic ? null : hasTopics ? coverageLabel(chapter) : null}
        hasBatch={tree.hasBatch}
        untagged={node.topic === null ? chapter.untagged : 0}
        next={next}
        onNext={() => next && router.replace(practiceChapterHref({ subject, chapter: next.chapter, standard: next.standard, topic: next.topic ?? (next.kind === 'chapter' ? null : WHOLE_CHAPTER) }))}
        onStart={(mode) => start(node, mode)}
      />
    );
  }

  const sessionStats = session && tree ? statsAt(tree.chapters, session.node) : null;
  const sessionNext = session && tree ? nextPlace(tree.chapters, session.node) : null;

  return (
    <StackScreen title={title} subtitle={chapter && title !== chapter.chapter ? `${subject} · ${chapter.chapter}` : subject ?? undefined} onRefresh={unavailable ? undefined : trees.refresh} refreshing={trees.refreshing}>
      {trees.error && tree ? <StaleNotice message={trees.error} onRetry={trees.reload} /> : null}
      {body}
      {session ? (
        <TopicPracticeSheet
          node={session.node}
          mode={session.mode}
          complete={!!sessionStats && sessionStats.questions > 0 && sessionStats.remaining === 0}
          next={
            sessionNext && subject
              ? {
                  label: sessionNext.label,
                  onGo: () =>
                    router.replace(
                      practiceChapterHref({ subject, chapter: sessionNext.chapter, standard: sessionNext.standard, topic: sessionNext.topic ?? (sessionNext.kind === 'chapter' ? null : WHOLE_CHAPTER) })
                    ),
                }
              : null
          }
          // Counts move as each answer is saved, so they're already right on the way back.
          onAnswered={(at, delta) => trees.setData((prev) => (prev && prev.subject === session.node.subject ? applyAnswer(prev, at, delta) : prev))}
          onClose={(changed) => {
            setSession(null);
            // Then the server's own numbers, in the background.
            if (changed) bumpDataVersion();
          }}
        />
      ) : null}
    </StackScreen>
  );
}

function NotFound({ text }: { text: string }) {
  return (
    <Card>
      <EmptyView icon={{ ios: 'questionmark.folder', android: 'folder_off' }} title="Not found" text={text} />
      <Muted>Go back and pick it again from Practice.</Muted>
    </Card>
  );
}
