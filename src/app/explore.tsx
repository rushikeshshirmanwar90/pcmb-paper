import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, BottomTabInset } from '@/constants/theme';
import type { DifficultyLevel, ExamCategory, FilterState, Paper, Standard, Subject } from '@/types/pcmb';
import { fetchPapers } from '@/services/apiService';

const FOUNDATION_STANDARDS: Standard[] = ['9th', '10th'];
const JEE_NEET_STANDARDS: Standard[] = ['11th', '12th'];
const SUBJECT_MAP: Record<ExamCategory, Subject[]> = {
  Foundation: ['Science', 'Mathematics', 'Physics', 'Chemistry'],
  'JEE/NEET': ['Physics', 'Chemistry', 'Mathematics', 'Biology'],
};

const DIFF_COLORS: Record<string, { bg: string; text: string }> = {
  Easy: { bg: '#D1FAE5', text: '#065F46' },
  Mid: { bg: '#FEF3C7', text: '#92400E' },
  Hard: { bg: '#FEE2E2', text: '#991B1B' },
};

const EXAM_COLORS: Record<string, { grad: string; text: string }> = {
  Foundation: { grad: '#6366F1', text: '#FFFFFF' },
  'JEE/NEET': { grad: '#0EA5E9', text: '#FFFFFF' },
  JEE: { grad: '#8B5CF6', text: '#FFFFFF' },
  NEET: { grad: '#10B981', text: '#FFFFFF' },
};

function chipColor(selected: boolean, dark: boolean) {
  if (selected) return { bg: '#6366F1', text: '#FFFFFF' };
  return { bg: dark ? '#2A2A2E' : '#F1F5F9', text: dark ? '#CBD5E1' : '#475569' };
}

function ChipRow({
  label,
  options,
  selected,
  onSelect,
  dark,
}: {
  label: string;
  options: string[];
  selected: string;
  onSelect: (v: string) => void;
  dark: boolean;
}) {
  return (
    <View style={styles.chipSection}>
      <Text style={[styles.chipLabel, { color: dark ? '#94A3B8' : '#64748B' }]}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {['All', ...options].map((opt) => {
          const isSelected = selected === opt;
          const c = chipColor(isSelected, dark);
          return (
            <Pressable
              key={opt}
              onPress={() => onSelect(opt)}
              style={[styles.chip, { backgroundColor: c.bg }]}
            >
              <Text style={[styles.chipText, { color: c.text, fontWeight: isSelected ? '700' : '500' }]}>
                {opt}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function PaperCard({ paper, dark }: { paper: Paper; dark: boolean }) {
  const cardBg = dark ? '#1C1C1E' : '#FFFFFF';
  const borderColor = dark ? '#2D2D30' : '#E2E8F0';
  const textColor = dark ? '#F1F5F9' : '#1E293B';
  const mutedColor = dark ? '#94A3B8' : '#64748B';

  const examColor = EXAM_COLORS[paper.examCategory] ?? EXAM_COLORS['JEE/NEET'];
  const diffColor = paper.difficulty ? (DIFF_COLORS[paper.difficulty] ?? DIFF_COLORS.Mid) : null;

  const date = new Date(paper.uploadedDate).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return (
    <View style={[styles.paperCard, { backgroundColor: cardBg, borderColor }]}>
      {/* Accent strip */}
      <View style={[styles.accentStrip, { backgroundColor: examColor.grad }]} />

      <View style={styles.paperCardBody}>
        {/* Badges row */}
        <View style={styles.paperBadgeRow}>
          <View style={[styles.badge, { backgroundColor: examColor.grad }]}>
            <Text style={[styles.badgeText, { color: examColor.text }]}>{paper.examCategory}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: dark ? '#2A2A2E' : '#F1F5F9' }]}>
            <Text style={[styles.badgeText, { color: mutedColor }]}>{paper.standard}</Text>
          </View>
          {diffColor && (
            <View style={[styles.badge, { backgroundColor: diffColor.bg }]}>
              <Text style={[styles.badgeText, { color: diffColor.text }]}>{paper.difficulty}</Text>
            </View>
          )}
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
              <View key={sb.subject} style={[styles.subjectPill, { backgroundColor: dark ? '#27272A' : '#EEF2FF' }]}>
                <Text style={[styles.subjectPillText, { color: dark ? '#A5B4FC' : '#4338CA' }]}>
                  {sb.subject}: {sb.count}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.subjectPills}>
            {paper.subjects.map((s) => (
              <View key={s} style={[styles.subjectPill, { backgroundColor: dark ? '#27272A' : '#EEF2FF' }]}>
                <Text style={[styles.subjectPillText, { color: dark ? '#A5B4FC' : '#4338CA' }]}>{s}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Footer: questions count + date */}
        <View style={[styles.paperFooter, { borderTopColor: borderColor }]}>
          <View style={styles.qCountBadge}>
            <Text style={styles.qCountText}>📄 {paper.totalQuestions} Qs</Text>
          </View>
          <Text style={[styles.dateText, { color: mutedColor }]}>{date}</Text>
        </View>
      </View>
    </View>
  );
}

export default function PapersScreen() {
  const scheme = useColorScheme();
  const dark = scheme === 'dark';
  const colors = Colors[dark ? 'dark' : 'light'];
  const insets = useSafeAreaInsets();

  const [filters, setFilters] = useState<FilterState>({
    examCategory: 'All',
    standard: 'All',
    subject: 'All',
    chapter: 'All',
    topic: 'All',
    level: 'All',
    searchQuery: '',
  });

  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(true);

  const availableStandards =
    filters.examCategory === 'Foundation'
      ? FOUNDATION_STANDARDS
      : filters.examCategory === 'JEE/NEET'
      ? JEE_NEET_STANDARDS
      : [...FOUNDATION_STANDARDS, ...JEE_NEET_STANDARDS];

  const availableSubjects: Subject[] =
    filters.examCategory === 'Foundation' || filters.examCategory === 'JEE/NEET'
      ? SUBJECT_MAP[filters.examCategory as ExamCategory]
      : ['Physics', 'Chemistry', 'Mathematics', 'Biology', 'Science'];

  function updateFilter<K extends keyof FilterState>(key: K, value: FilterState[K]) {
    setFilters((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'examCategory') { next.standard = 'All'; next.subject = 'All'; }
      if (key === 'standard') { next.subject = 'All'; }
      return next;
    });
  }

  const loadPapers = useCallback(async () => {
    setLoading(true);
    try {
      const ps = await fetchPapers(filters);
      setPapers(ps);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { loadPapers(); }, [loadPapers]);

  const bg = colors.background;
  const borderColor = dark ? '#2D2D30' : '#E2E8F0';
  const filterBg = dark ? '#111113' : '#F8FAFC';

  return (
    <View style={[styles.root, { backgroundColor: bg, paddingTop: insets.top }]}>
      {/* Top bar */}
      <View style={[styles.topBar, { borderBottomColor: borderColor, backgroundColor: bg }]}>
        <View style={styles.topBarLeft}>
          <Text style={[styles.screenTitle, { color: colors.text }]}>Papers</Text>
          {papers.length > 0 && !loading && (
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{papers.length}</Text>
            </View>
          )}
        </View>
        <Pressable
          onPress={() => setShowFilters((v) => !v)}
          style={[styles.filterToggleBtn, { backgroundColor: showFilters ? '#6366F1' : (dark ? '#27272A' : '#F1F5F9') }]}
        >
          <Text style={{ fontSize: 13, color: showFilters ? '#FFF' : colors.textSecondary, fontWeight: '600' }}>
            {showFilters ? '▲ Filters' : '▼ Filters'}
          </Text>
        </Pressable>
      </View>

      {/* Filter panel */}
      {showFilters && (
        <View style={[styles.filterPanel, { backgroundColor: filterBg, borderBottomColor: borderColor }]}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <ChipRow
              label="Competitive Exam"
              options={['Foundation', 'JEE/NEET']}
              selected={filters.examCategory}
              onSelect={(v) => updateFilter('examCategory', v as any)}
              dark={dark}
            />
            <ChipRow
              label="Standard / Grade"
              options={availableStandards}
              selected={filters.standard}
              onSelect={(v) => updateFilter('standard', v as any)}
              dark={dark}
            />
            <ChipRow
              label="Subject"
              options={availableSubjects}
              selected={filters.subject}
              onSelect={(v) => updateFilter('subject', v as any)}
              dark={dark}
            />
            <ChipRow
              label="Level"
              options={['Easy', 'Mid', 'Hard']}
              selected={filters.level}
              onSelect={(v) => updateFilter('level', v as any)}
              dark={dark}
            />
            <Pressable
              onPress={() => setFilters({ examCategory: 'All', standard: 'All', subject: 'All', chapter: 'All', topic: 'All', level: 'All', searchQuery: '' })}
              style={styles.resetBtn}
            >
              <Text style={styles.resetBtnText}>↺  Reset All Filters</Text>
            </Pressable>
          </ScrollView>
        </View>
      )}

      {/* Papers list */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={[{ color: colors.textSecondary, marginTop: 8, fontSize: 14 }]}>Loading papers…</Text>
        </View>
      ) : papers.length === 0 ? (
        <View style={styles.center}>
          <Text style={{ fontSize: 48 }}>📂</Text>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No papers found</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            Adjust filters or upload a paper from the web app
          </Text>
        </View>
      ) : (
        <FlatList
          data={papers}
          keyExtractor={(p) => p._id}
          renderItem={({ item }) => <PaperCard paper={item} dark={dark} />}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + BottomTabInset + Spacing.three },
          ]}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  topBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  screenTitle: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  countBadge: { backgroundColor: '#6366F1', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 },
  countBadgeText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  filterToggleBtn: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },

  filterPanel: {
    maxHeight: 260,
    borderBottomWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingTop: 8,
    paddingBottom: 4,
  },
  chipSection: { marginBottom: 10 },
  chipLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6 },
  chipRow: { flexDirection: 'row', gap: 6, paddingRight: Spacing.three },
  chip: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { fontSize: 13 },
  resetBtn: { alignSelf: 'center', marginVertical: 10, backgroundColor: '#FEE2E2', borderRadius: 20, paddingHorizontal: 20, paddingVertical: 8 },
  resetBtnText: { color: '#991B1B', fontSize: 13, fontWeight: '700' },

  listContent: { paddingTop: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: Spacing.four },
  emptyTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  emptySubtitle: { fontSize: 14, textAlign: 'center' },

  // Paper card
  paperCard: {
    marginHorizontal: Spacing.three,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  accentStrip: { width: 5 },
  paperCardBody: { flex: 1, padding: 14 },
  paperBadgeRow: { flexDirection: 'row', gap: 6, marginBottom: 8, flexWrap: 'wrap' },
  badge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '700' },
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
  qCountBadge: { backgroundColor: '#EEF2FF', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  qCountText: { color: '#4338CA', fontSize: 12, fontWeight: '700' },
  dateText: { fontSize: 11 },
});
