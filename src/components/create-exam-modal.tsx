import React, { useState, memo, useCallback, useMemo } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { getPalette, Spacing, MaxContentWidth } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useResponsive } from '@/hooks/use-responsive';
import { DropdownSelect } from '@/components/dropdown-select';
import { MathText } from './math-text';
import { Explanation } from './explanation';
import type {
  DifficultyLevel,
  ExamCategory,
  ExamRoom,
  FilterState,
  Question,
  Standard,
  Subject,
} from '@/types/pcmb';
import { fetchQuestions } from '@/services/apiService';

interface CreateExamModalProps {
  visible: boolean;
  onClose: () => void;
  onRoomCreated: (room: ExamRoom) => void;
}

const STANDARDS: Standard[] = ['9th', '10th', '11th', '12th'];
const SUBJECTS: Subject[] = ['Physics', 'Chemistry', 'Mathematics', 'Biology', 'Science'];
const DIFFICULTIES: DifficultyLevel[] = ['Easy', 'Mid', 'Hard'];

const FOUNDATION_STANDARDS: Standard[] = ['9th', '10th'];
const JEE_NEET_STANDARDS: Standard[] = ['11th', '12th'];
const SUBJECT_MAP: Record<ExamCategory, Subject[]> = {
  Foundation: ['Science', 'Mathematics', 'Physics', 'Chemistry'],
  'JEE/NEET': ['Physics', 'Chemistry', 'Mathematics', 'Biology'],
};

export function CreateExamModal({ visible, onClose, onRoomCreated }: CreateExamModalProps) {
  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <CreateExamModalContent onClose={onClose} onRoomCreated={onRoomCreated} />
    </Modal>
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
          borderLeftWidth: isSelected ? 4 : 1,
          borderLeftColor: isSelected ? palette.primary : palette.border,
        },
      ]}
    >
      <View style={styles.qCardTop}>
        <Pressable
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
            Q{index + 1} · {question.subject}
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

// ─── Modal Content Component ────────────────────────────────────────────────

function CreateExamModalContent({
  onClose,
  onRoomCreated,
}: {
  onClose: () => void;
  onRoomCreated: (room: ExamRoom) => void;
}) {
  const scheme = useColorScheme();
  const dark = scheme === 'dark';
  const palette = getPalette(dark);
  const { isTablet } = useResponsive();

  // Step state: 'config' | 'questions' | 'success'
  const [step, setStep] = useState<'config' | 'questions' | 'success'>('config');

  // Config fields
  const [title, setTitle] = useState('');
  const [examCategory, setExamCategory] = useState<string>('All');
  const [standard, setStandard] = useState<string>('All');
  const [subject, setSubject] = useState<string>('All');
  const [difficulty, setDifficulty] = useState<string>('All');
  const [questionCount, setQuestionCount] = useState<number>(10);

  // Questions fetching & curation
  const [loading, setLoading] = useState(false);
  const [fetchedQuestions, setFetchedQuestions] = useState<Question[]>([]);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<Set<string>>(new Set());

  // Inline question editor
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);

  // Created room
  const [createdRoom, setCreatedRoom] = useState<ExamRoom | null>(null);

  // Derived standards & subjects
  const availableStandards = useMemo(() => {
    if (examCategory === 'Foundation') return FOUNDATION_STANDARDS;
    if (examCategory === 'JEE/NEET') return JEE_NEET_STANDARDS;
    return STANDARDS;
  }, [examCategory]);

  const availableSubjects = useMemo(() => {
    if (examCategory === 'Foundation' || examCategory === 'JEE/NEET') {
      return SUBJECT_MAP[examCategory as ExamCategory];
    }
    return SUBJECTS;
  }, [examCategory]);

  // Step 1 -> Step 2: Fetch questions based on dropdown filters
  const handleFetchQuestions = async () => {
    if (!title.trim()) {
      Alert.alert('Title Required', 'Please enter an exam title or room name.');
      return;
    }

    setLoading(true);
    try {
      const filters: FilterState = {
        examCategory: (examCategory as ExamCategory) || 'All',
        standard: (standard as Standard) || 'All',
        subject: (subject as Subject) || 'All',
        chapter: 'All',
        topic: 'All',
        level: (difficulty as DifficultyLevel) || 'All',
        searchQuery: '',
      };

      const qs = await fetchQuestions(filters);
      if (qs.length === 0) {
        Alert.alert(
          'No Questions Found',
          'No questions match the selected filters. Please broaden your selection.'
        );
        return;
      }

      const initialSelected = new Set(qs.slice(0, questionCount).map((q) => q._id));
      setFetchedQuestions(qs);
      setSelectedQuestionIds(initialSelected);
      setStep('questions');
    } catch {
      Alert.alert('Error', 'Failed to fetch questions. Please check connection.');
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
  const handleSaveEditedQuestion = useCallback((updated: Question) => {
    setFetchedQuestions((prev) => prev.map((q) => (q._id === updated._id ? updated : q)));
    setEditingQuestion(null);
  }, []);

  // Final Step: Create Exam Room
  const handleCreateRoom = () => {
    const selectedList = fetchedQuestions.filter((q) => selectedQuestionIds.has(q._id));
    if (selectedList.length === 0) {
      Alert.alert('Select Questions', 'Please select at least 1 question for the exam room.');
      return;
    }

    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const prefix = examCategory === 'JEE/NEET' ? 'NEET' : examCategory === 'Foundation' ? 'FOUND' : 'PCMB';
    const roomCode = `${prefix}-${randomSuffix}`;

    const newRoom: ExamRoom = {
      _id: `room-${Date.now()}`,
      roomCode,
      title: title.trim(),
      examCategory: (examCategory as ExamCategory) || 'JEE/NEET',
      standard: (standard as Standard) || '12th',
      subject: (subject as Subject) || 'Physics',
      difficulty: (difficulty as DifficultyLevel) || 'Mid',
      durationMinutes: 0,
      totalMarks: selectedList.length * 4,
      questions: selectedList,
      createdAt: new Date().toISOString(),
      status: 'active',
    };

    setCreatedRoom(newRoom);
    onRoomCreated(newRoom);
    setStep('success');
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: palette.background }]}>
      <View style={[styles.mainContainer, { maxWidth: MaxContentWidth }]}>
        {/* ── Top Header ── */}
        <View style={[styles.header, { borderBottomColor: palette.border }]}>
          <View style={styles.headerLeft}>
            {step === 'questions' && (
              <Pressable onPress={() => setStep('config')} style={styles.backBtn}>
                <SymbolView
                  name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
                  tintColor={palette.primary}
                  size={20}
                />
              </Pressable>
            )}
            <Text style={[styles.headerTitle, { color: palette.foreground }]}>
              {step === 'config'
                ? 'Create Exam Room'
                : step === 'questions'
                ? 'Curate Questions'
                : 'Exam Room Ready!'}
            </Text>
          </View>
          <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={8}>
            <SymbolView
              name={{ ios: 'xmark.circle.fill', android: 'close', web: 'close' }}
              tintColor={palette.mutedForeground}
              size={24}
            />
          </Pressable>
        </View>

        {/* ── Step 1: Configuration Form with Dropdown Filters ── */}
        {step === 'config' && (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Exam Name */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: palette.mutedForeground }]}>
                EXAM ROOM TITLE *
              </Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="e.g. Physics Weekly Test Class 11"
                placeholderTextColor={palette.mutedForeground}
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

            {/* Dropdown: Competitive Track */}
            <DropdownSelect
              label="Competitive Track"
              options={['Foundation', 'JEE/NEET']}
              selected={examCategory}
              onSelect={(val) => {
                setExamCategory(val);
                setStandard('All');
                setSubject('All');
              }}
              icon={{ ios: 'graduationcap', android: 'school', web: 'school' }}
            />

            {/* Dropdown: Standard / Grade */}
            <DropdownSelect
              label="Standard / Grade"
              options={availableStandards}
              selected={standard}
              onSelect={setStandard}
              icon={{ ios: 'number', android: 'pin', web: 'pin' }}
            />

            {/* Dropdown: Subject */}
            <DropdownSelect
              label="Subject"
              options={availableSubjects}
              selected={subject}
              onSelect={setSubject}
              icon={{ ios: 'atom', android: 'science', web: 'science' }}
            />

            {/* Dropdown: Difficulty Level */}
            <DropdownSelect
              label="Difficulty Level"
              options={DIFFICULTIES}
              selected={difficulty}
              onSelect={setDifficulty}
              icon={{ ios: 'speedometer', android: 'speed', web: 'speed' }}
            />

            {/* Dropdown: Question Count */}
            <DropdownSelect
              label="Target Question Count"
              options={['5', '10', '15', '20', '30', '45']}
              selected={`${questionCount}`}
              onSelect={(val) => setQuestionCount(Number(val) || 10)}
              icon={{ ios: 'doc.text', android: 'description', web: 'description' }}
            />

            {/* Submit Step 1 Button */}
            <Pressable
              onPress={handleFetchQuestions}
              disabled={loading}
              style={[
                styles.primaryActionBtn,
                { backgroundColor: palette.primary, opacity: loading ? 0.7 : 1, marginTop: 12 },
              ]}
            >
              {loading ? (
                <ActivityIndicator color={palette.onPrimary} />
              ) : (
                <>
                  <SymbolView
                    name={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }}
                    tintColor={palette.onPrimary}
                    size={19}
                  />
                  <Text style={[styles.primaryActionBtnText, { color: palette.onPrimary }]}>
                    Fetch & Review Questions
                  </Text>
                </>
              )}
            </Pressable>
          </ScrollView>
        )}

        {/* ── Step 2: High Performance Virtualized Question List ── */}
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
                  {selectedQuestionIds.size} of {fetchedQuestions.length} selected · {selectedQuestionIds.size * 4} marks
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  if (selectedQuestionIds.size === fetchedQuestions.length) {
                    setSelectedQuestionIds(new Set());
                  } else {
                    setSelectedQuestionIds(new Set(fetchedQuestions.map((q) => q._id)));
                  }
                }}
                style={[styles.selectAllBtn, { borderColor: palette.border }]}
              >
                <Text style={[styles.selectAllBtnText, { color: palette.primary }]}>
                  {selectedQuestionIds.size === fetchedQuestions.length ? 'Deselect All' : 'Select All'}
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

            {/* Bottom Create Button Bar */}
            <View
              style={[
                styles.bottomBar,
                { backgroundColor: palette.card, borderTopColor: palette.border },
              ]}
            >
              <Pressable
                onPress={handleCreateRoom}
                style={[styles.primaryActionBtn, { backgroundColor: palette.primary }]}
              >
                <SymbolView
                  name={{ ios: 'checkmark.seal.fill', android: 'verified', web: 'verified' }}
                  tintColor={palette.onPrimary}
                  size={19}
                />
                <Text style={[styles.primaryActionBtnText, { color: palette.onPrimary }]}>
                  Confirm & Create Room ({selectedQuestionIds.size} Qs)
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* ── Step 3: Success Screen ── */}
        {step === 'success' && createdRoom && (
          <View style={styles.successContainer}>
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

              <Text style={[styles.successTitle, { color: palette.foreground }]}>
                Exam Room Created!
              </Text>
              <Text style={[styles.successSubtitle, { color: palette.mutedForeground }]}>
                Your exam is active and ready for practice.
              </Text>

              {/* Room Code Callout */}
              <View
                style={[
                  styles.roomCodeBox,
                  { backgroundColor: palette.primarySoft, borderColor: palette.primaryBorder },
                ]}
              >
                <Text style={[styles.roomCodeLabel, { color: palette.primary }]}>
                  ROOM ACCESS CODE
                </Text>
                <Text style={[styles.roomCodeValue, { color: palette.primary }]}>
                  {createdRoom.roomCode}
                </Text>
              </View>

              {/* Details List */}
              <View style={styles.detailsList}>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailKey, { color: palette.mutedForeground }]}>
                    Exam Title:
                  </Text>
                  <Text style={[styles.detailVal, { color: palette.foreground }]}>
                    {createdRoom.title}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailKey, { color: palette.mutedForeground }]}>
                    Questions:
                  </Text>
                  <Text style={[styles.detailVal, { color: palette.foreground }]}>
                    {createdRoom.questions.length}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailKey, { color: palette.mutedForeground }]}>
                    Total Marks:
                  </Text>
                  <Text style={[styles.detailVal, { color: palette.foreground }]}>
                    {createdRoom.totalMarks} marks
                  </Text>
                </View>
              </View>

              <Pressable
                onPress={onClose}
                style={[styles.primaryActionBtn, { backgroundColor: palette.primary, marginTop: 24 }]}
              >
                <Text style={[styles.primaryActionBtnText, { color: palette.onPrimary }]}>
                  Done & View Exam Room
                </Text>
              </Pressable>
            </View>
          </View>
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
    </SafeAreaView>
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
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backBtn: {
    padding: 4,
    marginRight: 4,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
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
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
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
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
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
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  roomCodeValue: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 2,
    marginTop: 4,
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
