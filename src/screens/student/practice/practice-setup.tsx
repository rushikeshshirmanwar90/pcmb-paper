import React, { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '@/components/app-text';
import { Button, DetailSheet, ErrorText, Icon, LoadingView, Muted, Segmented, useLoad, usePalette, ErrorView } from '@/components/kit';
import { KeyboardSafeView } from '@/components/keyboard-safe-view';
import { Reason } from '@/components/states';
import { programOf, programSubjects, type SchoolSubject } from '@/constants/school';
import { useSignedInUser } from '@/context/auth-context';
import { haptic } from '@/design/haptics';
import { hardShadow, Neo } from '@/design/tokens';
import { face } from '@/design/type';
import { column, SheetFooter, SheetHeader, type TopicPick } from '@/screens/student/assessment-session';
import {
  chapterKeyOf,
  chaptersOfPicked,
  MAX_TOPICS,
  PER_TOPIC_MAX,
  PER_TOPIC_MIN,
  scopeFromPicked,
  suggestedMinutes,
  topicsInChapters,
  type PickedChapterRef,
  type PickedTopicRef,
} from '@/screens/student/self-assessment';
import { studentApi, type AssessmentDetail, type AssessmentPool, type PracticeChapter } from '@/services/student-api';

// Start practice, as five dropdowns in the order students think it through:
// Subjects (several) → Chapters (several, from those subjects) → Topics
// (several, from those chapters) → Question type (PYQs, other questions or
// both) → How many questions (5–15 per topic picked). Then one button makes
// the test and opens its first question. Each dropdown opens a sheet with the
// choices; the next one waits until the one before it has something picked,
// and says why. Taking a subject or chapter off takes what was under it too.

const POOLS: { value: AssessmentPool; label: string; hint: string }[] = [
  { value: 'all', label: 'PYQs + other questions', hint: 'Past-year questions mixed with the rest of the bank' },
  { value: 'pyqs', label: 'PYQs only', hint: 'Only past-year exam questions' },
  { value: 'others', label: 'Other questions only', hint: 'No past-year questions' },
];

type Sheet = 'subjects' | 'chapters' | 'topics' | 'type' | 'count' | null;

const keyOf = (p: PickedTopicRef) => `${p.subject}|${p.standard}|${p.chapter}|${p.topic}`;
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
type Picked = PickedTopicRef;

/** "3 chapters: Optics, Waves +1" */
const summary = (n: number, noun: string, names: string[]) => `${n} ${noun}${n === 1 ? '' : 's'}: ${names.slice(0, 2).join(', ')}${n > 2 ? ` +${n - 2}` : ''}`;

export function PracticeSetup({
  initialSubject,
  preset,
  onBack,
  onCreated,
}: {
  initialSubject: SchoolSubject;
  /** "Retake my weak topics": these topics (and their chapters) come picked. */
  preset: TopicPick[] | null;
  onBack: () => void;
  /** The test, made and started: practice opens on its first question. */
  onCreated: (detail: AssessmentDetail) => void;
}) {
  const user = useSignedInUser();
  const all = programSubjects(programOf(user));
  const [subjects, setSubjects] = useState<SchoolSubject[]>(() => [all.includes(initialSubject) ? initialSubject : all[0]]);
  const [chapters, setChapters] = useState<PickedChapterRef[]>([]);
  const [picked, setPicked] = useState<Picked[]>([]);
  const [presetLeft, setPresetLeft] = useState(preset);
  const [pool, setPool] = useState<AssessmentPool>('all');
  const [perTopic, setPerTopic] = useState(10);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Each subject's chapters and topics (shared with topic practice through the load cache).
  const trees = useLoad(() => Promise.all(subjects.map((s) => studentApi.practiceTree(s))), [subjects.join('|')]);
  const chaptersBy = useMemo(() => {
    const map = new Map<SchoolSubject, PracticeChapter[]>();
    for (const t of trees.data ?? []) map.set(t.subject, t.chapters);
    return map;
  }, [trees.data]);

  // Retake: pick the result's weak topics, and their chapters, once the chapters are here.
  const presetChapters = chaptersBy.get(subjects[0]);
  if (presetLeft && presetChapters?.length) {
    const next: Picked[] = [];
    for (const p of presetLeft) {
      const c = presetChapters.find((x) => x.standard === p.standard && same(x.chapter, p.chapter));
      if (!c) continue;
      const topic = p.topic ? c.topics.find((t) => same(t.topic, p.topic))?.topic ?? '' : '';
      const item = { subject: subjects[0], standard: c.standard, chapter: c.chapter, topic };
      if (!next.some((x) => keyOf(x) === keyOf(item)) && next.length < MAX_TOPICS) next.push(item);
    }
    setPresetLeft(null);
    setChapters(chaptersOfPicked(next));
    setPicked(next);
  }

  const topics = picked.length;
  const count = topics * perTopic;
  const blocked = !subjects.length ? 'Choose at least one subject.' : !chapters.length ? 'Choose at least one chapter.' : !topics ? 'Choose at least one topic.' : null;

  const pickSubjects = (next: SchoolSubject[]) => {
    setSubjects(next);
    const left = chapters.filter((c) => next.includes(c.subject));
    setChapters(left);
    setPicked((prev) => topicsInChapters(prev, left));
  };
  const pickChapters = (next: PickedChapterRef[]) => {
    setChapters(next);
    setPicked((prev) => topicsInChapters(prev, next));
  };

  const start = async () => {
    if (blocked) return;
    setBusy(true);
    setError(null);
    try {
      const made = await studentApi.createAssessment({
        subject: subjects[0],
        subjects,
        scope: scopeFromPicked(picked),
        count,
        mix: 'smart',
        durationMinutes: suggestedMinutes(count, subjects[0]),
        negativeMarking: true,
        pool,
      });
      // Straight into the questions: practice starts now.
      onCreated(await studentApi.startAssessment(made.assessment.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start your practice. Try again.");
      setBusy(false);
    }
  };

  const treeProps = { chaptersBy, loading: trees.loading, error: trees.error && !trees.data ? trees.error : null, onRetry: trees.reload };
  return (
    <KeyboardSafeView>
      <SheetHeader title="Start practice" onBack={onBack} />
      <ScrollView contentContainerStyle={[styles.body, column]} keyboardShouldPersistTaps="handled">
        <Muted>Choose what to practise. You can pick several subjects, chapters and topics.</Muted>

        <Dropdown
          step={1}
          label="Subjects"
          value={subjects.length ? subjects.join(', ') : null}
          placeholder="Choose subjects"
          onPress={() => setSheet('subjects')}
        />
        <Dropdown
          step={2}
          label="Chapters"
          value={chapters.length ? summary(chapters.length, 'chapter', chapters.map((c) => c.chapter)) : null}
          placeholder="Choose chapters"
          disabledReason={!subjects.length ? 'Choose a subject first.' : null}
          onPress={() => setSheet('chapters')}
        />
        <Dropdown
          step={3}
          label="Topics"
          value={topics ? summary(topics, 'topic', picked.map((p) => p.topic || p.chapter)) : null}
          placeholder="Choose topics"
          disabledReason={!chapters.length ? 'Choose chapters first: topics come from the chapters you pick.' : null}
          onPress={() => setSheet('topics')}
        />
        <Dropdown step={4} label="Question type" value={POOLS.find((p) => p.value === pool)!.label} placeholder="" onPress={() => setSheet('type')} />
        <Dropdown
          step={5}
          label="Number of questions"
          value={topics ? `${count} questions (${perTopic} per topic)` : null}
          placeholder={`${PER_TOPIC_MIN}–${PER_TOPIC_MAX} per topic`}
          disabledReason={!topics ? 'Choose topics first: you get 5 to 15 questions for each.' : null}
          onPress={() => setSheet('count')}
        />
      </ScrollView>
      <SheetFooter>
        <ErrorText message={error} />
        <Button
          label={topics ? `Start practice · ${count} questions` : 'Start practice'}
          size="lg"
          icon={{ ios: 'play.fill', android: 'play_arrow' }}
          onPress={() => void start()}
          loading={busy}
          disabled={!!blocked}
        />
        <Reason text={blocked} />
      </SheetFooter>

      <SubjectsSheet visible={sheet === 'subjects'} all={all} value={subjects} onChange={pickSubjects} onClose={() => setSheet(null)} />
      <ChaptersSheet visible={sheet === 'chapters'} subjects={subjects} {...treeProps} value={chapters} onChange={pickChapters} onClose={() => setSheet(null)} />
      <TopicsSheet visible={sheet === 'topics'} chapters={chapters} {...treeProps} value={picked} onChange={setPicked} onClose={() => setSheet(null)} />
      <ChoiceSheet
        visible={sheet === 'type'}
        title="Question type"
        options={POOLS.map((p) => ({ key: p.value, label: p.label, hint: p.hint }))}
        value={pool}
        onPick={(v) => {
          setPool(v as AssessmentPool);
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
      />
      <ChoiceSheet
        visible={sheet === 'count'}
        title="Number of questions"
        options={Array.from({ length: PER_TOPIC_MAX - PER_TOPIC_MIN + 1 }, (_, i) => {
          const n = PER_TOPIC_MIN + i;
          return { key: String(n), label: `${n * Math.max(1, topics)} questions`, hint: `${n} per topic · about ${suggestedMinutes(n * Math.max(1, topics), subjects[0] ?? all[0])} min` };
        })}
        value={String(perTopic)}
        onPick={(v) => {
          setPerTopic(Number(v));
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
      />
    </KeyboardSafeView>
  );
}

// ─── The dropdown field ────────────────────────────────────────────────────

/** A numbered field that opens its choices: label, what's picked (or a hint), a chevron. Says why when it can't open yet. */
function Dropdown({ step, label, value, placeholder, disabledReason = null, onPress }: { step: number; label: string; value: string | null; placeholder: string; disabledReason?: string | null; onPress: () => void }) {
  const palette = usePalette();
  const disabled = !!disabledReason;
  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <View style={[styles.stepDot, { borderColor: palette.ink, backgroundColor: value ? palette.primary : palette.card }]}>
          <Text style={[styles.stepNum, { color: palette.ink }]}>{step}</Text>
        </View>
        <Text style={[styles.label, { color: palette.foreground }]}>{label}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value ?? placeholder}`}
        accessibilityHint={disabledReason ?? 'Opens the choices'}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [
          styles.box,
          { borderColor: palette.ink, backgroundColor: palette.card, opacity: disabled ? 0.5 : 1 },
          hardShadow(Neo.shadow.md, palette.ink),
          pressed && styles.sink,
        ]}
      >
        <Text style={[styles.value, { color: value ? palette.foreground : palette.mutedForeground }]} numberOfLines={2}>
          {value ?? placeholder}
        </Text>
        <Icon name={{ ios: 'chevron.down', android: 'expand_more' }} color={palette.foreground} size={18} />
      </Pressable>
      {disabledReason ? <Text style={[styles.reason, { color: palette.mutedForeground }]}>{disabledReason}</Text> : null}
    </View>
  );
}

// ─── The choice sheets ─────────────────────────────────────────────────────

function Check({ on, round = false }: { on: boolean; round?: boolean }) {
  const palette = usePalette();
  return (
    <View style={[round ? styles.radio : styles.check, { borderColor: palette.ink, backgroundColor: on ? palette.primary : palette.card }]}>
      {on ? round ? <View style={[styles.radioDot, { backgroundColor: palette.ink }]} /> : <Icon name={{ ios: 'checkmark', android: 'check' }} color={palette.ink} size={15} /> : null}
    </View>
  );
}

function Row({ label, hint, on, round, onPress, disabled = false }: { label: string; hint?: string; on: boolean; round?: boolean; onPress: () => void; disabled?: boolean }) {
  const palette = usePalette();
  return (
    <Pressable
      accessibilityRole={round ? 'radio' : 'checkbox'}
      accessibilityState={{ checked: on, disabled }}
      accessibilityLabel={hint ? `${label}. ${hint}` : label}
      disabled={disabled}
      onPress={() => {
        haptic.select();
        onPress();
      }}
      style={({ pressed }) => [styles.row, { borderBottomColor: palette.border, opacity: disabled ? 0.45 : 1 }, pressed && { backgroundColor: palette.muted }]}
    >
      <Check on={on} round={round} />
      <View style={styles.flex}>
        <Text style={[styles.rowLabel, { color: palette.foreground }]}>{label}</Text>
        {hint ? <Text style={[styles.rowHint, { color: palette.mutedForeground }]}>{hint}</Text> : null}
      </View>
    </Pressable>
  );
}

function SubjectsSheet({ visible, all, value, onChange, onClose }: { visible: boolean; all: SchoolSubject[]; value: SchoolSubject[]; onChange: (v: SchoolSubject[]) => void; onClose: () => void }) {
  return (
    <DetailSheet visible={visible} title="Subjects" onClose={onClose} footer={<Button label={value.length ? `Done · ${value.length} picked` : 'Done'} onPress={onClose} />}>
      <Muted>Pick one or more.</Muted>
      <View>
        {all.map((s) => (
          <Row key={s} label={s} on={value.includes(s)} onPress={() => onChange(value.includes(s) ? value.filter((x) => x !== s) : all.filter((x) => x === s || value.includes(x)))} />
        ))}
      </View>
    </DetailSheet>
  );
}

function ChoiceSheet({ visible, title, options, value, onPick, onClose }: { visible: boolean; title: string; options: { key: string; label: string; hint?: string }[]; value: string; onPick: (key: string) => void; onClose: () => void }) {
  return (
    <DetailSheet visible={visible} title={title} onClose={onClose}>
      <View>
        {options.map((o) => (
          <Row key={o.key} label={o.label} hint={o.hint} round on={o.key === value} onPress={() => onPick(o.key)} />
        ))}
      </View>
    </DetailSheet>
  );
}

/** Short names so three subject tabs fit on a narrow phone. */
const tabName = (s: SchoolSubject) => (s === 'Mathematics' ? 'Maths' : s);

type TreeProps = {
  chaptersBy: Map<SchoolSubject, PracticeChapter[]>;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
};

/**
 * What the chapter and topic sheets share: a search box and, with several
 * subjects, one tab each (showing how many are picked there), both pinned
 * while the list scrolls. Switching tabs starts the list from the top.
 */
function useSubjectTabs(subjects: SchoolSubject[]) {
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<SchoolSubject | null>(null);
  const listRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  // A subject taken out can't stay open here.
  const subject = tab && subjects.includes(tab) ? tab : subjects[0];
  const showTab = (s: SchoolSubject) => {
    setTab(s);
    listRef.current?.scrollTo({ y: 0, animated: false });
  };
  return { search, setSearch, query: search.trim().toLowerCase(), subject, showTab, listRef };
}

function PinnedSearchTabs({
  search,
  onSearch,
  placeholder,
  subjects,
  subject,
  countIn,
  onTab,
  clearLabel,
  onClear,
}: {
  search: string;
  onSearch: (v: string) => void;
  placeholder: string;
  subjects: SchoolSubject[];
  subject: SchoolSubject;
  countIn: (s: SchoolSubject) => number;
  onTab: (s: SchoolSubject) => void;
  clearLabel: string;
  onClear: (() => void) | null;
}) {
  const palette = usePalette();
  return (
    <>
      <View style={[styles.search, { borderColor: palette.ink, backgroundColor: palette.card }]}>
        <Icon name={{ ios: 'magnifyingglass', android: 'search' }} color={palette.mutedForeground} size={16} />
        <TextInput
          value={search}
          onChangeText={onSearch}
          placeholder={placeholder}
          placeholderTextColor={palette.mutedForeground}
          accessibilityLabel={placeholder}
          autoCorrect={false}
          style={[styles.searchInput, { color: palette.foreground }]}
        />
        {onClear ? (
          <Pressable accessibilityRole="button" accessibilityLabel={clearLabel} onPress={onClear} hitSlop={8}>
            <Text style={[styles.clear, { color: palette.foreground }]}>Clear</Text>
          </Pressable>
        ) : null}
      </View>
      {subjects.length > 1 ? (
        <Segmented
          label="Subject"
          value={subject}
          onChange={(s) => {
            haptic.select();
            onTab(s);
          }}
          options={subjects.map((s) => ({ value: s, label: tabName(s), count: countIn(s) || undefined }))}
        />
      ) : (
        <Text style={[styles.overline, { color: palette.mutedForeground }]}>{subject.toUpperCase()}</Text>
      )}
    </>
  );
}

/** Empty states, and a way to the subject that has the matches when this one has none. */
function NoMatches({ query, subject, elsewhere, onTab, empty }: { query: string; subject: SchoolSubject; elsewhere: SchoolSubject[]; onTab: (s: SchoolSubject) => void; empty: string }) {
  return (
    <>
      <Muted>{query ? `Nothing in ${subject} matches.` : empty}</Muted>
      {elsewhere.map((s) => (
        <Button key={s} label={`See matches in ${s}`} variant="secondary" onPress={() => onTab(s)} />
      ))}
    </>
  );
}

/** Step 2: chapters of the subjects picked. Up to 10 (each needs at least one topic). */
function ChaptersSheet({
  visible,
  subjects,
  chaptersBy,
  loading,
  error,
  onRetry,
  value,
  onChange,
  onClose,
}: TreeProps & { visible: boolean; subjects: SchoolSubject[]; value: PickedChapterRef[]; onChange: (v: PickedChapterRef[]) => void; onClose: () => void }) {
  const { search, setSearch, query, subject, showTab, listRef } = useSubjectTabs(subjects);
  const named = (text: string) => text.toLowerCase().includes(query);
  const shownIn = (s: SchoolSubject) => (chaptersBy.get(s) ?? []).filter((c) => !query || named(c.chapter) || c.topics.some((t) => named(t.topic)));
  const list = subject ? shownIn(subject) : [];
  const elsewhere = query && !list.length ? subjects.filter((s) => s !== subject && shownIn(s).length) : [];
  const keys = new Set(value.map(chapterKeyOf));
  const full = value.length >= MAX_TOPICS;
  const toggle = (c: PickedChapterRef) => {
    const k = chapterKeyOf(c);
    if (keys.has(k)) onChange(value.filter((x) => chapterKeyOf(x) !== k));
    else if (!full) onChange([...value, c]);
  };

  return (
    <DetailSheet
      visible={visible}
      title="Chapters"
      onClose={onClose}
      scrollRef={listRef}
      footer={<Button label={value.length ? `Done · ${value.length} picked` : 'Done'} onPress={onClose} />}
      pinned={
        <PinnedSearchTabs
          search={search}
          onSearch={setSearch}
          placeholder="Search chapters"
          subjects={subjects}
          subject={subject}
          countIn={(s) => value.filter((c) => c.subject === s).length}
          onTab={showTab}
          clearLabel="Clear the chapters picked"
          onClear={value.length ? () => onChange([]) : null}
        />
      }
    >
      <Muted>{full ? `That's ${MAX_TOPICS} chapters, the most for one practice. Take one off to pick another.` : 'Pick one or more. You choose their topics next.'}</Muted>
      {loading && !chaptersBy.size ? (
        <LoadingView label="Loading chapters…" />
      ) : error ? (
        <ErrorView message={error} onRetry={onRetry} />
      ) : (
        <View>
          {!list.length ? <NoMatches query={query} subject={subject} elsewhere={elsewhere} onTab={showTab} empty="No chapters yet." /> : null}
          {list.map((c) => {
            const ref: PickedChapterRef = { subject, standard: c.standard, chapter: c.chapter };
            const on = keys.has(chapterKeyOf(ref));
            const hits = query && !named(c.chapter) ? c.topics.filter((t) => named(t.topic)).length : 0;
            const hint = `${c.standard} · ${hits ? `${hits} topic${hits === 1 ? '' : 's'} match` : c.topics.length ? `${c.topics.length} topics` : 'whole chapter'}`;
            return <Row key={chapterKeyOf(ref)} label={c.chapter} hint={hint} on={on} disabled={full && !on} onPress={() => toggle(ref)} />;
          })}
        </View>
      )}
    </DetailSheet>
  );
}

/** Step 3: topics of the chapters picked, under each chapter's name. Up to 10 in all. */
function TopicsSheet({
  visible,
  chapters,
  chaptersBy,
  loading,
  error,
  onRetry,
  value,
  onChange,
  onClose,
}: TreeProps & { visible: boolean; chapters: PickedChapterRef[]; value: Picked[]; onChange: (v: Picked[]) => void; onClose: () => void }) {
  const palette = usePalette();
  // Only the subjects that have a chapter picked get a tab.
  const subjects = chapters.reduce<SchoolSubject[]>((acc, c) => (acc.includes(c.subject) ? acc : [...acc, c.subject]), []);
  const { search, setSearch, query, subject, showTab, listRef } = useSubjectTabs(subjects);
  const named = (text: string) => text.toLowerCase().includes(query);
  // The picked chapters of a subject, in the syllabus order, each with the topics the search leaves.
  const groupsIn = (s: SchoolSubject) =>
    (chaptersBy.get(s) ?? [])
      .filter((c) => chapters.some((x) => x.subject === s && x.standard === c.standard && x.chapter === c.chapter))
      .map((c) => ({ c, shown: !query || named(c.chapter) ? c.topics : c.topics.filter((t) => named(t.topic)) }))
      .filter(({ c, shown }) => shown.length || (!c.topics.length && (!query || named(c.chapter))));
  const groups = subject ? groupsIn(subject) : [];
  const elsewhere = query && !groups.length ? subjects.filter((s) => s !== subject && groupsIn(s).length) : [];
  const keys = new Set(value.map(keyOf));
  const full = value.length >= MAX_TOPICS;
  const toggle = (p: Picked) => {
    const k = keyOf(p);
    if (keys.has(k)) onChange(value.filter((x) => keyOf(x) !== k));
    else if (!full) onChange([...value, p]);
  };
  const row = (p: Picked, label: string) => {
    const on = keys.has(keyOf(p));
    return <Row key={keyOf(p)} label={label} on={on} disabled={full && !on} onPress={() => toggle(p)} />;
  };

  return (
    <DetailSheet
      visible={visible}
      title="Topics"
      onClose={onClose}
      scrollRef={listRef}
      footer={<Button label={value.length ? `Done · ${value.length} of ${MAX_TOPICS} picked` : 'Done'} onPress={onClose} />}
      pinned={
        subject ? (
          <PinnedSearchTabs
            search={search}
            onSearch={setSearch}
            placeholder="Search topics"
            subjects={subjects}
            subject={subject}
            countIn={(s) => value.filter((p) => p.subject === s).length}
            onTab={showTab}
            clearLabel="Clear the topics picked"
            onClear={value.length ? () => onChange([]) : null}
          />
        ) : null
      }
    >
      <Muted>{full ? `That's ${MAX_TOPICS} topics, the most for one practice. Take one off to pick another.` : `Pick up to ${MAX_TOPICS} topics from your chapters.`}</Muted>
      {loading && !chaptersBy.size ? (
        <LoadingView label="Loading topics…" />
      ) : error ? (
        <ErrorView message={error} onRetry={onRetry} />
      ) : !subject ? (
        <Muted>Choose chapters first.</Muted>
      ) : (
        <View style={styles.groups}>
          {!groups.length ? <NoMatches query={query} subject={subject} elsewhere={elsewhere} onTab={showTab} empty="No topics here yet." /> : null}
          {groups.map(({ c, shown }) => {
            const base = { subject, standard: c.standard, chapter: c.chapter };
            const pickedHere = value.filter((p) => p.subject === subject && p.standard === c.standard && p.chapter === c.chapter).length;
            return (
              <View key={chapterKeyOf(base)}>
                <View style={[styles.groupHead, { borderBottomColor: palette.border }]}>
                  <Text style={[styles.chapterName, styles.flex, { color: palette.foreground }]}>{c.chapter}</Text>
                  <Text style={[styles.rowHint, { color: palette.mutedForeground }]}>
                    {c.standard}
                    {pickedHere ? ` · ${pickedHere} picked` : ''}
                  </Text>
                </View>
                {/* A chapter without named topics is one topic, taken whole. */}
                {!c.topics.length ? row({ ...base, topic: '' }, 'Whole chapter') : shown.map((t) => row({ ...base, topic: t.topic }, t.topic))}
              </View>
            );
          })}
        </View>
      )}
    </DetailSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  body: { padding: 16, gap: 20, paddingBottom: 32 },
  field: { gap: 8 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepDot: { width: 24, height: 24, borderRadius: 12, borderWidth: Neo.border.width, alignItems: 'center', justifyContent: 'center' },
  stepNum: { fontSize: 12, fontFamily: face.heavy },
  label: { fontSize: 16, fontFamily: face.semibold },
  box: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 16, paddingVertical: 12, borderWidth: Neo.border.width, borderRadius: Neo.radius.md, marginRight: Neo.shadow.md, marginBottom: Neo.shadow.md },
  sink: { transform: [{ translateX: 2 }, { translateY: 2 }] },
  value: { flex: 1, fontSize: 15, lineHeight: 21, fontFamily: face.medium },
  reason: { fontSize: 13, lineHeight: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingVertical: 10, borderBottomWidth: Neo.border.width },
  rowLabel: { fontSize: 15, lineHeight: 21, fontFamily: face.medium },
  rowHint: { fontSize: 13, lineHeight: 18, marginTop: 1 },
  check: { width: 24, height: 24, borderRadius: Neo.radius.xs, borderWidth: Neo.border.width, alignItems: 'center', justifyContent: 'center' },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: Neo.border.width, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: Neo.border.width, borderRadius: Neo.radius.md, paddingHorizontal: 12, minHeight: 48 },
  searchInput: { flex: 1, fontSize: 15, minHeight: 44 },
  clear: { fontSize: 14, fontFamily: face.bold, textDecorationLine: 'underline' },
  overline: { fontSize: 12, letterSpacing: 1.1, fontFamily: face.semibold },
  chapterName: { fontSize: 15, lineHeight: 21, fontFamily: face.semibold },
  groups: { gap: 16 },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: Neo.border.width },
});
