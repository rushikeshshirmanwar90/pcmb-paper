import React, { useState, useMemo } from 'react';
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
import { getPalette, MaxContentWidth } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { subjectsFor } from '@/constants/syllabus';
import { DropdownSelect } from '@/components/dropdown-select';
import type { DifficultyLevel, ExamCategory, ExamRoom, Standard, Subject } from '@/types/pcmb';

interface EditRoomModalProps {
  room: ExamRoom | null;
  visible: boolean;
  onClose: () => void;
  onSave: (updatedRoom: ExamRoom) => void;
  onDelete: (roomId: string) => void;
}

const STANDARDS: Standard[] = ['9th', '10th', '11th', '12th'];
const DIFFICULTIES: DifficultyLevel[] = ['Easy', 'Mid', 'Hard'];

const FOUNDATION_STANDARDS: Standard[] = ['9th', '10th'];
const JEE_NEET_STANDARDS: Standard[] = ['11th', '12th'];

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
  const [examCategory, setExamCategory] = useState<string>(room.examCategory);
  const [standard, setStandard] = useState<string>(room.standard);
  const [subject, setSubject] = useState<string>(room.subject);
  const [difficulty, setDifficulty] = useState<string>(room.difficulty);
  const [status, setStatus] = useState<string>(room.status);

  const availableStandards = useMemo(() => {
    if (examCategory === 'Foundation') return FOUNDATION_STANDARDS;
    if (examCategory === 'JEE/NEET') return JEE_NEET_STANDARDS;
    return STANDARDS;
  }, [examCategory]);

  const availableSubjects = useMemo(() => subjectsFor(examCategory, standard), [examCategory, standard]);

  const handleSave = () => {
    if (!title.trim()) {
      Alert.alert('Validation Error', 'Exam room title cannot be empty.');
      return;
    }
    const updated: ExamRoom = {
      ...room,
      title: title.trim(),
      examCategory: (examCategory as ExamCategory) || 'JEE/NEET',
      standard: (standard as Standard) || '12th',
      subject: (subject as Subject) || 'Physics',
      difficulty: (difficulty as DifficultyLevel) || 'Mid',
      status: (status as 'active' | 'completed') || 'active',
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
      <View style={[styles.mainContainer, { maxWidth: MaxContentWidth }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: palette.border }]}>
          <View style={styles.headerLeft}>
            <Text style={[styles.headerTitle, { color: palette.foreground }]}>Edit Exam Room</Text>
            <View style={[styles.codeBadge, { backgroundColor: palette.primarySoft }]}>
              <Text style={[styles.codeBadgeText, { color: palette.primary }]}>{room.roomCode}</Text>
            </View>
          </View>
          <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={8}>
            <SymbolView
              name={{ ios: 'xmark.circle.fill', android: 'close', web: 'close' }}
              tintColor={palette.mutedForeground}
              size={24}
            />
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
              style={[
                styles.textInput,
                { backgroundColor: palette.card, borderColor: palette.border, color: palette.foreground },
              ]}
            />
          </View>

          {/* Status Dropdown */}
          <DropdownSelect
            label="Room Status"
            options={['active', 'completed']}
            selected={status}
            onSelect={setStatus}
            icon={{ ios: 'flag.fill', android: 'flag', web: 'flag' }}
          />

          {/* Track Dropdown */}
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

          {/* Standard Dropdown */}
          <DropdownSelect
            label="Standard / Grade"
            options={availableStandards}
            selected={standard}
            onSelect={(val) => {
              setStandard(val);
              // 9th and 10th don't have every subject.
              if (!(subjectsFor(examCategory, val) as string[]).includes(subject)) setSubject('All');
            }}
            icon={{ ios: 'number', android: 'pin', web: 'pin' }}
          />

          {/* Subject Dropdown */}
          <DropdownSelect
            label="Subject"
            options={availableSubjects}
            selected={subject}
            onSelect={setSubject}
            icon={{ ios: 'atom', android: 'science', web: 'science' }}
          />

          {/* Difficulty Dropdown */}
          <DropdownSelect
            label="Difficulty Level"
            options={DIFFICULTIES}
            selected={difficulty}
            onSelect={setDifficulty}
            icon={{ ios: 'speedometer', android: 'speed', web: 'speed' }}
          />

          {/* Action Buttons */}
          <View style={styles.actionButtonsCol}>
            <Pressable
              onPress={handleSave}
              style={[styles.saveBtn, { backgroundColor: palette.primary }]}
            >
              <SymbolView
                name={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }}
                tintColor={palette.onPrimary}
                size={18}
              />
              <Text style={[styles.saveBtnText, { color: palette.onPrimary }]}>Save Room Settings</Text>
            </Pressable>

            <Pressable
              onPress={handleDelete}
              style={[
                styles.deleteBtn,
                { backgroundColor: palette.dangerSoft, borderColor: palette.dangerBorder },
              ]}
            >
              <SymbolView
                name={{ ios: 'trash.fill', android: 'delete', web: 'delete' }}
                tintColor={palette.dangerInk}
                size={16}
              />
              <Text style={[styles.deleteBtnText, { color: palette.dangerInk }]}>Delete Exam Room</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

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
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  codeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  codeBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    fontFamily: 'monospace',
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
  actionButtonsCol: {
    marginTop: 12,
    gap: 12,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderRadius: 10,
    gap: 8,
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  deleteBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
});

export default EditRoomModal;
