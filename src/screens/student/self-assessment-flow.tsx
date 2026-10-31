import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Badge,
  Button,
  Card,
  Chips,
  EmptyView,
  ErrorText,
  ErrorView,
  Icon,
  LoadingView,
  Muted,
  Notice,
  SectionTitle,
  Segmented,
  useLoad,
  usePalette,
  type IconName,
} from '@/components/kit';
import { programOf, programSubjects, type SchoolSubject } from '@/constants/school';
import { useSignedInUser } from '@/context/auth-context';
import { bumpDataVersion } from '@/context/data-version';
import { openPracticeAt } from '@/context/practice-target';
import { AssessmentSession, column, DifficultyBar, SheetFooter, SheetHeader, type TopicPick } from '@/screens/student/assessment-session';
import {
  basisText,
  chapterKey,
  chapterState,
  COUNT_CHOICES,
  DEFAULT_COUNT,
  isTopicPicked,
  MIN_QUESTIONS,
  MIX_INFO,
  pickedQuestions,
  scopeOf,
  selectionLabel,
  splitLabel,
  suggestedMinutes,
  summaryLine,
  timeChoices,
  timeLabel,
  toggleChapter,
  toggleTopic,
  topicName,
  type Selection,
} from '@/screens/student/self-assessment';
import { resultTone } from '@/screens/student/test-format';
import { dayLabel } from '@/services/school-api';
import {
  LEVEL_LABEL,
  LEVEL_TONE,
  studentApi,
  type AssessmentDetail,
  type AssessmentMix,
  type AssessmentPlan,
  type AssessmentSummary,
  type PracticeChapter,
} from '@/services/student-api';

export type FlowView =
  | { kind: 'home' }
  | { kind: 'build'; subject: SchoolSubject; preset: TopicPick[] | null }
  | { kind: 'session'; id: string; initial?: AssessmentDetail };

/**
 * Self-assessment, full screen over the Practice tab: the student's past
 * self-assessments, making a new one (chapters, topics, size, difficulty mix,
 * time), taking it and the topic-by-topic result.
 */
export function SelfAssessmentFlow({
  subject,
  start = { kind: 'home' },
  onClose,
}: {
  subject: SchoolSubject;
  /** Where it opens. Opened straight at a new or existing one, its back steps return to the Practice tab, not the list. */
  start?: FlowView;
  onClose: () => void;
}) {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const [view, setView] = useState<FlowView>(start);
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

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onBack}>
      {/* A Modal is its own native window, where SafeAreaView reads no insets. It covers the whole
          screen, so the app's own insets are the right ones. */}
      <View style={[styles.root, { backgroundColor: palette.background, paddingTop: insets.top, paddingBottom: insets.bottom, paddingLeft: insets.left, paddingRight: insets.right }]}>
        {view.kind === 'home' ? (
          <Home round={listRound} onClose={close} onNew={() => setView({ kind: 'build', subject, preset: null })} onOpen={(id) => setView({ kind: 'session', id })} />
        ) : view.kind === 'build' ? (
          <Builder
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
              openPracticeAt({ subject: s, chapter: t.chapter, topic: t.topic || null });
              close();
            }}
            onRetake={(s, topics) => setView({ kind: 'build', subject: s, preset: topics })}
          />
        )}
      </View>
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
      <SheetHeader title="Self-assessment" onClose={onClose} />
      <ScrollView contentContainerStyle={[styles.body, column]}>
        <Card style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={[styles.heroTile, { backgroundColor: palette.primarySoft }]}>
              <Icon name={{ ios: 'checklist', android: 'fact_check' }} color={palette.primary} size={22} />
            </View>
            <View style={styles.flex}>
              <Text style={[styles.heroTitle, { color: palette.foreground }]}>Test yourself</Text>
              <Text style={[styles.meta, { color: palette.mutedForeground }]}>
                Pick chapters and topics. We choose past-year questions with the right mix of easy, medium and hard, then show which topics you&apos;re strong and weak in.
              </Text>
            </View>
          </View>
          <Button label="Create a self-assessment" icon={{ ios: 'plus', android: 'add' }} onPress={onNew} />
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
      style={({ pressed }) => [styles.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border }, pressed && styles.pressed]}
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

// ─── Making one ────────────────────────────────────────────────────────────

type TimeChoice = 'pace' | 'relaxed' | 'none';
const TIME_CHOICES: TimeChoice[] = ['pace', 'relaxed', 'none'];
const COUNTS = COUNT_CHOICES.map(String);
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

function Builder({
  initialSubject,
  preset,
  onBack,
  onCreated,
}: {
  initialSubject: SchoolSubject;
  /** Topics to start with, e.g. "Retake my weak topics". */
  preset: TopicPick[] | null;
  onBack: () => void;
  onCreated: (detail: AssessmentDetail) => void;
}) {
  const palette = usePalette();
  const user = useSignedInUser();
  const subjects = programSubjects(programOf(user));
  const [subject, setSubject] = useState<SchoolSubject>(subjects.includes(initialSubject) ? initialSubject : subjects[0]);
  const [selection, setSelection] = useState<Selection>({});
  const [presetLeft, setPresetLeft] = useState(preset);
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const [search, setSearch] = useState('');
  const [count, setCount] = useState(String(DEFAULT_COUNT));
  const [mix, setMix] = useState<AssessmentMix>('smart');
  const [time, setTime] = useState<TimeChoice>('pace');
  const [negative, setNegative] = useState<'on' | 'off'>('on');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tree = useLoad(() => studentApi.practiceTree(subject), [subject]);
  const chapters = useMemo(() => (tree.data?.subject === subject ? tree.data.chapters : []), [tree.data, subject]);

  // "Retake my weak topics": pick those topics once the chapters are here.
  if (presetLeft && chapters.length) {
    let next: Selection = {};
    const opened = new Set<string>();
    for (const p of presetLeft) {
      const c = chapters.find((x) => x.standard === p.standard && same(x.chapter, p.chapter));
      if (!c) continue;
      const t = p.topic ? c.topics.find((x) => same(x.topic, p.topic)) : null;
      if (t) {
        if (!isTopicPicked(next, c, t.topic)) next = toggleTopic(next, c, t.topic);
        opened.add(chapterKey(c));
      } else if (!next[chapterKey(c)]) next = toggleChapter(next, c);
    }
    setPresetLeft(null);
    setSelection(next);
    setOpen(opened);
  }

  const scope = useMemo(() => scopeOf(selection, chapters), [selection, chapters]);
  const available = pickedQuestions(selection, chapters);
  const n = Number(count);
  const choices = timeChoices(n, subject);
  const suggested = suggestedMinutes(n, subject);
  const minutes = time === 'none' ? null : Number(choices[TIME_CHOICES.indexOf(time)]);
  const setup = useMemo(
    () => ({ subject, scope, count: n, mix, durationMinutes: minutes, negativeMarking: negative === 'on' }),
    [subject, scope, n, mix, minutes, negative]
  );

  // The plan, a moment after the choices settle; only the latest answer counts.
  const [plan, setPlan] = useState<{ key: string; plan: AssessmentPlan | null; error: string | null } | null>(null);
  const planKey = JSON.stringify(setup);
  useEffect(() => {
    if (!setup.scope.length) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      studentApi.planAssessment(setup).then(
        (p) => !cancelled && setPlan({ key: planKey, plan: p, error: null }),
        (e: unknown) => !cancelled && setPlan({ key: planKey, plan: null, error: e instanceof Error ? e.message : "Couldn't work out the questions." })
      );
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [planKey, setup]);
  const current = plan && plan.key === planKey ? plan : null;
  const planning = !!scope.length && !current;
  const tooFew = !!current?.plan && current.plan.plan.count < MIN_QUESTIONS;

  const pickSubject = (s: SchoolSubject) => {
    setSubject(s);
    setSelection({});
    setOpen(new Set());
    setSearch('');
  };

  const create = async () => {
    setCreating(true);
    setError(null);
    try {
      // The plan's seed makes the test the one the preview showed.
      onCreated(await studentApi.createAssessment({ ...setup, seed: current?.plan?.seed }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't make the self-assessment. Try again.");
    } finally {
      setCreating(false);
    }
  };

  const query = search.trim().toLowerCase();
  const shown = query
    ? chapters.filter((c) => c.chapter.toLowerCase().includes(query) || c.topics.some((t) => t.topic.toLowerCase().includes(query)))
    : chapters;
  const standards = [...new Set(shown.map((c) => c.standard))];

  return (
    <View style={styles.flex}>
      <SheetHeader title="New self-assessment" onBack={onBack} />
      <ScrollView contentContainerStyle={[styles.body, column]} keyboardShouldPersistTaps="handled">
        <Step n={1} title="Subject" />
        <Chips choices={subjects} selected={subject} onChange={pickSubject} />

        <Step n={2} title="Chapters and topics" detail={scope.length ? `${selectionLabel(selection, chapters)} · ${available} questions` : 'Pick at least one'} />
        <View style={[styles.search, { borderColor: palette.border, backgroundColor: palette.card }]}>
          <Icon name={{ ios: 'magnifyingglass', android: 'search' }} color={palette.mutedForeground} size={16} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search chapters and topics"
            placeholderTextColor={palette.mutedForeground}
            accessibilityLabel="Search chapters and topics"
            style={[styles.searchInput, { color: palette.foreground }]}
            autoCorrect={false}
          />
          {scope.length ? (
            <Pressable accessibilityRole="button" onPress={() => setSelection({})} hitSlop={8}>
              <Text style={[styles.clear, { color: palette.primary }]}>Clear</Text>
            </Pressable>
          ) : null}
        </View>
        {tree.loading && !chapters.length ? (
          <LoadingView label={`Loading ${subject} chapters…`} />
        ) : tree.error && !chapters.length ? (
          <ErrorView message={tree.error} onRetry={tree.reload} />
        ) : !shown.length ? (
          <Muted>{query ? 'No chapter or topic matches.' : `No ${subject} chapters in the question bank yet.`}</Muted>
        ) : (
          standards.map((standard) => {
            const rows = shown.filter((c) => c.standard === standard);
            return (
              <View key={standard} style={styles.group}>
                <Text style={[styles.groupTitle, { color: palette.mutedForeground }]}>
                  {standard}
                  {rows[0]?.mine ? ' · your class' : ''}
                </Text>
                <Card style={styles.listCard}>
                  {rows.map((c, i) => (
                    <ChapterPicker
                      key={chapterKey(c)}
                      chapter={c}
                      selection={selection}
                      open={open.has(chapterKey(c)) || (!!query && c.topics.some((t) => t.topic.toLowerCase().includes(query)))}
                      query={query}
                      last={i === rows.length - 1}
                      onToggle={() => setSelection((s) => toggleChapter(s, c))}
                      onToggleTopic={(t) => setSelection((s) => toggleTopic(s, c, t))}
                      onExpand={() =>
                        setOpen((prev) => {
                          const next = new Set(prev);
                          if (next.has(chapterKey(c))) next.delete(chapterKey(c));
                          else next.add(chapterKey(c));
                          return next;
                        })
                      }
                    />
                  ))}
                </Card>
              </View>
            );
          })
        )}

        <Step n={3} title="How many questions" />
        <Chips choices={COUNTS} selected={count} onChange={setCount} />

        <Step n={4} title="Difficulty mix" />
        <Segmented
          label="Difficulty mix"
          value={mix}
          onChange={setMix}
          options={(['smart', 'balanced', 'challenge'] as const).map((m) => ({ value: m, label: MIX_INFO[m].label }))}
        />
        <Muted>{MIX_INFO[mix].text}</Muted>

        <Step n={5} title="Time and marking" />
        <Chips choices={TIME_CHOICES} selected={time} onChange={setTime} labels={{ pace: timeLabel(choices[0], suggested), relaxed: timeLabel(choices[1], suggested), none: timeLabel('0', suggested) }} />
        <Segmented
          label="Negative marking"
          value={negative}
          onChange={setNegative}
          options={[
            { value: 'on', label: '+4 / −1 (exam style)' },
            { value: 'off', label: '+4 / 0' },
          ]}
        />

        {scope.length ? <PlanPreview plan={current?.plan ?? null} error={current?.error ?? null} loading={planning} mix={mix} /> : null}
      </ScrollView>
      <SheetFooter>
        <ErrorText message={error} />
        <Button
          label={current?.plan ? `Create · ${current.plan.plan.count} questions` : 'Create self-assessment'}
          icon={{ ios: 'checkmark', android: 'check' }}
          onPress={() => void create()}
          loading={creating}
          disabled={!scope.length || planning || tooFew || !!current?.error}
        />
        {!scope.length ? <Text style={[styles.footerHint, { color: palette.mutedForeground }]}>Pick at least one chapter or topic.</Text> : null}
      </SheetFooter>
    </View>
  );
}

function Step({ n, title, detail }: { n: number; title: string; detail?: string }) {
  const palette = usePalette();
  return (
    <View style={styles.step}>
      <View style={[styles.stepNumber, { backgroundColor: palette.primarySoft }]}>
        <Text style={[styles.stepNumberText, { color: palette.primaryInk }]}>{n}</Text>
      </View>
      <Text accessibilityRole="header" style={[styles.stepTitle, { color: palette.foreground }]}>
        {title}
      </Text>
      {detail ? (
        <Text style={[styles.stepDetail, { color: palette.mutedForeground }]} numberOfLines={1}>
          {detail}
        </Text>
      ) : null}
    </View>
  );
}

const CHECK: Record<'all' | 'some' | 'none', IconName> = {
  all: { ios: 'checkmark.square.fill', android: 'check_box' },
  some: { ios: 'minus.square.fill', android: 'indeterminate_check_box' },
  none: { ios: 'square', android: 'check_box_outline_blank' },
};

function ChapterPicker({
  chapter: c,
  selection,
  open,
  query,
  last,
  onToggle,
  onToggleTopic,
  onExpand,
}: {
  chapter: PracticeChapter;
  selection: Selection;
  open: boolean;
  query: string;
  last: boolean;
  onToggle: () => void;
  onToggleTopic: (topic: string) => void;
  onExpand: () => void;
}) {
  const palette = usePalette();
  const state = chapterState(selection, c);
  const empty = c.questions === 0;
  const pickedTopics = c.topics.filter((t) => isTopicPicked(selection, c, t.topic)).length;
  const topics = query && !c.chapter.toLowerCase().includes(query) ? c.topics.filter((t) => t.topic.toLowerCase().includes(query)) : c.topics;
  const subtitle = [
    `${c.questions} question${c.questions === 1 ? '' : 's'}`,
    c.topics.length ? (state === 'none' ? `${c.topics.length} topics` : `${pickedTopics} of ${c.topics.length} topics`) : null,
    c.accuracy !== null ? `${c.accuracy}% right in practice` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <View style={!last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border }}>
      <View style={styles.pickRow}>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: state === 'all' ? true : state === 'some' ? 'mixed' : false, disabled: empty }}
          accessibilityLabel={`${c.chapter}, ${subtitle}`}
          disabled={empty}
          onPress={onToggle}
          style={({ pressed }) => [styles.pickMain, empty && styles.empty, pressed && styles.pressed]}
        >
          <Icon name={CHECK[state]} color={state === 'none' ? palette.mutedForeground : palette.primary} size={22} />
          <View style={styles.flex}>
            <Text style={[styles.rowTitle, { color: palette.foreground }]} numberOfLines={2}>
              {c.chapter}
            </Text>
            <Text style={[styles.meta, { color: palette.mutedForeground }]}>{subtitle}</Text>
          </View>
        </Pressable>
        {c.topics.length && !empty ? (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: open }}
            accessibilityLabel={`${open ? 'Hide' : 'Show'} topics of ${c.chapter}`}
            onPress={onExpand}
            style={({ pressed }) => [styles.expand, pressed && styles.pressed]}
          >
            <Icon name={open ? { ios: 'chevron.up', android: 'expand_less' } : { ios: 'chevron.down', android: 'expand_more' }} color={palette.mutedForeground} size={18} />
          </Pressable>
        ) : null}
      </View>
      {open && c.topics.length && !empty
        ? topics.map((t) => {
            const on = isTopicPicked(selection, c, t.topic);
            const off = t.questions === 0;
            return (
              <Pressable
                key={t.topic}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on, disabled: off }}
                accessibilityLabel={`${t.topic}, ${t.questions} questions`}
                disabled={off}
                onPress={() => onToggleTopic(t.topic)}
                style={({ pressed }) => [styles.topicRow, off && styles.empty, pressed && styles.pressed]}
              >
                <Icon name={on ? CHECK.all : CHECK.none} color={on ? palette.primary : palette.mutedForeground} size={20} />
                <Text style={[styles.topicText, { color: palette.foreground }]} numberOfLines={2}>
                  {t.topic}
                </Text>
                {t.accuracy !== null ? <Badge label={`${t.accuracy}%`} tone={resultTone(t.accuracy)} /> : null}
                <Text style={[styles.topicCount, { color: palette.mutedForeground }]}>{t.questions}</Text>
              </Pressable>
            );
          })
        : null}
    </View>
  );
}

/** What the test will be: size, difficulty, how it's shared over topics, and why. */
function PlanPreview({ plan, error, loading, mix }: { plan: AssessmentPlan | null; error: string | null; loading: boolean; mix: AssessmentMix }) {
  const palette = usePalette();
  if (error) return <Notice tone="danger" title="Couldn't plan the questions" text={error} />;
  if (loading || !plan) {
    return (
      <Card>
        <LoadingView label="Choosing questions…" />
      </Card>
    );
  }
  const { count, requested, byDifficulty, fresh, available } = plan.plan;
  if (count < MIN_QUESTIONS) {
    return (
      <Notice
        tone="warning"
        title="Not enough questions"
        text={available.total ? `What you picked has only ${available.total} past-year question${available.total === 1 ? '' : 's'}. Pick more topics (at least ${MIN_QUESTIONS}).` : 'What you picked has no past-year questions yet. Pick other topics.'}
      />
    );
  }
  const topics = plan.topics.filter((t) => t.count > 0).sort((a, b) => b.count - a.count);
  return (
    <Card style={styles.preview}>
      <SectionTitle title="Your test" />
      <Text style={[styles.previewBig, { color: palette.foreground }]}>
        {count} questions <Text style={[styles.previewSmall, { color: palette.mutedForeground }]}>· {splitLabel(byDifficulty)}</Text>
      </Text>
      <DifficultyBar split={byDifficulty} />
      <Muted>{basisText(mix, plan.basis)}</Muted>
      {count < requested ? <Muted>{`Only ${count} past-year questions here, so the test has ${count}, not ${requested}.`}</Muted> : null}
      <Muted>{fresh === count ? "All of them are new to you." : `${fresh} of them are new to you; the rest you've answered before (wrong ones first).`}</Muted>
      {topics.length > 1 ? (
        <View style={styles.previewTopics}>
          {topics.slice(0, 8).map((t) => (
            <View key={`${t.standard}|${t.chapter}|${t.topic}`} style={styles.previewTopic}>
              <Text style={[styles.previewTopicName, { color: palette.foreground }]} numberOfLines={1}>
                {topicName(t)}
              </Text>
              {t.level !== 'not-enough' ? <Badge label={LEVEL_LABEL[t.level]} tone={LEVEL_TONE[t.level]} /> : null}
              <Text style={[styles.previewTopicCount, { color: palette.mutedForeground }]}>{t.count}</Text>
            </View>
          ))}
          {topics.length > 8 ? <Muted>{`and ${topics.length - 8} more topics`}</Muted> : null}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.7 },
  empty: { opacity: 0.5 },
  body: { padding: 16, gap: 14, paddingBottom: 24 },
  meta: { fontSize: 13, lineHeight: 19, marginTop: 2 },

  hero: { gap: 14, padding: 16 },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  heroTile: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  heroTitle: { fontSize: 18, fontWeight: '800' },
  listCard: { paddingVertical: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, minHeight: 64 },
  rowTitle: { fontSize: 15, lineHeight: 20, fontWeight: '700' },

  step: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
  stepNumber: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  stepNumberText: { fontSize: 13, fontWeight: '800' },
  stepTitle: { fontSize: 16, fontWeight: '800' },
  stepDetail: { flex: 1, fontSize: 13, textAlign: 'right' },

  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, minHeight: 44 },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 10 },
  clear: { fontSize: 14, fontWeight: '700' },
  group: { gap: 6 },
  groupTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  pickRow: { flexDirection: 'row', alignItems: 'center' },
  pickMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, minHeight: 56 },
  expand: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  topicRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingLeft: 34, minHeight: 44 },
  topicText: { flex: 1, fontSize: 14, lineHeight: 19 },
  topicCount: { fontSize: 13, fontVariant: ['tabular-nums'], minWidth: 28, textAlign: 'right' },

  preview: { gap: 10, padding: 16 },
  previewBig: { fontSize: 20, fontWeight: '800' },
  previewSmall: { fontSize: 14, fontWeight: '600' },
  previewTopics: { gap: 8, marginTop: 4 },
  previewTopic: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  previewTopicName: { flex: 1, fontSize: 14 },
  previewTopicCount: { fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'], minWidth: 24, textAlign: 'right' },
  footerHint: { fontSize: 13, textAlign: 'center' },
});
