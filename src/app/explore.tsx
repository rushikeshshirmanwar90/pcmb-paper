import { useEffect, useState, memo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Alert,
  Share,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { AppHeader } from '@/components/app-header';
import { SideDrawer } from '@/components/side-drawer';
import { CreateExamModal } from '@/components/create-exam-modal';
import { ExamRoomDetailsModal } from '@/components/exam-room-details-modal';
import { EditPaperModal } from '@/components/edit-paper-modal';
import { EditRoomModal } from '@/components/edit-room-modal';
import { DropdownSelect } from '@/components/dropdown-select';
import { useChapterTopicOptions } from '@/hooks/use-chapter-topic-options';
import { subjectsFor } from '@/constants/syllabus';
import { Colors, getPalette, Spacing, BottomTabInset } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { ExamRoom, FilterState, Paper, Standard } from '@/types/pcmb';
import { fetchPapers } from '@/services/apiService';
import { useRooms } from '@/context/rooms-context';
import { useTabNavigation } from '@/context/tab-context';

const FOUNDATION_STANDARDS: Standard[] = ['9th', '10th'];
const JEE_NEET_STANDARDS: Standard[] = ['11th', '12th'];

function ExamRoomCard({
  room,
  dark,
  onOpenDetails,
  onEditRoom,
  onDeleteRoom,
}: {
  room: ExamRoom;
  dark: boolean;
  onOpenDetails: (room: ExamRoom) => void;
  onEditRoom: (room: ExamRoom) => void;
  onDeleteRoom: (roomId: string) => void;
}) {
  const palette = getPalette(dark);

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Join the Exam Room "${room.title}" on PCMB Paper app using Room Code: ${room.roomCode}`,
      });
    } catch {
      Alert.alert('Share', `Room Code: ${room.roomCode}`);
    }
  };

  const confirmDelete = () => {
    Alert.alert(
      'Delete Exam Room',
      `Are you sure you want to delete "${room.title}" (${room.roomCode})?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => onDeleteRoom(room._id) },
      ]
    );
  };

  return (
    <View style={[styles.paperCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
      <View style={[styles.accentStrip, { backgroundColor: palette.primary }]} />
      <View style={styles.paperCardBody}>
        <View style={styles.roomHeaderRow}>
          <View style={[styles.roomCodeBadge, { backgroundColor: palette.primarySoft, borderColor: palette.primaryBorder }]}>
            <SymbolView name={{ ios: 'key.fill', android: 'vpn_key', web: 'vpn_key' }} tintColor={palette.primary} size={13} />
            <Text style={[styles.roomCodeText, { color: palette.primary }]}>{room.roomCode}</Text>
          </View>

          <View style={styles.roomHeaderActions}>
            <View style={[styles.badge, { backgroundColor: room.status === 'completed' ? palette.secondary : palette.successSoft }]}>
              <Text style={[styles.badgeText, { color: room.status === 'completed' ? palette.mutedForeground : palette.successInk }]}>
                {room.status === 'completed' ? 'Completed' : 'Active'}
              </Text>
            </View>

            {/* Quick Edit Room Settings button */}
            <Pressable
              onPress={() => onEditRoom(room)}
              style={({ pressed }) => [styles.iconActionBtn, { backgroundColor: palette.primarySoft }, pressed && styles.pressed]}>
              <SymbolView name={{ ios: 'gearshape.fill', android: 'settings', web: 'settings' }} tintColor={palette.primary} size={14} />
            </Pressable>

            {/* Quick Delete Room button */}
            <Pressable
              onPress={confirmDelete}
              style={({ pressed }) => [styles.iconActionBtn, { backgroundColor: palette.dangerSoft }, pressed && styles.pressed]}>
              <SymbolView name={{ ios: 'trash.fill', android: 'delete', web: 'delete' }} tintColor={palette.dangerInk} size={14} />
            </Pressable>
          </View>
        </View>

        <Text style={[styles.paperTitle, { color: palette.foreground }]} numberOfLines={2}>
          {room.title}
        </Text>

        <View style={styles.metaRow}>
          <Text style={[styles.metaPillText, { color: palette.mutedForeground }]}>
            Track: {room.examCategory} · Grade: {room.standard} · Subject: {room.subject}
          </Text>
        </View>

        {/* Stats Row */}
        <View style={styles.roomStatsPillRow}>
          <View style={[styles.roomStatPill, { backgroundColor: palette.secondary }]}>
            <Text style={[styles.roomStatPillText, { color: palette.foreground }]}>
              {room.questions.length} Questions
            </Text>
          </View>
          <View style={[styles.roomStatPill, { backgroundColor: palette.secondary }]}>
            <Text style={[styles.roomStatPillText, { color: palette.foreground }]}>
              {room.totalMarks || room.questions.length * 4} Marks
            </Text>
          </View>
        </View>

        {/* Footer Actions */}
        <View style={[styles.paperFooter, { borderTopColor: palette.border, marginTop: 12 }]}>
          <Pressable
            onPress={() => onOpenDetails(room)}
            style={({ pressed }) => [
              styles.viewEditBtn,
              { backgroundColor: palette.primary },
              pressed && styles.pressed,
            ]}>
            <SymbolView name={{ ios: 'square.and.pencil', android: 'edit_note', web: 'edit_note' }} tintColor={palette.onPrimary} size={15} />
            <Text style={[styles.viewEditBtnText, { color: palette.onPrimary }]}>View & Edit Questions</Text>
          </Pressable>

          <Pressable
            onPress={handleShare}
            style={({ pressed }) => [
              styles.shareBtn,
              { backgroundColor: palette.secondary, borderColor: palette.border },
              pressed && styles.pressed,
            ]}>
            <SymbolView name={{ ios: 'square.and.arrow.up', android: 'share', web: 'share' }} tintColor={palette.primary} size={14} />
            <Text style={[styles.shareBtnText, { color: palette.primary }]}>Share</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function PaperCard({
  paper,
  dark,
  onEditPaper,
  onDeletePaper,
}: {
  paper: Paper;
  dark: boolean;
  onEditPaper: (paper: Paper) => void;
  onDeletePaper: (paperId: string) => void;
}) {
  const palette = getPalette(dark);
  const cardBg = palette.card;
  const borderColor = palette.border;
  const textColor = palette.cardForeground;
  const mutedColor = palette.mutedForeground;

  const examColor = { grad: palette.primary, text: palette.onPrimary };
  const diffColor = paper.difficulty === 'Easy'
    ? { bg: palette.successSoft, text: palette.successInk }
    : paper.difficulty === 'Hard'
      ? { bg: palette.dangerSoft, text: palette.dangerInk }
      : paper.difficulty
        ? { bg: palette.warningSoft, text: palette.warningInk }
        : null;

  const date = new Date(paper.uploadedDate).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const confirmDelete = () => {
    Alert.alert(
      'Delete Question Paper',
      `Are you sure you want to delete "${paper.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => onDeletePaper(paper._id) },
      ]
    );
  };

  return (
    <View style={[styles.paperCard, { backgroundColor: cardBg, borderColor }]}>
      {/* Accent strip */}
      <View style={[styles.accentStrip, { backgroundColor: examColor.grad }]} />

      <View style={styles.paperCardBody}>
        {/* Badges row with Edit & Delete actions */}
        <View style={styles.paperBadgeRow}>
          <View style={[styles.badge, { backgroundColor: examColor.grad }]}>
            <Text style={[styles.badgeText, { color: examColor.text }]}>{paper.examCategory}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: palette.secondary }]}>
            <Text style={[styles.badgeText, { color: mutedColor }]}>{paper.standard}</Text>
          </View>
          {diffColor && (
            <View style={[styles.badge, { backgroundColor: diffColor.bg }]}>
              <Text style={[styles.badgeText, { color: diffColor.text }]}>{paper.difficulty}</Text>
            </View>
          )}

          <View style={styles.paperCardHeaderActions}>
            <Pressable
              onPress={() => onEditPaper(paper)}
              style={({ pressed }) => [styles.iconActionBtn, { backgroundColor: palette.primarySoft }, pressed && styles.pressed]}>
              <SymbolView name={{ ios: 'pencil', android: 'edit', web: 'edit' }} tintColor={palette.primary} size={14} />
            </Pressable>
            <Pressable
              onPress={confirmDelete}
              style={({ pressed }) => [styles.iconActionBtn, { backgroundColor: palette.dangerSoft }, pressed && styles.pressed]}>
              <SymbolView name={{ ios: 'trash.fill', android: 'delete', web: 'delete' }} tintColor={palette.dangerInk} size={14} />
            </Pressable>
          </View>
        </View>

        {/* Title */}
        <Text style={[styles.paperTitle, { color: textColor }]} numberOfLines={2}>
          {paper.title}
        </Text>

        {/* Chapter · Topic */}
        {(paper.chapter || paper.topic) ? (
          <Text style={[styles.paperMeta, { color: mutedColor }]}>
            {[paper.chapter, paper.topic].filter(Boolean).join('  ›  ')}
          </Text>
        ) : null}

        {/* Subject pills */}
        {paper.subjectBreakdown && paper.subjectBreakdown.length > 0 ? (
          <View style={styles.subjectPills}>
            {paper.subjectBreakdown.map((sb) => (
              <View key={sb.subject} style={[styles.subjectPill, { backgroundColor: palette.violetSoft }]}>
                <Text style={[styles.subjectPillText, { color: palette.violet }]}>
                  {sb.subject}: {sb.count}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.subjectPills}>
            {paper.subjects.map((s) => (
              <View key={s} style={[styles.subjectPill, { backgroundColor: palette.violetSoft }]}>
                <Text style={[styles.subjectPillText, { color: palette.violet }]}>{s}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Footer: questions count + date + Edit shortcut */}
        <View style={[styles.paperFooter, { borderTopColor: borderColor }]}>
          <View style={[styles.qCountBadge, { backgroundColor: palette.primary }]}>
            <SymbolView name={{ ios: 'doc.text', android: 'description', web: 'description' }} tintColor={palette.onPrimary} size={14} />
            <Text style={[styles.qCountText, { color: palette.onPrimary }]}>{paper.totalQuestions} questions</Text>
          </View>
          <Text style={[styles.dateText, { color: mutedColor }]}>{date}</Text>
        </View>
      </View>
    </View>
  );
}

function PapersScreenComponent() {
  const scheme = useColorScheme();
  const dark = scheme === 'dark';
  const palette = getPalette(dark);
  const colors = Colors[dark ? 'dark' : 'light'];
  const insets = useSafeAreaInsets();

  const { papersSegment: activeSegment, setPapersSegment: setActiveSegment } = useTabNavigation();
  const { rooms: examRooms, addRoom, updateRoom, deleteRoom } = useRooms();
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedRoomForDetails, setSelectedRoomForDetails] = useState<ExamRoom | null>(null);
  const [selectedPaperForEdit, setSelectedPaperForEdit] = useState<Paper | null>(null);
  const [selectedRoomForEdit, setSelectedRoomForEdit] = useState<ExamRoom | null>(null);

  const [filters, setFilters] = useState<FilterState>({
    examCategory: 'All',
    standard: 'All',
    subject: 'All',
    chapter: 'All',
    topic: 'All',
    level: 'All',
    searchQuery: '',
  });

  const availableStandards =
    filters.examCategory === 'Foundation'
      ? FOUNDATION_STANDARDS
      : filters.examCategory === 'JEE/NEET'
      ? JEE_NEET_STANDARDS
      : [...FOUNDATION_STANDARDS, ...JEE_NEET_STANDARDS];

  const availableSubjects = subjectsFor(filters.examCategory, filters.standard);

  function updateFilter<K extends keyof FilterState>(key: K, value: FilterState[K]) {
    setFilters((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'examCategory') { next.standard = 'All'; next.subject = 'All'; }
      if (key === 'standard') { next.subject = 'All'; }
      if (key === 'examCategory' || key === 'standard' || key === 'subject') { next.chapter = 'All'; }
      if (key !== 'topic' && key !== 'level' && key !== 'searchQuery') { next.topic = 'All'; }
      return next;
    });
  }

  const { chapters, topics } = useChapterTopicOptions(filters);

  useEffect(() => {
    let isCancelled = false;
    fetchPapers(filters).then((ps) => {
      if (!isCancelled) {
        setPapers(ps);
        setLoading(false);
      }
    });
    return () => {
      isCancelled = true;
    };
  }, [filters]);

  const bg = colors.background;
  const activeFilterCount = [
    filters.examCategory !== 'All',
    filters.standard !== 'All',
    filters.subject !== 'All',
    filters.chapter !== 'All',
    filters.topic !== 'All',
    filters.level !== 'All',
  ].filter(Boolean).length;

  const handleRoomCreated = (newRoom: ExamRoom) => {
    addRoom(newRoom);
    setActiveSegment('rooms');
  };

  const handleUpdateRoom = (updatedRoom: ExamRoom) => {
    updateRoom(updatedRoom);
    setSelectedRoomForDetails(updatedRoom);
  };

  const handleDeleteRoom = (roomId: string) => {
    deleteRoom(roomId);
    if (selectedRoomForDetails?._id === roomId) {
      setSelectedRoomForDetails(null);
    }
  };

  const handleSavePaper = (updatedPaper: Paper) => {
    setPapers((prev) =>
      prev.map((p) => (p._id === updatedPaper._id ? updatedPaper : p))
    );
  };

  const handleDeletePaper = (paperId: string) => {
    setPapers((prev) => prev.filter((p) => p._id !== paperId));
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.root, { backgroundColor: bg }]}>
      <AppHeader title="Papers & Exams" subtitle="Browse question papers or host live exam rooms" />

      {/* ── Segment Selector + Action Row ── */}
      <View style={styles.topControlSection}>
        <View style={[styles.segmentedControl, { backgroundColor: palette.secondary, borderColor: palette.border }]}>
          <Pressable
            onPress={() => setActiveSegment('papers')}
            style={[
              styles.segmentBtn,
              activeSegment === 'papers' && { backgroundColor: palette.card },
            ]}>
            <Text
              style={[
                styles.segmentText,
                { color: activeSegment === 'papers' ? palette.primary : palette.mutedForeground, fontWeight: activeSegment === 'papers' ? '700' : '500' },
              ]}>
              Question Papers ({papers.length})
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setActiveSegment('rooms')}
            style={[
              styles.segmentBtn,
              activeSegment === 'rooms' && { backgroundColor: palette.card },
            ]}>
            <Text
              style={[
                styles.segmentText,
                { color: activeSegment === 'rooms' ? palette.primary : palette.mutedForeground, fontWeight: activeSegment === 'rooms' ? '700' : '500' },
              ]}>
              Exam Rooms ({examRooms.length})
            </Text>
          </Pressable>
        </View>
      </View>

      {/* ── Toolbar: Filter Button + Create (+) Button ── */}
      <View style={styles.resultsToolbar}>
        {activeSegment === 'papers' ? (
          <>
            <Text style={[styles.resultsLabel, { color: colors.textSecondary }]}>
              {loading ? 'Loading papers…' : `${papers.length} papers available`}
            </Text>
            <View style={styles.toolbarRightActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: showFilters }}
                onPress={() => setShowFilters((visible) => !visible)}
                style={({ pressed }) => [styles.filterToggleBtn, { backgroundColor: palette.card, borderColor: palette.border }, pressed && styles.pressed]}>
                <SymbolView
                  name={{ ios: 'slider.horizontal.3', android: 'tune', web: 'tune' }}
                  tintColor={palette.primary}
                  size={16} />
                <Text style={[styles.filterToggleText, { color: palette.primary }]}>{showFilters ? 'Hide' : 'Filters'}</Text>
                {activeFilterCount > 0 && (
                  <View style={[styles.filterCountBadge, { backgroundColor: palette.primary }]}>
                    <Text style={[styles.filterCountText, { color: palette.onPrimary }]}>{activeFilterCount}</Text>
                  </View>
                )}
              </Pressable>

              {/* Plus Button to Launch Exam Room creation */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Create Exam Room"
                onPress={() => setShowCreateModal(true)}
                style={({ pressed }) => [styles.createExamPlusBtn, { backgroundColor: palette.primary }, pressed && styles.pressed]}>
                <SymbolView
                  name={{ ios: 'plus', android: 'add', web: 'add' }}
                  tintColor={palette.onPrimary}
                  size={18} />
                <Text style={[styles.createExamBtnText, { color: palette.onPrimary }]}>Create Exam</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <Text style={[styles.resultsLabel, { color: colors.textSecondary }]}>
              {examRooms.length} Active Exam Rooms
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Create Exam Room"
              onPress={() => setShowCreateModal(true)}
              style={({ pressed }) => [styles.createExamPlusBtn, { backgroundColor: palette.primary }, pressed && styles.pressed]}>
              <SymbolView
                name={{ ios: 'plus', android: 'add', web: 'add' }}
                tintColor={palette.onPrimary}
                size={18} />
              <Text style={[styles.createExamBtnText, { color: palette.onPrimary }]}>Create Room</Text>
            </Pressable>
          </>
        )}
      </View>

      <SideDrawer
        visible={showFilters}
        title="Filter Papers & Rooms"
        subtitle="Find content for your study track"
        onClose={() => setShowFilters(false)}>
          <ScrollView style={styles.filterScroll} contentContainerStyle={styles.filterPanel} showsVerticalScrollIndicator={false} nestedScrollEnabled>
            <DropdownSelect
              label="Competitive Exam"
              options={['Foundation', 'JEE/NEET']}
              selected={filters.examCategory}
              onSelect={(v) => updateFilter('examCategory', v as any)}
              icon={{ ios: 'graduationcap', android: 'school', web: 'school' }}
            />
            <DropdownSelect
              label="Standard / Grade"
              options={availableStandards}
              selected={filters.standard}
              onSelect={(v) => updateFilter('standard', v as any)}
              icon={{ ios: 'number', android: 'pin', web: 'pin' }}
            />
            <DropdownSelect
              label="Subject"
              options={availableSubjects}
              selected={filters.subject}
              onSelect={(v) => updateFilter('subject', v as any)}
              icon={{ ios: 'atom', android: 'science', web: 'science' }}
            />
            <DropdownSelect
              label="Chapter"
              options={chapters}
              emptyText="No chapters uploaded for this selection"
              selected={filters.chapter}
              onSelect={(v) => updateFilter('chapter', v)}
              searchable
              icon={{ ios: 'book', android: 'menu_book', web: 'menu_book' }}
            />
            <DropdownSelect
              label="Topic"
              options={topics}
              emptyText="No topics uploaded for this selection"
              selected={filters.topic}
              onSelect={(v) => updateFilter('topic', v)}
              searchable
              icon={{ ios: 'list.bullet', android: 'list', web: 'list' }}
            />
            <DropdownSelect
              label="Difficulty Level"
              options={['Easy', 'Mid', 'Hard']}
              selected={filters.level}
              onSelect={(v) => updateFilter('level', v as any)}
              icon={{ ios: 'speedometer', android: 'speed', web: 'speed' }}
            />
            <Pressable
              onPress={() => {
                setFilters({ examCategory: 'All', standard: 'All', subject: 'All', chapter: 'All', topic: 'All', level: 'All', searchQuery: '' });
                setShowFilters(false);
              }}
              style={[styles.resetBtn, { backgroundColor: palette.primary, marginTop: 8 }]}
            >
              <Text style={[styles.resetBtnText, { color: palette.onPrimary }]}>Reset All Filters</Text>
            </Pressable>
          </ScrollView>
      </SideDrawer>

      {/* ── Main Content: Papers list OR Exam Rooms List ── */}
      {activeSegment === 'papers' ? (
        loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={palette.primary} />
            <Text style={[{ color: colors.textSecondary, marginTop: 8, fontSize: 14 }]}>Loading papers…</Text>
          </View>
        ) : papers.length === 0 ? (
          <View style={styles.center}>
            <SymbolView name={{ ios: 'doc.text', android: 'description', web: 'description' }} tintColor={palette.mutedForeground} size={36} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No papers found</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              Adjust filters or upload a paper from the web app
            </Text>
          </View>
        ) : (
          <FlatList
            data={papers}
            keyExtractor={(p) => p._id}
            renderItem={({ item }) => (
              <PaperCard
                paper={item}
                dark={dark}
                onEditPaper={(p) => setSelectedPaperForEdit(p)}
                onDeletePaper={handleDeletePaper}
              />
            )}
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: insets.bottom + BottomTabInset + Spacing.three },
            ]}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          />
        )
      ) : (
        <FlatList
          data={examRooms}
          keyExtractor={(r) => r._id}
          renderItem={({ item }) => (
            <ExamRoomCard
              room={item}
              dark={dark}
              onOpenDetails={(r) => setSelectedRoomForDetails(r)}
              onEditRoom={(r) => setSelectedRoomForEdit(r)}
              onDeleteRoom={handleDeleteRoom}
            />
          )}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + BottomTabInset + Spacing.three },
          ]}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        />
      )}

      {/* ── Create Exam Modal ── */}
      <CreateExamModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onRoomCreated={handleRoomCreated}
      />

      {/* ── Exam Room Details & Question Editor Modal ── */}
      <ExamRoomDetailsModal
        room={selectedRoomForDetails}
        visible={!!selectedRoomForDetails}
        onClose={() => setSelectedRoomForDetails(null)}
        onUpdateRoom={handleUpdateRoom}
      />

      {/* ── Edit Question Paper Modal ── */}
      <EditPaperModal
        paper={selectedPaperForEdit}
        visible={!!selectedPaperForEdit}
        onClose={() => setSelectedPaperForEdit(null)}
        onSave={handleSavePaper}
        onDelete={handleDeletePaper}
      />

      {/* ── Edit Exam Room Settings Modal ── */}
      <EditRoomModal
        room={selectedRoomForEdit}
        visible={!!selectedRoomForEdit}
        onClose={() => setSelectedRoomForEdit(null)}
        onSave={handleUpdateRoom}
        onDelete={handleDeleteRoom}
      />
    </SafeAreaView>
  );
}

export const ExploreScreen = memo(PapersScreenComponent);
export default ExploreScreen;

const styles = StyleSheet.create({
  root: { flex: 1 },
  topControlSection: {
    paddingHorizontal: Spacing.three,
    paddingTop: 12,
  },
  segmentedControl: {
    flexDirection: 'row',
    borderRadius: 8,
    borderWidth: 1,
    padding: 3,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentText: {
    fontSize: 13,
  },
  resultsToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingTop: 12,
    paddingBottom: 10,
  },
  resultsLabel: { fontSize: 13, fontWeight: '600' },
  toolbarRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterToggleBtn: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  filterToggleText: { fontSize: 13, fontWeight: '700' },
  filterCountBadge: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
  },
  filterCountText: { fontSize: 10, fontWeight: '700' },
  createExamPlusBtn: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 6,
    paddingHorizontal: 14,
  },
  createExamBtnText: { fontSize: 13, fontWeight: '700' },
  pressed: { opacity: 0.75 },

  filterScroll: { flex: 1 },
  filterPanel: { paddingHorizontal: Spacing.three, paddingTop: 16, paddingBottom: Spacing.five },
  chipSection: { marginBottom: 10 },
  chipLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6 },
  chipRow: { flexDirection: 'row', gap: 6, paddingRight: Spacing.three },
  chip: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { fontSize: 13 },
  resetBtn: { alignSelf: 'flex-start', marginVertical: 10, borderRadius: 6, paddingHorizontal: 14, paddingVertical: 11 },
  resetBtnText: { fontSize: 13, fontWeight: '700' },

  listContent: { paddingTop: 6 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: Spacing.four },
  emptyTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  emptySubtitle: { fontSize: 14, textAlign: 'center' },

  // Paper card
  paperCard: {
    marginHorizontal: Spacing.three,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  accentStrip: { width: 5 },
  paperCardBody: { flex: 1, padding: 14 },
  paperBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' },
  badge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  paperCardHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 'auto',
  },
  iconActionBtn: {
    padding: 6,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paperTitle: { fontSize: 15, fontWeight: '700', lineHeight: 21, marginBottom: 4 },
  paperMeta: { fontSize: 12, marginBottom: 8, fontStyle: 'italic' },
  subjectPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  subjectPill: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  subjectPillText: { fontSize: 11, fontWeight: '600' },
  paperFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: 8,
    marginTop: 2,
  },
  qCountBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 6, paddingHorizontal: 9, paddingVertical: 5 },
  qCountText: { fontSize: 12, fontWeight: '700' },
  dateText: { fontSize: 11 },

  // Room Card
  roomHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  roomCodeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  roomCodeText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  roomHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaRow: {
    marginBottom: 6,
  },
  metaPillText: {
    fontSize: 12,
  },
  roomStatsPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4,
  },
  roomStatPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  roomStatPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  viewEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
  },
  viewEditBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
    borderWidth: 1,
  },
  shareBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
