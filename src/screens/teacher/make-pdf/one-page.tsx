import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Button, ErrorView, Icon, LoadingView, Muted, Notice, Segmented, useLoad, usePalette } from '@/components/kit';
import { DropdownSelect } from '@/components/dropdown-select';
import { MultiSelectDropdown } from '@/components/multi-select-dropdown';
import { ApiError } from '@/services/api-client';
import { fetchBankOptions, fetchBankPage, fetchBankRandom, verifyBankQuestions } from '@/services/pdf-questions';
import {
  bankBody,
  bankKey,
  bankMissing,
  bankReady,
  CLASSES,
  COMPETITIVE_EXAMS,
  COURSES,
  hasPyqs,
  keepSelected,
  subjectsOf,
  withChapters,
  withClass,
  withCourse,
  withExam,
  withSource,
  withSubject,
  type BankScope,
  type Course,
  type QuestionSource,
} from '@/screens/teacher/make-pdf/bank-scope';
import { PickCard } from '@/screens/teacher/make-pdf/manual-picker';
import { addQuestions, MAX_QUESTIONS, questionCount, removeQuestion, type PdfKind } from '@/screens/teacher/make-pdf/model';
import { CountField, Group, StepLayout } from '@/screens/teacher/make-pdf/ui';
import type { Question } from '@/types/pcmb';

const PAGE_SIZE = 10;
const KIND_OPTIONS = [
  { value: 'exam' as const, label: 'Exam PDF' },
  { value: 'smart' as const, label: 'Smart PDF' },
];
const SOURCE_OPTIONS = [
  { value: 'regular' as const, label: 'Regular questions' },
  { value: 'pyq' as const, label: 'PYQs' },
];

interface Browsed {
  key: string;
  items: Question[];
  total: number;
  nextPage: number;
  hasMore: boolean;
  loading: boolean;
  more: boolean;
  error: string | null;
}
const EMPTY = (key: string): Browsed => ({ key, items: [], total: 0, nextPage: 1, hasMore: false, loading: true, more: false, error: null });

const errorText = (error: unknown, fallback: string) => (error instanceof ApiError || error instanceof Error ? error.message : fallback);

/**
 * Make PDF's one screen for choosing questions: course, class, exam, subject,
 * source, chapters, topics and years, then the matching MCQs to browse and pick
 * (or a number chosen at random), all in one scroll. Fields appear only once the
 * ones before them are chosen; changing one clears only what no longer fits.
 * Questions are read from the bank a page at a time and never changed. Continue
 * hands the exact questions, checked again by the server, to the PDF settings.
 */
export function OnePageSelect({
  kind,
  onKind,
  scope,
  onScope,
  selected,
  onSelected,
  count,
  onCount,
  onContinue,
  bottomInset,
}: {
  kind: PdfKind;
  onKind: (kind: PdfKind) => void;
  scope: BankScope;
  onScope: (scope: BankScope) => void;
  selected: Question[];
  onSelected: (questions: Question[]) => void;
  count: number;
  onCount: (count: number) => void;
  onContinue: (questions: Question[]) => void;
  bottomInset: number;
}) {
  const palette = usePalette();
  const ready = bankReady(scope);
  const key = bankKey(scope);
  const body = useMemo(() => bankBody(scope), [scope]);

  const options = useLoad(async () => ({ key, data: await fetchBankOptions(body) }), [key], { enabled: ready });
  const fresh = options.data && options.data.key === key ? options.data.data : null;
  // While narrower chapters, topics or years load, the lists stay put, so an open dropdown isn't torn down.
  const base = [scope.course, scope.standard, scope.exam, scope.subject, scope.source].join('|');
  const [kept, setKept] = useState<{ base: string; data: NonNullable<typeof fresh> } | null>(null);
  if (fresh && kept?.data !== fresh) setKept({ base, data: fresh });
  const data = fresh ?? (ready && kept?.base === base ? kept.data : null);
  const optionsLoading = ready && !data && !options.error;

  const topicSections = useMemo(() => {
    if (!data) return [];
    const chosen = new Set(scope.chapters.map((chapter) => chapter.toLowerCase()));
    return data.chapters
      .filter((chapter) => !chosen.size || chosen.has(chapter.name.toLowerCase()))
      .map((chapter) => ({
        title: chapter.name,
        options: data.topics.filter((topic) => topic.chapter.toLowerCase() === chapter.name.toLowerCase()).map((topic) => topic.name),
      }))
      .filter((section) => section.options.length > 0);
  }, [data, scope.chapters]);
  const topicOptions = useMemo(() => [...new Set(topicSections.flatMap((section) => section.options))], [topicSections]);
  const counts = (rows: { name: string; count: number }[] | undefined) => Object.fromEntries((rows ?? []).map((row) => [row.name, row.count]));

  const [message, setMessage] = useState<{ tone: 'warning' | 'info'; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [browsing, setBrowsing] = useState(false);

  // Changing a choice takes out the picked questions that no longer fit, and says so.
  const change = (next: BankScope) => {
    const kept = keepSelected(selected, scope, next);
    onScope(next);
    setError(null);
    setMessage(
      kept.length < selected.length
        ? { tone: 'warning', text: `${questionCount(selected.length - kept.length)} no longer matched your choices, so ${selected.length - kept.length === 1 ? 'it was' : 'they were'} taken out.` }
        : null
    );
    if (kept.length < selected.length) onSelected(kept);
  };

  const [browsed, setBrowsed] = useState<Browsed>(() => EMPTY(''));
  const [retry, setRetry] = useState(0);
  const browseKey = `${key}#${retry}`;
  useEffect(() => {
    if (!browsing || !ready) return;
    let cancelled = false;
    fetchBankPage(body, 1, PAGE_SIZE).then(
      (page) => !cancelled && setBrowsed({ key: browseKey, items: page.questions, total: page.total, nextPage: 2, hasMore: page.hasMore, loading: false, more: false, error: null }),
      (e: unknown) => !cancelled && setBrowsed({ ...EMPTY(browseKey), loading: false, error: errorText(e, 'Could not load questions.') })
    );
    return () => {
      cancelled = true;
    };
  }, [browsing, ready, body, browseKey]);
  const showing = browsed.key === browseKey ? browsed : EMPTY(browseKey);

  const loadMore = () => {
    if (showing.loading || showing.more || !showing.hasMore) return;
    const asked = showing.nextPage;
    setBrowsed((current) => (current.key === browseKey ? { ...current, more: true } : current));
    fetchBankPage(body, asked, PAGE_SIZE).then(
      (page) =>
        setBrowsed((current) => {
          if (current.key !== browseKey) return current;
          const have = new Set(current.items.map((item) => item._id));
          return { ...current, items: [...current.items, ...page.questions.filter((item) => !have.has(item._id))], total: page.total, nextPage: asked + 1, hasMore: page.hasMore, more: false };
        }),
      (e: unknown) => setBrowsed((current) => (current.key === browseKey ? { ...current, more: false, error: errorText(e, 'Could not load more questions.') } : current))
    );
  };

  const toggle = (question: Question) => {
    setMessage(null);
    onSelected(selected.some((item) => item._id === question._id) ? removeQuestion(selected, question._id) : addQuestions(selected, [question]).list);
  };

  const total = data?.total ?? 0;
  const countValid = Number.isInteger(count) && count >= 1 && count <= MAX_QUESTIONS;
  const missing = bankMissing(scope);

  /** Replaces the selection with `count` random questions from the scope. Returns how many the server found. */
  const pickRandom = async () => {
    const found = await fetchBankRandom(body, count, []);
    onSelected(found);
    return found;
  };

  const randomNow = async () => {
    if (!ready || !countValid || working) return;
    setWorking(true);
    setError(null);
    try {
      const found = await pickRandom();
      setMessage(
        found.length < count
          ? { tone: 'warning', text: `Only ${questionCount(found.length)} match these choices, so all of them were selected.` }
          : { tone: 'info', text: `${questionCount(found.length)} chosen at random. Browse to swap any you don't want.` }
      );
    } catch (e) {
      setError(errorText(e, 'Could not choose questions. Try again.'));
    } finally {
      setWorking(false);
    }
  };

  const generate = async () => {
    if (!ready || working) return;
    if (selected.length === 0 && !countValid) return;
    setWorking(true);
    setError(null);
    setMessage(null);
    try {
      let questions: Question[];
      if (selected.length > 0) {
        // The server has the last word on which picked questions belong to these choices.
        const checked = await verifyBankQuestions(body, selected.map((question) => question._id));
        questions = checked.questions;
        if (checked.dropped > 0) {
          onSelected(questions);
          setMessage({ tone: 'warning', text: `${questionCount(checked.dropped)} no longer matched your choices and ${checked.dropped === 1 ? 'was' : 'were'} taken out. Check the rest, then continue.` });
          return;
        }
      } else {
        questions = await pickRandom();
        if (questions.length < count && questions.length > 0) {
          setMessage({ tone: 'warning', text: `Only ${questionCount(questions.length)} match these choices, so all of them were selected. Continue to use them.` });
          return;
        }
      }
      if (questions.length === 0) {
        setError('No questions match these choices. Try other chapters or topics.');
        return;
      }
      onContinue(questions);
    } catch (e) {
      setError(errorText(e, 'Could not get the questions. Try again.'));
    } finally {
      setWorking(false);
    }
  };

  const canGenerate = ready && !working && (selected.length > 0 || (countValid && total > 0));

  return (
    <StepLayout
      inset={bottomInset}
      footer={
        <>
          {error ? <Notice tone="danger" text={error} live /> : null}
          {message ? <Notice tone={message.tone} text={message.text} live /> : null}
          <Button
            label={selected.length > 0 ? `Generate PDF (${questionCount(selected.length)})` : countValid ? `Generate PDF (${count} random)` : 'Generate PDF'}
            icon={{ ios: 'doc.badge.plus', android: 'note_add' }}
            loading={working}
            disabled={!canGenerate}
            onPress={() => void generate()}
          />
          {!canGenerate && !working ? <Muted>{missing ?? (total === 0 && data ? 'No questions to choose from yet.' : !countValid ? `Enter 1 to ${MAX_QUESTIONS} questions.` : 'Loading…')}</Muted> : null}
        </>
      }
    >
      <Group title="Make PDF">
        <Segmented label="PDF type" options={KIND_OPTIONS} value={kind} onChange={onKind} />



        <DropdownSelect
          label="Course type"
          required
          options={[...COURSES]}
          selected={scope.course}
          placeholder="Select course type"
          onSelect={(course) => change(withCourse(scope, course as Course))}
          icon={{ ios: 'books.vertical', android: 'library_books', web: 'library_books' }}
        />

        {scope.course ? (
          <DropdownSelect
            label="Class"
            required
            options={[...CLASSES[scope.course]]}
            selected={scope.standard}
            placeholder="Select class"
            onSelect={(standard) => change(withClass(scope, standard))}
            icon={{ ios: 'graduationcap', android: 'school', web: 'school' }}
          />
        ) : null}

        {scope.course === 'Competitive' && scope.standard ? (
          <DropdownSelect
            label="Exam"
            required
            options={[...COMPETITIVE_EXAMS]}
            selected={scope.exam}
            placeholder="Select exam"
            onSelect={(exam) => change(withExam(scope, exam as 'JEE' | 'NEET'))}
            icon={{ ios: 'target', android: 'flag', web: 'flag' }}
          />
        ) : null}

        {scope.standard && (scope.course === 'Foundation' || scope.exam) ? (
          <DropdownSelect
            label="Subject"
            required
            options={subjectsOf(scope)}
            selected={scope.subject}
            placeholder="Select subject"
            onSelect={(subject) => change(withSubject(scope, subject))}
            icon={{ ios: 'atom', android: 'science', web: 'science' }}
          />
        ) : null}

        {ready && hasPyqs(scope) ? (
          <Segmented<QuestionSource> label="Question source" options={SOURCE_OPTIONS} value={scope.source} onChange={(source) => change(withSource(scope, source))} />
        ) : null}
        {ready && !hasPyqs(scope) ? <Muted>Foundation has regular MCQs only; previous-year questions aren&apos;t available for it yet.</Muted> : null}

      {ready ? (
        <>
          {optionsLoading ? <LoadingView label="Loading chapters…" /> : null}
          {options.error && !data ? <ErrorView message={options.error} onRetry={options.reload} /> : null}
          {data ? (
            <>
              <MultiSelectDropdown
                label="Chapters"
                options={data.chapters.map((chapter) => chapter.name)}
                counts={counts(data.chapters)}
                selected={scope.chapters}
                onSelect={(chapters) => change(withChapters(scope, data.chapters.map((c) => c.name).filter((name) => chapters.includes(name)), data.topics))}
                placeholder="All chapters"
                emptyText="No questions for these choices yet"
                allWhenNone
                applyOnDone
                searchable
                icon={{ ios: 'book', android: 'menu_book', web: 'menu_book' }}
              />
              {topicOptions.length > 0 ? (
                <MultiSelectDropdown
                  label="Topics"
                  options={topicOptions}
                  sections={topicSections}
                  counts={counts(data.topics)}
                  selected={scope.topics}
                  onSelect={(topics) => change({ ...scope, topics: topicOptions.filter((topic) => topics.includes(topic)) })}
                  placeholder="All topics"
                  emptyText="No topics for these chapters"
                  allWhenNone
                applyOnDone
                  searchable
                  icon={{ ios: 'list.bullet', android: 'list', web: 'list' }}
                />
              ) : null}
              {scope.source === 'pyq' ? (
                data.years.length > 0 ? (
                  <MultiSelectDropdown
                    label="PYQ years"
                    options={data.years.map((year) => year.name)}
                    counts={counts(data.years)}
                    selected={scope.years}
                    onSelect={(years) => change({ ...scope, years: data.years.map((y) => y.name).filter((name) => years.includes(name)) })}
                    placeholder="All years"
                    allWhenNone
                applyOnDone
                    searchable
                    icon={{ ios: 'calendar', android: 'event', web: 'event' }}
                  />
                ) : null
              ) : null}
              <Text accessibilityLiveRegion="polite" style={{ color: palette.foreground, fontSize: 14, fontWeight: '700' }}>
                Available questions: {data.total.toLocaleString()}
              </Text>
              {data.total === 0 ? (
                <Notice
                  tone="warning"
                  title="No questions for these choices"
                  text={scope.source === 'pyq' ? 'No verified previous-year MCQs match. Try other years or chapters, or use regular questions.' : 'The question bank has no MCQs for these choices. Try other chapters or topics.'}
                />
              ) : null}
            </>
          ) : null}
        </>
      ) : null}

      {ready && data && data.total > 0 ? (
        <>
          <CountField label="Number of questions" value={count} onChange={onCount} min={1} max={MAX_QUESTIONS} hint="Used to pick at random, or when nothing is picked by hand." />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Button label={browsing ? 'Hide questions' : 'Browse questions'} variant="secondary" icon={{ ios: 'list.bullet.rectangle', android: 'list_alt' }} onPress={() => setBrowsing((open) => !open)} />
            </View>
            <View style={{ flex: 1 }}>
              <Button label="Pick randomly" variant="tonal" icon={{ ios: 'dice', android: 'casino' }} disabled={!countValid || working} onPress={() => void randomNow()} />
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text accessibilityLiveRegion="polite" style={{ color: palette.foreground, fontSize: 14, fontWeight: '700' }}>
              Selected questions: {selected.length}
            </Text>
            {selected.length > 0 ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Clear selected questions" hitSlop={8} onPress={() => onSelected([])}>
                <Text style={{ color: palette.primary, fontSize: 14, fontWeight: '600' }}>Clear</Text>
              </Pressable>
            ) : null}
          </View>
          {selected.map((question, index) => (
            <View key={question._id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ color: palette.mutedForeground, fontSize: 12, width: 24 }}>{index + 1}.</Text>
              <Text numberOfLines={1} style={{ flex: 1, color: palette.foreground, fontSize: 13 }}>
                {[question.chapter, question.questionText.replace(/\s+/g, ' ')].filter(Boolean).join(' · ')}
              </Text>
              <Pressable accessibilityRole="button" accessibilityLabel={`Remove question ${index + 1}`} hitSlop={10} onPress={() => toggle(question)}>
                <Icon name={{ ios: 'xmark.circle.fill', android: 'cancel' }} color={palette.mutedForeground} size={18} />
              </Pressable>
            </View>
          ))}
        </>
      ) : null}
      </Group>

      {browsing && ready && data && data.total > 0 ? (
        <View style={{ gap: 12 }}>
          <Text accessibilityLiveRegion="polite" style={{ color: palette.mutedForeground, fontSize: 13 }}>
            {showing.loading ? 'Finding questions…' : `${showing.total.toLocaleString()} question${showing.total === 1 ? '' : 's'} found`}
          </Text>
          {showing.loading ? <ActivityIndicator color={palette.primary} /> : null}
          {showing.error && showing.items.length === 0 ? <ErrorView message={showing.error} onRetry={() => setRetry((n) => n + 1)} /> : null}
          {showing.items.map((item) => {
            const picked = selected.some((question) => question._id === item._id);
            return <PickCard key={item._id} question={item} picked={picked} replacing={false} disabled={!picked && selected.length >= MAX_QUESTIONS} onPress={toggle} />;
          })}
          {showing.more ? <ActivityIndicator color={palette.primary} /> : null}
          {showing.hasMore && !showing.more ? <Button label="Load more questions" variant="secondary" onPress={loadMore} /> : null}
          {showing.error && showing.items.length > 0 ? <Muted>{showing.error}</Muted> : null}
          {!showing.loading && !showing.error && showing.items.length === 0 ? <Muted>No questions found for these choices.</Muted> : null}
        </View>
      ) : null}
    </StepLayout>
  );
}
