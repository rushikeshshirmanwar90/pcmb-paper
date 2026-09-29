import { useEffect, useState, memo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { AppHeader } from '@/components/app-header';
import { SideDrawer } from '@/components/side-drawer';
import { Colors, getPalette, Spacing, BottomTabInset } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { ExamCategory, FilterState, Paper, Standard, Subject } from '@/types/pcmb';
import { fetchPapers } from '@/services/apiService';

const FOUNDATION_STANDARDS: Standard[] = ['9th', '10th'];
const JEE_NEET_STANDARDS: Standard[] = ['11th', '12th'];
const SUBJECT_MAP: Record<ExamCategory, Subject[]> = {
  Foundation: ['Science', 'Mathematics', 'Physics', 'Chemistry'],
  'JEE/NEET': ['Physics', 'Chemistry', 'Mathematics', 'Biology'],
};

function chipColor(selected: boolean, dark: boolean) {
  const palette = getPalette(dark);
  if (selected) return { bg: palette.primary, text: palette.onPrimary };
  return { bg: palette.card, text: palette.inkSoft };
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
  const palette = getPalette(dark);
  return (
    <View style={styles.chipSection}>
      <Text style={[styles.chipLabel, { color: palette.mutedForeground }]}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {['All', ...options].map((opt) => {
          const isSelected = selected === opt;
          const c = chipColor(isSelected, dark);
          return (
            <Pressable
              key={opt}
              onPress={() => onSelect(opt)}
              style={[styles.chip, { backgroundColor: c.bg, borderColor: isSelected ? palette.primary : palette.border }]}
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
          <View style={[styles.badge, { backgroundColor: palette.secondary }]}>
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

        {/* Footer: questions count + date */}
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
  const [showFilters, setShowFilters] = useState(false);

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
    filters.level !== 'All',
  ].filter(Boolean).length;

  return (
    <SafeAreaView edges={['top']} style={[styles.root, { backgroundColor: bg }]}>
      <AppHeader title="Papers" subtitle="Browse question papers by track and subject" />
      <View style={styles.resultsToolbar}>
        <Text style={[styles.resultsLabel, { color: colors.textSecondary }]}>
          {loading ? 'Loading papers…' : `${papers.length} papers`}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: showFilters }}
          onPress={() => setShowFilters((visible) => !visible)}
          style={({ pressed }) => [styles.filterToggleBtn, { backgroundColor: palette.primary }, pressed && styles.pressed]}>
          <SymbolView
            name={{ ios: 'slider.horizontal.3', android: 'tune', web: 'tune' }}
            tintColor={palette.onPrimary}
            size={17} />
          <Text style={[styles.filterToggleText, { color: palette.onPrimary }]}>{showFilters ? 'Hide filters' : 'Filters'}</Text>
          {activeFilterCount > 0 && (
            <View style={[styles.filterCountBadge, { backgroundColor: palette.primaryInk }]}>
              <Text style={[styles.filterCountText, { color: palette.onPrimary }]}>{activeFilterCount}</Text>
            </View>
          )}
        </Pressable>
      </View>

      <SideDrawer
        visible={showFilters}
        title="Paper filters"
        subtitle="Find a paper for your study track"
        onClose={() => setShowFilters(false)}>
          <ScrollView style={styles.filterScroll} contentContainerStyle={styles.filterPanel} showsVerticalScrollIndicator={false} nestedScrollEnabled>
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
              style={[styles.resetBtn, { backgroundColor: palette.primary }]}
            >
              <Text style={[styles.resetBtnText, { color: palette.onPrimary }]}>Reset all filters</Text>
            </Pressable>
          </ScrollView>
      </SideDrawer>

      {/* Papers list */}
      {loading ? (
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
          renderItem={({ item }) => <PaperCard paper={item} dark={dark} />}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + BottomTabInset + Spacing.three },
          ]}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        />
      )}
    </SafeAreaView>
  );
}

export const ExploreScreen = memo(PapersScreenComponent);
export default ExploreScreen;

const styles = StyleSheet.create({
  root: { flex: 1 },
  resultsToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingTop: 16,
    paddingBottom: 12,
  },
  resultsLabel: { fontSize: 13, fontWeight: '600' },
  filterToggleBtn: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 6,
    paddingHorizontal: 14,
  },
  filterToggleText: { fontSize: 13, fontWeight: '700' },
  filterCountBadge: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 10,
  },
  filterCountText: { fontSize: 11, fontWeight: '700' },
  pressed: { opacity: 0.72 },

  filterScroll: { flex: 1 },
  filterPanel: { paddingHorizontal: Spacing.three, paddingTop: 16, paddingBottom: Spacing.five },
  chipSection: { marginBottom: 10 },
  chipLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6 },
  chipRow: { flexDirection: 'row', gap: 6, paddingRight: Spacing.three },
  chip: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { fontSize: 13 },
  resetBtn: { alignSelf: 'flex-start', marginVertical: 10, borderRadius: 6, paddingHorizontal: 14, paddingVertical: 11 },
  resetBtnText: { fontSize: 13, fontWeight: '700' },

  listContent: { paddingTop: 12 },
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
  qCountBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 6, paddingHorizontal: 9, paddingVertical: 5 },
  qCountText: { fontSize: 12, fontWeight: '700' },
  dateText: { fontSize: 11 },
});
