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
import type { DifficultyLevel, ExamCategory, ExamRoom, Standard, Subject } from '@/types/pcmb';

interface EditRoomModalProps {
  room: ExamRoom | null;
  visible: boolean;
  onClose: () => void;
  onSave: (updatedRoom: ExamRoom) => void;
  onDelete: (roomId: string) => void;
}

const STANDARDS: Standard[] = ['9th', '10th', '11th', '12th'];
const SUBJECTS: Subject[] = ['Physics', 'Chemistry', 'Mathematics', 'Biology', 'Science'];
const DIFFICULTIES: DifficultyLevel[] = ['Easy', 'Mid', 'Hard'];

export function EditRoomModal({
  room,
  visible,
  onClose,
  onSave,
  onDelete,
}: EditRoomModalProps) {
  if (!visible || !room) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <EditRoomModalContent
        key={room._id}
        room={room}
        onClose={onClose}
        onSave={onSave}
        onDelete={onDelete}
      />
    </Modal>
  );
}

function EditRoomModalContent({
  room,
  onClose,
  onSave,
  onDelete,
}: {
  room: ExamRoom;
  onClose: () => void;
  onSave: (updatedRoom: ExamRoom) => void;
  onDelete: (roomId: string) => void;
}) {
  const scheme = useColorScheme();
  const palette = getPalette(scheme === 'dark');

  const [title, setTitle] = useState(room.title);
  const [examCategory, setExamCategory] = useState<ExamCategory | 'All'>(room.examCategory);
  const [standard, setStandard] = useState<Standard | 'All'>(room.standard);
  const [subject, setSubject] = useState<Subject | 'All'>(room.subject);
  const [difficulty, setDifficulty] = useState<DifficultyLevel | 'All'>(room.difficulty);
  const [durationMinutes, setDurationMinutes] = useState(String(room.durationMinutes));
  const [status, setStatus] = useState<'active' | 'completed'>(room.status);

  const handleSave = () => {
    if (!title.trim()) {
      Alert.alert('Validation Error', 'Exam room title cannot be empty.');
      return;
    }
    const parsedDuration = parseInt(durationMinutes, 10) || room.durationMinutes;

    const updated: ExamRoom = {
      ...room,
      title: title.trim(),
      examCategory,
      standard,
      subject,
      difficulty,
      durationMinutes: parsedDuration,
      status,
    };

    onSave(updated);
    onClose();
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Exam Room',
      `Are you sure you want to delete Exam Room "${room.title}" (${room.roomCode})?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            onDelete(room._id);
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
        <View style={styles.headerLeft}>
          <Text style={[styles.headerTitle, { color: palette.foreground }]}>Edit Exam Room</Text>
          <View style={[styles.codeBadge, { backgroundColor: palette.primarySoft }]}>
            <Text style={[styles.codeBadgeText, { color: palette.primary }]}>{room.roomCode}</Text>
          </View>
        </View>
        <Pressable onPress={onClose} style={styles.closeBtn}>
          <SymbolView name={{ ios: 'xmark.circle.fill', android: 'close', web: 'close' }} tintColor={palette.mutedForeground} size={24} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Title */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: palette.mutedForeground }]}>EXAM ROOM TITLE *</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Exam Room Title"
            placeholderTextColor={palette.mutedForeground}
            style={[styles.textInput, { backgroundColor: palette.card, borderColor: palette.border, color: palette.foreground }]}
          />
        </View>

        {/* Status */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: palette.mutedForeground }]}>ROOM STATUS</Text>
          <View style={styles.chipGrid}>
            {(['active', 'completed'] as const).map((st) => {
              const isSel = status === st;
              return (
                <Pressable
                  key={st}
                  onPress={() => setStatus(st)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: isSel ? palette.primary : palette.card,
                      borderColor: isSel ? palette.primary : palette.border,
                    },
                  ]}>
                  <Text style={[styles.chipText, { color: isSel ? palette.onPrimary : palette.foreground, fontWeight: isSel ? '700' : '500' }]}>
                    {st === 'active' ? 'Active / Open' : 'Completed'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Exam Category */}
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

        {/* Difficulty */}
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

        {/* Duration */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: palette.mutedForeground }]}>DURATION (MINUTES)</Text>
          <TextInput
            value={durationMinutes}
            onChangeText={setDurationMinutes}
            keyboardType="number-pad"
            placeholder="e.g. 45"
            placeholderTextColor={palette.mutedForeground}
            style={[styles.textInput, { backgroundColor: palette.card, borderColor: palette.border, color: palette.foreground }]}
          />
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtonsCol}>
          <Pressable
            onPress={handleSave}
            style={[styles.saveBtn, { backgroundColor: palette.primary }]}>
            <SymbolView name={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }} tintColor={palette.onPrimary} size={18} />
            <Text style={[styles.saveBtnText, { color: palette.onPrimary }]}>Save Room Settings</Text>
          </Pressable>

          <Pressable
            onPress={handleDelete}
            style={[styles.deleteBtn, { backgroundColor: palette.dangerSoft, borderColor: palette.dangerBorder }]}>
            <SymbolView name={{ ios: 'trash.fill', android: 'delete', web: 'delete' }} tintColor={palette.dangerInk} size={16} />
            <Text style={[styles.deleteBtnText, { color: palette.dangerInk }]}>Delete Exam Room</Text>
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
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  codeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  codeBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
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
