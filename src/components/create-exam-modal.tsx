import React, { useState, useRef, useEffect, memo, useCallback } from 'react';
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
import { Diagrams } from './diagrams';
import { MathText } from './math-text';
import { pickedInOrder, pickerList, pickerTakesBack, reconcilePool, seedTopic } from '@/screens/teacher/test-questions';
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
import { createPdfsFor, PDF_CHOICES, PdfRequestError, type PdfChoice, type PdfStage } from '@/services/question-pdf';
import { DateField } from '@/screens/teacher/date-field';
import { openPdf, pdfContentLabel, printPdf, sharePdf, type SavedPdf } from '@/services/pdf-library';
import { SmartPdfScreen } from './smart-pdf-screen';

interface CreateExamModalProps {
  visible: boolean;
  onClose: () => void;
  onRoomCreated: (room: ExamRoom) => void;
}

const DIFFICULTIES: DifficultyLevel[] = ['Easy', 'Mid', 'Hard'];

const MARKS_PER_QUESTION = 4;

/** A new room's id, and the short code students type to join it, e.g. NEET-4821. */
function newRoomKeys(examCategory: ExamCategory) {
  const prefix = examCategory === 'JEE/NEET' ? 'NEET' : 'FOUND';
  return { _id: `room-${Date.now()}`, roomCode: `${prefix}-${Math.floor(1000 + Math.random() * 9000)}` };
}

// What the question-count field accepts.
const QUESTION_RANGE = { min: 1, max: 300 };

/** The typed value as a whole number within the range, else null. */
function wholeNumberIn(text: string, { min, max }: { min: number; max: number }) {
  const value = Number(text);
  return text !== '' && Number.isInteger(value) && value >= min && value <= max ? value : null;
}

type Choice<T> = { value: T; label: string };

/** What the picked questions become. */
export type QuestionSetPurpose = 'room' | 'pdf';

const PURPOSE_CHOICES: Choice<QuestionSetPurpose>[] = [
  { value: 'room', label: 'Exam room' },
  { value: 'pdf', label: 'PDF paper' },
];

const PDF_CHOICE_OPTIONS: Choice<PdfChoice>[] = PDF_CHOICES.map(({ value, label }) => ({ value, label }));

/** Chosen at the last step, after the questions are picked. */
type PdfKind = 'exam' | 'smart';

const PDF_KIND_CHOICES: Choice<PdfKind>[] = [
  { value: 'exam', label: 'Exam PDF' },
  { value: 'smart', label: 'Smart PDF' },
];

const PDF_KIND_HINTS: Record<PdfKind, string> = {
  exam: 'The printed paper, with the options chosen on the details step',
  smart: 'One question per 16:9 slide, with space below to write',
};

/** The paper's duration, in minutes: 0 leaves the time out of the header. */
const DURATION_RANGE = { min: 0, max: 600 };
const DEFAULT_DURATION_MINUTES = 60;

const startOfToday = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

/** A day as yyyy-mm-dd, in the phone's own calendar. */
const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const LEVEL_NAMES: Record<string, string> = { Easy: 'Easy', Mid: 'Medium', Hard: 'Hard' };

const PDF_STAGE_TEXT: Record<PdfStage, (count: number) => string> = {
  making: (n) => `Making the PDF of ${n} question${n === 1 ? '' : 's'}…`,
  downloading: () => 'Downloading the PDF…',
};

const LEVEL_CHOICES: Choice<DifficultyLevel>[] = [
  { value: 'Easy', label: 'Easy' },
  { value: 'Mid', label: 'Medium' },
  { value: 'Hard', label: 'Hard' },
];

/** A paper's name from the chapters or topics picked: "EMI", or "EMI, Optics +2 more" once it would be too long for a heading. */
function titleFromNames(names: string[]): string {
  let title = '';
  for (let i = 0; i < names.length; i++) {
    const next = title ? `${title}, ${names[i]}` : names[i];
    if (title && next.length > 60) return `${title} +${names.length - i} more`;
    title = next;
  }
  return title.slice(0, 80);
}

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
        <QuestionSetFlow purpose="room" onClose={onClose} onRoomCreated={onRoomCreated} />
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

  const details = [LEVEL_NAMES[question.difficulty] ?? question.difficulty, question.source].filter(Boolean).join(' · ');

  return (
    // The whole card ticks the question; Edit and the solution toggle are buttons of their own.
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isSelected }}
      accessibilityLabel={`Question ${index + 1}`}
      onPress={() => onToggle(question._id)}
      style={({ pressed }) => [
        styles.questionItemCard,
        {
          backgroundColor: palette.card,
          borderColor: isSelected ? palette.primary : palette.border,
          borderWidth: isSelected ? 1.5 : 1,
        },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.qCardTop}>
        <View style={styles.checkboxRow}>
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
          <Text style={[styles.qIndexText, { color: palette.primary }]} numberOfLines={1}>
            Q{index + 1} · {question.topic || question.subject}
          </Text>
        </View>

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

      {details ? <Text style={[styles.qDetails, { color: palette.mutedForeground }]}>{details}</Text> : null}

      {/* Question Content */}
      <View style={{ marginBottom: 8 }}>
        <MathText text={question.questionText} fontSize={14} color={palette.foreground} />
        <Diagrams urls={question.diagramUrls} maxHeight={180} />
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
                <Diagrams urls={question.optionDiagramUrls?.[optKey as 'A' | 'B' | 'C' | 'D']} maxHeight={100} />
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
    </Pressable>
  );
});

// ─── Question set flow: details → pick questions → exam room or PDF paper ───

interface QuestionSetFlowProps {
  /** What the picked questions become: an exam room, or a PDF question paper. */
  purpose: QuestionSetPurpose;
  /** Offers switching between the two on the details step. */
  onPurposeChange?: (purpose: QuestionSetPurpose) => void;
  onRoomCreated?: (room: ExamRoom) => void;
  /**
   * Saves the picked questions as a batch's test instead of making a room on
   * the phone; the flow shows its own error if this throws.
   */
  onSubmitTest?: (input: { title: string; standard: Standard; subject: Subject; questions: Question[] }) => Promise<void>;
  /**
   * The test's name, class and subject when they were already chosen (the
   * teacher's first step): they aren't asked again, and the flow starts at the
   * chapters, topics, levels and number of questions.
   */
  locked?: { title: string; standard: Standard; subject: Subject };
  /**
   * The questions a test being edited already holds, as the picker knows them.
   * Giving them puts the picker in edit mode: it opens on the question list
   * with these picked, loads more from the first saved topic, and keeps every
   * pick (even from topics no longer shown) when the topic changes.
   */
  initialQuestions?: Question[];
  /** Edit mode: the Back button under the list. */
  onBack?: () => void;
  /** Edit mode: lets the wizard around the picker drive its Back and drop picks. */
  controlRef?: React.MutableRefObject<QuestionFlowControl | null>;
  /** In the modal, closes it; the form inline on the Questions tab has no close. */
  onClose?: () => void;
  /** After a room is made: show it in the Exam Rooms list. */
  onViewRooms?: () => void;
  /** Shows My PDFs, where every PDF made is saved. */
  onViewPdfs?: () => void;
  /** Space to keep clear at the bottom for the tab bar when shown inline. */
  bottomInset?: number;
  /** Whether the flow is on screen; inline on a tab it stays mounted while other tabs show. */
  active?: boolean;
}

type Step = 'config' | 'questions' | 'smart' | 'success';

/** What an edit-mode picker offers the wizard around it. */
export interface QuestionFlowControl {
  /** Steps back inside the picker (from Change topic to the list); false when it is already at the list. */
  back: () => boolean;
  /** Unpicks a question the wizard's review took out. */
  deselect: (id: string) => void;
  /** The ids picked right now, in the order they will be saved. */
  pickedIds: () => string[];
}

export function QuestionSetFlow({
  purpose,
  onPurposeChange,
  onRoomCreated,
  onSubmitTest,
  locked,
  initialQuestions,
  onBack,
  controlRef,
  onClose,
  onViewRooms,
  onViewPdfs,
  bottomInset = 0,
  active = true,
}: QuestionSetFlowProps) {
  const scheme = useColorScheme();
  const dark = scheme === 'dark';
  const palette = getPalette(dark);
  const isPdf = purpose === 'pdf';

  // Editing a test: the questions it holds come first, and the topic choice is a side trip.
  const editing = !!initialQuestions;
  const [seed] = useState(() => (initialQuestions ? seedTopic(initialQuestions) : null));

  const [step, setStep] = useState<Step>(editing ? 'questions' : 'config');
  // The form leads to a request; keep the connection fresh while it's filled in.
  useKeepServerConnection(active && step === 'config');

  // Details
  // What the teacher typed for the name; null until they do (or after they clear it).
  const [typedTitle, setTypedTitle] = useState<string | null>(locked?.title ?? null);
  const [standard, setStandard] = useState<Standard | null>(locked?.standard ?? null);
  const [subject, setSubject] = useState<Subject | null>(locked?.subject ?? null);
  // None picked means all of them. An edited test starts on its first saved topic.
  const [pickedChapters, setPickedChapters] = useState<string[]>(seed ? [seed.chapter] : []);
  const [pickedTopics, setPickedTopics] = useState<string[]>(seed ? [seed.topic] : []);
  // A PDF paper's name is the topic (else the chapter) picked, e.g. "EMI", until the teacher types their own.
  const autoTitle = isPdf && !locked ? titleFromNames(pickedTopics.length ? pickedTopics : pickedChapters) : '';
  const title = typedTitle ?? autoTitle;
  // Edit mode lists either this topic's questions or every pick, whatever topic it is from.
  const [view, setView] = useState<'all' | 'selected'>(seed ? 'all' : 'selected');
  const [levels, setLevels] = useState<DifficultyLevel[]>([]);
  // Typed in; null until it's a whole number in range.
  const [questionCountText, setQuestionCountText] = useState(String(initialQuestions?.length || 20));
  const questionCount = wholeNumberIn(questionCountText, QUESTION_RANGE);
  // The paper's header: the set, the exam's day and its length. Everything else
  // in it (institute, class, subject, chapter, marks) comes from what's picked.
  const [pdfChoice, setPdfChoice] = useState<PdfChoice>('answers');
  const [pdfKind, setPdfKind] = useState<PdfKind>('exam');
  const [paperSet, setPaperSet] = useState('1');
  const [examDate, setExamDate] = useState(startOfToday);
  const [durationText, setDurationText] = useState(String(DEFAULT_DURATION_MINUTES));
  const durationMinutes = wholeNumberIn(durationText, DURATION_RANGE);

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

  // Questions to pick from, kept per picked topic or chapter for Auto select.
  // An edited test loads its topic's questions as soon as the picker opens.
  const [loading, setLoading] = useState(!!seed);
  // A request had to be retried: the connection is slow or stalled.
  const [slowConnection, setSlowConnection] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [poolGroups, setPoolGroups] = useState<Question[][]>([]);
  const [fetchedQuestions, setFetchedQuestions] = useState<Question[]>([]);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<Set<string>>(
    () => new Set(initialQuestions?.map((q) => q._id))
  );
  // Every question seen so far, so picks outlive the list they were picked from.
  const [known, setKnown] = useState(() => new Map<string, Question>(initialQuestions?.map((q) => [q._id, q])));

  // Inline question editor
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);

  // What was made
  const [createdRoom, setCreatedRoom] = useState<ExamRoom | null>(null);
  // The PDFs as saved in My PDFs (two when "Separate PDFs" was chosen), and the questions they were made from.
  const [madePdf, setMadePdf] = useState<{ pdfs: SavedPdf[]; questions: Question[] } | null>(null);
  const [makingPdf, setMakingPdf] = useState(false);
  const [pdfProgress, setPdfProgress] = useState<{ stage: PdfStage; count: number }>({ stage: 'making', count: 0 });
  const [pdfError, setPdfError] = useState<string | null>(null);

  const missing = [
    !title.trim() && (isPdf ? 'a paper name' : onSubmitTest ? 'a test name' : 'a room name'),
    !standard && 'a class',
    !subject && 'a subject',
    !editing && questionCount === null && `${QUESTION_RANGE.min} to ${QUESTION_RANGE.max} questions`,
    isPdf && durationMinutes === null && `a duration from ${DURATION_RANGE.min} to ${DURATION_RANGE.max} minutes`,
  ].filter((word): word is string => !!word);
  const selectedCount = selectedQuestionIds.size;
  const stillToPick = questionCount === null ? 0 : questionCount - selectedCount;

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

  // Fetches the pool for these groups and shows it. Returns whether there are
  // questions to show; otherwise the reason is in fetchError.
  const loadPool = async (groups: { chapter?: string; topic?: string }[]) => {
    if (!standard || !subject || !examCategory) {
      setLoading(false);
      return false;
    }
    // About three candidates per question asked for, shared between the groups.
    const poolSize = Math.min(300, Math.max(60, (questionCount ?? QUESTION_RANGE.min) * 3));
    const perGroup = Math.max(10, Math.ceil(poolSize / groups.length));

    setLoading(true);
    setSlowConnection(false);
    setFetchError(null);
    try {
      const pool = await fetchQuestionPool({ examCategory, standard, subject, groups, levels, perGroup }, () =>
        setSlowConnection(true)
      );
      const seen = new Set<string>();
      let byGroup = pool.map((group) =>
        group.filter((q) => {
          if (seen.has(q._id)) return false;
          seen.add(q._id);
          return true;
        })
      );
      // An edited test keeps its own copy of any question it already holds.
      if (editing) byGroup = byGroup.map((group) => reconcilePool(group, known));
      const qs = byGroup.flat();
      if (qs.length === 0) {
        setFetchError('No questions match these choices. Try more chapters or topics, or another level.');
        return false;
      }

      setPoolGroups(byGroup);
      setFetchedQuestions(qs);
      if (editing) setKnown((prev) => new Map([...qs.map((q) => [q._id, q] as const), ...prev]));
      // A new test starts with nothing picked: the teacher picks by hand first
      // and Auto select is a button away. An edited test keeps every pick.
      if (!editing) setSelectedQuestionIds(new Set());
      setPdfError(null);
      setView('all');
      setStep('questions');
      return true;
    } catch (error) {
      setFetchError(
        error instanceof QuestionLoadError ? error.message : 'Could not load questions. Check your connection and try again.'
      );
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Step 1 -> Step 2: fetch only the questions that match
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
    await loadPool(groups);
  };

  // An edited test opens on its questions, plus the others from its first saved
  // topic; the saved picks are already listed, so a failed load only costs the extras.
  const seedLoaded = useRef(false);
  const loadSeedTopic = async () => {
    if (!seed) return;
    if (!(await loadPool([seed]))) setView('selected');
  };
  useEffect(() => {
    if (seedLoaded.current) return;
    seedLoaded.current = true;
    void loadSeedTopic();
    // Once, when the picker opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Tops the picks up to the number asked for, keeping the ones already
  // picked by hand and sharing the rest evenly between topics or chapters.
  const autoSelect = () => {
    if (stillToPick <= 0) return;
    const remaining = poolGroups.map((group) => group.filter((q) => !selectedQuestionIds.has(q._id)));
    setSelectedQuestionIds(new Set([...selectedQuestionIds, ...balancedPick(remaining, stillToPick)]));
  };

  // Save edited question
  const handleSaveEditedQuestion = (updated: Question) => {
    setKnown((prev) => new Map(prev).set(updated._id, updated));
    setFetchedQuestions((prev) => prev.map((q) => (q._id === updated._id ? updated : q)));
    setPoolGroups((prev) => prev.map((group) => group.map((q) => (q._id === updated._id ? updated : q))));
    setEditingQuestion(null);
  };

  const pickedQuestions = () =>
    editing ? pickedInOrder(selectedQuestionIds, known) : fetchedQuestions.filter((q) => selectedQuestionIds.has(q._id));

  // The wizard around an edit-mode picker steps it back and unpicks from it.
  // Kept current every render, since back() depends on the step shown.
  useEffect(() => {
    if (!controlRef) return;
    controlRef.current = {
      back: () => {
        if (!pickerTakesBack(editing, step)) return false;
        setStep('questions');
        return true;
      },
      deselect: (id) =>
        setSelectedQuestionIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        }),
      pickedIds: () => [...selectedQuestionIds],
    };
    return () => {
      controlRef.current = null;
    };
  });

  // Final step: create the room
  const [savingTest, setSavingTest] = useState(false);

  const handleCreateRoom = async () => {
    const selectedList = pickedQuestions();
    if (selectedList.length === 0 || !standard || !subject || !examCategory) return;

    if (onSubmitTest) {
      setSavingTest(true);
      setPdfError(null);
      try {
        await onSubmitTest({ title: title.trim(), standard, subject, questions: selectedList });
      } catch (error) {
        setPdfError(error instanceof Error ? error.message : "Couldn't save the test. Try again.");
      } finally {
        setSavingTest(false);
      }
      return;
    }

    const newRoom: ExamRoom = {
      ...newRoomKeys(examCategory),
      title: title.trim(),
      examCategory,
      standard,
      subject,
      difficulty: levels.length === 1 ? levels[0] : 'All',
      // Rooms are made without a time limit.
      durationMinutes: 0,
      totalMarks: selectedList.length * MARKS_PER_QUESTION,
      questions: selectedList,
      createdAt: new Date().toISOString(),
      status: 'active',
    };

    setCreatedRoom(newRoom);
    onRoomCreated?.(newRoom);
    setStep('success');
  };

  // Final step: the server prints the picked questions to a PDF, which is
  // saved to My PDFs.
  const handleMakePdf = async () => {
    const selectedList = pickedQuestions();
    if (selectedList.length === 0 || !standard || !subject) return;

    setMakingPdf(true);
    setPdfProgress({ stage: 'making', count: selectedList.length });
    setPdfError(null);
    try {
      const pdfs = await createPdfsFor(
        {
          title: title.trim(),
          questions: selectedList,
          marksPerQuestion: MARKS_PER_QUESTION,
          standard,
          subject,
          paper: {
            paperSet: paperSet.trim() || '1',
            date: dayKey(examDate),
            durationMinutes: durationMinutes || undefined,
          },
        },
        pdfChoice,
        (stage) => setPdfProgress((progress) => ({ ...progress, stage }))
      );
      setMadePdf({ pdfs, questions: selectedList });
      setStep('success');
    } catch (error) {
      setPdfError(
        error instanceof PdfRequestError ? error.message : 'Could not make the PDF. Try again, or pick fewer questions.'
      );
    } finally {
      setMakingPdf(false);
    }
  };

  /** Opens, shares or prints a PDF just made, saying so if that fails. */
  const runPdfAction = async (action: (pdf: SavedPdf) => Promise<void>, pdf: SavedPdf) => {
    setPdfError(null);
    try {
      await action(pdf);
    } catch (error) {
      setPdfError(error instanceof Error ? error.message : 'Something went wrong. Try again.');
    }
  };

  // A teacher often makes several for one class: keep its class, subject and
  // settings, clear the rest.
  const startAnother = () => {
    setTypedTitle(null);
    setPickedChapters([]);
    setPickedTopics([]);
    setPoolGroups([]);
    setFetchedQuestions([]);
    setSelectedQuestionIds(new Set());
    setCreatedRoom(null);
    setMadePdf(null);
    setFetchError(null);
    setPdfError(null);
    setStep('config');
  };

  /** Open, Share and Print for a PDF just made. A lone PDF gets a large Open button; each of two gets its own row. */
  const renderPdfActions = (pdf: SavedPdf, lone: boolean) => (
    <View key={pdf.id} style={styles.fullWidth}>
      {lone ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => runPdfAction(openPdf, pdf)}
          style={({ pressed }) => [
            styles.primaryActionBtn,
            styles.fullWidth,
            { backgroundColor: palette.primary, marginTop: 24 },
            pressed && styles.pressed,
          ]}
        >
          <SymbolView name={{ ios: 'eye', android: 'visibility', web: 'visibility' }} tintColor={palette.onPrimary} size={18} />
          <Text style={[styles.primaryActionBtnText, { color: palette.onPrimary }]}>Open PDF</Text>
        </Pressable>
      ) : (
        <View style={styles.successPdfHead}>
          <Text style={[styles.successPdfName, { color: palette.foreground }]} numberOfLines={2}>
            {pdf.name}
          </Text>
          <Text style={[styles.successPdfMeta, { color: palette.mutedForeground }]}>
            {pdfContentLabel(pdf)}
            {pdf.pageCount ? ` · ${pdf.pageCount} page${pdf.pageCount === 1 ? '' : 's'}` : ''}
          </Text>
        </View>
      )}
      <View style={[styles.fullWidth, styles.successBtnRow]}>
        {(
          [
            ...(lone ? [] : [['Open', { ios: 'eye', android: 'visibility', web: 'visibility' }, openPdf] as const]),
            ['Share', { ios: 'square.and.arrow.up', android: 'share', web: 'share' }, sharePdf] as const,
            ['Print', { ios: 'printer', android: 'print', web: 'print' }, printPdf] as const,
          ]
        ).map(([label, icon, action]) => (
          <Pressable
            key={label}
            accessibilityRole="button"
            accessibilityLabel={lone ? label : `${label} ${pdf.name}`}
            onPress={() => runPdfAction(action, pdf)}
            style={({ pressed }) => [
              styles.secondaryBtn,
              styles.successRowBtn,
              { borderColor: palette.border },
              pressed && styles.pressed,
            ]}
          >
            <SymbolView name={icon} tintColor={palette.primary} size={16} />
            <Text style={[styles.secondaryBtnText, { color: palette.foreground }]}>{label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

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
  // An edited test sits inside the wizard, whose own header and Back lead the way.
  const showHeader = !editing && (!!onClose || step === 'questions' || step === 'smart');

  // Edit mode's banner: where the listed questions come from.
  const scopeLines = [
    `Subject: ${subject ?? ''}`,
    pickedChapters.length || pickedTopics.length
      ? [
          pickedChapters.length ? `Chapter: ${pickedChapters.join(', ')}` : null,
          `Topic: ${pickedTopics.length ? pickedTopics.join(', ') : 'All topics'}`,
        ]
          .filter(Boolean)
          .join(' · ')
      : fetchedQuestions.length
      ? 'Topic: All chapters'
      : 'Topic: not chosen yet',
  ];
  const listed = editing ? pickerList(view, fetchedQuestions, selectedQuestionIds, known) : fetchedQuestions;
  const headerTitle =
    step === 'questions'
      ? 'Pick questions'
      : step === 'smart'
      ? 'Smart PDF'
      : step === 'success'
      ? isPdf
        ? 'PDF ready'
        : 'Room ready'
      : isPdf
      ? 'Make a PDF paper'
      : onSubmitTest
      ? 'New test'
      : 'Create a room';

  const successDetails = (questions: Question[]) => [
    ['Class', `${standard} · ${subject}`],
    ['Chapters', `${new Set(questions.map((q) => q.chapter)).size}`],
    ['Questions', `${questions.length}`],
    ['Total marks', `${questions.length * MARKS_PER_QUESTION}`],
  ];

  return (
    <View style={[styles.mainContainer, { maxWidth: MaxContentWidth }]}>
      {showHeader && (
        <View style={[styles.header, { borderBottomColor: palette.border }]}>
          <View style={styles.headerLeft}>
            {(step === 'questions' || step === 'smart') && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={step === 'smart' ? 'Back to the questions' : 'Back to the details'}
                onPress={() => setStep(step === 'smart' ? 'questions' : 'config')}
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

      {/* ── Step 1: Details ── */}
      {step === 'config' && (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 40 + bottomInset }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {onPurposeChange ? (
            <ChoiceChips label="Make" choices={PURPOSE_CHOICES} selected={purpose} onSelect={onPurposeChange} columns={2} />
          ) : null}

          {editing ? (
            <View style={styles.fieldGroup}>
              <Text style={[styles.summaryTitle, { color: palette.foreground }]}>Change topic</Text>
              <Text style={[styles.summaryMeta, { color: palette.mutedForeground }]}>
                Your {selectedCount} picked question{selectedCount === 1 ? '' : 's'} stay picked. Choose where to look for more.
              </Text>
            </View>
          ) : null}

          {!locked && (
            <>
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: palette.mutedForeground }]}>
              {isPdf ? 'Paper name' : onSubmitTest ? 'Test name' : 'Room name'}
            </Text>
            <TextInput
              value={title}
              onChangeText={(text) => setTypedTitle(text === '' ? null : text)}
              placeholder={isPdf ? 'e.g. 11th Physics chapter test' : 'e.g. 11th Physics weekly test'}
              placeholderTextColor={palette.mutedForeground}
              accessibilityLabel={isPdf ? 'Paper name' : onSubmitTest ? 'Test name' : 'Room name'}
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
            {isPdf ? (
              <Text style={[styles.fieldHint, { color: palette.mutedForeground }]}>
                Filled in from the chapter or topic you pick. Edit it if you like.
              </Text>
            ) : null}
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
            </>
          )}

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

          {editing ? null : (
            <NumberField
              label="Questions"
              unit="questions"
              value={questionCountText}
              onChange={setQuestionCountText}
              range={QUESTION_RANGE}
            />
          )}

          {isPdf ? (
            <>
              <ChoiceChips
                label="In the PDF"
                hint={PDF_CHOICES.find((choice) => choice.value === pdfChoice)?.hint}
                choices={PDF_CHOICE_OPTIONS}
                selected={pdfChoice}
                onSelect={setPdfChoice}
                columns={1}
              />
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: palette.mutedForeground }]}>Paper set</Text>
                <TextInput
                  value={paperSet}
                  onChangeText={(text) => setPaperSet(text.slice(0, 10))}
                  placeholder="1"
                  placeholderTextColor={palette.mutedForeground}
                  accessibilityLabel="Paper set"
                  accessibilityHint="Printed in the paper's header"
                  returnKeyType="done"
                  style={[
                    styles.textInput,
                    { backgroundColor: palette.card, borderColor: palette.border, color: palette.foreground },
                  ]}
                />
                <Text style={[styles.fieldHint, { color: palette.mutedForeground }]}>
                  The institute, class, subject, chapter and marks are filled in for you.
                </Text>
              </View>
              <View style={styles.numberRow}>
                <DateField label="Date" value={examDate} minimumDate={startOfToday()} onChange={setExamDate} />
                <NumberField
                  label="Duration"
                  unit="minutes"
                  value={durationText}
                  onChange={setDurationText}
                  range={DURATION_RANGE}
                />
              </View>
            </>
          ) : null}

          {!editing && questionCount !== null ? (
            <Text style={[styles.summaryLine, { color: palette.foreground }]}>
              {locked ? `${questionCount} questions` : `${questionCount} questions · ${questionCount * MARKS_PER_QUESTION} marks`}
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
                <Text style={[styles.primaryActionBtnText, { color: palette.onPrimary }]}>
                  {editing ? 'Show questions' : 'Next: pick questions'}
                </Text>
                <SymbolView
                  name={{ ios: 'arrow.right', android: 'arrow_forward', web: 'arrow_forward' }}
                  tintColor={palette.onPrimary}
                  size={18}
                />
              </>
            )}
          </Pressable>

          {editing ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back to the questions"
              onPress={() => setStep('questions')}
              style={({ pressed }) => [styles.secondaryBtn, { borderColor: palette.border }, pressed && styles.pressed]}
            >
              <Text style={[styles.secondaryBtnText, { color: palette.foreground }]}>Back to the questions</Text>
            </Pressable>
          ) : null}

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

        </ScrollView>
      )}

      {/* ── Making the PDF: the list makes way for the progress card ── */}
      {step === 'questions' && makingPdf && (
        <View style={[styles.progressPanel, { paddingBottom: bottomInset }]}>
          <View style={[styles.progressCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <ActivityIndicator size="large" color={palette.primary} />
            <Text accessibilityLiveRegion="polite" style={[styles.progressTitle, { color: palette.foreground }]}>
              {PDF_STAGE_TEXT[pdfProgress.stage](pdfProgress.count)}
            </Text>
            <Text style={[styles.progressHint, { color: palette.mutedForeground }]}>
              Keep the app open until the PDF is ready.
            </Text>
          </View>
        </View>
      )}

      {/* ── Step 2: Pick questions, by hand or with Auto select ── */}
      {step === 'questions' && !makingPdf && (
        <View style={styles.stepContainer}>
          {editing ? (
            <View style={[styles.summaryBanner, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <Text accessibilityRole="header" style={[styles.fieldLabel, { color: palette.mutedForeground }]}>
                EDIT QUESTIONS
              </Text>
              {scopeLines.map((line) => (
                <Text key={line} style={[styles.summaryTitle, { color: palette.foreground }]} numberOfLines={2}>
                  {line}
                </Text>
              ))}
              <View style={styles.bannerActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Change topic or subtopic"
                  onPress={() => setStep('config')}
                  style={({ pressed }) => [
                    styles.autoSelectBtn,
                    { backgroundColor: palette.primarySoft, borderColor: palette.primaryBorder },
                    pressed && styles.pressed,
                  ]}
                >
                  <SymbolView
                    name={{ ios: 'arrow.triangle.2.circlepath', android: 'autorenew', web: 'autorenew' }}
                    tintColor={palette.primary}
                    size={16}
                  />
                  <Text style={[styles.autoSelectText, { color: palette.primaryInk }]}>Change Topic / Subtopic</Text>
                </Pressable>
              </View>
              <Text accessibilityLiveRegion="polite" style={[styles.summaryMeta, { color: palette.mutedForeground }]}>
                Selected Questions: {selectedCount}
              </Text>
              <ChoiceChips
                label="Show"
                choices={[
                  { value: 'all' as const, label: 'All Questions' },
                  { value: 'selected' as const, label: `Selected Questions (${selectedCount})` },
                ]}
                selected={view}
                onSelect={setView}
                columns={2}
              />
            </View>
          ) : null}
          {!editing && (
          <View
            style={[
              styles.summaryBanner,
              { backgroundColor: palette.card, borderColor: palette.border },
            ]}
          >
            <Text style={[styles.summaryTitle, { color: palette.foreground }]} numberOfLines={1}>
              {title}
            </Text>
            <Text style={[styles.summaryMeta, { color: palette.mutedForeground }]}>
              {selectedCount} of {questionCount ?? selectedCount} picked · {fetchedQuestions.length} to choose from · tap a
              question to pick it
            </Text>
            <View style={styles.bannerActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: stillToPick <= 0 }}
                disabled={stillToPick <= 0}
                onPress={autoSelect}
                style={({ pressed }) => [
                  styles.autoSelectBtn,
                  { backgroundColor: palette.primarySoft, borderColor: palette.primaryBorder },
                  stillToPick <= 0 && styles.disabled,
                  pressed && styles.pressed,
                ]}
              >
                <SymbolView
                  name={{ ios: 'wand.and.stars', android: 'auto_awesome', web: 'auto_awesome' }}
                  tintColor={palette.primary}
                  size={16}
                />
                <Text style={[styles.autoSelectText, { color: palette.primaryInk }]}>
                  {stillToPick <= 0
                    ? `${questionCount} picked`
                    : selectedCount === 0
                    ? `Auto select ${stillToPick}`
                    : `Auto select ${stillToPick} more`}
                </Text>
              </Pressable>
              {selectedCount > 0 ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setSelectedQuestionIds(new Set())}
                  style={({ pressed }) => [styles.selectAllBtn, { borderColor: palette.border }, pressed && styles.pressed]}
                >
                  <Text style={[styles.selectAllBtnText, { color: palette.foreground }]}>Clear</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
          )}

          <FlatList
            data={listed}
            keyExtractor={(item) => item._id}
            ListEmptyComponent={
              editing ? (
                <View style={styles.emptyList}>
                  {view === 'all' && loading ? (
                    <>
                      <ActivityIndicator color={palette.primary} />
                      <Text accessibilityLiveRegion="polite" style={[styles.helperText, { color: palette.mutedForeground }]}>
                        {slowConnection ? 'The connection is slow, still trying…' : 'Loading more questions…'}
                      </Text>
                    </>
                  ) : (
                    <>
                      <Text style={[styles.helperText, { color: fetchError && view === 'all' ? palette.dangerInk : palette.mutedForeground }]}>
                        {view === 'selected'
                          ? 'No questions are picked. Pick some from All Questions.'
                          : fetchError ?? 'Choose a topic to see more questions.'}
                      </Text>
                      {view === 'all' && seed && fetchError ? (
                        <Pressable
                          accessibilityRole="button"
                          onPress={loadSeedTopic}
                          style={({ pressed }) => [styles.secondaryBtn, { borderColor: palette.border }, pressed && styles.pressed]}
                        >
                          <Text style={[styles.secondaryBtnText, { color: palette.foreground }]}>Try again</Text>
                        </Pressable>
                      ) : null}
                    </>
                  )}
                </View>
              ) : undefined
            }
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
            contentContainerStyle={styles.questionsList}
            showsVerticalScrollIndicator={false}
          />

          <View
            style={[
              styles.bottomBar,
              { backgroundColor: palette.card, borderTopColor: palette.border, marginBottom: bottomInset },
            ]}
          >
            {pdfError ? (
              <Text accessibilityLiveRegion="polite" style={[styles.bottomBarError, { color: palette.dangerInk }]}>
                {pdfError}
              </Text>
            ) : null}
            {isPdf && !editing && selectedCount > 0 ? (
              <ChoiceChips
                label="PDF type"
                hint={PDF_KIND_HINTS[pdfKind]}
                choices={PDF_KIND_CHOICES}
                selected={pdfKind}
                onSelect={setPdfKind}
                columns={2}
              />
            ) : null}
            <View style={editing ? styles.editBottomRow : undefined}>
              {editing ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Back to the details"
                  onPress={onBack}
                  style={({ pressed }) => [styles.secondaryBtn, styles.editBackBtn, { borderColor: palette.border }, pressed && styles.pressed]}
                >
                  <Text style={[styles.secondaryBtnText, { color: palette.foreground }]}>Back</Text>
                </Pressable>
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: selectedCount === 0 || savingTest, busy: savingTest }}
                disabled={selectedCount === 0 || savingTest}
                onPress={isPdf ? (pdfKind === 'smart' ? () => setStep('smart') : handleMakePdf) : handleCreateRoom}
                style={({ pressed }) => [
                  styles.primaryActionBtn,
                  editing && styles.editNextBtn,
                  { backgroundColor: palette.primary, opacity: selectedCount === 0 ? 0.45 : pressed || savingTest ? 0.8 : 1 },
                ]}
              >
                {savingTest ? <ActivityIndicator color={palette.onPrimary} /> : null}
                <Text style={[styles.primaryActionBtnText, { color: palette.onPrimary }]}>
                  {selectedCount === 0
                    ? 'Pick at least one question'
                    : editing
                    ? `Next · ${selectedCount} question${selectedCount === 1 ? '' : 's'}`
                    : `${isPdf ? (pdfKind === 'smart' ? 'Next: Smart PDF layout' : 'Make PDF') : onSubmitTest ? 'Continue' : 'Create room'} · ${selectedCount} question${selectedCount === 1 ? '' : 's'}`}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}

      {/* ── Step 3, Smart PDF: layout preview, then Generate ── */}
      {step === 'smart' && (
        <SmartPdfScreen
          title={title.trim()}
          questions={pickedQuestions()}
          standard={standard ?? undefined}
          subject={subject ?? undefined}
          bottomInset={bottomInset}
          onMade={(pdf) => {
            setMadePdf({ pdfs: [pdf], questions: pickedQuestions() });
            setPdfError(null);
            setStep('success');
          }}
        />
      )}

      {/* ── Step 3a: Room code ── */}
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
              {successDetails(createdRoom.questions).map(([key, value]) => (
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
                onPress={startAnother}
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

      {/* ── Step 3b: PDF paper ── */}
      {step === 'success' && madePdf && (
        <ScrollView
          contentContainerStyle={[styles.successContainer, { paddingBottom: 24 + bottomInset }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.successCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <View
              style={[styles.successIconCircle, { backgroundColor: palette.primarySoft, borderColor: palette.primaryBorder }]}
            >
              <SymbolView
                name={{ ios: 'doc.richtext.fill', android: 'picture_as_pdf', web: 'picture_as_pdf' }}
                tintColor={palette.primary}
                size={40}
              />
            </View>

            <Text style={[styles.successTitle, { color: palette.foreground }]}>
              {madePdf.pdfs.length > 1 ? 'PDFs ready' : madePdf.pdfs[0].name}
            </Text>
            <Text style={[styles.successSubtitle, { color: palette.mutedForeground }]}>
              {madePdf.pdfs.length > 1
                ? 'Both are saved to My PDFs on this phone. Open them, send them to your students, or print them.'
                : 'Saved to My PDFs on this phone. Open it, send it to your students, or print it.'}
            </Text>

            <View style={styles.detailsList}>
              {[
                ...successDetails(madePdf.questions),
                ...(madePdf.pdfs.length === 1
                  ? [
                      ...(madePdf.pdfs[0].pageCount ? [['Pages', `${madePdf.pdfs[0].pageCount}`]] : []),
                      ['In the PDF', pdfContentLabel(madePdf.pdfs[0])],
                    ]
                  : []),
              ].map(([key, value]) => (
                <View key={key} style={styles.detailRow}>
                  <Text style={[styles.detailKey, { color: palette.mutedForeground }]}>{key}</Text>
                  <Text style={[styles.detailVal, { color: palette.foreground }]}>{value}</Text>
                </View>
              ))}
            </View>

            {pdfError ? (
              <Text accessibilityLiveRegion="polite" style={[styles.helperText, { color: palette.dangerInk }]}>
                {pdfError}
              </Text>
            ) : null}

            {madePdf.pdfs.map((pdf) => renderPdfActions(pdf, madePdf.pdfs.length === 1))}
            {onViewPdfs ? (
              <Pressable
                accessibilityRole="button"
                onPress={onViewPdfs}
                style={({ pressed }) => [
                  styles.secondaryBtn,
                  styles.fullWidth,
                  styles.successRowBtn,
                  { borderColor: palette.border, marginTop: 10 },
                  pressed && styles.pressed,
                ]}
              >
                <SymbolView name={{ ios: 'folder', android: 'folder', web: 'folder' }} tintColor={palette.primary} size={16} />
                <Text style={[styles.secondaryBtnText, { color: palette.foreground }]}>My PDFs</Text>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              onPress={startAnother}
              style={({ pressed }) => [
                styles.secondaryBtn,
                styles.fullWidth,
                { borderColor: palette.border, marginTop: 10 },
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.secondaryBtnText, { color: palette.foreground }]}>Make another paper</Text>
            </Pressable>
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
  successPdfHead: {
    marginTop: 20,
    marginBottom: 8,
    gap: 2,
  },
  successPdfName: {
    fontSize: 15,
    fontWeight: '700',
  },
  successPdfMeta: {
    fontSize: 12,
  },
  successBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  successRowBtn: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
  },

  // Step 2 Curation
  stepContainer: {
    flex: 1,
  },
  summaryBanner: {
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  bannerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  autoSelectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
  },
  autoSelectText: {
    fontSize: 14,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.5,
  },
  qDetails: {
    fontSize: 12,
    marginBottom: 6,
  },
  progressPanel: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  progressCard: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 32,
    paddingHorizontal: 24,
    borderRadius: 16,
    borderWidth: 1,
  },
  progressTitle: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  progressHint: {
    fontSize: 13,
    textAlign: 'center',
  },
  bottomBarError: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 8,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  summaryMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  emptyList: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 32,
  },
  editBottomRow: {
    flexDirection: 'row',
    gap: 10,
  },
  editBackBtn: {
    flex: 1,
  },
  editNextBtn: {
    flex: 2,
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
    marginRight: 8,
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
