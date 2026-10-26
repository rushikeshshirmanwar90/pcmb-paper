import React, { useEffect, useState, memo } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { AppHeader } from '@/components/app-header';
import { SideDrawer } from '@/components/side-drawer';
import { MathText } from '@/components/math-text';
import { Explanation } from '@/components/explanation';
import { Diagrams } from '@/components/diagrams';
import { DropdownSelect } from '@/components/dropdown-select';
import { QuestionSetFlow } from '@/components/create-exam-modal';
import { Colors, getPalette, Spacing, BottomTabInset, MaxContentWidth } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTabNavigation } from '@/context/tab-context';
import { useTabBarHeight } from '@/hooks/use-tab-bar-height';
import { useResponsive } from '@/hooks/use-responsive';
import type { FilterState, Question, Standard } from '@/types/pcmb';
import { fetchQuestions } from '@/services/apiService';
import { createQuestionsPdf, PdfRequestError } from '@/services/question-pdf';
import { openPdf, sharePdf, type SavedPdf } from '@/services/pdf-library';
import { MyPdfsScreen } from '@/components/my-pdfs-screen';
import { useChapterTopicOptions } from '@/hooks/use-chapter-topic-options';
import { subjectsFor } from '@/constants/syllabus';

// ─── constants ──────────────────────────────────────────────────────────────

const FOUNDATION_STANDARDS: Standard[] = ['9th', '10th'];
const JEE_NEET_STANDARDS: Standard[] = ['11th', '12th'];


// ─── Question Card ─────────────────────────────────────────────────────────

function QuestionCard({ question, dark }: { question: Question; dark: boolean }) {
  const palette = getPalette(dark);
  const { cardPadding } = useResponsive();

  const diffColor =
    question.difficulty === 'Easy'
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
    <View style={[styles.card, { backgroundColor: cardBg, borderColor, padding: cardPadding }]}>
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
      {question.chapter || question.topic ? (
        <Text style={[styles.chapterLabel, { color: mutedColor }]}>
          {[question.chapter, question.topic].filter(Boolean).join('  ·  ')}
        </Text>
      ) : null}

      {/* Question text */}
      <View style={styles.questionTextWrap}>
        <MathText text={question.questionText} fontSize={15} color={textColor} />
        <Diagrams urls={question.diagramUrls} />
      </View>

      {/* Numerical questions have no options — show the answer value instead. */}
      {question.answerType === 'Numerical' ? (
        question.correctAnswer ? (
          <View
            style={[
              styles.optionBox,
              { backgroundColor: palette.successSoft, borderColor: palette.successBorder },
            ]}
          >
            <Text style={[styles.optionKey, { color: palette.success }]}>Ans</Text>
            <View style={styles.optionTextWrap}>
              <MathText text={question.correctAnswer} fontSize={14} color={palette.successInk} />
            </View>
          </View>
        ) : null
      ) : (
      <View style={styles.optionsGrid}>
        {options.map(([key, text]) => {
          const optionImages = question.optionDiagramUrls?.[key as 'A' | 'B' | 'C' | 'D'] ?? [];
          const isCorrect = question.correctAnswer === key;
          const optBg = isCorrect ? palette.successSoft : palette.background;
          const optBorder = isCorrect ? palette.successBorder : palette.border;
          const optTextColor = isCorrect ? palette.successInk : palette.inkSoft;
          return (
            <View
              key={key}
              style={[
                styles.optionBox,
                { backgroundColor: optBg, borderColor: optBorder },
              ]}
            >
              <Text
                style={[
                  styles.optionKey,
                  { color: isCorrect ? palette.success : mutedColor },
                ]}
              >
                {key}
              </Text>
              <View style={styles.optionTextWrap}>
                <MathText text={text} fontSize={14} color={optTextColor} />
                <Diagrams urls={optionImages} maxHeight={160} />
              </View>
            </View>
          );
        })}
      </View>
      )}

      {/* Explanation */}
      {question.explanation ? (
        <Explanation
          text={question.explanation}
          source={question.source}
          correctAnswer={question.answerType === 'Numerical' ? undefined : question.correctAnswer}
          diagramUrls={question.explanationDiagramUrls}
          defaultCollapsed
        />
      ) : null}
    </View>
  );
}

// ─── Main Screen ────────────────────────────────────────────────────────────

/**
 * Opens on the PDF paper form, so a teacher starts from the class and
 * chapter and only sees the questions that match. The whole
 * bank is one tap away for browsing (its filtered list can be saved as a PDF
 * too), and so is My PDFs, every PDF made, saved on the phone.
 */
function QuestionsScreenComponent() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const { activeKey, questionsMode, setQuestionsMode } = useTabNavigation();
  const tabBarHeight = useTabBarHeight();

  if (questionsMode === 'browse') {
    return (
      <BrowseQuestions
        backLabel="Make a PDF paper"
        onBack={() => setQuestionsMode('create')}
        onViewPdfs={() => setQuestionsMode('pdfs')}
      />
    );
  }
  if (questionsMode === 'pdfs') {
    return <MyPdfsScreen onBack={() => setQuestionsMode('create')} onCreate={() => setQuestionsMode('create')} />;
  }

  // Tests for batches are set from the Tests tab; this tab makes PDF papers.
  return (
    <SafeAreaView edges={['top']} style={[styles.root, { backgroundColor: colors.background }]}>
      <AppHeader title="Make a PDF paper" subtitle="Choose a class and chapter, then the questions" />
      <View style={[styles.mainWrapper, { maxWidth: MaxContentWidth }]}>
        <QuestionSetFlow
          purpose="pdf"
          onViewPdfs={() => setQuestionsMode('pdfs')}
          bottomInset={tabBarHeight}
          active={activeKey === 'questions'}
        />
      </View>
    </SafeAreaView>
  );
}

// ─── Question bank: every question, filtered by the drawer ─────────────────

function BrowseQuestions({
  backLabel,
  onBack,
  onViewPdfs,
}: {
  /** Names the form the back button returns to. */
  backLabel: string;
  onBack: () => void;
  onViewPdfs: () => void;
}) {
  const scheme = useColorScheme();
  const dark = scheme === 'dark';
  const palette = getPalette(dark);
  const colors = Colors[dark ? 'dark' : 'light'];
  const { questionFilters: filters, setQuestionFilters: setFilters } = useTabNavigation();

  // The questions last loaded and the filters they were loaded for: until they
  // match the current filters, a load is under way (the last results stay shown).
  const [loaded, setLoaded] = useState<{ filters: FilterState; questions: Question[] } | null>(null);
  const questions = loaded?.questions ?? [];
  const loading = loaded?.filters !== filters;
  const [showFilters, setShowFilters] = useState(false);
  const [makingPdf, setMakingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [madePdf, setMadePdf] = useState<SavedPdf | null>(null);

  const runPdfAction = async (action: (pdf: SavedPdf) => Promise<void>) => {
    if (!madePdf) return;
    setPdfError(null);
    try {
      await action(madePdf);
    } catch (error) {
      setPdfError(error instanceof Error ? error.message : 'Something went wrong. Try again.');
    }
  };

  // Every question the filters found, as a paper with an answer key at the
  // end, saved to My PDFs.
  const handleMakePdf = async () => {
    const named = [filters.standard, filters.subject, filters.chapter, filters.topic].filter((v) => v !== 'All');
    setMakingPdf(true);
    setPdfError(null);
    setMadePdf(null);
    try {
      const saved = await createQuestionsPdf({
        title: named.length ? named.join(' · ') : 'Question bank',
        questions,
        content: 'answers',
        marksPerQuestion: 4,
        standard: filters.standard !== 'All' ? filters.standard : undefined,
        subject: filters.subject !== 'All' ? filters.subject : undefined,
      });
      setMadePdf(saved);
    } catch (error) {
      setPdfError(error instanceof PdfRequestError ? error.message : 'Could not make the PDF. Try again.');
    } finally {
      setMakingPdf(false);
    }
  };

  // Derive standards and subjects from examCategory
  const availableStandards =
    filters.examCategory === 'Foundation'
      ? FOUNDATION_STANDARDS
      : filters.examCategory === 'JEE/NEET'
      ? JEE_NEET_STANDARDS
      : [...FOUNDATION_STANDARDS, ...JEE_NEET_STANDARDS];

  const availableSubjects = subjectsFor(filters.examCategory, filters.standard);

  const { chapters, chapterCounts, topics, topicCounts } = useChapterTopicOptions(filters);

  // Load questions whenever filters change
  useEffect(() => {
    let isCancelled = false;
    fetchQuestions(filters).then((qs) => {
      if (!isCancelled) setLoaded({ filters, questions: qs });
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
      <AppHeader title="Question bank" subtitle="Every question, by subject, chapter and level" />

      <View style={[styles.mainWrapper, { maxWidth: MaxContentWidth }]}>
        <Pressable
          accessibilityRole="button"
          onPress={onBack}
          style={({ pressed }) => [styles.backRow, pressed && styles.pressed]}
        >
          <SymbolView
            name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
            tintColor={palette.primary}
            size={16}
          />
          <Text style={[styles.backRowText, { color: palette.primary }]}>{backLabel}</Text>
        </Pressable>

        {/* Results and Filter Toggle Toolbar */}
        <View style={styles.resultsToolbar}>
          <Text style={[styles.resultsLabel, { color: colors.textSecondary }]}>
            {loading ? 'Finding questions…' : `${questions.length} questions available`}
          </Text>
          <View style={styles.toolbarActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Save these ${questions.length} questions as a PDF`}
            accessibilityState={{ disabled: loading || makingPdf || questions.length === 0, busy: makingPdf }}
            disabled={loading || makingPdf || questions.length === 0}
            onPress={handleMakePdf}
            style={({ pressed }) => [
              styles.filterToggleBtn,
              { borderWidth: 1, borderColor: palette.primary },
              (loading || questions.length === 0) && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            {makingPdf ? (
              <ActivityIndicator size="small" color={palette.primary} />
            ) : (
              <SymbolView
                name={{ ios: 'doc.richtext', android: 'picture_as_pdf', web: 'picture_as_pdf' }}
                tintColor={palette.primary}
                size={16}
              />
            )}
            <Text style={[styles.filterToggleText, { color: palette.primary }]}>PDF</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: showFilters }}
            onPress={() => setShowFilters((visible) => !visible)}
            style={({ pressed }) => [
              styles.filterToggleBtn,
              { backgroundColor: palette.primary },
              pressed && styles.pressed,
            ]}
          >
            <SymbolView
              name={{ ios: 'slider.horizontal.3', android: 'tune', web: 'tune' }}
              tintColor={palette.onPrimary}
              size={16}
            />
            <Text style={[styles.filterToggleText, { color: palette.onPrimary }]}>
              {showFilters ? 'Hide Filters' : 'Filters'}
            </Text>
            {activeFilterCount > 0 && (
              <View style={[styles.filterCountBadge, { backgroundColor: palette.primaryInk }]}>
                <Text style={[styles.filterCountText, { color: palette.onPrimary }]}>
                  {activeFilterCount}
                </Text>
              </View>
            )}
          </Pressable>
          </View>
        </View>
        {makingPdf ? (
          <Text accessibilityLiveRegion="polite" style={[styles.pdfStatus, { color: colors.textSecondary }]}>
            Making the PDF of {questions.length} question{questions.length === 1 ? '' : 's'}…
          </Text>
        ) : null}
        {pdfError ? (
          <Text accessibilityLiveRegion="polite" style={[styles.pdfStatus, { color: palette.dangerInk }]}>
            {pdfError}
          </Text>
        ) : null}
        {madePdf ? (
          <View
            accessibilityLiveRegion="polite"
            style={[styles.pdfBanner, { backgroundColor: palette.successSoft, borderColor: palette.successBorder }]}
          >
            <View style={styles.pdfBannerTop}>
              <Text style={[styles.pdfBannerText, { color: palette.successInk }]} numberOfLines={2}>
                Saved “{madePdf.name}” to My PDFs
              </Text>
              <Pressable accessibilityLabel="Dismiss" hitSlop={8} onPress={() => setMadePdf(null)}>
                <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} tintColor={palette.successInk} size={14} />
              </Pressable>
            </View>
            <View style={styles.pdfBannerActions}>
              {([
                ['Open', () => runPdfAction(openPdf)],
                ['Share', () => runPdfAction(sharePdf)],
                ['My PDFs', onViewPdfs],
              ] as const).map(([label, onPress]) => (
                <Pressable
                  key={label}
                  accessibilityRole="button"
                  onPress={onPress}
                  style={({ pressed }) => [styles.pdfBannerBtn, { borderColor: palette.successBorder }, pressed && styles.pressed]}
                >
                  <Text style={[styles.pdfBannerBtnText, { color: palette.successInk }]}>{label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {/* Search Box */}
        <View style={styles.searchContainer}>
          <View style={[styles.searchBox, { backgroundColor: filterBg, borderColor }]}>
            <SymbolView
              name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }}
              tintColor={palette.mutedForeground}
              size={18}
            />
            <TextInput
              placeholder="Search questions, formulas, chapters…"
              placeholderTextColor={palette.mutedForeground}
              value={filters.searchQuery}
              onChangeText={(t) => setFilters((p) => ({ ...p, searchQuery: t }))}
              style={[styles.searchInput, { color: colors.text }]}
            />
            {filters.searchQuery.length > 0 && (
              <Pressable
                accessibilityLabel="Clear search"
                onPress={() => setFilters((p) => ({ ...p, searchQuery: '' }))}
              >
                <SymbolView
                  name={{ ios: 'xmark.circle.fill', android: 'cancel', web: 'cancel' }}
                  tintColor={palette.mutedForeground}
                  size={18}
                />
              </Pressable>
            )}
          </View>
        </View>

        {/* Active Filters Pill Bar (Quick View) */}
        {activeFilterCount > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.activePillsContainer}
          >
            {filters.examCategory !== 'All' && (
              <Pressable
                onPress={() => updateFilter('examCategory', 'All')}
                style={[styles.activePill, { backgroundColor: palette.primarySoft, borderColor: palette.primaryBorder }]}
              >
                <Text style={[styles.activePillText, { color: palette.primaryInk }]}>
                  Exam: {filters.examCategory}
                </Text>
                <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} tintColor={palette.primaryInk} size={11} />
              </Pressable>
            )}
            {filters.standard !== 'All' && (
              <Pressable
                onPress={() => updateFilter('standard', 'All')}
                style={[styles.activePill, { backgroundColor: palette.primarySoft, borderColor: palette.primaryBorder }]}
              >
                <Text style={[styles.activePillText, { color: palette.primaryInk }]}>
                  Grade: {filters.standard}
                </Text>
                <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} tintColor={palette.primaryInk} size={11} />
              </Pressable>
            )}
            {filters.subject !== 'All' && (
              <Pressable
                onPress={() => updateFilter('subject', 'All')}
                style={[styles.activePill, { backgroundColor: palette.primarySoft, borderColor: palette.primaryBorder }]}
              >
                <Text style={[styles.activePillText, { color: palette.primaryInk }]}>
                  Subject: {filters.subject}
                </Text>
                <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} tintColor={palette.primaryInk} size={11} />
              </Pressable>
            )}
            {filters.chapter !== 'All' && (
              <Pressable
                onPress={() => updateFilter('chapter', 'All')}
                style={[styles.activePill, { backgroundColor: palette.primarySoft, borderColor: palette.primaryBorder }]}
              >
                <Text style={[styles.activePillText, { color: palette.primaryInk }]}>
                  Chapter: {filters.chapter}
                </Text>
                <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} tintColor={palette.primaryInk} size={11} />
              </Pressable>
            )}
            {filters.topic !== 'All' && (
              <Pressable
                onPress={() => updateFilter('topic', 'All')}
                style={[styles.activePill, { backgroundColor: palette.primarySoft, borderColor: palette.primaryBorder }]}
              >
                <Text style={[styles.activePillText, { color: palette.primaryInk }]}>
                  Topic: {filters.topic}
                </Text>
                <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} tintColor={palette.primaryInk} size={11} />
              </Pressable>
            )}
            {filters.level !== 'All' && (
              <Pressable
                onPress={() => updateFilter('level', 'All')}
                style={[styles.activePill, { backgroundColor: palette.primarySoft, borderColor: palette.primaryBorder }]}
              >
                <Text style={[styles.activePillText, { color: palette.primaryInk }]}>
                  Level: {filters.level}
                </Text>
                <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} tintColor={palette.primaryInk} size={11} />
              </Pressable>
            )}
          </ScrollView>
        )}

        {/* Filter SideDrawer with Sleek Dropdown Selects */}
        <SideDrawer
          visible={showFilters}
          title="Filter Questions"
          subtitle="Customize your practice set"
          onClose={() => setShowFilters(false)}
        >
          <ScrollView
            style={styles.filterScroll}
            contentContainerStyle={styles.filterPanel}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
          >
            {/* 1. Competitive Exam */}
            <DropdownSelect
              label="Competitive Exam"
              options={['Foundation', 'JEE/NEET']}
              selected={filters.examCategory}
              onSelect={(v) => updateFilter('examCategory', v as any)}
              icon={{ ios: 'graduationcap', android: 'school', web: 'school' }}
            />

            {/* 2. Standard */}
            <DropdownSelect
              label="Standard / Grade"
              options={availableStandards}
              selected={filters.standard}
              onSelect={(v) => updateFilter('standard', v as any)}
              icon={{ ios: 'number', android: 'pin', web: 'pin' }}
            />

            {/* 3. Subject */}
            <DropdownSelect
              label="Subject"
              options={availableSubjects}
              selected={filters.subject}
              onSelect={(v) => updateFilter('subject', v as any)}
              icon={{ ios: 'atom', android: 'science', web: 'science' }}
            />

            {/* 4. Chapter */}
            <DropdownSelect
              label="Chapter"
              options={chapters}
              counts={chapterCounts}
              emptyText="No chapters uploaded for this selection"
              selected={filters.chapter}
              onSelect={(v) => updateFilter('chapter', v as any)}
              searchable
              icon={{ ios: 'book', android: 'menu_book', web: 'menu_book' }}
            />

            {/* 5. Topic */}
            <DropdownSelect
              label="Topic"
              options={topics}
              counts={topicCounts}
              emptyText="No topics uploaded for this selection"
              selected={filters.topic}
              onSelect={(v) => updateFilter('topic', v as any)}
              searchable
              icon={{ ios: 'list.bullet', android: 'list', web: 'list' }}
            />

            {/* 6. Level */}
            <DropdownSelect
              label="Difficulty Level"
              options={['Easy', 'Mid', 'Hard']}
              selected={filters.level}
              onSelect={(v) => updateFilter('level', v as any)}
              icon={{ ios: 'speedometer', android: 'speed', web: 'speed' }}
            />

            {/* Reset button */}
            <Pressable
              onPress={() => {
                setFilters({
                  examCategory: 'All',
                  standard: 'All',
                  subject: 'All',
                  chapter: 'All',
                  topic: 'All',
                  level: 'All',
                  searchQuery: '',
                });
                setShowFilters(false);
              }}
              style={[styles.resetBtn, { backgroundColor: palette.primary }]}
            >
              <Text style={[styles.resetBtnText, { color: palette.onPrimary }]}>
                Reset All Filters
              </Text>
            </Pressable>
          </ScrollView>
        </SideDrawer>

        {/* Question List */}
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={palette.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              Loading questions…
            </Text>
          </View>
        ) : questions.length === 0 ? (
          <View style={styles.center}>
            <SymbolView
              name={{ ios: 'doc.questionmark', android: 'quiz', web: 'quiz' }}
              tintColor={palette.mutedForeground}
              size={36}
            />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No questions found</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              Try adjusting your dropdown filters or search term
            </Text>
          </View>
        ) : (
          <FlatList
            data={questions}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => <QuestionCard question={item} dark={dark} />}
            // Detaching off-screen rows leaves their maths web views blank on Android.
            removeClippedSubviews={false}
            ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
            contentContainerStyle={[styles.listContent, { paddingBottom: BottomTabInset + 40 }]}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

export const QuestionsScreen = memo(QuestionsScreenComponent);
export default QuestionsScreen;

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  mainWrapper: {
    flex: 1,
    width: '100%',
    alignSelf: 'center',
  },
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.45,
  },
  toolbarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pdfStatus: {
    fontSize: 13,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
  },
  pdfBanner: {
    marginHorizontal: Spacing.three,
    marginBottom: Spacing.two,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 10,
  },
  pdfBannerTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  pdfBannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  pdfBannerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  pdfBannerBtn: {
    flex: 1,
    minHeight: 38,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pdfBannerBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    minHeight: 44,
    paddingHorizontal: Spacing.three,
  },
  backRowText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Results toolbar
  resultsToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.one,
  },
  resultsLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  filterToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  filterToggleText: {
    fontSize: 13,
    fontWeight: '700',
  },
  filterCountBadge: {
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
    minWidth: 16,
    alignItems: 'center',
  },
  filterCountText: {
    fontSize: 10,
    fontWeight: '800',
  },

  // Search
  searchContainer: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },

  // Active filter pills
  activePillsContainer: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
    gap: 8,
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
  },
  activePillText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Filter Drawer
  filterScroll: {
    flex: 1,
  },
  filterPanel: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 40,
  },
  resetBtn: {
    marginTop: 10,
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },

  // Question Card
  card: {
    marginHorizontal: Spacing.three,
    borderRadius: 12,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  badge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  questionNum: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  chapterLabel: {
    fontSize: 12,
    marginBottom: 8,
    fontStyle: 'italic',
  },
  questionTextWrap: {
    marginBottom: 12,
  },
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
  optionTextWrap: {
    flex: 1,
  },

  // List
  listContent: {
    paddingTop: 8,
  },

  // Loader / empty
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: Spacing.four,
    paddingVertical: 40,
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
    maxWidth: 280,
  },
});
