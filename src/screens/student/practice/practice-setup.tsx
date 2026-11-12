import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '@/components/app-text';
import { Button, DetailSheet, ErrorText, Icon, LoadingView, Muted, useLoad, usePalette, ErrorView } from '@/components/kit';
import { KeyboardSafeView } from '@/components/keyboard-safe-view';
import { Reason } from '@/components/states';
import { programOf, programSubjects, type SchoolSubject } from '@/constants/school';
import { useSignedInUser } from '@/context/auth-context';
import { haptic } from '@/design/haptics';
import { hardShadow, Neo } from '@/design/tokens';
import { face } from '@/design/type';
import { column, SheetFooter, SheetHeader, type TopicPick } from '@/screens/student/assessment-session';
import { MAX_TOPICS, PER_TOPIC_MAX, PER_TOPIC_MIN, scopeFromPicked, suggestedMinutes, type PickedTopicRef } from '@/screens/student/self-assessment';
import { studentApi, type AssessmentDetail, type AssessmentPool, type PracticeChapter } from '@/services/student-api';

// Start practice, as four dropdowns in the order students think it through:
// Subjects (several) → Topics (several, from those subjects) → Question type
// (PYQs, other questions or both) → How many questions (5–15 per topic
// picked). Then one button makes the test and opens its first question.
// Each dropdown opens a sheet with the choices; the next one waits until the
// one before it has something picked, and says why.

const POOLS: { value: AssessmentPool; label: string; hint: string }[] = [
  { value: 'all', label: 'PYQs + other questions', hint: 'Past-year questions mixed with the rest of the bank' },
  { value: 'pyqs', label: 'PYQs only', hint: 'Only past-year exam questions' },
  { value: 'others', label: 'Other questions only', hint: 'No past-year questions' },
];

type Sheet = 'subjects' | 'topics' | 'type' | 'count' | null;

const keyOf = (p: PickedTopicRef) => `${p.subject}|${p.standard}|${p.chapter}|${p.topic}`;
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
type Picked = PickedTopicRef;

export function PracticeSetup({
  initialSubject,
  preset,
  onBack,
  onCreated,
}: {
  initialSubject: SchoolSubject;
  /** "Retake my weak topics": these topics come picked. */
  preset: TopicPick[] | null;
  onBack: () => void;
  /** The test, made and started: practice opens on its first question. */
  onCreated: (detail: AssessmentDetail) => void;
}) {
  const user = useSignedInUser();
  const all = programSubjects(programOf(user));
  const [subjects, setSubjects] = useState<SchoolSubject[]>(() => [all.includes(initialSubject) ? initialSubject : all[0]]);
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

  // Retake: pick the result's weak topics once their chapters are here.
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
    setPicked(next);
  }

  const topics = picked.length;
  const count = topics * perTopic;
  const blocked = !subjects.length ? 'Choose at least one subject.' : !topics ? 'Choose at least one topic.' : null;

  const pickSubjects = (next: SchoolSubject[]) => {
    setSubjects(next);
    // Topics of a subject taken out go with it.
    setPicked((prev) => prev.filter((p) => next.includes(p.subject)));
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

  const topicNames = picked.map((p) => p.topic || p.chapter);
  return (
    <KeyboardSafeView>
      <SheetHeader title="Start practice" onBack={onBack} />
      <ScrollView contentContainerStyle={[styles.body, column]} keyboardShouldPersistTaps="handled">
        <Muted>Choose what to practise. You can pick several subjects and topics.</Muted>

        <Dropdown
          step={1}
          label="Subjects"
          value={subjects.length ? subjects.join(', ') : null}
          placeholder="Choose subjects"
          onPress={() => setSheet('subjects')}
        />
        <Dropdown
          step={2}
          label="Topics"
          value={topics ? `${topics} topic${topics === 1 ? '' : 's'}: ${topicNames.slice(0, 2).join(', ')}${topics > 2 ? ` +${topics - 2}` : ''}` : null}
          placeholder="Choose topics"
          disabledReason={!subjects.length ? 'Choose a subject first.' : null}
          onPress={() => setSheet('topics')}
        />
        <Dropdown step={3} label="Question type" value={POOLS.find((p) => p.value === pool)!.label} placeholder="" onPress={() => setSheet('type')} />
        <Dropdown
          step={4}
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
      <TopicsSheet
        visible={sheet === 'topics'}
        subjects={subjects}
        chaptersBy={chaptersBy}
        loading={trees.loading}
        error={trees.error && !trees.data ? trees.error : null}
        onRetry={trees.reload}
        value={picked}
        onChange={setPicked}
        onClose={() => setSheet(null)}
      />
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

function Row({ label, hint, on, round, onPress, indent = false, disabled = false }: { label: string; hint?: string; on: boolean; round?: boolean; onPress: () => void; indent?: boolean; disabled?: boolean }) {
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
      style={({ pressed }) => [styles.row, indent && styles.indent, { borderBottomColor: palette.border, opacity: disabled ? 0.45 : 1 }, pressed && { backgroundColor: palette.muted }]}
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

/**
 * Topics from the subjects picked: subject, then chapters (tap to open), then
 * their topics; a search finds a chapter or topic by name. Up to 10 topics.
 */
function TopicsSheet({
  visible,
  subjects,
  chaptersBy,
  loading,
  error,
  onRetry,
  value,
  onChange,
  onClose,
}: {
  visible: boolean;
  subjects: SchoolSubject[];
  chaptersBy: Map<SchoolSubject, PracticeChapter[]>;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  value: Picked[];
  onChange: (v: Picked[]) => void;
  onClose: () => void;
}) {
  const palette = usePalette();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const query = search.trim().toLowerCase();
  const keys = new Set(value.map(keyOf));
  const full = value.length >= MAX_TOPICS;
  const toggle = (p: Picked) => {
    const k = keyOf(p);
    if (keys.has(k)) onChange(value.filter((x) => keyOf(x) !== k));
    else if (!full) onChange([...value, p]);
  };

  return (
    <DetailSheet
      visible={visible}
      title="Topics"
      onClose={onClose}
      footer={<Button label={value.length ? `Done · ${value.length} of ${MAX_TOPICS} picked` : 'Done'} onPress={onClose} />}
    >
      <View style={[styles.search, { borderColor: palette.ink, backgroundColor: palette.card }]}>
        <Icon name={{ ios: 'magnifyingglass', android: 'search' }} color={palette.mutedForeground} size={16} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search chapters and topics"
          placeholderTextColor={palette.mutedForeground}
          accessibilityLabel="Search chapters and topics"
          autoCorrect={false}
          style={[styles.searchInput, { color: palette.foreground }]}
        />
        {value.length ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Clear the topics picked" onPress={() => onChange([])} hitSlop={8}>
            <Text style={[styles.clear, { color: palette.foreground }]}>Clear</Text>
          </Pressable>
        ) : null}
      </View>
      <Muted>{full ? `That's ${MAX_TOPICS} topics, the most for one practice. Take one off to pick another.` : `Pick up to ${MAX_TOPICS} topics.`}</Muted>

      {loading && !chaptersBy.size ? (
        <LoadingView label="Loading chapters…" />
      ) : error ? (
        <ErrorView message={error} onRetry={onRetry} />
      ) : (
        subjects.map((subject) => {
          const chapters = (chaptersBy.get(subject) ?? []).filter(
            (c) => !query || c.chapter.toLowerCase().includes(query) || c.topics.some((t) => t.topic.toLowerCase().includes(query))
          );
          return (
            <View key={subject} style={styles.subjectBlock}>
              <Text style={[styles.overline, { color: palette.mutedForeground }]}>{subject.toUpperCase()}</Text>
              {!chapters.length ? <Muted>{query ? 'Nothing matches.' : 'No chapters yet.'}</Muted> : null}
              {chapters.map((c) => {
                const ck = `${subject}|${c.standard}|${c.chapter}`;
                const isOpen = !!query || open.has(ck);
                const pickedHere = value.filter((p) => p.subject === subject && p.standard === c.standard && p.chapter === c.chapter).length;
                const whole: Picked = { subject, standard: c.standard, chapter: c.chapter, topic: '' };
                if (!c.topics.length) {
                  // A chapter without named topics is one topic, taken whole.
                  return <Row key={ck} label={c.chapter} hint={c.standard} on={keys.has(keyOf(whole))} disabled={full && !keys.has(keyOf(whole))} onPress={() => toggle(whole)} />;
                }
                const topicsShown = query && !c.chapter.toLowerCase().includes(query) ? c.topics.filter((t) => t.topic.toLowerCase().includes(query)) : c.topics;
                return (
                  <View key={ck}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ expanded: isOpen }}
                      accessibilityLabel={`${c.chapter}, ${c.standard}${pickedHere ? `, ${pickedHere} picked` : ''}`}
                      onPress={() => setOpen((prev) => {
                        const next = new Set(prev);
                        if (next.has(ck)) next.delete(ck);
                        else next.add(ck);
                        return next;
                      })}
                      style={({ pressed }) => [styles.chapterRow, { borderBottomColor: palette.border }, pressed && { backgroundColor: palette.muted }]}
                    >
                      <View style={styles.flex}>
                        <Text style={[styles.chapterName, { color: palette.foreground }]}>{c.chapter}</Text>
                        <Text style={[styles.rowHint, { color: palette.mutedForeground }]}>
                          {c.standard} · {c.topics.length} topics{pickedHere ? ` · ${pickedHere} picked` : ''}
                        </Text>
                      </View>
                      <Icon name={isOpen ? { ios: 'chevron.up', android: 'expand_less' } : { ios: 'chevron.down', android: 'expand_more' }} color={palette.foreground} size={16} />
                    </Pressable>
                    {isOpen
                      ? topicsShown.map((t) => {
                          const item: Picked = { subject, standard: c.standard, chapter: c.chapter, topic: t.topic };
                          const on = keys.has(keyOf(item));
                          return <Row key={keyOf(item)} label={t.topic} indent on={on} disabled={full && !on} onPress={() => toggle(item)} />;
                        })
                      : null}
                  </View>
                );
              })}
            </View>
          );
        })
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
  indent: { paddingLeft: 16 },
  rowLabel: { fontSize: 15, lineHeight: 21, fontFamily: face.medium },
  rowHint: { fontSize: 13, lineHeight: 18, marginTop: 1 },
  check: { width: 24, height: 24, borderRadius: Neo.radius.xs, borderWidth: Neo.border.width, alignItems: 'center', justifyContent: 'center' },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: Neo.border.width, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: Neo.border.width, borderRadius: Neo.radius.md, paddingHorizontal: 12, minHeight: 48 },
  searchInput: { flex: 1, fontSize: 15, minHeight: 44 },
  clear: { fontSize: 14, fontFamily: face.bold, textDecorationLine: 'underline' },
  subjectBlock: { gap: 4 },
  overline: { fontSize: 12, letterSpacing: 1.1, fontFamily: face.semibold, marginTop: 8 },
  chapterRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 10, borderBottomWidth: Neo.border.width },
  chapterName: { fontSize: 15, lineHeight: 21, fontFamily: face.semibold },
});
