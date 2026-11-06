import { memo, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Chips, ErrorView, Icon, Muted, MultiChips, usePalette } from '@/components/kit';
import { DropdownSelect } from '@/components/dropdown-select';
import { browseQuestions } from '@/services/pdf-questions';
import { hasQuestion, LEVELS, MAX_QUESTIONS, questionCount, type Level, type QuestionType, type Scope } from '@/screens/teacher/make-pdf/model';
import { QuestionPreview, questionMeta } from '@/screens/teacher/make-pdf/question-preview';
import { Footer } from '@/screens/teacher/make-pdf/ui';
import type { Question } from '@/types/pcmb';

const PAGE_SIZE = 20;
const LEVEL_LABELS: Partial<Record<Level, string>> = { Mid: 'Medium' };
const TYPE_LABELS: Record<QuestionType, string> = { any: 'Any type', MCQ: 'MCQ', Numerical: 'Numerical' };

/** How the picker is used: adding questions to the paper, or choosing one to take another's place. */
export type PickMode = { type: 'add' } | { type: 'replace'; question: Question };

interface Loaded {
  /** The filters these questions are for; an older answer is never shown for newer filters. */
  key: string;
  items: Question[];
  total: number;
  nextPage: number;
  hasMore: boolean;
  loading: boolean;
  more: boolean;
  error: string | null;
}

const EMPTY = (key: string): Loaded => ({ key, items: [], total: 0, nextPage: 1, hasMore: false, loading: true, more: false, error: null });

export const PickCard = memo(function PickCard({
  question,
  picked,
  replacing,
  disabled,
  onPress,
}: {
  question: Question;
  /** In the paper already. */
  picked: boolean;
  replacing: boolean;
  /** Can't be chosen now: the paper is full, or (replacing) the question is in it already. */
  disabled: boolean;
  onPress: (question: Question) => void;
}) {
  const palette = usePalette();
  const meta = questionMeta(question);
  return (
    <Pressable
      accessibilityRole={replacing ? 'button' : 'checkbox'}
      accessibilityState={replacing ? { disabled } : { checked: picked, disabled }}
      accessibilityLabel={replacing ? `Use this question instead. ${meta}` : `${picked ? 'Remove' : 'Add'} question. ${meta}`}
      disabled={disabled}
      onPress={() => onPress(question)}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: picked && !replacing ? palette.primarySoft : palette.card,
          borderColor: picked && !replacing ? palette.primary : palette.border,
          borderWidth: picked && !replacing ? 1.5 : 1,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={styles.cardTop}>
        {replacing ? (
          <View style={[styles.useBadge, { backgroundColor: disabled ? palette.secondary : palette.primarySoft }]}>
            <Text style={[styles.useText, { color: disabled ? palette.mutedForeground : palette.primaryInk }]}>{disabled ? 'Already in your paper' : 'Use this one'}</Text>
          </View>
        ) : (
          <View style={[styles.checkbox, { backgroundColor: picked ? palette.primary : 'transparent', borderColor: picked ? palette.primary : palette.borderStrong }]}>
            {picked ? <Icon name={{ ios: 'checkmark', android: 'check' }} color={palette.onPrimary} size={13} /> : null}
          </View>
        )}
        <Text style={[styles.meta, { color: palette.mutedForeground }]} numberOfLines={2}>
          {meta}
        </Text>
      </View>
      <QuestionPreview question={question} />
    </Pressable>
  );
});

/**
 * Browses the chosen exam's questions for the scope, a page at a time as the
 * teacher scrolls, with search and filters; adds and removes questions, or (in
 * replace mode) picks the one question that takes another's place. Questions
 * come from the question bank as they are: nothing here edits them.
 */
export function ManualPicker({
  scope,
  chapters,
  selected,
  mode,
  onToggle,
  onReplace,
  onDone,
  bottomInset,
}: {
  scope: Scope;
  /** Every chapter of the subject that has questions, to narrow to one. */
  chapters: string[];
  selected: Question[];
  mode: PickMode;
  onToggle: (question: Question) => void;
  onReplace: (question: Question) => void;
  /** Add mode: back to the review. Replace mode: leave without replacing. */
  onDone: () => void;
  bottomInset: number;
}) {
  const palette = usePalette();
  const replacing = mode.type === 'replace';
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [levels, setLevels] = useState<Level[]>([]);
  const [type, setType] = useState<QuestionType>('any');
  // Replacing starts in the chapter of the question being replaced, which is usually what's wanted.
  const [chapter, setChapter] = useState(() => (mode.type === 'replace' && chapters.includes(mode.question.chapter) ? mode.question.chapter : ''));

  useEffect(() => {
    const timer = setTimeout(() => setSearch(query), 400);
    return () => clearTimeout(timer);
  }, [query]);

  const request = useMemo(
    () => ({
      exam: scope.exam,
      subject: scope.subject,
      chapters: chapter ? [chapter] : scope.chapters,
      topics: chapter ? [] : scope.topics,
      levels,
      type,
      search,
    }),
    [chapter, levels, scope.chapters, scope.exam, scope.subject, scope.topics, search, type]
  );
  const key = JSON.stringify(request);
  const [loaded, setLoaded] = useState<Loaded>(() => EMPTY(''));
  const [retry, setRetry] = useState(0);
  // What the questions in `loaded` are for: other filters (or a retry) show nothing of them, so no stale page ever appears.
  const loadKey = `${key}#${retry}`;

  // New filters start from the first page again.
  useEffect(() => {
    let cancelled = false;
    browseQuestions({ ...request, page: 1, limit: PAGE_SIZE }).then(
      (page) => {
        if (!cancelled) setLoaded({ key: loadKey, items: page.questions, total: page.total, nextPage: 2, hasMore: page.hasMore, loading: false, more: false, error: null });
      },
      (error: unknown) => {
        if (!cancelled) setLoaded({ ...EMPTY(loadKey), loading: false, error: error instanceof Error ? error.message : 'Could not load questions.' });
      }
    );
    return () => {
      cancelled = true;
    };
  }, [loadKey, request]);

  const loadMore = () => {
    if (loaded.key !== loadKey || !loaded.hasMore || loaded.loading || loaded.more) return;
    const asked = loaded.nextPage;
    setLoaded((current) => (current.key === loadKey ? { ...current, more: true } : current));
    browseQuestions({ ...request, page: asked, limit: PAGE_SIZE }).then(
      (page) =>
        setLoaded((current) => {
          if (current.key !== loadKey) return current;
          const have = new Set(current.items.map((item) => item._id));
          return {
            ...current,
            items: [...current.items, ...page.questions.filter((item) => !have.has(item._id))],
            total: page.total,
            nextPage: asked + 1,
            hasMore: page.hasMore,
            more: false,
          };
        }),
      (error: unknown) =>
        setLoaded((current) => (current.key === loadKey ? { ...current, more: false, hasMore: false, error: error instanceof Error ? error.message : 'Could not load more questions.' } : current))
    );
  };

  const full = selected.length >= MAX_QUESTIONS;
  const chapterOptions = chapters.filter((name) => scope.chapters.length === 0 || scope.chapters.includes(name));
  const replacingId = mode.type === 'replace' ? mode.question._id : '';
  const showing = loaded.key === loadKey ? loaded : EMPTY(loadKey);
  // Replace mode never offers the question being replaced as its own replacement.
  const items = replacing ? showing.items.filter((item) => item._id !== replacingId) : showing.items;

  const header = (
    <View style={styles.header}>
      {replacing ? (
        <Text style={[styles.hint, { color: palette.foreground }]}>Choose the question that should take the place of the one you are replacing. It keeps the same position in the paper.</Text>
      ) : null}
      <View style={[styles.search, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <Icon name={{ ios: 'magnifyingglass', android: 'search' }} color={palette.mutedForeground} size={17} />
        <TextInput
          accessibilityLabel="Search questions"
          value={query}
          onChangeText={setQuery}
          placeholder="Search questions, formulas, topics…"
          placeholderTextColor={palette.mutedForeground}
          returnKeyType="search"
          autoCorrect={false}
          style={[styles.searchInput, { color: palette.foreground }]}
        />
        {query ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={8} onPress={() => setQuery('')}>
            <Icon name={{ ios: 'xmark.circle.fill', android: 'cancel' }} color={palette.mutedForeground} size={18} />
          </Pressable>
        ) : null}
      </View>
      {chapterOptions.length > 1 ? (
        <DropdownSelect
          label="Chapter"
          options={chapterOptions}
          selected={chapter}
          placeholder={scope.chapters.length ? 'Your chosen chapters' : 'All chapters'}
          onSelect={(value) => setChapter(value === 'All' ? '' : value)}
          searchable
          icon={{ ios: 'book', android: 'menu_book', web: 'menu_book' }}
        />
      ) : null}
      <MultiChips label="Level" choices={LEVELS} labels={LEVEL_LABELS} selected={levels} onChange={setLevels} />
      <Chips label="Type" choices={['any', 'MCQ', 'Numerical'] as const} labels={TYPE_LABELS} selected={type} onChange={setType} />
      <Text accessibilityLiveRegion="polite" style={[styles.count, { color: palette.mutedForeground }]}>
        {showing.loading ? 'Finding questions…' : showing.error && items.length === 0 ? '' : `${showing.total.toLocaleString()} question${showing.total === 1 ? '' : 's'} found`}
      </Text>
    </View>
  );

  return (
    <>
      <FlatList
        data={items}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <PickCard
            question={item}
            picked={hasQuestion(selected, item._id)}
            replacing={replacing}
            disabled={replacing ? hasQuestion(selected, item._id) : full && !hasQuestion(selected, item._id)}
            onPress={replacing ? onReplace : onToggle}
          />
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={
          showing.loading ? (
            <View style={styles.state}>
              <ActivityIndicator color={palette.primary} />
            </View>
          ) : showing.error ? (
            <ErrorView message={showing.error} onRetry={() => setRetry((n) => n + 1)} />
          ) : (
            <View style={styles.state}>
              <Text style={[styles.emptyTitle, { color: palette.foreground }]}>No questions found</Text>
              <Muted>Try other filters or a different search. Only this exam&apos;s questions in your chapters are listed.</Muted>
            </View>
          )
        }
        ListFooterComponent={
          showing.more ? (
            <View style={styles.more}>
              <ActivityIndicator color={palette.primary} />
            </View>
          ) : showing.error && items.length > 0 ? (
            <ErrorView message={showing.error} onRetry={() => setRetry((n) => n + 1)} />
          ) : undefined
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.6}
        initialNumToRender={4}
        maxToRenderPerBatch={4}
        windowSize={5}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />
      <Footer inset={bottomInset}>
        {replacing ? (
          <Button label="Cancel" variant="secondary" onPress={onDone} />
        ) : (
          <>
            {full ? <Muted>A PDF holds up to {MAX_QUESTIONS} questions, so no more can be added.</Muted> : null}
            <Button label={selected.length ? `Review ${questionCount(selected.length)}` : 'Pick at least one question'} icon={{ ios: 'checklist', android: 'checklist' }} disabled={selected.length === 0} onPress={onDone} />
          </>
        )}
      </Footer>
    </>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 12, paddingBottom: 24 },
  header: { gap: 12, marginBottom: 4 },
  hint: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.2, borderRadius: 10, paddingHorizontal: 12, minHeight: 46 },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 8 },
  count: { fontSize: 13 },
  card: { borderRadius: 12, padding: 12, gap: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  useBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  useText: { fontSize: 12, fontWeight: '700' },
  meta: { flex: 1, fontSize: 12, lineHeight: 16 },
  state: { alignItems: 'center', gap: 8, paddingVertical: 36, paddingHorizontal: 16 },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  more: { paddingVertical: 16 },
});
