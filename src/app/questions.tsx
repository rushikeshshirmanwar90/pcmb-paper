import { useEffect, useState, memo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { AppHeader } from '@/components/app-header';
import { SideDrawer } from '@/components/side-drawer';
import { Colors, getPalette, Spacing, BottomTabInset } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTabNavigation } from '@/context/tab-context';
import type { ExamCategory, FilterState, Question, Standard, Subject } from '@/types/pcmb';
import { fetchFilterOptions, fetchQuestions } from '@/services/apiService';

// ─── helpers ────────────────────────────────────────────────────────────────

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

// ─── components ─────────────────────────────────────────────────────────────

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
          const colors = chipColor(isSelected, dark);
          return (
            <Pressable
              key={opt}
              onPress={() => onSelect(opt)}
              style={[styles.chip, { backgroundColor: colors.bg, borderColor: isSelected ? palette.primary : palette.border }]}
            >
              <Text style={[styles.chipText, { color: colors.text, fontWeight: isSelected ? '700' : '500' }]}>
                {opt}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function QuestionCard({ question, dark }: { question: Question; dark: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const palette = getPalette(dark);
  const diffColor = question.difficulty === 'Easy'
    ? { bg: palette.successSoft, text: palette.successInk }
    : question.difficulty === 'Hard'
      ? { bg: palette.dangerSoft, text: palette.dangerInk }
      : { bg: palette.warningSoft, text: palette.warningInk };
  const subjColor = { bg: palette.violetSoft, text: palette.violet };
  const cardBg = palette.card;
  const textColor = palette.cardForeground;
  const mutedColor = palette.mutedForeground;
  const borderColor = palette.border;

  const options: [string, string][] = [
    ['A', question.optionA],
    ['B', question.optionB],
    ['C', question.optionC],
    ['D', question.optionD],
  ];

  return (
    <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
      {/* Header badges */}
      <View style={styles.cardHeader}>
        <View style={styles.badgeRow}>
          <View style={[styles.badge, { backgroundColor: subjColor.bg }]}>
            <Text style={[styles.badgeText, { color: subjColor.text }]}>{question.subject}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: diffColor.bg }]}>
            <Text style={[styles.badgeText, { color: diffColor.text }]}>{question.difficulty}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: palette.secondary }]}>
            <Text style={[styles.badgeText, { color: mutedColor }]}>{question.standard}</Text>
          </View>
        </View>
        <Text style={[styles.questionNum, { color: mutedColor }]}>#{question.questionNumber}</Text>
      </View>

      {/* Chapter · Topic */}
      {(question.chapter || question.topic) ? (
        <Text style={[styles.chapterLabel, { color: mutedColor }]}>
          {[question.chapter, question.topic].filter(Boolean).join('  ·  ')}
        </Text>
      ) : null}

      {/* Question text */}
      <Text style={[styles.questionText, { color: textColor }]}>{question.questionText}</Text>

      {/* Options */}
      <View style={styles.optionsGrid}>
        {options.map(([key, text]) => {
          const isCorrect = question.correctAnswer === key;
          const optBg = isCorrect ? palette.successSoft : palette.background;
          const optBorder = isCorrect ? palette.successBorder : palette.border;
          const optTextColor = isCorrect ? palette.successInk : palette.inkSoft;
          return (
            <View key={key} style={[styles.optionBox, { backgroundColor: optBg, borderColor: optBorder }]}>
              <Text style={[styles.optionKey, { color: isCorrect ? palette.success : mutedColor }]}>
                {key}
              </Text>
              <Text style={[styles.optionText, { color: optTextColor }]}>{text}</Text>
            </View>
          );
        })}
      </View>

      {/* Toggle explanation */}
      {question.explanation ? (
        <Pressable
          onPress={() => setExpanded((v) => !v)}
          style={[styles.explanationToggle, { borderColor }] }>
          <Text style={{ color: palette.primary, fontSize: 13, fontWeight: '700' }}>
            {expanded ? '▲ Hide Explanation' : '▼ Show Explanation'}
          </Text>
        </Pressable>
      ) : null}

      {expanded && question.explanation ? (
        <View style={[styles.explanationBox, { backgroundColor: palette.violetSoft, borderColor: palette.violetBorder }]}>
          <Text style={[styles.explanationText, { color: palette.inkSoft }]}>
            {question.explanation}
          </Text>
          {question.source ? (
            <Text style={[styles.sourceText, { color: mutedColor }]}>Source: {question.source}</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

// ─── main screen ────────────────────────────────────────────────────────────

function QuestionsScreenComponent() {
  const scheme = useColorScheme();
  const dark = scheme === 'dark';
  const palette = getPalette(dark);
  const colors = Colors[dark ? 'dark' : 'light'];
  const insets = useSafeAreaInsets();
  const { questionFilters: filters, setQuestionFilters: setFilters } = useTabNavigation();

  const [chapters, setChapters] = useState<string[]>([]);
  const [topics, setTopics] = useState<string[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Derive standards and subjects from examCategory
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

  // Load filter options (chapters / topics) from backend
  useEffect(() => {
    fetchFilterOptions().then((opts) => {
      setChapters(opts.chapters);
      setTopics(opts.topics);
    });
  }, []);

  // Load questions whenever filters change
  useEffect(() => {
    let isCancelled = false;
    fetchQuestions(filters).then((qs) => {
      if (!isCancelled) {
        setQuestions(qs);
        setLoading(false);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [filters]);

  function updateFilter<K extends keyof FilterState>(key: K, value: FilterState[K]) {
    setFilters((prev) => {
      const next = { ...prev, [key]: value };
      // Reset downstream filters when parent changes
      if (key === 'examCategory') {
        next.standard = 'All';
        next.subject = 'All';
        next.chapter = 'All';
        next.topic = 'All';
      } else if (key === 'standard') {
        next.subject = 'All';
        next.chapter = 'All';
        next.topic = 'All';
      } else if (key === 'subject') {
        next.chapter = 'All';
        next.topic = 'All';
      } else if (key === 'chapter') {
        next.topic = 'All';
      }
      return next;
    });
  }

  const bg = colors.background;
  const borderColor = palette.border;
  const filterBg = palette.card;
  const activeFilterCount = [
    filters.examCategory !== 'All',
    filters.standard !== 'All',
    filters.subject !== 'All',
    filters.chapter !== 'All',
    filters.topic !== 'All',
    filters.level !== 'All',
  ].filter(Boolean).length;

  return (
    <SafeAreaView edges={['top']} style={[styles.root, { backgroundColor: bg }]}>
      <AppHeader title="Questions" subtitle="Practice by subject, chapter and level" />
      <View style={styles.resultsToolbar}>
        <Text style={[styles.resultsLabel, { color: colors.textSecondary }]}>
          {loading ? 'Finding questions…' : `${questions.length} questions`}
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

      <View style={styles.searchContainer}>
        <View style={[styles.searchBox, { backgroundColor: filterBg, borderColor }]}>
          <SymbolView
            name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }}
            tintColor={palette.mutedForeground}
            size={18} />
          <TextInput
            placeholder="Search questions, chapters, topics…"
            placeholderTextColor={palette.mutedForeground}
            value={filters.searchQuery}
            onChangeText={(t) => setFilters((p) => ({ ...p, searchQuery: t }))}
            style={[styles.searchInput, { color: colors.text }]}
          />
          {filters.searchQuery.length > 0 && (
            <Pressable
              accessibilityLabel="Clear search"
              onPress={() => setFilters((p) => ({ ...p, searchQuery: '' }))}>
              <SymbolView name={{ ios: 'xmark.circle.fill', android: 'cancel', web: 'cancel' }} tintColor={palette.mutedForeground} size={18} />
            </Pressable>
          )}
        </View>
      </View>

      <SideDrawer
        visible={showFilters}
        title="Question filters"
        subtitle="Narrow your practice set"
        onClose={() => setShowFilters(false)}>
          <ScrollView style={styles.filterScroll} contentContainerStyle={styles.filterPanel} showsVerticalScrollIndicator={false} nestedScrollEnabled>

            {/* 1. Competitive Exam */}
            <ChipRow
              label="Competitive Exam"
              options={['Foundation', 'JEE/NEET']}
              selected={filters.examCategory}
              onSelect={(v) => updateFilter('examCategory', v as any)}
              dark={dark}
            />

            {/* 2. Standard */}
            <ChipRow
              label="Standard / Grade"
              options={availableStandards}
              selected={filters.standard}
              onSelect={(v) => updateFilter('standard', v as any)}
              dark={dark}
            />

            {/* 3. Subject */}
            <ChipRow
              label="Subject"
              options={availableSubjects}
              selected={filters.subject}
              onSelect={(v) => updateFilter('subject', v as any)}
              dark={dark}
            />

            {/* 4. Chapter */}
            <ChipRow
              label="Chapter"
              options={chapters.slice(0, 20)}
              selected={filters.chapter}
              onSelect={(v) => updateFilter('chapter', v as any)}
              dark={dark}
            />

            {/* 5. Topic */}
            <ChipRow
              label="Topic"
              options={topics.slice(0, 20)}
              selected={filters.topic}
              onSelect={(v) => updateFilter('topic', v as any)}
              dark={dark}
            />

            {/* 6. Level */}
            <ChipRow
              label="Level"
              options={['Easy', 'Mid', 'Hard']}
              selected={filters.level}
              onSelect={(v) => updateFilter('level', v as any)}
              dark={dark}
            />

            {/* Reset button */}
            <Pressable
              onPress={() =>
                setFilters({
                  examCategory: 'All',
                  standard: 'All',
                  subject: 'All',
                  chapter: 'All',
                  topic: 'All',
                  level: 'All',
                  searchQuery: '',
                })
              }
              style={[styles.resetBtn, { backgroundColor: palette.primary }]}
            >
              <Text style={[styles.resetBtnText, { color: palette.onPrimary }]}>Reset all filters</Text>
            </Pressable>
          </ScrollView>
      </SideDrawer>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={palette.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading questions…</Text>
        </View>
      ) : questions.length === 0 ? (
        <View style={styles.center}>
          <SymbolView name={{ ios: 'doc.questionmark', android: 'quiz', web: 'quiz' }} tintColor={palette.mutedForeground} size={36} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No questions found</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            Try adjusting the filters above
          </Text>
        </View>
      ) : (
        <FlatList
          data={questions}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => <QuestionCard question={item} dark={dark} />}
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

export const QuestionsScreen = memo(QuestionsScreenComponent);
export default QuestionsScreen;

// ─── styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },

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

  // Search
  searchContainer: {
    paddingHorizontal: Spacing.three,
    paddingBottom: 14,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },

  // Filter panel
  filterScroll: { flex: 1 },
  filterPanel: { paddingHorizontal: Spacing.three, paddingTop: 16, paddingBottom: Spacing.five },
  chipSection: {
    marginBottom: 10,
  },
  chipLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 6,
    paddingRight: Spacing.three,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: {
    fontSize: 13,
  },
  resetBtn: {
    alignSelf: 'flex-start',
    marginVertical: 10,
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  resetBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },

  // Question card
  card: {
    marginHorizontal: Spacing.three,
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  badge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  questionNum: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  chapterLabel: {
    fontSize: 12,
    marginBottom: 8,
    fontStyle: 'italic',
  },
  questionText: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22,
    marginBottom: 12,
  },

  // Options
  optionsGrid: {
    gap: 8,
  },
  optionBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    gap: 10,
  },
  optionKey: {
    fontSize: 13,
    fontWeight: '800',
    fontFamily: 'monospace',
    minWidth: 16,
    marginTop: 1,
  },
  optionText: {
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },

  // Explanation
  explanationToggle: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    alignItems: 'center',
  },
  explanationBox: {
    marginTop: 10,
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
  },
  explanationText: {
    fontSize: 14,
    lineHeight: 21,
  },
  sourceText: {
    fontSize: 11,
    marginTop: 6,
    fontStyle: 'italic',
  },

  // List
  listContent: {
    paddingTop: 12,
  },

  // Loader / empty
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: Spacing.four,
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
});
