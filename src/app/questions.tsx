"use client";

import { useEffect, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, BottomTabInset } from '@/constants/theme';
import type { DifficultyLevel, ExamCategory, FilterState, Question, Standard, Subject } from '@/types/pcmb';
import { fetchFilterOptions, fetchQuestions } from '@/services/apiService';

// ─── helpers ────────────────────────────────────────────────────────────────

const FOUNDATION_STANDARDS: Standard[] = ['9th', '10th'];
const JEE_NEET_STANDARDS: Standard[] = ['11th', '12th'];

const SUBJECT_MAP: Record<ExamCategory, Subject[]> = {
  Foundation: ['Science', 'Mathematics', 'Physics', 'Chemistry'],
  'JEE/NEET': ['Physics', 'Chemistry', 'Mathematics', 'Biology'],
};

const DIFFICULTY_COLORS: Record<DifficultyLevel, { bg: string; text: string }> = {
  Easy: { bg: '#D1FAE5', text: '#065F46' },
  Mid: { bg: '#FEF3C7', text: '#92400E' },
  Hard: { bg: '#FEE2E2', text: '#991B1B' },
};

const SUBJECT_COLORS: Record<string, { bg: string; text: string }> = {
  Physics: { bg: '#EDE9FE', text: '#5B21B6' },
  Chemistry: { bg: '#ECFDF5', text: '#065F46' },
  Mathematics: { bg: '#EFF6FF', text: '#1E40AF' },
  Biology: { bg: '#FFF7ED', text: '#9A3412' },
  Science: { bg: '#F0F9FF', text: '#075985' },
};

function chipColor(selected: boolean, dark: boolean) {
  if (selected) return { bg: '#6366F1', text: '#FFFFFF' };
  return { bg: dark ? '#2A2A2E' : '#F1F5F9', text: dark ? '#CBD5E1' : '#475569' };
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
  return (
    <View style={styles.chipSection}>
      <Text style={[styles.chipLabel, { color: dark ? '#94A3B8' : '#64748B' }]}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {['All', ...options].map((opt) => {
          const isSelected = selected === opt;
          const colors = chipColor(isSelected, dark);
          return (
            <Pressable
              key={opt}
              onPress={() => onSelect(opt)}
              style={[styles.chip, { backgroundColor: colors.bg }]}
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
  const diffColor = DIFFICULTY_COLORS[question.difficulty] ?? DIFFICULTY_COLORS.Mid;
  const subjColor = SUBJECT_COLORS[question.subject] ?? { bg: '#F1F5F9', text: '#475569' };
  const cardBg = dark ? '#1C1C1E' : '#FFFFFF';
  const textColor = dark ? '#F1F5F9' : '#1E293B';
  const mutedColor = dark ? '#94A3B8' : '#64748B';
  const borderColor = dark ? '#2D2D30' : '#E2E8F0';

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
          <View style={[styles.badge, { backgroundColor: dark ? '#2A2A2E' : '#F1F5F9' }]}>
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
          const optBg = isCorrect
            ? (dark ? '#064E3B' : '#ECFDF5')
            : (dark ? '#27272A' : '#F8FAFC');
          const optBorder = isCorrect
            ? (dark ? '#10B981' : '#34D399')
            : (dark ? '#3F3F46' : '#E2E8F0');
          const optTextColor = isCorrect
            ? (dark ? '#6EE7B7' : '#047857')
            : (dark ? '#E4E4E7' : '#475569');
          return (
            <View key={key} style={[styles.optionBox, { backgroundColor: optBg, borderColor: optBorder }]}>
              <Text style={[styles.optionKey, { color: isCorrect ? (dark ? '#10B981' : '#059669') : mutedColor }]}>
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
          style={[styles.explanationToggle, { borderColor }]}
        >
          <Text style={{ color: '#6366F1', fontSize: 13, fontWeight: '600' }}>
            {expanded ? '▲ Hide Explanation' : '▼ Show Explanation'}
          </Text>
        </Pressable>
      ) : null}

      {expanded && question.explanation ? (
        <View style={[styles.explanationBox, { backgroundColor: dark ? '#1A1A2E' : '#F5F3FF', borderColor: dark ? '#4C1D95' : '#DDD6FE' }]}>
          <Text style={[styles.explanationText, { color: dark ? '#C4B5FD' : '#5B21B6' }]}>
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

export default function QuestionsScreen() {
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

  const [chapters, setChapters] = useState<string[]>([]);
  const [topics, setTopics] = useState<string[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(true);

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
  const loadQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const qs = await fetchQuestions(filters);
      setQuestions(qs);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

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
  const borderColor = dark ? '#2D2D30' : '#E2E8F0';
  const filterBg = dark ? '#111113' : '#F8FAFC';

  return (
    <View style={[styles.root, { backgroundColor: bg, paddingTop: insets.top }]}>
      {/* ── Top bar ── */}
      <View style={[styles.topBar, { borderBottomColor: borderColor, backgroundColor: bg }]}>
        <View style={styles.topBarLeft}>
          <Text style={[styles.screenTitle, { color: colors.text }]}>Questions</Text>
          {questions.length > 0 && !loading && (
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{questions.length}</Text>
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

      {/* ── Search bar ── */}
      <View style={[styles.searchContainer, { backgroundColor: filterBg, borderBottomColor: borderColor }]}>
        <View style={[styles.searchBox, { backgroundColor: dark ? '#1C1C1E' : '#FFFFFF', borderColor }]}>
          <Text style={{ color: dark ? '#64748B' : '#94A3B8', marginRight: 6, fontSize: 15 }}>🔍</Text>
          <TextInput
            placeholder="Search questions, chapters, topics…"
            placeholderTextColor={dark ? '#4B5563' : '#9CA3AF'}
            value={filters.searchQuery}
            onChangeText={(t) => setFilters((p) => ({ ...p, searchQuery: t }))}
            style={[styles.searchInput, { color: colors.text }]}
          />
          {filters.searchQuery.length > 0 && (
            <Pressable onPress={() => setFilters((p) => ({ ...p, searchQuery: '' }))}>
              <Text style={{ color: '#94A3B8', fontSize: 16 }}>✕</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* ── Filter panel ── */}
      {showFilters && (
        <View style={[styles.filterPanel, { backgroundColor: filterBg, borderBottomColor: borderColor }]}>
          <ScrollView showsVerticalScrollIndicator={false}>

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
              style={styles.resetBtn}
            >
              <Text style={styles.resetBtnText}>↺  Reset All Filters</Text>
            </Pressable>
          </ScrollView>
        </View>
      )}

      {/* ── Questions List ── */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading questions…</Text>
        </View>
      ) : questions.length === 0 ? (
        <View style={styles.center}>
          <Text style={{ fontSize: 48 }}>📭</Text>
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
    </View>
  );
}

// ─── styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  countBadge: {
    backgroundColor: '#6366F1',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  countBadgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  filterToggleBtn: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },

  // Search
  searchContainer: {
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },

  // Filter panel
  filterPanel: {
    maxHeight: 320,
    borderBottomWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingTop: 8,
    paddingBottom: 4,
  },
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
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: {
    fontSize: 13,
  },
  resetBtn: {
    alignSelf: 'center',
    marginVertical: 10,
    backgroundColor: '#FEE2E2',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  resetBtnText: {
    color: '#991B1B',
    fontSize: 13,
    fontWeight: '700',
  },

  // Question card
  card: {
    marginHorizontal: Spacing.three,
    borderRadius: 16,
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
