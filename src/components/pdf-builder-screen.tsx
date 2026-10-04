import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SymbolView } from 'expo-symbols';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DropdownSelect } from '@/components/dropdown-select';
import { MultiSelectDropdown } from '@/components/multi-select-dropdown';
import { getPalette } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { fetchPdfFilterOptions, searchPdfQuestions } from '@/services/apiService';
import type { DifficultyLevel, ExamCategory, Question, Standard, Subject } from '@/types/pcmb';

const EXAM_TYPES = ['MCQ + MCQ', 'MCQ + Numeric', 'MCQ + Subjective'];
const LANGUAGES = ['English'];
const SUBJECTS = ['Physics', 'Chemistry', 'Mathematics', 'Biology'];
const LEVELS: DifficultyLevel[] = ['Easy', 'Mid', 'Hard'];
const MCQ_YEARS = Array.from({ length: new Date().getFullYear() - 2010 + 1 }, (_, index) => `${new Date().getFullYear() - index}`);
const MODULE_STANDARDS: Record<string, string[]> = {
  Foundation: ['9th', '10th'],
  'JEE / NEET': ['11th', '12th'],
};

type ActionMode = 'Search' | 'Auto Generate' | 'PDF Question';

export function PdfBuilderScreen({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const palette = getPalette(useColorScheme() === 'dark');
  const [step, setStep] = useState<'welcome' | 'setup' | 'questions'>('welcome');
  const [pdfName, setPdfName] = useState('');
  const [moduleType, setModuleType] = useState('');
  const [examType, setExamType] = useState('');
  const [languages, setLanguages] = useState<string[]>([]);
  const [standards, setStandards] = useState<string[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [questionSubject, setQuestionSubject] = useState('');
  const [chapter, setChapter] = useState('');
  const [topic, setTopic] = useState('');
  const [level, setLevel] = useState('');
  const [mcqYear, setMcqYear] = useState('');
  const [actionMode, setActionMode] = useState<ActionMode | null>(null);
  const [availableChapters, setAvailableChapters] = useState<string[]>([]);
  const [availableTopics, setAvailableTopics] = useState<string[]>([]);
  const [filtersLoading, setFiltersLoading] = useState(false);
  const [filterError, setFilterError] = useState('');
  const [validationError, setValidationError] = useState('');
  const [searchError, setSearchError] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<Question[]>([]);
  const [selectedQuestions, setSelectedQuestions] = useState<Question[]>([]);

  const availableStandards = moduleType ? MODULE_STANDARDS[moduleType] : [];
  const examCategory: ExamCategory = moduleType === 'Foundation' ? 'Foundation' : 'JEE/NEET';

  useEffect(() => {
    if (!visible || step !== 'questions' || !moduleType || !standards.length || !questionSubject) return;
    let cancelled = false;
    const scopes = standards.map((standard) =>
      fetchPdfFilterOptions({
        examCategory,
        standard: standard as Standard,
        subject: questionSubject as Subject,
        chapter: chapter || undefined,
      })
    );
    Promise.all(scopes)
      .then((options) => {
        if (cancelled) return;
        setAvailableChapters([...new Set(options.flatMap((item) => item.chapters))].sort());
        setAvailableTopics([...new Set(options.flatMap((item) => item.topics))].sort());
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setAvailableChapters([]);
        setAvailableTopics([]);
        setFilterError(error instanceof Error ? error.message : 'Unable to load question filters.');
      })
      .finally(() => {
        if (!cancelled) setFiltersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [chapter, examCategory, moduleType, questionSubject, standards, step, visible]);

  const closeScreen = () => {
    setStep('welcome');
    setPdfName('');
    setModuleType('');
    setExamType('');
    setLanguages([]);
    setStandards([]);
    setSubjects([]);
    setQuestionSubject('');
    setChapter('');
    setTopic('');
    setLevel('');
    setMcqYear('');
    setActionMode(null);
    setAvailableChapters([]);
    setAvailableTopics([]);
    setFilterError('');
    setValidationError('');
    setSearchError('');
    setSearchResults([]);
    setSelectedQuestions([]);
    onClose();
  };

  const handleNext = () => {
    const missing: string[] = [];
    if (!pdfName.trim()) missing.push('PDF name');
    if (!moduleType) missing.push('module type');
    if (!examType) missing.push('exam type');
    if (!languages.length) missing.push('language');
    if (!standards.length) missing.push('standard');
    if (!subjects.length) missing.push('subject');
    if (missing.length) {
      setValidationError(`Please complete: ${missing.join(', ')}.`);
      return;
    }
    setValidationError('');
    setFiltersLoading(true);
    setStep('questions');
  };

  const resetQuestionSearch = () => {
    setActionMode(null);
    setSearchResults([]);
    setSearchError('');
  };

  const handleSearch = async () => {
    setActionMode('Search');
    setSearchError('');
    setSearchResults([]);
    if (!moduleType || !standards.length || !subjects.length) {
      setSearchError('Complete the PDF details and select at least one standard and subject first.');
      return;
    }
    setSearchLoading(true);
    try {
      const results = await searchPdfQuestions({
        examCategory,
        standards: standards as Standard[],
        subjects: subjects as Subject[],
        chapter: chapter || undefined,
        topic: topic || undefined,
        level: level ? level as DifficultyLevel : undefined,
        year: mcqYear || undefined,
      });
      setSearchResults(results);
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : 'Question search failed.');
    } finally {
      setSearchLoading(false);
    }
  };

  const toggleQuestion = (question: Question) => {
    setSelectedQuestions((current) =>
      current.some((item) => item._id === question._id)
        ? current.filter((item) => item._id !== question._id)
        : [...current, question]
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={closeScreen}>
      <SafeAreaView style={[styles.root, { backgroundColor: palette.background }]}>
        <View style={[styles.header, { backgroundColor: palette.card, borderBottomColor: palette.border }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={step === 'questions' ? () => setStep('setup') : step === 'setup' ? () => setStep('welcome') : closeScreen}
            style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}>
            <SymbolView
              name={step !== 'welcome'
                ? { ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }
                : { ios: 'xmark', android: 'close', web: 'close' }}
              tintColor={palette.foreground}
              size={19}
            />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={[styles.headerTitle, { color: palette.foreground }]}>PDF Studio</Text>
            <Text style={[styles.headerSubtitle, { color: palette.mutedForeground }]}>
              {step === 'questions' ? 'Add questions to your paper' : step === 'setup' ? 'Set up your question paper' : 'Create a custom question paper'}
            </Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {step === 'welcome' ? (
            <View style={[styles.welcomeCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <View style={[styles.heroIcon, { backgroundColor: palette.primarySoft }]}>
                <SymbolView
                  name={{ ios: 'doc.richtext', android: 'picture_as_pdf', web: 'picture_as_pdf' }}
                  tintColor={palette.primary}
                  size={34}
                />
              </View>
              <Text style={[styles.welcomeTitle, { color: palette.foreground }]}>Build your question paper</Text>
              <Text style={[styles.welcomeDescription, { color: palette.mutedForeground }]}>
                Choose a module, exam format and question filters to prepare a PDF tailored to your needs.
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setStep('setup')}
                style={({ pressed }) => [
                  styles.primaryButton,
                  { backgroundColor: palette.primary },
                  pressed && styles.pressed,
                ]}>
                <SymbolView
                  name={{ ios: 'plus', android: 'add', web: 'add' }}
                  tintColor={palette.onPrimary}
                  size={18}
                />
                <Text style={[styles.primaryButtonText, { color: palette.onPrimary }]}>Create PDF</Text>
              </Pressable>
            </View>
          ) : step === 'setup' ? (
            <>
              <View style={[styles.section, { backgroundColor: palette.card, borderColor: palette.border }]}>
                <Text style={[styles.sectionTitle, { color: palette.foreground }]}>PDF details</Text>
                <Text style={[styles.fieldLabel, { color: palette.mutedForeground }]}>PDF NAME</Text>
                <TextInput
                  accessibilityLabel="PDF name"
                  value={pdfName}
                  onChangeText={(value) => {
                    setPdfName(value);
                    setValidationError('');
                  }}
                  placeholder="Enter a name for your PDF"
                  placeholderTextColor={palette.mutedForeground}
                  style={[styles.textInput, { backgroundColor: palette.background, borderColor: palette.border, color: palette.foreground }]}
                />

                <DropdownSelect
                  label="Module type"
                  options={['Foundation', 'JEE / NEET']}
                  selected={moduleType}
                  placeholder="Select module type"
                  onSelect={(value) => {
                    setModuleType(value === 'All' ? '' : value);
                    setStandards([]);
                    setValidationError('');
                    setFilterError('');
                    setAvailableChapters([]);
                    setAvailableTopics([]);
                    setFiltersLoading(false);
                    setSelectedQuestions([]);
                    resetQuestionSearch();
                  }}
                  icon={{ ios: 'graduationcap.fill', android: 'school', web: 'school' }}
                />
                <DropdownSelect
                  label="Exam type"
                  options={EXAM_TYPES}
                  selected={examType}
                  placeholder="Select exam type"
                  onSelect={(value) => {
                    setExamType(value === 'All' ? '' : value);
                    setValidationError('');
                  }}
                  icon={{ ios: 'list.bullet.clipboard', android: 'fact_check', web: 'fact_check' }}
                />
                <MultiSelectDropdown
                  label="Language"
                  options={LANGUAGES}
                  selected={languages}
                  onSelect={(values) => {
                    setLanguages(values);
                    setValidationError('');
                  }}
                  placeholder="Select language"
                  icon={{ ios: 'character.bubble', android: 'translate', web: 'translate' }}
                />
                <MultiSelectDropdown
                  label="Standard"
                  options={availableStandards}
                  selected={standards}
                  onSelect={(values) => {
                    setStandards(values);
                    setValidationError('');
                    setFilterError('');
                    setAvailableChapters([]);
                    setAvailableTopics([]);
                    setFiltersLoading(false);
                    setSelectedQuestions([]);
                    resetQuestionSearch();
                  }}
                  placeholder={moduleType ? 'Select standard(s)' : 'Select a module first'}
                  emptyText={!moduleType ? 'Choose a module type first' : undefined}
                  icon={{ ios: 'number', android: 'pin', web: 'pin' }}
                />
                <MultiSelectDropdown
                  label="Subject"
                  options={SUBJECTS}
                  selected={subjects}
                  onSelect={(values) => {
                    setSubjects(values);
                    setValidationError('');
                    setSelectedQuestions((current) => current.filter((question) => values.includes(question.subject)));
                    resetQuestionSearch();
                    if (questionSubject && !values.includes(questionSubject)) {
                      setQuestionSubject('');
                      setChapter('');
                      setTopic('');
                      setAvailableChapters([]);
                      setAvailableTopics([]);
                      setFiltersLoading(false);
                    }
                  }}
                  placeholder="Select subject(s)"
                  icon={{ ios: 'atom', android: 'science', web: 'science' }}
                />
              </View>

              {validationError ? (
                <Text accessibilityRole="alert" style={[styles.errorText, { color: palette.danger }]}>
                  {validationError}
                </Text>
              ) : null}

              <Pressable
                accessibilityRole="button"
                onPress={handleNext}
                style={({ pressed }) => [
                  styles.nextButton,
                  { backgroundColor: palette.primary },
                  pressed && styles.pressed,
                ]}>
                <Text style={[styles.nextButtonText, { color: palette.onPrimary }]}>Next</Text>
                <SymbolView
                  name={{ ios: 'arrow.right', android: 'arrow_forward', web: 'arrow_forward' }}
                  tintColor={palette.onPrimary}
                  size={17}
                />
              </Pressable>
            </>
          ) : (
              <View style={[styles.section, { backgroundColor: palette.card, borderColor: palette.border }]}>
                <View style={styles.sectionHeading}>
                  <View style={styles.sectionHeadingCopy}>
                    <Text style={[styles.sectionTitle, { color: palette.foreground }]}>Add questions</Text>
                    <Text style={[styles.sectionDescription, { color: palette.mutedForeground }]}>
                      Choose the criteria for questions in your paper.
                    </Text>
                  </View>
                  <View style={[styles.questionBadge, { backgroundColor: palette.primarySoft }]}>
                    <SymbolView
                      name={{ ios: 'plus', android: 'add', web: 'add' }}
                      tintColor={palette.primary}
                      size={16}
                    />
                  </View>
                </View>
                {filtersLoading ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator color={palette.primary} />
                    <Text style={[styles.loadingText, { color: palette.mutedForeground }]}>Loading available chapters and topics…</Text>
                  </View>
                ) : null}
                {filterError ? (
                  <Text accessibilityRole="alert" style={[styles.errorText, { color: palette.danger }]}>{filterError}</Text>
                ) : null}
                <DropdownSelect
                  label="Subject"
                  options={subjects}
                  selected={questionSubject}
                  placeholder="Select from the subjects above"
                  onSelect={(value) => {
                    const selectedSubject = value === 'All' ? '' : value;
                    setQuestionSubject(selectedSubject);
                    setChapter('');
                    setTopic('');
                    setAvailableChapters([]);
                    setAvailableTopics([]);
                    setFilterError('');
                    setFiltersLoading(!!selectedSubject);
                    resetQuestionSearch();
                  }}
                  emptyText="Select at least one subject in PDF details"
                  icon={{ ios: 'atom', android: 'science', web: 'science' }}
                />
                <DropdownSelect
                  label="Chapter"
                  options={availableChapters}
                  selected={chapter}
                  placeholder={questionSubject ? 'Select chapter' : 'Select a subject first'}
                  emptyText={
                    !questionSubject
                      ? 'Choose a subject first'
                      : !filtersLoading && availableChapters.length === 0
                        ? 'No chapters available for this selection'
                        : undefined
                  }
                  onSelect={(value) => {
                    setChapter(value === 'All' ? '' : value);
                    setTopic('');
                    setAvailableTopics([]);
                    setFilterError('');
                    setFiltersLoading(true);
                    resetQuestionSearch();
                  }}
                  icon={{ ios: 'book.closed', android: 'menu_book', web: 'menu_book' }}
                />
                <DropdownSelect
                  label="Topic"
                  options={availableTopics}
                  selected={topic}
                  placeholder={chapter ? 'Select topic' : 'Select a chapter first'}
                  emptyText={
                    !chapter
                      ? 'Choose a chapter first'
                      : !filtersLoading && availableTopics.length === 0
                        ? 'No topics available for this selection'
                        : undefined
                  }
                  onSelect={(value) => {
                    setTopic(value === 'All' ? '' : value);
                    resetQuestionSearch();
                  }}
                  icon={{ ios: 'text.alignleft', android: 'subject', web: 'subject' }}
                />
                <DropdownSelect
                  label="Level"
                  options={LEVELS}
                  selected={level}
                  placeholder="Select level"
                  onSelect={(value) => {
                    setLevel(value);
                    resetQuestionSearch();
                  }}
                  icon={{ ios: 'speedometer', android: 'speed', web: 'speed' }}
                />
                <DropdownSelect
                  label="MCQ year"
                  options={MCQ_YEARS}
                  selected={mcqYear}
                  placeholder="Select year"
                  onSelect={(value) => {
                    setMcqYear(value);
                    resetQuestionSearch();
                  }}
                  icon={{ ios: 'calendar', android: 'calendar_month', web: 'calendar_month' }}
                />
                <Text style={[styles.actionHint, { color: palette.mutedForeground }]}>
                  Search the question database using the filters selected above.
                </Text>
                <View style={styles.actions}>
                  {(['Search', 'Auto Generate', 'PDF Question'] as const).map((action) => {
                    const selected = actionMode === action;
                    return (
                      <Pressable
                        key={action}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        disabled={searchLoading}
                        onPress={() => {
                          if (action === 'Search') {
                            void handleSearch();
                          } else {
                            setActionMode(action);
                          }
                        }}
                        style={({ pressed }) => [
                          styles.actionButton,
                          {
                            backgroundColor: selected ? palette.primarySoft : palette.card,
                            borderColor: selected ? palette.primary : palette.border,
                          },
                          pressed && styles.pressed,
                        ]}>
                        <Text style={[
                          styles.actionButtonText,
                          { color: selected ? palette.primary : palette.foreground },
                        ]}>
                          {action}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                {searchLoading ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator color={palette.primary} />
                    <Text style={[styles.loadingText, { color: palette.mutedForeground }]}>Searching questions…</Text>
                  </View>
                ) : null}
                {searchError ? (
                  <Text accessibilityRole="alert" style={[styles.errorText, { color: palette.danger }]}>{searchError}</Text>
                ) : null}
                {actionMode ? (
                  <Text style={[styles.actionHint, { color: palette.mutedForeground }]}>
                    {actionMode === 'Search'
                      ? 'Search uses the current module, standards, subjects and question filters.'
                      : `${actionMode} is not connected yet. Use Search to find and select questions from the library.`}
                  </Text>
                ) : null}
                {!searchLoading && !searchError && searchResults.length === 0 ? (
                  <Text style={[styles.actionHint, { color: palette.mutedForeground }]}>
                    {actionMode === 'Search'
                      ? 'No questions found for the selected filters.'
                      : 'Press Search to find questions matching the selected filters.'}
                  </Text>
                ) : null}
                {searchResults.length > 0 ? (
                  <View style={styles.results}>
                    <View style={styles.resultsHeader}>
                      <Text style={[styles.resultsTitle, { color: palette.foreground }]}>
                        Search results ({searchResults.length})
                      </Text>
                      <Text style={[styles.resultsCount, { color: palette.primary }]}>
                        {selectedQuestions.length} selected
                      </Text>
                    </View>
                    {searchResults.map((question) => {
                      const selected = selectedQuestions.some((item) => item._id === question._id);
                      return (
                        <Pressable
                          key={question._id}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: selected }}
                          onPress={() => toggleQuestion(question)}
                          style={({ pressed }) => [
                            styles.resultCard,
                            {
                              backgroundColor: selected ? palette.primarySoft : palette.background,
                              borderColor: selected ? palette.primaryBorder : palette.border,
                              opacity: pressed ? 0.76 : 1,
                            },
                          ]}>
                          <View style={styles.resultCopy}>
                            <Text numberOfLines={3} style={[styles.resultQuestion, { color: palette.foreground }]}>
                              {question.questionText}
                            </Text>
                            <Text style={[styles.resultMeta, { color: palette.mutedForeground }]}>
                              {[question.subject, question.chapter, question.topic, question.difficulty, question.source].filter(Boolean).join(' · ')}
                            </Text>
                          </View>
                          <View style={[
                            styles.checkbox,
                            { backgroundColor: selected ? palette.primary : 'transparent', borderColor: selected ? palette.primary : palette.borderStrong },
                          ]}>
                            {selected ? (
                              <SymbolView
                                name={{ ios: 'checkmark', android: 'check', web: 'check' }}
                                tintColor={palette.onPrimary}
                                size={12}
                              />
                            ) : null}
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : null}
              </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  headerButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  headerCopy: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  headerSubtitle: { fontSize: 11, marginTop: 2 },
  headerSpacer: { width: 42 },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: 18, gap: 16, paddingBottom: 40 },
  welcomeCard: { alignItems: 'center', padding: 28, borderWidth: 1, borderRadius: 16, marginTop: 18 },
  heroIcon: { width: 72, height: 72, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  welcomeTitle: { fontSize: 22, fontWeight: '700', textAlign: 'center' },
  welcomeDescription: { fontSize: 14, lineHeight: 21, textAlign: 'center', maxWidth: 420, marginTop: 8, marginBottom: 22 },
  primaryButton: { minHeight: 48, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 10 },
  primaryButtonText: { fontSize: 14, fontWeight: '700' },
  nextButton: { minHeight: 48, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 10 },
  nextButtonText: { fontSize: 14, fontWeight: '700' },
  section: { padding: 18, borderWidth: 1, borderRadius: 14, gap: 16 },
  sectionTitle: { fontSize: 17, fontWeight: '700' },
  fieldLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginBottom: -10 },
  textInput: { minHeight: 46, borderWidth: 1, borderRadius: 9, paddingHorizontal: 13, fontSize: 14 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 2 },
  sectionHeadingCopy: { flex: 1 },
  sectionDescription: { fontSize: 12, lineHeight: 17, marginTop: 4 },
  questionBadge: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 9 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  actionButton: { flexGrow: 1, flexBasis: '30%', minHeight: 42, borderWidth: 1, borderRadius: 9, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' },
  actionButtonText: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
  actionHint: { fontSize: 12, lineHeight: 17, marginTop: -6 },
  errorText: { fontSize: 12, lineHeight: 18 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  loadingText: { fontSize: 12 },
  results: { gap: 9, marginTop: 4 },
  resultsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  resultsTitle: { fontSize: 14, fontWeight: '700' },
  resultsCount: { fontSize: 12, fontWeight: '700' },
  resultCard: { minHeight: 74, padding: 12, borderRadius: 10, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  resultCopy: { flex: 1, gap: 7 },
  resultQuestion: { fontSize: 13, lineHeight: 19, fontWeight: '500' },
  resultMeta: { fontSize: 10, lineHeight: 15 },
  checkbox: { width: 20, height: 20, borderWidth: 1, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.72 },
});
