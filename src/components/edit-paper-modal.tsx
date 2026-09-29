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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { getPalette, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { DifficultyLevel, ExamCategory, Paper, Standard, Subject } from '@/types/pcmb';

interface EditPaperModalProps {
  paper: Paper | null;
  visible: boolean;
  onClose: () => void;
  onSave: (updatedPaper: Paper) => void;
  onDelete: (paperId: string) => void;
}

const STANDARDS: Standard[] = ['9th', '10th', '11th', '12th'];
const SUBJECTS: Subject[] = ['Physics', 'Chemistry', 'Mathematics', 'Biology', 'Science'];
const DIFFICULTIES: DifficultyLevel[] = ['Easy', 'Mid', 'Hard'];

export function EditPaperModal({
  paper,
  visible,
  onClose,
  onSave,
  onDelete,
}: EditPaperModalProps) {
  if (!visible || !paper) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <EditPaperModalContent
        key={paper._id}
        paper={paper}
        onClose={onClose}
        onSave={onSave}
        onDelete={onDelete}
      />
    </Modal>
  );
}

function EditPaperModalContent({
  paper,
  onClose,
  onSave,
  onDelete,
}: {
  paper: Paper;
  onClose: () => void;
  onSave: (updatedPaper: Paper) => void;
  onDelete: (paperId: string) => void;
}) {
  const scheme = useColorScheme();
  const palette = getPalette(scheme === 'dark');

  const [title, setTitle] = useState(paper.title);
  const [examCategory, setExamCategory] = useState<ExamCategory>(paper.examCategory);
  const [standard, setStandard] = useState<Standard>(paper.standard);
  const [selectedSubjects, setSelectedSubjects] = useState<Subject[]>(paper.subjects);
  const [chapter, setChapter] = useState(paper.chapter || '');
  const [topic, setTopic] = useState(paper.topic || '');
  const [difficulty, setDifficulty] = useState<DifficultyLevel>(paper.difficulty || 'Mid');
  const [totalQuestions, setTotalQuestions] = useState(String(paper.totalQuestions));

  const toggleSubject = (s: Subject) => {
    if (selectedSubjects.includes(s)) {
      if (selectedSubjects.length === 1) {
        Alert.alert('Subject Required', 'Paper must contain at least one subject.');
        return;
      }
      setSelectedSubjects(selectedSubjects.filter((item) => item !== s));
    } else {
      setSelectedSubjects([...selectedSubjects, s]);
    }
  };

  const handleSave = () => {
    if (!title.trim()) {
      Alert.alert('Validation Error', 'Paper title cannot be empty.');
      return;
    }
    const parsedQuestions = parseInt(totalQuestions, 10) || paper.totalQuestions;

    const updated: Paper = {
      ...paper,
      title: title.trim(),
      examCategory,
      standard,
      subjects: selectedSubjects,
      chapter: chapter.trim() || undefined,
      topic: topic.trim() || undefined,
      difficulty,
      totalQuestions: parsedQuestions,
    };

    onSave(updated);
    onClose();
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Question Paper',
      `Are you sure you want to delete "${paper.title}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            onDelete(paper._id);
            onClose();
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: palette.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: palette.border }]}>
        <Text style={[styles.headerTitle, { color: palette.foreground }]}>Edit Question Paper</Text>
        <Pressable onPress={onClose} style={styles.closeBtn}>
          <SymbolView name={{ ios: 'xmark.circle.fill', android: 'close', web: 'close' }} tintColor={palette.mutedForeground} size={24} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Title */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: palette.mutedForeground }]}>PAPER TITLE *</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Paper Title"
            placeholderTextColor={palette.mutedForeground}
            style={[styles.textInput, { backgroundColor: palette.card, borderColor: palette.border, color: palette.foreground }]}
          />
        </View>

        {/* Exam Category */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: palette.mutedForeground }]}>COMPETITIVE TRACK</Text>
          <View style={styles.chipGrid}>
            {(['Foundation', 'JEE/NEET'] as ExamCategory[]).map((cat) => {
              const isSel = examCategory === cat;
              return (
                <Pressable
                  key={cat}
                  onPress={() => setExamCategory(cat)}
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
            {STANDARDS.map((std) => {
              const isSel = standard === std;
              return (
                <Pressable
                  key={std}
                  onPress={() => setStandard(std)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: isSel ? palette.primary : palette.card,
                      borderColor: isSel ? palette.primary : palette.border,
                    },
                  ]}>
                  <Text style={[styles.chipText, { color: isSel ? palette.onPrimary : palette.foreground, fontWeight: isSel ? '700' : '500' }]}>
                    {std} Grade
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Subjects */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: palette.mutedForeground }]}>SUBJECTS</Text>
          <View style={styles.chipGrid}>
            {SUBJECTS.map((sub) => {
              const isSel = selectedSubjects.includes(sub);
              return (
                <Pressable
                  key={sub}
                  onPress={() => toggleSubject(sub)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: isSel ? palette.primary : palette.card,
                      borderColor: isSel ? palette.primary : palette.border,
                    },
                  ]}>
                  <Text style={[styles.chipText, { color: isSel ? palette.onPrimary : palette.foreground, fontWeight: isSel ? '700' : '500' }]}>
                    {sub} {isSel ? '✓' : ''}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Chapter & Topic */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: palette.mutedForeground }]}>CHAPTER</Text>
          <TextInput
            value={chapter}
            onChangeText={setChapter}
            placeholder="e.g. Kinematics, Real Numbers"
            placeholderTextColor={palette.mutedForeground}
            style={[styles.textInput, { backgroundColor: palette.card, borderColor: palette.border, color: palette.foreground }]}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: palette.mutedForeground }]}>TOPIC</Text>
          <TextInput
            value={topic}
            onChangeText={setTopic}
            placeholder="e.g. Projectiles, Euclid Division"
            placeholderTextColor={palette.mutedForeground}
            style={[styles.textInput, { backgroundColor: palette.card, borderColor: palette.border, color: palette.foreground }]}
          />
        </View>

        {/* Difficulty */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: palette.mutedForeground }]}>DIFFICULTY LEVEL</Text>
          <View style={styles.chipGrid}>
            {DIFFICULTIES.map((lvl) => {
              const isSel = difficulty === lvl;
              return (
                <Pressable
                  key={lvl}
                  onPress={() => setDifficulty(lvl)}
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

        {/* Total Questions */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: palette.mutedForeground }]}>TOTAL QUESTIONS</Text>
          <TextInput
            value={totalQuestions}
            onChangeText={setTotalQuestions}
            keyboardType="number-pad"
            placeholder="e.g. 20"
            placeholderTextColor={palette.mutedForeground}
            style={[styles.textInput, { backgroundColor: palette.card, borderColor: palette.border, color: palette.foreground }]}
          />
        </View>

        {/* Save & Delete Action Buttons */}
        <View style={styles.actionButtonsCol}>
          <Pressable
            onPress={handleSave}
            style={[styles.saveBtn, { backgroundColor: palette.primary }]}>
            <SymbolView name={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }} tintColor={palette.onPrimary} size={18} />
            <Text style={[styles.saveBtnText, { color: palette.onPrimary }]}>Save Changes</Text>
          </Pressable>

          <Pressable
            onPress={handleDelete}
            style={[styles.deleteBtn, { backgroundColor: palette.dangerSoft, borderColor: palette.dangerBorder }]}>
            <SymbolView name={{ ios: 'trash.fill', android: 'delete', web: 'delete' }} tintColor={palette.dangerInk} size={16} />
            <Text style={[styles.deleteBtnText, { color: palette.dangerInk }]}>Delete Question Paper</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
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
  headerTitle: { fontSize: 18, fontWeight: '700' },
  closeBtn: { padding: 4 },
  scrollContent: { padding: Spacing.four, gap: 16, paddingBottom: 40 },
  fieldGroup: { gap: 8 },
  fieldLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6 },
  textInput: {
    height: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    fontSize: 14,
  },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
  },
  chipText: { fontSize: 13 },
  actionButtonsCol: { gap: 12, marginTop: 16 },
  saveBtn: {
    height: 50,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveBtnText: { fontSize: 15, fontWeight: '700' },
  deleteBtn: {
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  deleteBtnText: { fontSize: 14, fontWeight: '700' },
});
