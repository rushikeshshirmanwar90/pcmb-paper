import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Alert,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { MathText } from '@/components/math-text';
import { Explanation } from '@/components/explanation';
import { DropdownSelect } from '@/components/dropdown-select';
import { getPalette, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { DifficultyLevel, ExamRoom, Question } from '@/types/pcmb';

interface ExamRoomDetailsModalProps {
  room: ExamRoom | null;
  visible: boolean;
  onClose: () => void;
  onUpdateRoom: (updatedRoom: ExamRoom) => void;
}

const DIFFICULTIES: DifficultyLevel[] = ['Easy', 'Mid', 'Hard'];

export function ExamRoomDetailsModal({
  room,
  visible,
  onClose,
  onUpdateRoom,
}: ExamRoomDetailsModalProps) {
  if (!visible || !room) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ExamRoomDetailsContent room={room} onClose={onClose} onUpdateRoom={onUpdateRoom} />
    </Modal>
  );
}

function ExamRoomDetailsContent({
  room,
  onClose,
  onUpdateRoom,
}: {
  room: ExamRoom;
  onClose: () => void;
  onUpdateRoom: (updatedRoom: ExamRoom) => void;
}) {
  const scheme = useColorScheme();
  const palette = getPalette(scheme === 'dark');

  const [currentRoom, setCurrentRoom] = useState<ExamRoom>(room);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Join the Exam Room "${currentRoom.title}" on PCMB Paper app using Room Code: ${currentRoom.roomCode}`,
      });
    } catch {
      Alert.alert('Share', `Room Code: ${currentRoom.roomCode}`);
    }
  };

  const handleSaveEditedQuestion = (updatedQ: Question) => {
    const nextQuestions = currentRoom.questions.map((q) =>
      q._id === updatedQ._id ? updatedQ : q
    );
    const updatedRoom: ExamRoom = {
      ...currentRoom,
      questions: nextQuestions,
      totalMarks: nextQuestions.length * 4,
    };
    setCurrentRoom(updatedRoom);
    onUpdateRoom(updatedRoom);
    setEditingQuestion(null);
  };

  const handleDeleteQuestion = (questionId: string) => {
    Alert.alert(
      'Remove Question',
      'Are you sure you want to remove this question from the exam room?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            const nextQuestions = currentRoom.questions.filter((q) => q._id !== questionId);
            const updatedRoom: ExamRoom = {
              ...currentRoom,
              questions: nextQuestions,
              totalMarks: nextQuestions.length * 4,
            };
            setCurrentRoom(updatedRoom);
            onUpdateRoom(updatedRoom);
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: palette.background }]}>
      {/* ── Top Header ── */}
      <View style={[styles.header, { borderBottomColor: palette.border }]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.headerTitle, { color: palette.foreground }]}>Exam Room Details</Text>
        </View>
        <Pressable onPress={onClose} style={styles.closeBtn}>
          <SymbolView name={{ ios: 'xmark.circle.fill', android: 'close', web: 'close' }} tintColor={palette.mutedForeground} size={24} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ── Room Hero Card ── */}
        <View style={[styles.roomHeroCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={styles.heroTopRow}>
            <View style={[styles.roomCodeBox, { backgroundColor: palette.primarySoft, borderColor: palette.primaryBorder }]}>
              <SymbolView name={{ ios: 'key.fill', android: 'vpn_key', web: 'vpn_key' }} tintColor={palette.primary} size={15} />
              <Text style={[styles.roomCodeText, { color: palette.primary }]}>{currentRoom.roomCode}</Text>
            </View>
            <Pressable
              onPress={handleShare}
              style={({ pressed }) => [styles.shareActionBtn, { backgroundColor: palette.primary }, pressed && styles.pressed]}>
              <SymbolView name={{ ios: 'square.and.arrow.up', android: 'share', web: 'share' }} tintColor={palette.onPrimary} size={14} />
              <Text style={[styles.shareActionBtnText, { color: palette.onPrimary }]}>Share Code</Text>
            </Pressable>
          </View>

          <Text style={[styles.roomHeroTitle, { color: palette.foreground }]}>{currentRoom.title}</Text>

          {/* Key metadata chips */}
          <View style={styles.badgeRow}>
            <View style={[styles.infoBadge, { backgroundColor: palette.secondary }]}>
              <Text style={[styles.infoBadgeText, { color: palette.mutedForeground }]}>
                Track: <Text style={{ color: palette.foreground, fontWeight: '700' }}>{currentRoom.examCategory}</Text>
              </Text>
            </View>
            <View style={[styles.infoBadge, { backgroundColor: palette.secondary }]}>
              <Text style={[styles.infoBadgeText, { color: palette.mutedForeground }]}>
                Grade: <Text style={{ color: palette.foreground, fontWeight: '700' }}>{currentRoom.standard}</Text>
              </Text>
            </View>
            <View style={[styles.infoBadge, { backgroundColor: palette.secondary }]}>
              <Text style={[styles.infoBadgeText, { color: palette.mutedForeground }]}>
                Subject: <Text style={{ color: palette.foreground, fontWeight: '700' }}>{currentRoom.subject}</Text>
              </Text>
            </View>
          </View>

          {/* Stats Bar */}
          <View style={[styles.statsBar, { borderTopColor: palette.border }]}>
            <View style={styles.statItem}>
              <Text style={[styles.statVal, { color: palette.primary }]}>{currentRoom.questions.length}</Text>
              <Text style={[styles.statLbl, { color: palette.mutedForeground }]}>Questions</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: palette.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statVal, { color: palette.primary }]}>{currentRoom.totalMarks}</Text>
              <Text style={[styles.statLbl, { color: palette.mutedForeground }]}>Total Marks</Text>
            </View>
          </View>
        </View>

        {/* ── Section Title ── */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionHeading, { color: palette.foreground }]}>
            Questions in Room ({currentRoom.questions.length})
          </Text>
          <Text style={[styles.sectionSubtitle, { color: palette.mutedForeground }]}>
            {"Tap \"Edit\" on any question to modify prompt, options, or answer"}
          </Text>
        </View>

        {/* ── Questions List ── */}
        {currentRoom.questions.length === 0 ? (
          <View style={[styles.emptyQuestionsBox, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <SymbolView name={{ ios: 'doc.text.magnifyingglass', android: 'find_in_page', web: 'find_in_page' }} tintColor={palette.mutedForeground} size={32} />
            <Text style={[styles.emptyQuestionsTitle, { color: palette.foreground }]}>No questions currently in this room</Text>
          </View>
        ) : (
          currentRoom.questions.map((q, idx) => (
            <View
              key={q._id || `q-${idx}`}
              style={[styles.questionCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
              {/* Question Card Top Bar */}
              <View style={styles.questionCardHeader}>
                <View style={styles.qIndexBadgeRow}>
                  <View style={[styles.qNumBadge, { backgroundColor: palette.primary }]}>
                    <Text style={[styles.qNumText, { color: palette.onPrimary }]}>Q{idx + 1}</Text>
                  </View>
                  <Text style={[styles.qSubjectText, { color: palette.mutedForeground }]}>
                    {q.subject} · {q.chapter || 'Core'}
                  </Text>
                  {q.difficulty && (
                    <View style={[styles.diffBadge, { backgroundColor: palette.secondary }]}>
                      <Text style={[styles.diffText, { color: palette.mutedForeground }]}>{q.difficulty}</Text>
                    </View>
                  )}
                </View>

                <View style={styles.qActionBtns}>
                  <Pressable
                    onPress={() => setEditingQuestion(q)}
                    style={({ pressed }) => [styles.editActionBtn, { backgroundColor: palette.primarySoft }, pressed && styles.pressed]}>
                    <SymbolView name={{ ios: 'pencil', android: 'edit', web: 'edit' }} tintColor={palette.primary} size={13} />
                    <Text style={[styles.editActionText, { color: palette.primary }]}>Edit</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => handleDeleteQuestion(q._id)}
                    style={({ pressed }) => [styles.deleteActionBtn, { backgroundColor: palette.dangerSoft }, pressed && styles.pressed]}>
                    <SymbolView name={{ ios: 'trash', android: 'delete', web: 'delete' }} tintColor={palette.dangerInk} size={13} />
                  </Pressable>
                </View>
              </View>

              {/* Question Text */}
              <View style={styles.questionTextWrap}>
                <MathText text={q.questionText} fontSize={14} color={palette.foreground} />
              </View>

              {/* Options Grid */}
              <View style={styles.optionsList}>
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
                        styles.optionRow,
                        {
                          backgroundColor: isCorrect ? palette.successSoft : palette.background,
                          borderColor: isCorrect ? palette.successBorder : palette.border,
                        },
                      ]}>
                      <View
                        style={[
                          styles.optionKeyCircle,
                          {
                            backgroundColor: isCorrect ? palette.success : palette.secondary,
                          },
                        ]}>
                        <Text style={{ color: isCorrect ? palette.onPrimary : palette.foreground, fontWeight: '700', fontSize: 11 }}>
                          {optKey}
                        </Text>
                      </View>
                      <View style={styles.optionContentWrap}>
                        <MathText text={optText} fontSize={13} color={isCorrect ? palette.successInk : palette.foreground} />
                      </View>
                      {isCorrect && (
                        <View style={[styles.correctTag, { backgroundColor: palette.success }]}>
                          <Text style={{ color: palette.onPrimary, fontSize: 10, fontWeight: '800' }}>CORRECT</Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>

              {/* Explanation section — rendered with proper math formatting */}
              {q.explanation ? (
                <Explanation
                  text={q.explanation}
                  source={q.source}
                  correctAnswer={q.correctAnswer}
                  defaultCollapsed={false}
                />
              ) : null}
            </View>
          ))
        )}
      </ScrollView>

      {/* ── Inline Edit Question Modal ── */}
      {editingQuestion && (
        <QuestionEditorSheet
          question={editingQuestion}
          onSave={handleSaveEditedQuestion}
          onCancel={() => setEditingQuestion(null)}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Inline Question Editor Modal Component ───────────────────────────────────

function QuestionEditorSheet({
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
    if (!questionText.trim()) {
      Alert.alert('Validation Error', 'Question text cannot be empty.');
      return;
    }
    onSave({
      ...question,
      questionText: questionText.trim(),
      optionA: optionA.trim(),
      optionB: optionB.trim(),
      optionC: optionC.trim(),
      optionD: optionD.trim(),
      correctAnswer,
      explanation: explanation.trim(),
      difficulty,
    });
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onCancel}>
      <View style={styles.editModalOverlay}>
        <View style={[styles.editModalContent, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={styles.editModalHeader}>
            <Text style={[styles.editModalTitle, { color: palette.foreground }]}>Edit Room Question</Text>
            <Pressable onPress={onCancel} hitSlop={8}>
              <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} tintColor={palette.mutedForeground} size={20} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.editModalScroll} showsVerticalScrollIndicator={false}>
            {/* Difficulty Selector */}
            <DropdownSelect
              label="DIFFICULTY LEVEL"
              options={DIFFICULTIES}
              selected={difficulty}
              onSelect={(val) => setDifficulty(val as DifficultyLevel)}
            />

            {/* Question Text */}
            <Text style={[styles.fieldLabel, { color: palette.mutedForeground, marginTop: 8 }]}>QUESTION TEXT (LaTeX supported)</Text>
            <TextInput
              value={questionText}
              onChangeText={setQuestionText}
              multiline
              style={[styles.multilineInput, { backgroundColor: palette.background, borderColor: palette.border, color: palette.foreground }]}
            />
            {questionText.trim().length > 0 && (
              <View style={[styles.inlinePreviewBox, { backgroundColor: palette.secondary, borderColor: palette.border }]}>
                <Text style={[styles.inlinePreviewTitle, { color: palette.primary }]}>LIVE FORMULA PREVIEW</Text>
                <MathText text={questionText} fontSize={14} color={palette.foreground} />
              </View>
            )}

            {/* Options */}
            <Text style={[styles.fieldLabel, { color: palette.mutedForeground, marginTop: 12 }]}>OPTIONS</Text>
            {(['A', 'B', 'C', 'D'] as const).map((opt) => {
              const val = opt === 'A' ? optionA : opt === 'B' ? optionB : opt === 'C' ? optionC : optionD;
              const setter = opt === 'A' ? setOptionA : opt === 'B' ? setOptionB : opt === 'C' ? setOptionC : setOptionD;
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
                  {val.trim().length > 0 && (
                    <View style={{ paddingLeft: 46, paddingTop: 2 }}>
                      <MathText text={val} fontSize={12.5} color={isCorrect ? palette.successInk : palette.mutedForeground} />
                    </View>
                  )}
                </View>
              );
            })}

            {/* Explanation */}
            <Text style={[styles.fieldLabel, { color: palette.mutedForeground, marginTop: 12 }]}>EXPLANATION / SOLUTION</Text>
            <TextInput
              value={explanation}
              onChangeText={setExplanation}
              multiline
              placeholder="Step-by-step solution / explanation"
              placeholderTextColor={palette.mutedForeground}
              style={[styles.multilineInput, { backgroundColor: palette.background, borderColor: palette.border, color: palette.foreground }]}
            />
            {explanation.trim().length > 0 && (
              <View style={[styles.inlinePreviewBox, { backgroundColor: palette.secondary, borderColor: palette.border, marginTop: 8 }]}>
                <Text style={[styles.inlinePreviewTitle, { color: palette.primary }]}>EXPLANATION PREVIEW</Text>
                <MathText text={explanation} fontSize={13.5} color={palette.foreground} />
              </View>
            )}
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
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  closeBtn: { padding: 4 },
  scrollContent: { padding: Spacing.four, gap: 16, paddingBottom: 60 },

  // Room Hero Card
  roomHeroCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  roomCodeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  roomCodeText: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  shareActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  shareActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  pressed: { opacity: 0.75 },
  roomHeroTitle: {
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 23,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  infoBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  infoBadgeText: {
    fontSize: 12,
  },
  statsBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: 12,
  },
  statItem: {
    alignItems: 'center',
  },
  statVal: {
    fontSize: 16,
    fontWeight: '800',
  },
  statLbl: {
    fontSize: 11,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 24,
  },

  // Section Header
  sectionHeaderRow: {
    marginTop: 6,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '700',
  },
  sectionSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },

  emptyQuestionsBox: {
    padding: 24,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    gap: 8,
  },
  emptyQuestionsTitle: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Question Card
  questionCard: {
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    gap: 12,
  },
  questionCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  qIndexBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  qNumBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  qNumText: {
    fontSize: 11,
    fontWeight: '800',
  },
  qSubjectText: {
    fontSize: 12,
    fontWeight: '600',
  },
  diffBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  diffText: {
    fontSize: 10,
    fontWeight: '600',
  },
  qActionBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  editActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  editActionText: {
    fontSize: 12,
    fontWeight: '700',
  },
  deleteActionBtn: {
    padding: 6,
    borderRadius: 6,
  },
  questionBodyText: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '500',
  },
  questionTextWrap: {
    marginBottom: 2,
  },
  optionContentWrap: {
    flex: 1,
  },
  optionsList: {
    gap: 8,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
  },
  optionKeyCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  correctTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },

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
  inlinePreviewBox: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 6,
    marginBottom: 8,
  },
  inlinePreviewTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
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
  diffChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
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
  primaryActionBtn: {
    height: 52,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryActionBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
