import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '@/components/app-text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Badge,
  Button,
  Card,
  EmptyView,
  ErrorView,
  Icon,
  LoadingView,
  SectionTitle,
  useLoad,
  usePalette,
  type IconName,
} from '@/components/kit';
import { type SchoolSubject } from '@/constants/school';
import { bumpDataVersion } from '@/context/data-version';
import { useRouter } from 'expo-router';
import { practiceChapterHref } from '@/screens/student/practice/practice-links';
import { AssessmentSession, column, SheetHeader, type TopicPick } from '@/screens/student/assessment-session';
import { summaryLine } from '@/screens/student/self-assessment';
import { PracticeSetup } from '@/screens/student/practice/practice-setup';
import { StepSlide, useStepDirection } from '@/design/motion';

import { resultTone } from '@/screens/student/test-format';
import { dayLabel } from '@/services/school-api';
import {
  studentApi,
  type AssessmentDetail,
  type AssessmentSummary,
} from '@/services/student-api';
import { face } from '@/design/type';
import { Neo } from '@/design/tokens';

export type FlowView =
  | { kind: 'home' }
  | { kind: 'build'; subject: SchoolSubject; preset: TopicPick[] | null }
  | { kind: 'session'; id: string; initial?: AssessmentDetail };

/**
 * Self-assessment, full screen over the Practice tab: the student's past
 * self-assessments, making a new one (chapters, topics, size, difficulty mix,
 * time), taking it and the topic-by-topic result.
 */
// A self-assessment just made or started, handed to the page that opens it, so it shows without a reload.
const handoff = new Map<string, AssessmentDetail>();
export function handOffAssessment(detail: AssessmentDetail) {
  handoff.set(detail.assessment.id, detail);
}
export function takeHandedOff(id: string): AssessmentDetail | undefined {
  const detail = handoff.get(id);
  handoff.delete(id);
  return detail;
}

export function SelfAssessmentFlow({
  subject,
  start = { kind: 'home' },
  onClose,
  page = false,
}: {
  /** Open as a page of its own (the /practice/assessment route) instead of a full-screen modal. */
  page?: boolean;
  subject: SchoolSubject;
  /** Where it opens. Opened straight at a new or existing one, its back steps return to the Practice tab, not the list. */
  start?: FlowView;
  onClose: () => void;
}) {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [view, setView] = useState<FlowView>(start);
  // Forward through the flow (list → new → test) comes in from the right; going back, from the left.
  const direction = useStepDirection(view.kind === 'home' ? 0 : view.kind === 'build' ? 1 : 2);
  const [listRound, setListRound] = useState(0);
  // What Android's back button does inside a session (the session sets it).
  const backRef = useRef<(() => void) | null>(null);

  const close = useCallback(() => {
    // Submitted answers count as practice, so the Practice tab reloads its numbers.
    bumpDataVersion();
    onClose();
  }, [onClose]);
  const fromList = start.kind === 'home';
  const home = useCallback(() => {
    if (!fromList) return close();
    setListRound((n) => n + 1);
    setView({ kind: 'home' });
  }, [fromList, close]);

  const onBack = () => {
    if (view.kind === 'session') (backRef.current ?? home)();
    else if (view.kind === 'build') home();
    else close();
  };

  // As a page, Android's back button steps back inside the flow first, as the modal did.
  const onBackRef = useRef(onBack);
  useEffect(() => {
    onBackRef.current = onBack;
  });
  useEffect(() => {
    if (!page) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBackRef.current();
      return true;
    });
    return () => sub.remove();
  }, [page]);

  // A Modal is its own native window, where SafeAreaView reads no insets. It covers the whole
  // screen, so the app's own insets are the right ones (and the same holds for a full page).
  const body = (
      <View style={[styles.root, { backgroundColor: palette.background, paddingTop: insets.top, paddingBottom: insets.bottom, paddingLeft: insets.left, paddingRight: insets.right }]}>
        <StepSlide step={view.kind === 'session' ? `session:${view.id}` : view.kind} direction={direction} style={styles.root}>
        {view.kind === 'home' ? (
          <Home round={listRound} onClose={close} onNew={() => setView({ kind: 'build', subject, preset: null })} onOpen={(id) => setView({ kind: 'session', id })} />
        ) : view.kind === 'build' ? (
          <PracticeSetup
            initialSubject={view.subject}
            preset={view.preset}
            onBack={home}
            onCreated={(detail) => setView({ kind: 'session', id: detail.assessment.id, initial: detail })}
          />
        ) : (
          <AssessmentSession
            key={view.id}
            id={view.id}
            initial={view.initial}
            backRef={backRef}
            onBack={home}
            onPractise={(s, t) => {
              const href = practiceChapterHref({ subject: s, chapter: t.chapter, standard: t.standard, topic: t.topic || null });
              // As a page, the chapter takes this page's place, so Back returns to where it was opened from.
              if (page) {
                bumpDataVersion();
                router.replace(href);
                return;
              }
              close();
              router.push(href);
            }}
            onRetake={(s, topics) => setView({ kind: 'build', subject: s, preset: topics })}
          />
        )}
        </StepSlide>
      </View>
  );
  if (page) return body;
  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onBack}>
      {body}
    </Modal>
  );
}

// ─── The list ──────────────────────────────────────────────────────────────

function Home({ round, onClose, onNew, onOpen }: { round: number; onClose: () => void; onNew: () => void; onOpen: (id: string) => void }) {
  const palette = usePalette();
  const { data, error, loading, reload } = useLoad(() => studentApi.assessments(), [round]);
  const list = data ?? [];
  const going = list.filter((a) => a.state !== 'submitted');
  const done = list.filter((a) => a.state === 'submitted');

  return (
    <View style={styles.flex}>
      <SheetHeader title="Your practice tests" onClose={onClose} />
      <ScrollView contentContainerStyle={[styles.body, column]}>
        <Card style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={[styles.heroTile, { backgroundColor: palette.primarySoft }]}>
              <Icon name={{ ios: 'checklist', android: 'fact_check' }} color={palette.primary} size={22} />
            </View>
            <View style={styles.flex}>
              <Text style={[styles.heroTitle, { color: palette.foreground }]}>Practise and get scored</Text>
              <Text style={[styles.meta, { color: palette.mutedForeground }]}>
                Pick a subject and topics, and choose whether to include PYQs. We pick a fair mix of easy, medium and hard, then show which topics you&apos;re strong and weak in.
              </Text>
            </View>
          </View>
          <Button label="Start practice" icon={{ ios: 'play.fill', android: 'play_arrow' }} onPress={onNew} />
        </Card>

        {loading && !data ? (
          <LoadingView label="Loading your self-assessments…" />
        ) : error && !data ? (
          <ErrorView message={error} onRetry={reload} />
        ) : !list.length ? (
          <Card>
            <EmptyView icon={{ ios: 'tray', android: 'inbox' }} title="None yet" text="Your self-assessments and their results will show here." />
          </Card>
        ) : (
          <>
            {going.length ? (
              <>
                <SectionTitle title="To finish" />
                <Card style={styles.listCard}>
                  {going.map((a, i) => (
                    <AssessmentRow key={a.id} a={a} last={i === going.length - 1} onPress={() => onOpen(a.id)} />
                  ))}
                </Card>
              </>
            ) : null}
            {done.length ? (
              <>
                <SectionTitle title="Results" />
                <Card style={styles.listCard}>
                  {done.map((a, i) => (
                    <AssessmentRow key={a.id} a={a} last={i === done.length - 1} onPress={() => onOpen(a.id)} />
                  ))}
                </Card>
              </>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function AssessmentRow({ a, last, onPress }: { a: AssessmentSummary; last: boolean; onPress: () => void }) {
  const palette = usePalette();
  const strength = a.result?.strength ?? null;
  const icon: IconName =
    a.state === 'submitted' ? { ios: 'chart.bar', android: 'bar_chart' } : a.state === 'in-progress' ? { ios: 'pause.circle', android: 'pause_circle' } : { ios: 'play.circle', android: 'play_circle' };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${a.title}, ${summaryLine(a)}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, !last && { borderBottomWidth: Neo.border.width, borderBottomColor: palette.border }, pressed && styles.pressed]}
    >
      <Icon name={icon} color={a.state === 'submitted' ? palette.primary : palette.warning} size={22} />
      <View style={styles.flex}>
        <Text style={[styles.rowTitle, { color: palette.foreground }]} numberOfLines={2}>
          {a.title}
        </Text>
        <Text style={[styles.meta, { color: palette.mutedForeground }]}>{summaryLine(a)}</Text>
        <Text style={[styles.meta, { color: palette.mutedForeground }]}>{dayLabel(a.submittedAt ?? a.createdAt)}</Text>
      </View>
      {strength !== null ? <Badge label={`${strength}%`} tone={resultTone(strength)} /> : a.state === 'in-progress' ? <Badge label="Continue" tone="warning" /> : <Badge label="Start" tone="primary" />}
      <Icon name={{ ios: 'chevron.right', android: 'chevron_right' }} color={palette.mutedForeground} size={16} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.7 },
  empty: { opacity: 0.5 },
  body: { padding: 16, gap: 16, paddingBottom: 32 },
  meta: { fontSize: 13, lineHeight: 19, marginTop: 2 },

  hero: { gap: 14, padding: 16 },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  heroTile: { width: 44, height: 44, borderRadius: Neo.radius.md, alignItems: 'center', justifyContent: 'center' },
  heroTitle: { fontSize: 18, fontFamily: face.heavy },
  listCard: { paddingVertical: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, minHeight: 64 },
  rowTitle: { fontSize: 15, lineHeight: 20, fontFamily: face.bold },

  step: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
  stepNumber: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  stepNumberText: { fontSize: 13, fontFamily: face.heavy },
  stepTitle: { fontSize: 16, fontFamily: face.heavy },
  stepDetail: { flex: 1, fontSize: 13, lineHeight: 17, textAlign: 'right' },

  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: Neo.border.width, borderRadius: Neo.radius.md, paddingHorizontal: 12, minHeight: 44 },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 10 },
  clear: { fontSize: 14, fontFamily: face.bold, textDecorationLine: 'underline' },
  group: { gap: 6 },
  groupTitle: { fontSize: 12, fontFamily: face.bold, letterSpacing: 0.5 },
  pickRow: { flexDirection: 'row', alignItems: 'center' },
  pickMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, minHeight: 56 },
  expand: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  topicRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingLeft: 34, minHeight: 44 },
  topicText: { flex: 1, fontSize: 14, lineHeight: 19 },
  topicCount: { fontSize: 13, fontVariant: ['tabular-nums'], minWidth: 28, textAlign: 'right' },

  preview: { gap: 10, padding: 16 },
  quickRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  quickLabel: { fontSize: 12, fontFamily: face.semibold },
  quickValue: { fontSize: 15, lineHeight: 21, fontFamily: face.semibold, marginTop: 2 },
  previewBig: { fontSize: 20, fontFamily: face.heavy },
  previewSmall: { fontSize: 14, fontFamily: face.semibold },
  previewTopics: { gap: 8, marginTop: 4 },
  previewTopic: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  previewTopicName: { flex: 1, fontSize: 14 },
  previewTopicCount: { fontSize: 14, fontFamily: face.bold, fontVariant: ['tabular-nums'], minWidth: 24, textAlign: 'right' },
  footerHint: { fontSize: 13, textAlign: 'center' },
});
