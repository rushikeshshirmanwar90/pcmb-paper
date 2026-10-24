import React, { useState, memo, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { getPalette, MaxContentWidth } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { DropdownSelect } from '@/components/dropdown-select';
import { MultiSelectDropdown } from '@/components/multi-select-dropdown';
import { useChapterTopicOptions } from '@/hooks/use-chapter-topic-options';
import { ALL_STANDARDS, SUBJECTS_BY_TRACK, trackOf } from '@/constants/syllabus';
import { MathText } from './math-text';
import { Explanation } from './explanation';
import type {
  DifficultyLevel,
  ExamCategory,
  ExamRoom,
  Question,
  Standard,
  Subject,
} from '@/types/pcmb';
import { fetchQuestionPool, QuestionLoadError } from '@/services/apiService';
import { useKeepServerConnection } from '@/hooks/use-keep-server-connection';

interface CreateExamModalProps {
  visible: boolean;
  onClose: () => void;
  onRoomCreated: (room: ExamRoom) => void;
}

const DIFFICULTIES: DifficultyLevel[] = ['Easy', 'Mid', 'Hard'];

const MARKS_PER_QUESTION = 4;

/** 45 → "45 min", 90 → "1 hr 30 min", 180 → "3 hr" */
function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest} min`;
  return rest ? `${hours} hr ${rest} min` : `${hours} hr`;
}

/** A new room's id, and the short code students type to join it, e.g. NEET-4821. */
function newRoomKeys(examCategory: ExamCategory) {
  const prefix = examCategory === 'JEE/NEET' ? 'NEET' : 'FOUND';
  return { _id: `room-${Date.now()}`, roomCode: `${prefix}-${Math.floor(1000 + Math.random() * 9000)}` };
}

// What the number fields accept.
const QUESTION_RANGE = { min: 1, max: 300 };
const MINUTES_RANGE = { min: 5, max: 600 };

/** The typed value as a whole number within the range, else null. */
function wholeNumberIn(text: string, { min, max }: { min: number; max: number }) {
  const value = Number(text);
  return text !== '' && Number.isInteger(value) && value >= min && value <= max ? value : null;
}

type Choice<T> = { value: T; label: string };

const LEVEL_CHOICES: Choice<DifficultyLevel>[] = [
  { value: 'Easy', label: 'Easy' },
  { value: 'Mid', label: 'Medium' },
  { value: 'Hard', label: 'Hard' },
];

/** "a room name, a class and a subject" */
function listWords(words: string[]) {
  return words.length <= 1 ? words.join('') : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
}

/** `count` questions spread evenly through the list, not just its first ones. */
function spreadPick(questions: Question[], count: number): string[] {
  if (questions.length <= count) return questions.map((q) => q._id);
  const step = questions.length / count;
  return Array.from({ length: count }, (_, i) => questions[Math.floor(i * step)]._id);
}

/**
 * The questions to start with: `count` of them shared out evenly between the
 * groups (each picked topic or chapter), so every one of them is in the room.
 */
function balancedPick(groups: Question[][], count: number): string[] {
  const shares = groups.map(() => 0);
  let left = Math.min(count, groups.reduce((sum, group) => sum + group.length, 0));
  while (left > 0) {
    for (let i = 0; i < groups.length && left > 0; i++) {
      if (shares[i] < groups[i].length) {
        shares[i]++;
        left--;
      }
    }
  }
  return groups.flatMap((group, i) => spreadPick(group, shares[i]));
}

export function CreateExamModal({ visible, onClose, onRoomCreated }: CreateExamModalProps) {
  const scheme = useColorScheme();
  const palette = getPalette(scheme === 'dark');
  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[styles.root, { backgroundColor: palette.background }]}>
        <CreateRoomFlow onClose={onClose} onRoomCreated={onRoomCreated} />
      </SafeAreaView>
    </Modal>
  );
}

// ─── Choice chips: a row of tap-to-choose buttons ───────────────────────────

interface ChipGroupProps<T> {
  label: string;
  /** Muted note beside the label, e.g. the track a class belongs to. */
  hint?: string;
  choices: Choice<T>[];
  /** Shown instead of the chips while there is nothing to choose yet. */
  disabledText?: string;
  /** Lay the chips out as an even grid this many across, instead of wrapping by width. */
  columns?: number;
}

function ChipGroup<T extends string | number>({
  label,
  hint,
  choices,
  disabledText,
  columns,
  role,
  isSelected,
  onPress,
}: ChipGroupProps<T> & {
  role: 'radio' | 'checkbox';
  isSelected: (value: T) => boolean;
  onPress: (value: T) => void;
}) {
  const scheme = useColorScheme();
  const palette = getPalette(scheme === 'dark');

  return (
    <View style={styles.fieldGroup}>
      <View style={styles.labelRow}>
        <Text style={[styles.fieldLabel, styles.fieldLabelInRow, { color: palette.mutedForeground }]}>{label}</Text>
        {hint ? <Text style={[styles.labelHint, { color: palette.mutedForeground }]}>{hint}</Text> : null}
      </View>
      {disabledText ? (
        <View style={[styles.chipPlaceholder, { borderColor: palette.border }]}>
          <Text style={[styles.chipPlaceholderText, { color: palette.mutedForeground }]}>{disabledText}</Text>
        </View>
      ) : (
        <View style={styles.chipRow} accessibilityRole={role === 'radio' ? 'radiogroup' : undefined} accessibilityLabel={label}>
          {choices.map((choice) => {
            const selected = isSelected(choice.value);
            return (
              <Pressable
                key={String(choice.value)}
                accessibilityRole={role}
                accessibilityState={{ checked: selected }}
                onPress={() => onPress(choice.value)}
                style={({ pressed }) => [
                  styles.chip,
                  columns ? { flexGrow: 1, flexBasis: `${Math.floor(100 / columns) - 4}%`, minWidth: 0 } : null,
                  {
                    backgroundColor: selected ? palette.primarySoft : palette.card,
                    borderColor: selected ? palette.primary : palette.border,
                  },
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  numberOfLines={1}
                  style={[
                    styles.chipText,
                    {
                      color: selected ? palette.primaryInk : palette.foreground,
                      fontWeight: selected ? '700' : '500',
                    },
                  ]}
                >
                  {choice.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

/** Pick exactly one. */
function ChoiceChips<T extends string | number>({
  selected,
  onSelect,
  ...group
}: ChipGroupProps<T> & { selected: T | null; onSelect: (value: T) => void }) {
  return <ChipGroup {...group} role="radio" isSelected={(value) => value === selected} onPress={onSelect} />;
}

const ANY = '__any__';

/** Pick any number; the leading "Any" chip stands for picking none, and clears the picks. */
function MultiChoiceChips<T extends string>({
  selected,
  onChange,
  anyLabel = 'Any',
  choices,
  ...group
}: ChipGroupProps<T> & { selected: T[]; onChange: (values: T[]) => void; anyLabel?: string }) {
  const toggle = (value: string) => {
    if (value === ANY) return onChange([]);
    const next = selected.includes(value as T) ? selected.filter((v) => v !== value) : [...selected, value as T];
    // Keep the picks in the chips' order.
    onChange(choices.map((choice) => choice.value).filter((v) => next.includes(v)));
  };
  return (
    <ChipGroup<string>
      {...group}
      choices={[{ value: ANY, label: anyLabel }, ...choices]}
      role="checkbox"
      isSelected={(value) => (value === ANY ? selected.length === 0 : selected.includes(value as T))}
      onPress={toggle}
    />
  );
}

// ─── Number field: a typed whole number with its unit ──────────────────────

function NumberField({
  label,
  unit,
  value,
  onChange,
  range,
}: {
  label: string;
  unit: string;
  value: string;
  onChange: (text: string) => void;
  range: { min: number; max: number };
}) {
  const scheme = useColorScheme();
  const palette = getPalette(scheme === 'dark');
  const invalid = wholeNumberIn(value, range) === null;

  return (
    <View style={[styles.fieldGroup, styles.numberField]}>
      <Text style={[styles.fieldLabel, { color: palette.mutedForeground }]}>{label}</Text>
      <View
        style={[
          styles.numberInput,
          { backgroundColor: palette.card, borderColor: invalid ? palette.danger : palette.border },
        ]}
      >
        <TextInput
          value={value}
          // Digits only; whatever else is typed or pasted is dropped.
          onChangeText={(text) => onChange(text.replace(/[^0-9]/g, ''))}
          // "020" reads back as "20".
          onBlur={() => value && onChange(String(Number(value)))}
          keyboardType="number-pad"
          inputMode="numeric"
          returnKeyType="done"
          maxLength={3}
          placeholder={`${range.min}`}
          placeholderTextColor={palette.mutedForeground}
          accessibilityLabel={`${label}, in ${unit}`}
          accessibilityHint={`From ${range.min} to ${range.max}`}
          style={[styles.numberText, { color: palette.foreground }]}
        />
        <Text style={[styles.unitText, { color: palette.mutedForeground }]}>{unit}</Text>
      </View>
      <Text style={[styles.fieldHint, { color: invalid ? palette.dangerInk : palette.mutedForeground }]}>
        {range.min} to {range.max}
      </Text>
    </View>
  );
}

// ─── Memoized Question Review Item for 60fps rendering ──────────────────────

interface QuestionReviewCardProps {
  question: Question;
  index: number;
  isSelected: boolean;
  onToggle: (id: string) => void;
  onEdit: (q: Question) => void;
  dark: boolean;
}

const QuestionReviewCard = memo(function QuestionReviewCard({
  question,
  index,
  isSelected,
  onToggle,
  onEdit,
  dark,
}: QuestionReviewCardProps) {
  const palette = getPalette(dark);

  return (
    <View
      style={[
        styles.questionItemCard,
        {
          backgroundColor: palette.card,
          borderColor: isSelected ? palette.primary : palette.border,
          borderWidth: isSelected ? 1.5 : 1,
        },
      ]}
    >
      <View style={styles.qCardTop}>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: isSelected }}
          accessibilityLabel={`Question ${index + 1}`}
          onPress={() => onToggle(question._id)}
          style={styles.checkboxRow}
          hitSlop={8}
        >
          <View
            style={[
              styles.checkbox,
              {
                backgroundColor: isSelected ? palette.primary : 'transparent',
                borderColor: isSelected ? palette.primary : palette.border,
              },
            ]}
          >
            {isSelected && (
              <SymbolView
                name={{ ios: 'checkmark', android: 'check', web: 'check' }}
                tintColor={palette.onPrimary}
                size={14}
              />
            )}
          </View>
          <Text style={[styles.qIndexText, { color: palette.primary }]}>
            Q{index + 1} · {question.topic || question.subject}
          </Text>
        </Pressable>

        {/* Edit Question Trigger */}
        <Pressable
          onPress={() => onEdit(question)}
          style={[styles.editBtn, { backgroundColor: palette.primarySoft }]}
          hitSlop={6}
        >
          <SymbolView
            name={{ ios: 'pencil', android: 'edit', web: 'edit' }}
            tintColor={palette.primary}
            size={13}
          />
          <Text style={[styles.editBtnText, { color: palette.primary }]}>Edit</Text>
        </Pressable>
      </View>

      {/* Question Content */}
      <View style={{ marginBottom: 8 }}>
        <MathText text={question.questionText} fontSize={14} color={palette.foreground} />
      </View>

      {/* Options Preview */}
      <View style={styles.optionsPreviewGrid}>
        {[
          ['A', question.optionA],
          ['B', question.optionB],
          ['C', question.optionC],
          ['D', question.optionD],
        ].map(([optKey, optText]) => {
          const isCorrect = question.correctAnswer === optKey;
          return (
            <View
              key={optKey}
              style={[
                styles.optPreviewBox,
                {
                  backgroundColor: isCorrect ? palette.successSoft : palette.background,
                  borderColor: isCorrect ? palette.successBorder : palette.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.optKeyBadge,
                  { color: isCorrect ? palette.success : palette.mutedForeground },
                ]}
              >
                {optKey}.
              </Text>
              <View style={{ flex: 1 }}>
                <MathText
                  text={optText}
                  fontSize={12}
                  color={isCorrect ? palette.successInk : palette.foreground}
                />
              </View>
            </View>
          );
        })}
      </View>

      {/* Explanation Preview */}
      {question.explanation ? (
        <Explanation
          text={question.explanation}
          source={question.source}
          correctAnswer={question.correctAnswer}
          defaultCollapsed
        />
      ) : null}
    </View>
  );
});

// ─── Create-room flow: room details → pick questions → room code ────────────

interface CreateRoomFlowProps {
  onRoomCreated: (room: ExamRoom) => void;
  /** In the modal, closes it; the form inline on the Questions tab has no close. */
  onClose?: () => void;
  /** After the room is made: show it in the Exam Rooms list. */
  onViewRooms?: () => void;
  /** Offers browsing the whole question bank instead of making a room. */
  onBrowse?: () => void;
  /** Space to keep clear at the bottom for the tab bar when shown inline. */
  bottomInset?: number;
  /** Whether the flow is on screen; inline on a tab it stays mounted while other tabs show. */
  active?: boolean;
}

type Step = 'config' | 'questions' | 'success';

export function CreateRoomFlow({
  onRoomCreated,
  onClose,
  onViewRooms,
  onBrowse,
  bottomInset = 0,
  active = true,
}: CreateRoomFlowProps) {
  const scheme = useColorScheme();
  const dark = scheme === 'dark';
  const palette = getPalette(dark);

  const [step, setStep] = useState<Step>('config');
  // The form leads to a request; keep the connection fresh while it's filled in.
  useKeepServerConnection(active && step === 'config');

  // Room details
  const [title, setTitle] = useState('');
  const [standard, setStandard] = useState<Standard | null>(null);
  const [subject, setSubject] = useState<Subject | null>(null);
  // None picked means all of them.
  const [pickedChapters, setPickedChapters] = useState<string[]>([]);
  const [pickedTopics, setPickedTopics] = useState<string[]>([]);
  const [levels, setLevels] = useState<DifficultyLevel[]>([]);
  // Typed in; null until they're a whole number in range.
  const [questionCountText, setQuestionCountText] = useState('20');
  const [durationText, setDurationText] = useState('45');
  const questionCount = wholeNumberIn(questionCountText, QUESTION_RANGE);
  const durationMinutes = wholeNumberIn(durationText, MINUTES_RANGE);

  const examCategory = standard ? trackOf(standard) : null;
  // The whole subject's chapters and topics; chapters only mean something
  // once the subject is known.
  const {
    chapters,
    chapterCounts,
    topicCounts,
    chapterTopics,
    loading: loadingOptions,
  } = useChapterTopicOptions(
    {
      examCategory: examCategory ?? 'All',
      standard: standard ?? 'All',
      subject: subject ?? 'All',
      chapter: 'All',
    },
    { enabled: !!subject }
  );
  // Topics come from the picked chapters, listed under each one.
  const topicSections = pickedChapters
    .map((name) => ({ title: name, options: chapterTopics[name] ?? [] }))
    .filter((section) => section.options.length > 0);
  const topicOptions = [...new Set(topicSections.flatMap((section) => section.options))];

  // Questions to pick from
  const [loading, setLoading] = useState(false);
  // A request had to be retried: the connection is slow or stalled.
  const [slowConnection, setSlowConnection] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [fetchedQuestions, setFetchedQuestions] = useState<Question[]>([]);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<Set<string>>(new Set());

  // Inline question editor
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);

  // Created room
  const [createdRoom, setCreatedRoom] = useState<ExamRoom | null>(null);

  const missing = [
    !title.trim() && 'a room name',
    !standard && 'a class',
    !subject && 'a subject',
    questionCount === null && `${QUESTION_RANGE.min} to ${QUESTION_RANGE.max} questions`,
    durationMinutes === null && `a time of ${MINUTES_RANGE.min} to ${MINUTES_RANGE.max} minutes`,
  ].filter((word): word is string => !!word);
  const selectedCount = selectedQuestionIds.size;

  const chooseStandard = (value: Standard) => {
    setStandard(value);
    // Chapters differ by class; a subject the new class doesn't teach goes too.
    if (subject && !SUBJECTS_BY_TRACK[trackOf(value)].includes(subject)) setSubject(null);
    setPickedChapters([]);
    setPickedTopics([]);
  };

  const chooseChapters = (values: string[]) => {
    // Keep the syllabus order, and drop topics of chapters no longer picked.
    const picked = chapters.filter((name) => values.includes(name));
    setPickedChapters(picked);
    setPickedTopics((prev) => prev.filter((topic) => picked.some((name) => chapterTopics[name]?.includes(topic))));
  };

  // Step 1 -> Step 2: fetch only the questions that match the room
  const handleFetchQuestions = async () => {
    if (!standard || !subject || !examCategory || !title.trim() || questionCount === null) return;

    // One group per picked topic, else per picked chapter, else the whole
    // subject, so every topic or chapter the teacher picked is in the pool.
    const topicsInOrder = topicOptions.filter((topic) => pickedTopics.includes(topic));
    const groups = topicsInOrder.length
      ? topicsInOrder.map((topic) => ({ chapter: pickedChapters.find((name) => chapterTopics[name]?.includes(topic)), topic }))
      : pickedChapters.length
      ? pickedChapters.map((chapter) => ({ chapter }))
      : [{}];
    // About three candidates per question asked for, shared between the groups.
    const poolSize = Math.min(300, Math.max(60, questionCount * 3));
    const perGroup = Math.max(10, Math.ceil(poolSize / groups.length));

    setLoading(true);
    setSlowConnection(false);
    setFetchError(null);
    try {
      const pool = await fetchQuestionPool({ examCategory, standard, subject, groups, levels, perGroup }, () =>
        setSlowConnection(true)
      );
      const seen = new Set<string>();
      const byGroup = pool.map((group) =>
        group.filter((q) => {
          if (seen.has(q._id)) return false;
          seen.add(q._id);
          return true;
        })
      );
      const qs = byGroup.flat();
      if (qs.length === 0) {
        setFetchError('No questions match these choices. Try more chapters or topics, or another level.');
        return;
      }

      setFetchedQuestions(qs);
      setSelectedQuestionIds(new Set(balancedPick(byGroup, questionCount)));
      setStep('questions');
    } catch (error) {
      setFetchError(
        error instanceof QuestionLoadError ? error.message : 'Could not load questions. Check your connection and try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  // Toggle question selection
  const toggleQuestionSelect = useCallback((id: string) => {
    setSelectedQuestionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Save edited question
  const handleSaveEditedQuestion = (updated: Question) => {
    setFetchedQuestions((prev) => prev.map((q) => (q._id === updated._id ? updated : q)));
    setEditingQuestion(null);
  };

  // Final step: create the room
  const handleCreateRoom = () => {
    const selectedList = fetchedQuestions.filter((q) => selectedQuestionIds.has(q._id));
    if (selectedList.length === 0 || !standard || !subject || !examCategory || durationMinutes === null) return;

    const newRoom: ExamRoom = {
      ...newRoomKeys(examCategory),
      title: title.trim(),
      examCategory,
      standard,
      subject,
      difficulty: levels.length === 1 ? levels[0] : 'All',
      durationMinutes,
      totalMarks: selectedList.length * MARKS_PER_QUESTION,
      questions: selectedList,
      createdAt: new Date().toISOString(),
      status: 'active',
    };

    setCreatedRoom(newRoom);
    onRoomCreated(newRoom);
    setStep('success');
  };

  // A teacher often makes several rooms for one class: keep its class,
  // subject and settings, clear the rest.
  const startAnotherRoom = () => {
    setTitle('');
    setPickedChapters([]);
    setPickedTopics([]);
    setFetchedQuestions([]);
    setSelectedQuestionIds(new Set());
    setCreatedRoom(null);
    setFetchError(null);
    setStep('config');
  };

  const shareRoom = async (room: ExamRoom) => {
    try {
      await Share.share({
        message: `Join the Exam Room "${room.title}" on PCMB Paper app using Room Code: ${room.roomCode}`,
      });
    } catch {
      Alert.alert('Share', `Room Code: ${room.roomCode}`);
    }
  };

  // Inline, the screen's own header names the task; only picking needs a back button.
  const showHeader = !!onClose || step === 'questions';
  const headerTitle = step === 'config' ? 'Create a room' : step === 'questions' ? 'Pick questions' : 'Room ready';

  return (
    <View style={[styles.mainContainer, { maxWidth: MaxContentWidth }]}>
      {showHeader && (
        <View style={[styles.header, { borderBottomColor: palette.border }]}>
          <View style={styles.headerLeft}>
            {step === 'questions' && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Back to the room details"
                onPress={() => setStep('config')}
                style={styles.iconBtn}
              >
                <SymbolView
                  name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
                  tintColor={palette.primary}
                  size={20}
                />
              </Pressable>
            )}
            <Text style={[styles.headerTitle, { color: palette.foreground }]}>{headerTitle}</Text>
          </View>
          {onClose && (
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={styles.iconBtn}>
              <SymbolView
                name={{ ios: 'xmark.circle.fill', android: 'close', web: 'close' }}
                tintColor={palette.mutedForeground}
                size={24}
              />
            </Pressable>
          )}
        </View>
      )}

      {/* ── Step 1: Room details ── */}
      {step === 'config' && (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 40 + bottomInset }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: palette.mutedForeground }]}>Room name</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. 11th Physics weekly test"
              placeholderTextColor={palette.mutedForeground}
              accessibilityLabel="Room name"
              returnKeyType="done"
              style={[
                styles.textInput,
                {
                  backgroundColor: palette.card,
                  borderColor: palette.border,
                  color: palette.foreground,
                },
              ]}
            />
          </View>

          <ChoiceChips
            label="Class"
            hint={examCategory === 'JEE/NEET' ? 'JEE / NEET' : examCategory ?? undefined}
            choices={ALL_STANDARDS.map((s) => ({ value: s, label: s }))}
            selected={standard}
            onSelect={chooseStandard}
            columns={4}
          />

          <ChoiceChips
            label="Subject"
            choices={(examCategory ? SUBJECTS_BY_TRACK[examCategory] : []).map((s) => ({ value: s, label: s }))}
            selected={subject}
            onSelect={(value) => {
              setSubject(value);
              setPickedChapters([]);
              setPickedTopics([]);
            }}
            disabledText={standard ? undefined : 'Choose a class first'}
            columns={2}
          />

          <View style={styles.fieldGroup}>
            <MultiSelectDropdown
              label="Chapters"
              options={chapters}
              counts={chapterCounts}
              selected={pickedChapters}
              onSelect={chooseChapters}
              placeholder="All chapters"
              emptyText={
                !subject
                  ? 'Choose a subject first'
                  : loadingOptions
                  ? 'Loading chapters…'
                  : 'No chapters for this subject yet'
              }
              allWhenNone
              searchable
              icon={{ ios: 'book', android: 'menu_book', web: 'menu_book' }}
            />
          </View>

          <View style={styles.fieldGroup}>
            <MultiSelectDropdown
              label="Topics"
              options={topicOptions}
              sections={topicSections}
              counts={topicCounts}
              selected={pickedTopics}
              onSelect={(values) => setPickedTopics(topicOptions.filter((topic) => values.includes(topic)))}
              placeholder="All topics"
              emptyText={!subject ? 'Choose a subject first' : 'Choose chapters first'}
              allWhenNone
              searchable
              icon={{ ios: 'list.bullet', android: 'list', web: 'list' }}
            />
          </View>

          <MultiChoiceChips label="Levels" choices={LEVEL_CHOICES} selected={levels} onChange={setLevels} columns={4} />
          <View style={styles.numberRow}>
            <NumberField
              label="Questions"
              unit="questions"
              value={questionCountText}
              onChange={setQuestionCountText}
              range={QUESTION_RANGE}
            />
            <NumberField
              label="Time"
              unit="min"
              value={durationText}
              onChange={setDurationText}
              range={MINUTES_RANGE}
            />
          </View>

          {questionCount !== null && durationMinutes !== null ? (
            <Text style={[styles.summaryLine, { color: palette.foreground }]}>
              {questionCount} questions · {questionCount * MARKS_PER_QUESTION} marks · {formatMinutes(durationMinutes)}
            </Text>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: missing.length > 0 || loading }}
            onPress={handleFetchQuestions}
            disabled={missing.length > 0 || loading}
            style={({ pressed }) => [
              styles.primaryActionBtn,
              {
                backgroundColor: palette.primary,
                opacity: missing.length > 0 ? 0.45 : pressed || loading ? 0.8 : 1,
              },
            ]}
          >
            {loading ? (
              <ActivityIndicator color={palette.onPrimary} />
            ) : (
              <>
                <Text style={[styles.primaryActionBtnText, { color: palette.onPrimary }]}>Next: pick questions</Text>
                <SymbolView
                  name={{ ios: 'arrow.right', android: 'arrow_forward', web: 'arrow_forward' }}
                  tintColor={palette.onPrimary}
                  size={18}
                />
              </>
            )}
          </Pressable>

          {missing.length > 0 ? (
            <Text style={[styles.helperText, { color: palette.mutedForeground }]}>
              Add {listWords(missing)} to continue.
            </Text>
          ) : null}
          {loading && slowConnection ? (
            <Text accessibilityLiveRegion="polite" style={[styles.helperText, { color: palette.mutedForeground }]}>
              The connection is slow, still trying…
            </Text>
          ) : null}
          {fetchError ? (
            <Text accessibilityLiveRegion="polite" style={[styles.helperText, { color: palette.dangerInk }]}>
              {fetchError}
            </Text>
          ) : null}

          {onBrowse && (
            <Pressable
              accessibilityRole="button"
              onPress={onBrowse}
              style={({ pressed }) => [styles.linkBtn, pressed && styles.pressed]}
            >
              <Text style={[styles.linkText, { color: palette.primary }]}>Browse the whole question bank instead</Text>
            </Pressable>
          )}
        </ScrollView>
      )}

      {/* ── Step 2: Pick questions ── */}
      {step === 'questions' && (
        <View style={styles.stepContainer}>
          <View
            style={[
              styles.summaryBanner,
              { backgroundColor: palette.card, borderColor: palette.border },
            ]}
          >
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={[styles.summaryTitle, { color: palette.foreground }]} numberOfLines={1}>
                {title}
              </Text>
              <Text style={[styles.summaryMeta, { color: palette.mutedForeground }]}>
                {selectedCount} of {fetchedQuestions.length} picked · {selectedCount * MARKS_PER_QUESTION} marks
                {durationMinutes !== null ? ` · ${formatMinutes(durationMinutes)}` : ''}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                if (selectedCount === fetchedQuestions.length) {
                  setSelectedQuestionIds(new Set());
                } else {
                  setSelectedQuestionIds(new Set(fetchedQuestions.map((q) => q._id)));
                }
              }}
              hitSlop={4}
              style={[styles.selectAllBtn, { borderColor: palette.border }]}
            >
              <Text style={[styles.selectAllBtnText, { color: palette.primary }]}>
                {selectedCount === fetchedQuestions.length ? 'Clear all' : 'Pick all'}
              </Text>
            </Pressable>
          </View>

          <FlatList
            data={fetchedQuestions}
            keyExtractor={(item) => item._id}
            renderItem={({ item, index }) => (
              <QuestionReviewCard
                question={item}
                index={index}
                isSelected={selectedQuestionIds.has(item._id)}
                onToggle={toggleQuestionSelect}
                onEdit={setEditingQuestion}
                dark={dark}
              />
            )}
            initialNumToRender={5}
            maxToRenderPerBatch={5}
            windowSize={5}
            removeClippedSubviews={Platform.OS !== 'web'}
            contentContainerStyle={styles.questionsList}
            showsVerticalScrollIndicator={false}
          />

          <View
            style={[
              styles.bottomBar,
              { backgroundColor: palette.card, borderTopColor: palette.border, marginBottom: bottomInset },
            ]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: selectedCount === 0 }}
              disabled={selectedCount === 0}
              onPress={handleCreateRoom}
              style={({ pressed }) => [
                styles.primaryActionBtn,
                { backgroundColor: palette.primary, opacity: selectedCount === 0 ? 0.45 : pressed ? 0.8 : 1 },
              ]}
            >
              <Text style={[styles.primaryActionBtnText, { color: palette.onPrimary }]}>
                {selectedCount === 0
                  ? 'Pick at least one question'
                  : `Create room · ${selectedCount} question${selectedCount === 1 ? '' : 's'}`}
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* ── Step 3: Room code ── */}
      {step === 'success' && createdRoom && (
        <ScrollView
          contentContainerStyle={[styles.successContainer, { paddingBottom: 24 + bottomInset }]}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              styles.successCard,
              { backgroundColor: palette.card, borderColor: palette.border },
            ]}
          >
            <View
              style={[
                styles.successIconCircle,
                { backgroundColor: palette.successSoft, borderColor: palette.successBorder },
              ]}
            >
              <SymbolView
                name={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }}
                tintColor={palette.success}
                size={48}
              />
            </View>

            <Text style={[styles.successTitle, { color: palette.foreground }]}>{createdRoom.title}</Text>
            <Text style={[styles.successSubtitle, { color: palette.mutedForeground }]}>
              Share this code with your students so they can join the room.
            </Text>

            {/* Room Code Callout */}
            <View
              style={[
                styles.roomCodeBox,
                { backgroundColor: palette.primarySoft, borderColor: palette.primaryBorder },
              ]}
            >
              <Text style={[styles.roomCodeLabel, { color: palette.primaryInk }]}>Room code</Text>
              <Text selectable style={[styles.roomCodeValue, { color: palette.primary }]}>
                {createdRoom.roomCode}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => shareRoom(createdRoom)}
                style={({ pressed }) => [styles.shareBtn, { borderColor: palette.primaryBorder }, pressed && styles.pressed]}
              >
                <SymbolView
                  name={{ ios: 'square.and.arrow.up', android: 'share', web: 'share' }}
                  tintColor={palette.primary}
                  size={16}
                />
                <Text style={[styles.shareBtnText, { color: palette.primary }]}>Share code</Text>
              </Pressable>
            </View>

            {/* Details List */}
            <View style={styles.detailsList}>
              {[
                ['Class', `${createdRoom.standard} · ${createdRoom.subject}`],
                ['Chapters', `${new Set(createdRoom.questions.map((q) => q.chapter)).size}`],
                ['Questions', `${createdRoom.questions.length}`],
                ['Total marks', `${createdRoom.totalMarks}`],
                ['Time', formatMinutes(createdRoom.durationMinutes)],
              ].map(([key, value]) => (
                <View key={key} style={styles.detailRow}>
                  <Text style={[styles.detailKey, { color: palette.mutedForeground }]}>{key}</Text>
                  <Text style={[styles.detailVal, { color: palette.foreground }]}>{value}</Text>
                </View>
              ))}
            </View>

            {onViewRooms && (
              <Pressable
                accessibilityRole="button"
                onPress={onViewRooms}
                style={({ pressed }) => [
                  styles.primaryActionBtn,
                  styles.fullWidth,
                  { backgroundColor: palette.primary, marginTop: 24 },
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.primaryActionBtnText, { color: palette.onPrimary }]}>See your exam rooms</Text>
              </Pressable>
            )}
            {onClose ? (
              <Pressable
                accessibilityRole="button"
                onPress={onClose}
                style={({ pressed }) => [
                  styles.primaryActionBtn,
                  styles.fullWidth,
                  { backgroundColor: palette.primary, marginTop: 24 },
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.primaryActionBtnText, { color: palette.onPrimary }]}>Done</Text>
              </Pressable>
            ) : (
              <Pressable
                accessibilityRole="button"
                onPress={startAnotherRoom}
                style={({ pressed }) => [
                  styles.secondaryBtn,
                  styles.fullWidth,
                  { borderColor: palette.border, marginTop: 10 },
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.secondaryBtnText, { color: palette.foreground }]}>Create another room</Text>
              </Pressable>
            )}
          </View>
        </ScrollView>
      )}

      {/* ── Inline Question Edit Modal ── */}
      {editingQuestion && (
        <QuestionEditModal
          question={editingQuestion}
          onSave={handleSaveEditedQuestion}
          onCancel={() => setEditingQuestion(null)}
        />
      )}
    </View>
  );
}

// ─── Inline Question Editor Modal Component ───────────────────────────────────

function QuestionEditModal({
  question,
  onSave,
  onCancel,
}: {
  question: Question;
  onSave: (q: Question) => void;
  onCancel: () => void;
}) {
  const scheme = useColorScheme();
  const palette = getPalette(scheme === 'dark');

  const [questionText, setQuestionText] = useState(question.questionText);
  const [optionA, setOptionA] = useState(question.optionA);
  const [optionB, setOptionB] = useState(question.optionB);
  const [optionC, setOptionC] = useState(question.optionC);
  const [optionD, setOptionD] = useState(question.optionD);
  const [correctAnswer, setCorrectAnswer] = useState(question.correctAnswer);
  const [explanation, setExplanation] = useState(question.explanation);
  const [difficulty, setDifficulty] = useState<string>(question.difficulty);

  const handleSave = () => {
    onSave({
      ...question,
      questionText,
      optionA,
      optionB,
      optionC,
      optionD,
      correctAnswer,
      explanation,
      difficulty: difficulty as DifficultyLevel,
    });
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onCancel}>
      <View style={styles.editModalOverlay}>
        <View
          style={[
            styles.editModalContent,
            { backgroundColor: palette.card, borderColor: palette.border },
          ]}
        >
          <View style={styles.editModalHeader}>
            <Text style={[styles.editModalTitle, { color: palette.foreground }]}>
              Edit Question
            </Text>
            <Pressable onPress={onCancel} hitSlop={8}>
              <SymbolView
                name={{ ios: 'xmark', android: 'close', web: 'close' }}
                tintColor={palette.mutedForeground}
                size={20}
              />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.editModalScroll}
            showsVerticalScrollIndicator={false}
          >
            {/* Difficulty Dropdown */}
            <DropdownSelect
              label="Difficulty"
              options={DIFFICULTIES}
              selected={difficulty}
              onSelect={setDifficulty}
            />

            {/* Question Text */}
            <Text style={[styles.fieldLabel, { color: palette.mutedForeground }]}>
              QUESTION TEXT (LaTeX supported)
            </Text>
            <TextInput
              value={questionText}
              onChangeText={setQuestionText}
              multiline
              style={[
                styles.multilineInput,
                {
                  backgroundColor: palette.background,
                  borderColor: palette.border,
                  color: palette.foreground,
                },
              ]}
            />
            {questionText.trim().length > 0 && (
              <View style={[styles.inlinePreviewBox, { backgroundColor: palette.secondary, borderColor: palette.border }]}>
                <Text style={[styles.inlinePreviewTitle, { color: palette.primary }]}>LIVE FORMULA PREVIEW</Text>
                <MathText text={questionText} fontSize={14} color={palette.foreground} />
              </View>
            )}

            {/* Options */}
            <Text style={[styles.fieldLabel, { color: palette.mutedForeground, marginTop: 12 }]}>
              OPTIONS
            </Text>
            {(['A', 'B', 'C', 'D'] as const).map((opt) => {
              const val =
                opt === 'A'
                  ? optionA
                  : opt === 'B'
                  ? optionB
                  : opt === 'C'
                  ? optionC
                  : optionD;
              const setter =
                opt === 'A'
                  ? setOptionA
                  : opt === 'B'
                  ? setOptionB
                  : opt === 'C'
                  ? setOptionC
                  : setOptionD;
              const isCorrect = correctAnswer === opt;

              return (
                <View key={opt} style={{ marginBottom: 8 }}>
                  <View style={styles.editOptRow}>
                    <Pressable
                      onPress={() => setCorrectAnswer(opt)}
                      style={[
                        styles.correctCheckBadge,
                        {
                          backgroundColor: isCorrect ? palette.success : palette.secondary,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color: isCorrect ? palette.onPrimary : palette.foreground,
                          fontWeight: '700',
                          fontSize: 12,
                        }}
                      >
                        {opt} {isCorrect ? '✓' : ''}
                      </Text>
                    </Pressable>
                    <TextInput
                      value={val}
                      onChangeText={setter}
                      placeholder={`Option ${opt}`}
                      placeholderTextColor={palette.mutedForeground}
                      style={[
                        styles.textInput,
                        {
                          flex: 1,
                          backgroundColor: palette.background,
                          borderColor: isCorrect ? palette.success : palette.border,
                          color: palette.foreground,
                        },
                      ]}
                    />
                  </View>
                  {val.trim().length > 0 && (
                    <View style={{ paddingLeft: 48, paddingTop: 2 }}>
                      <MathText text={val} fontSize={12.5} color={isCorrect ? palette.successInk : palette.mutedForeground} />
                    </View>
                  )}
                </View>
              );
            })}

            {/* Explanation */}
            <Text style={[styles.fieldLabel, { color: palette.mutedForeground, marginTop: 12 }]}>
              EXPLANATION / SOLUTION
            </Text>
            <TextInput
              value={explanation}
              onChangeText={setExplanation}
              multiline
              placeholder="Step-by-step solution / explanation"
              placeholderTextColor={palette.mutedForeground}
              style={[
                styles.multilineInput,
                {
                  backgroundColor: palette.background,
                  borderColor: palette.border,
                  color: palette.foreground,
                },
              ]}
            />
            {explanation.trim().length > 0 && (
              <View style={[styles.inlinePreviewBox, { backgroundColor: palette.secondary, borderColor: palette.border, marginTop: 8 }]}>
                <Text style={[styles.inlinePreviewTitle, { color: palette.primary }]}>EXPLANATION PREVIEW</Text>
                <MathText text={explanation} fontSize={13.5} color={palette.foreground} />
              </View>
            )}
          </ScrollView>

          <View style={[styles.editModalActions, { borderTopColor: palette.border }]}>
            <Pressable
              onPress={onCancel}
              style={[styles.secondaryBtn, { borderColor: palette.border }]}
            >
              <Text style={{ color: palette.foreground, fontWeight: '600' }}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleSave}
              style={[styles.primaryActionBtn, { flex: 1, backgroundColor: palette.primary }]}
            >
              <Text style={[styles.primaryActionBtnText, { color: palette.onPrimary }]}>
                Save Changes
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  mainContainer: {
    flex: 1,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingLeft: 8,
  },
  iconBtn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  fieldLabelInRow: {
    marginBottom: 0,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  labelHint: {
    fontSize: 12,
    fontWeight: '600',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    minHeight: Platform.select({ android: 48, default: 44 }),
    minWidth: 56,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    fontSize: 14,
  },
  chipPlaceholder: {
    minHeight: Platform.select({ android: 48, default: 44 }),
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1.2,
    borderStyle: 'dashed',
    justifyContent: 'center',
  },
  chipPlaceholderText: {
    fontSize: 14,
  },
  numberRow: {
    flexDirection: 'row',
    gap: 12,
  },
  numberField: {
    flex: 1,
  },
  numberInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: Platform.select({ android: 48, default: 44 }),
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1.2,
  },
  numberText: {
    flex: 1,
    minWidth: 0,
    fontSize: 16,
    fontWeight: '600',
    paddingVertical: 10,
    fontVariant: ['tabular-nums'],
  },
  unitText: {
    fontSize: 14,
  },
  fieldHint: {
    fontSize: 12,
    marginTop: 6,
  },
  summaryLine: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
    marginBottom: 14,
  },
  helperText: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 10,
    textAlign: 'center',
  },
  linkBtn: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  linkText: {
    fontSize: 14,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.75,
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  textInput: {
    borderWidth: 1.2,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
  },
  multilineInput: {
    borderWidth: 1.2,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderRadius: 10,
    gap: 8,
  },
  primaryActionBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryBtn: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },

  // Step 2 Curation
  stepContainer: {
    flex: 1,
  },
  summaryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  summaryMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  selectAllBtn: {
    borderWidth: 1,
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  selectAllBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  questionsList: {
    padding: 14,
    gap: 12,
    paddingBottom: 24,
  },
  questionItemCard: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
  },
  qCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qIndexText: {
    fontSize: 13,
    fontWeight: '700',
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  editBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  optionsPreviewGrid: {
    gap: 6,
  },
  optPreviewBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    gap: 6,
  },
  optKeyBadge: {
    fontSize: 11,
    fontWeight: '800',
    minWidth: 14,
  },
  bottomBar: {
    borderTopWidth: 1,
    padding: 14,
  },

  // Step 3 Success
  successContainer: {
    flexGrow: 1,
    padding: 20,
    justifyContent: 'center',
  },
  successCard: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
  },
  successIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 6,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 20,
  },
  roomCodeBox: {
    width: '100%',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 18,
  },
  roomCodeLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  roomCodeValue: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 2,
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 16,
    marginTop: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  shareBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  detailsList: {
    width: '100%',
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  detailKey: {
    fontSize: 13,
  },
  detailVal: {
    fontSize: 13,
    fontWeight: '700',
  },

  // Edit question modal
  editModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  editModalContent: {
    height: '86%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
    paddingTop: 16,
  },
  editModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  editModalTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  editModalScroll: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  inlinePreviewBox: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 6,
    marginBottom: 10,
  },
  inlinePreviewTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  editOptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  correctCheckBadge: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 44,
    alignItems: 'center',
  },
  editModalActions: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
  },
});

export default CreateExamModal;
