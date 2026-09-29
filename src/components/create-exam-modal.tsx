import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { getPalette, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
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

const QUESTION_COUNT_PRESETS = [5, 10, 15, 20, 30, 45];
const DURATION_PRESETS = [15, 30, 45, 60, 90, 180];
const STANDARDS: Standard[] = ['9th', '10th', '11th', '12th'];
const SUBJECTS: Subject[] = ['Physics', 'Chemistry', 'Mathematics', 'Biology', 'Science'];
const DIFFICULTIES: DifficultyLevel[] = ['Easy', 'Mid', 'Hard'];

export function CreateExamModal({ visible, onClose, onRoomCreated }: CreateExamModalProps) {
  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <CreateExamModalContent onClose={onClose} onRoomCreated={onRoomCreated} />
    </Modal>
  );
}

function CreateExamModalContent({
  onClose,
  onRoomCreated,
}: {
  onClose: () => void;
  onRoomCreated: (room: ExamRoom) => void;
}) {
  const scheme = useColorScheme();
  const palette = getPalette(scheme === 'dark');

  // Step state: 'config' | 'questions' | 'success'
  const [step, setStep] = useState<'config' | 'questions' | 'success'>('config');

  // Config fields
  const [title, setTitle] = useState('');
  const [examCategory, setExamCategory] = useState<ExamCategory | 'All'>('All');
  const [standard, setStandard] = useState<Standard | 'All'>('All');
  const [subject, setSubject] = useState<Subject | 'All'>('All');
  const [difficulty, setDifficulty] = useState<DifficultyLevel | 'All'>('All');
  const [questionCount, setQuestionCount] = useState(10);
  const [durationMinutes, setDurationMinutes] = useState(30);

  // Questions fetching & curation
  const [loading, setLoading] = useState(false);
  const [fetchedQuestions, setFetchedQuestions] = useState<Question[]>([]);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<Set<string>>(new Set());

  // Inline question editor
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);

  // Created room
  const [createdRoom, setCreatedRoom] = useState<ExamRoom | null>(null);

  // Step 1 -> Step 2: Fetch questions based on filters
  const handleFetchQuestions = async () => {
    if (!title.trim()) {
      Alert.alert('Title Required', 'Please enter an exam title or room name.');
      return;
    }

    setLoading(true);
    try {
      const filters: FilterState = {
        examCategory,
        standard,
        subject,
        chapter: 'All',
        topic: 'All',
        level: difficulty,
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
  const toggleQuestionSelect = (id: string) => {
    setSelectedQuestionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Save edited question
  const handleSaveEditedQuestion = (updated: Question) => {
    setFetchedQuestions((prev) => prev.map((q) => (q._id === updated._id ? updated : q)));
    setEditingQuestion(null);
  };

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
      examCategory,
      standard,
      subject,
      difficulty,
      durationMinutes,
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
      {/* ── Top Header ── */}
      <View style={[styles.header, { borderBottomColor: palette.border }]}>
        <View style={styles.headerLeft}>
          {step === 'questions' && (
            <Pressable onPress={() => setStep('config')} style={styles.backBtn}>
              <SymbolView name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} tintColor={palette.primary} size={20} />
            </Pressable>
          )}
          <Text style={[styles.headerTitle, { color: palette.foreground }]}>
            {step === 'config'
              ? 'Create Exam Room'
              : step === 'questions'
              ? 'Curate & Edit Questions'
              : 'Exam Room Ready!'}
          </Text>
        </View>
        <Pressable onPress={onClose} style={styles.closeBtn}>
          <SymbolView name={{ ios: 'xmark.circle.fill', android: 'close', web: 'close' }} tintColor={palette.mutedForeground} size={24} />
        </Pressable>
      </View>

      {/* ── Step 1: Configuration Form ── */}
      {step === 'config' && (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Exam Name */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: palette.mutedForeground }]}>EXAM ROOM TITLE *</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Physics Weekly Assessment Class 11"
              placeholderTextColor={palette.mutedForeground}
              style={[styles.textInput, { backgroundColor: palette.card, borderColor: palette.border, color: palette.foreground }]}
            />
          </View>

          {/* Exam Track */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: palette.mutedForeground }]}>COMPETITIVE TRACK</Text>
            <View style={styles.chipGrid}>
              {['All', 'Foundation', 'JEE/NEET'].map((cat) => {
                const isSel = examCategory === cat;
                return (
                  <Pressable
                    key={cat}
                    onPress={() => setExamCategory(cat as any)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: isSel ? palette.primary : palette.card,
                        borderColor: isSel ? palette.primary : palette.border,
                      },
                    ]}>
                    <Text style={[styles.chipText, { color: isSel ? palette.onPrimary : palette.foreground, fontWeight: isSel ? '700' : '500' }]}>
                      {cat}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Standard / Grade */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: palette.mutedForeground }]}>STANDARD / GRADE</Text>
            <View style={styles.chipGrid}>
              {['All', ...STANDARDS].map((std) => {
                const isSel = standard === std;
                return (
                  <Pressable
                    key={std}
                    onPress={() => setStandard(std as any)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: isSel ? palette.primary : palette.card,
                        borderColor: isSel ? palette.primary : palette.border,
                      },
                    ]}>
                    <Text style={[styles.chipText, { color: isSel ? palette.onPrimary : palette.foreground, fontWeight: isSel ? '700' : '500' }]}>
                      {std === 'All' ? 'All Grades' : `${std} Grade`}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Subject */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: palette.mutedForeground }]}>SUBJECT</Text>
            <View style={styles.chipGrid}>
              {['All', ...SUBJECTS].map((sub) => {
                const isSel = subject === sub;
                return (
                  <Pressable
                    key={sub}
                    onPress={() => setSubject(sub as any)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: isSel ? palette.primary : palette.card,
                        borderColor: isSel ? palette.primary : palette.border,
                      },
                    ]}>
                    <Text style={[styles.chipText, { color: isSel ? palette.onPrimary : palette.foreground, fontWeight: isSel ? '700' : '500' }]}>
                      {sub}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Difficulty Level */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: palette.mutedForeground }]}>DIFFICULTY LEVEL</Text>
            <View style={styles.chipGrid}>
              {['All', ...DIFFICULTIES].map((lvl) => {
                const isSel = difficulty === lvl;
                return (
                  <Pressable
                    key={lvl}
                    onPress={() => setDifficulty(lvl as any)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: isSel ? palette.primary : palette.card,
                        borderColor: isSel ? palette.primary : palette.border,
                      },
                    ]}>
                    <Text style={[styles.chipText, { color: isSel ? palette.onPrimary : palette.foreground, fontWeight: isSel ? '700' : '500' }]}>
                      {lvl}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Number of Questions Preset & Stepper */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: palette.mutedForeground }]}>
              NUMBER OF QUESTIONS ({questionCount})
            </Text>
            <View style={styles.chipGrid}>
              {QUESTION_COUNT_PRESETS.map((cnt) => {
                const isSel = questionCount === cnt;
                return (
                  <Pressable
                    key={cnt}
                    onPress={() => setQuestionCount(cnt)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: isSel ? palette.primary : palette.card,
                        borderColor: isSel ? palette.primary : palette.border,
                      },
                    ]}>
                    <Text style={[styles.chipText, { color: isSel ? palette.onPrimary : palette.foreground, fontWeight: isSel ? '700' : '500' }]}>
                      {cnt} Questions
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Duration Presets */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: palette.mutedForeground }]}>
              TEST DURATION ({durationMinutes} mins)
            </Text>
            <View style={styles.chipGrid}>
              {DURATION_PRESETS.map((dur) => {
                const isSel = durationMinutes === dur;
                return (
                  <Pressable
                    key={dur}
                    onPress={() => setDurationMinutes(dur)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: isSel ? palette.primary : palette.card,
                        borderColor: isSel ? palette.primary : palette.border,
                      },
                    ]}>
                    <Text style={[styles.chipText, { color: isSel ? palette.onPrimary : palette.foreground, fontWeight: isSel ? '700' : '500' }]}>
                      {dur} mins
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Submit Step 1 Button */}
          <Pressable
            onPress={handleFetchQuestions}
            disabled={loading}
            style={[styles.primaryActionBtn, { backgroundColor: palette.primary, opacity: loading ? 0.7 : 1 }]}>
            {loading ? (
              <ActivityIndicator color={palette.onPrimary} />
            ) : (
              <>
                <SymbolView name={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }} tintColor={palette.onPrimary} size={20} />
                <Text style={[styles.primaryActionBtnText, { color: palette.onPrimary }]}>
                  Fetch & Review Questions
                </Text>
              </>
            )}
          </Pressable>
        </ScrollView>
      )}

      {/* ── Step 2: Questions Review & Inline Editor ── */}
      {step === 'questions' && (
        <View style={styles.stepContainer}>
          <View style={[styles.summaryBanner, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <View>
              <Text style={[styles.summaryTitle, { color: palette.foreground }]}>{title}</Text>
              <Text style={[styles.summaryMeta, { color: palette.mutedForeground }]}>
                {selectedQuestionIds.size} of {fetchedQuestions.length} questions selected · {durationMinutes} mins
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
              style={[styles.selectAllBtn, { borderColor: palette.border }]}>
              <Text style={[styles.selectAllBtnText, { color: palette.primary }]}>
                {selectedQuestionIds.size === fetchedQuestions.length ? 'Deselect All' : 'Select All'}
              </Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.questionsList} showsVerticalScrollIndicator={false}>
            {fetchedQuestions.map((q, idx) => {
              const isSelected = selectedQuestionIds.has(q._id);
              return (
                <View
                  key={q._id}
                  style={[
                    styles.questionItemCard,
                    {
                      backgroundColor: palette.card,
                      borderColor: isSelected ? palette.primary : palette.border,
                      borderLeftWidth: isSelected ? 4 : 1,
                      borderLeftColor: isSelected ? palette.primary : palette.border,
                    },
                  ]}>
                  <View style={styles.qCardTop}>
                    <Pressable
                      onPress={() => toggleQuestionSelect(q._id)}
                      style={styles.checkboxRow}>
                      <View
                        style={[
                          styles.checkbox,
                          {
                            backgroundColor: isSelected ? palette.primary : 'transparent',
                            borderColor: isSelected ? palette.primary : palette.border,
                          },
                        ]}>
                        {isSelected && (
                          <SymbolView name={{ ios: 'checkmark', android: 'check', web: 'check' }} tintColor={palette.onPrimary} size={14} />
                        )}
                      </View>
                      <Text style={[styles.qIndexText, { color: palette.primary }]}>
                        Q{idx + 1} · {q.subject}
                      </Text>
                    </Pressable>

                    {/* Edit Question Trigger */}
                    <Pressable
                      onPress={() => setEditingQuestion(q)}
                      style={[styles.editBtn, { backgroundColor: palette.primarySoft }]}>
                      <SymbolView name={{ ios: 'pencil', android: 'edit', web: 'edit' }} tintColor={palette.primary} size={14} />
                      <Text style={[styles.editBtnText, { color: palette.primary }]}>Edit</Text>
                    </Pressable>
                  </View>

                  {/* Question Content */}
                  <Text style={[styles.qText, { color: palette.foreground }]}>{q.questionText}</Text>

                  {/* Options Preview */}
                  <View style={styles.optionsPreviewGrid}>
                    {[
                      ['A', q.optionA],
                      ['B', q.optionB],
                      ['C', q.optionC],
                      ['D', q.optionD],
                    ].map(([optKey, optText]) => {
                      const isCorrect = q.correctAnswer === optKey;
                      return (
                        <View
                          key={optKey}
                          style={[
                            styles.optPreviewBox,
                            {
                              backgroundColor: isCorrect ? palette.successSoft : palette.background,
                              borderColor: isCorrect ? palette.successBorder : palette.border,
                            },
                          ]}>
                          <Text style={[styles.optKeyBadge, { color: isCorrect ? palette.success : palette.mutedForeground }]}>
                            {optKey}.
                          </Text>
                          <Text numberOfLines={1} style={[styles.optText, { color: isCorrect ? palette.successInk : palette.foreground }]}>
                            {optText}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              );
            })}
          </ScrollView>

          {/* Bottom Create Button Bar */}
          <View style={[styles.bottomBar, { backgroundColor: palette.card, borderTopColor: palette.border }]}>
            <Pressable
              onPress={handleCreateRoom}
              style={[styles.primaryActionBtn, { backgroundColor: palette.primary }]}>
              <SymbolView name={{ ios: 'checkmark.seal.fill', android: 'verified', web: 'verified' }} tintColor={palette.onPrimary} size={20} />
              <Text style={[styles.primaryActionBtnText, { color: palette.onPrimary }]}>
                Generate Exam Room ({selectedQuestionIds.size} Questions)
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* ── Step 3: Exam Room Created Success Card ── */}
      {step === 'success' && createdRoom && (
        <View style={styles.successContainer}>
          <View style={[styles.successCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <View style={[styles.successIconBadge, { backgroundColor: palette.successSoft }]}>
              <SymbolView name={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }} tintColor={palette.success} size={48} />
            </View>
            <Text style={[styles.successHeading, { color: palette.foreground }]}>Room Created Successfully!</Text>
            <Text style={[styles.successSubheading, { color: palette.mutedForeground }]}>
              Share this room code with your students to take this test.
            </Text>

            {/* Room Code Callout */}
            <View style={[styles.roomCodeBox, { backgroundColor: palette.primarySoft, borderColor: palette.primaryBorder }]}>
              <Text style={[styles.roomCodeLabel, { color: palette.primary }]}>ROOM ACCESS CODE</Text>
              <Text style={[styles.roomCodeValue, { color: palette.primary }]}>{createdRoom.roomCode}</Text>
            </View>

            {/* Details List */}
            <View style={styles.detailsList}>
              <View style={styles.detailRow}>
                <Text style={[styles.detailKey, { color: palette.mutedForeground }]}>Exam Title:</Text>
                <Text style={[styles.detailVal, { color: palette.foreground }]}>{createdRoom.title}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={[styles.detailKey, { color: palette.mutedForeground }]}>Questions:</Text>
                <Text style={[styles.detailVal, { color: palette.foreground }]}>{createdRoom.questions.length}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={[styles.detailKey, { color: palette.mutedForeground }]}>Duration:</Text>
                <Text style={[styles.detailVal, { color: palette.foreground }]}>{createdRoom.durationMinutes} minutes</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={[styles.detailKey, { color: palette.mutedForeground }]}>Total Marks:</Text>
                <Text style={[styles.detailVal, { color: palette.foreground }]}>{createdRoom.totalMarks} marks</Text>
              </View>
            </View>

            <Pressable
              onPress={onClose}
              style={[styles.primaryActionBtn, { backgroundColor: palette.primary, marginTop: 24 }]}>
              <Text style={[styles.primaryActionBtnText, { color: palette.onPrimary }]}>Done & View Exam Room</Text>
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
    </SafeAreaView>
  );
}

// ─── Inline Question Editor Modal ─────────────────────────────────────────────

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
  const [difficulty, setDifficulty] = useState<DifficultyLevel>(question.difficulty);

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
      difficulty,
    });
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onCancel}>
      <View style={styles.editModalOverlay}>
        <View style={[styles.editModalContent, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={styles.editModalHeader}>
            <Text style={[styles.editModalTitle, { color: palette.foreground }]}>Edit Question</Text>
            <Pressable onPress={onCancel}>
              <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} tintColor={palette.mutedForeground} size={20} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.editModalScroll} showsVerticalScrollIndicator={false}>
            {/* Difficulty Selector */}
            <Text style={[styles.fieldLabel, { color: palette.mutedForeground }]}>DIFFICULTY</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
              {DIFFICULTIES.map((d) => (
                <Pressable
                  key={d}
                  onPress={() => setDifficulty(d)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: difficulty === d ? palette.primary : palette.background,
                      borderColor: difficulty === d ? palette.primary : palette.border,
                      paddingVertical: 6,
                    },
                  ]}>
                  <Text style={{ color: difficulty === d ? palette.onPrimary : palette.foreground, fontWeight: '700', fontSize: 12 }}>
                    {d}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Question Text */}
            <Text style={[styles.fieldLabel, { color: palette.mutedForeground }]}>QUESTION TEXT</Text>
            <TextInput
              value={questionText}
              onChangeText={setQuestionText}
              multiline
              style={[styles.multilineInput, { backgroundColor: palette.background, borderColor: palette.border, color: palette.foreground }]}
            />

            {/* Options */}
            {(['A', 'B', 'C', 'D'] as const).map((opt) => {
              const val = opt === 'A' ? optionA : opt === 'B' ? optionB : opt === 'C' ? optionC : optionD;
              const setter = opt === 'A' ? setOptionA : opt === 'B' ? setOptionB : opt === 'C' ? setOptionC : setOptionD;
              const isCorrect = correctAnswer === opt;

              return (
                <View key={opt} style={styles.editOptRow}>
                  <Pressable
                    onPress={() => setCorrectAnswer(opt)}
                    style={[
                      styles.correctCheckBadge,
                      {
                        backgroundColor: isCorrect ? palette.success : palette.secondary,
                      },
                    ]}>
                    <Text style={{ color: isCorrect ? palette.onPrimary : palette.foreground, fontWeight: '700', fontSize: 12 }}>
                      {opt} {isCorrect ? '✓' : ''}
                    </Text>
                  </Pressable>
                  <TextInput
                    value={val}
                    onChangeText={setter}
                    placeholder={`Option ${opt}`}
                    placeholderTextColor={palette.mutedForeground}
                    style={[styles.textInput, { flex: 1, backgroundColor: palette.background, borderColor: isCorrect ? palette.success : palette.border, color: palette.foreground }]}
                  />
                </View>
              );
            })}

            {/* Explanation */}
            <Text style={[styles.fieldLabel, { color: palette.mutedForeground, marginTop: 12 }]}>EXPLANATION</Text>
            <TextInput
              value={explanation}
              onChangeText={setExplanation}
              multiline
              placeholder="Step-by-step solution / explanation"
              placeholderTextColor={palette.mutedForeground}
              style={[styles.multilineInput, { backgroundColor: palette.background, borderColor: palette.border, color: palette.foreground }]}
            />
          </ScrollView>

          <View style={[styles.editModalActions, { borderTopColor: palette.border }]}>
            <Pressable onPress={onCancel} style={[styles.secondaryBtn, { borderColor: palette.border }]}>
              <Text style={{ color: palette.foreground, fontWeight: '600' }}>Cancel</Text>
            </Pressable>
            <Pressable onPress={handleSave} style={[styles.primaryActionBtn, { flex: 1, backgroundColor: palette.primary }]}>
              <Text style={[styles.primaryActionBtnText, { color: palette.onPrimary }]}>Save Changes</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  closeBtn: { padding: 4 },
  scrollContent: { padding: Spacing.four, gap: 18, paddingBottom: 40 },

  fieldGroup: { gap: 8 },
  fieldLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6 },
  textInput: {
    height: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    fontSize: 14,
  },
  multilineInput: {
    minHeight: 80,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  chipText: { fontSize: 13 },
  primaryActionBtn: {
    height: 52,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
  },
  primaryActionBtnText: { fontSize: 15, fontWeight: '700' },

  // Step 2
  stepContainer: { flex: 1 },
  summaryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  summaryTitle: { fontSize: 15, fontWeight: '700' },
  summaryMeta: { fontSize: 12, marginTop: 2 },
  selectAllBtn: { paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderRadius: 6 },
  selectAllBtnText: { fontSize: 12, fontWeight: '700' },
  questionsList: { padding: 16, gap: 14, paddingBottom: 100 },
  questionItemCard: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  qCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qIndexText: { fontSize: 13, fontWeight: '700' },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  editBtnText: { fontSize: 12, fontWeight: '700' },
  qText: { fontSize: 14, lineHeight: 20 },
  optionsPreviewGrid: { gap: 6 },
  optPreviewBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  optKeyBadge: { fontSize: 12, fontWeight: '700' },
  optText: { fontSize: 12, flex: 1 },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    borderTopWidth: 1,
  },

  // Success step
  successContainer: { flex: 1, padding: 20, justifyContent: 'center' },
  successCard: {
    padding: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  successIconBadge: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  successHeading: { fontSize: 20, fontWeight: '800', textAlign: 'center' },
  successSubheading: { fontSize: 13, textAlign: 'center', marginTop: 6, marginBottom: 20 },
  roomCodeBox: {
    width: '100%',
    padding: 18,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    marginBottom: 20,
  },
  roomCodeLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  roomCodeValue: { fontSize: 28, fontWeight: '900', letterSpacing: 2, marginTop: 4 },
  detailsList: { width: '100%', gap: 10 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailKey: { fontSize: 13, fontWeight: '500' },
  detailVal: { fontSize: 13, fontWeight: '700' },

  // Edit modal
  editModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  editModalContent: {
    height: '88%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
    paddingTop: 16,
  },
  editModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  editModalTitle: { fontSize: 17, fontWeight: '700' },
  editModalScroll: { padding: 20, gap: 12, paddingBottom: 40 },
  editOptRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  correctCheckBadge: {
    width: 36,
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editModalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
  },
  secondaryBtn: {
    height: 52,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
