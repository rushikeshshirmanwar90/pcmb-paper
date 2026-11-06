import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { DropdownSelect } from '@/components/dropdown-select';
import { MultiSelectDropdown } from '@/components/multi-select-dropdown';
import { Button, ErrorView, Icon, LoadingView, Muted, Notice, useLoad, usePalette } from '@/components/kit';
import { ApiError } from '@/services/api-client';
import { fetchBankOptions, fetchBankPage, fetchBankRandom } from '@/services/pdf-questions';
import { bankBody, bankKey, keepSelected, withChapters, type BankScope, type QuestionSource } from '@/screens/teacher/make-pdf/bank-scope';
import { PickCard } from '@/screens/teacher/make-pdf/manual-picker';
import { addQuestions, MAX_QUESTIONS, questionCount, removeQuestion } from '@/screens/teacher/make-pdf/model';
import { CountField } from '@/screens/teacher/make-pdf/ui';
import type { Question } from '@/types/pcmb';

const PAGE_SIZE = 10;
const SOURCES: Record<QuestionSource, string> = { regular: 'Regular Questions', pyq: 'PYQs' };

interface Browsed { key: string; items: Question[]; total: number; nextPage: number; hasMore: boolean; loading: boolean; more: boolean; error: string | null }
const EMPTY = (key: string): Browsed => ({ key, items: [], total: 0, nextPage: 1, hasMore: false, loading: true, more: false, error: null });
const errorText = (error: unknown, fallback: string) => (error instanceof ApiError || error instanceof Error ? error.message : fallback);

/**
 * Question selection for a test, inline on the first page. It reads the same question bank as
 * Make PDF (chapters, topics, PYQ years, counts, pages, random picks) for a scope the batches
 * decide; the server checks the picked ids again when the test is created. Questions are never changed.
 */
export function QuestionPicker({ scope, onScope, selected, onSelected, count, onCount }: {
  scope: BankScope;
  onScope: (scope: BankScope) => void;
  selected: Question[];
  onSelected: (questions: Question[]) => void;
  count: number;
  onCount: (count: number) => void;
}) {
  const palette = usePalette();
  const key = bankKey(scope);
  const body = useMemo(() => bankBody(scope), [scope]);
  const options = useLoad(async () => ({ key, data: await fetchBankOptions(body) }), [key]);
  const fresh = options.data && options.data.key === key ? options.data.data : null;
  // While narrower filters load, the lists stay put, so an open dropdown isn't torn down.
  const [kept, setKept] = useState<NonNullable<typeof fresh> | null>(null);
  if (fresh && kept !== fresh) setKept(fresh);
  const data = fresh ?? kept;

  const topicSections = useMemo(() => {
    if (!data) return [];
    const chosen = new Set(scope.chapters.map((c) => c.toLowerCase()));
    return data.chapters
      .filter((c) => !chosen.size || chosen.has(c.name.toLowerCase()))
      .map((c) => ({ title: c.name, options: data.topics.filter((t) => t.chapter.toLowerCase() === c.name.toLowerCase()).map((t) => t.name) }))
      .filter((s) => s.options.length > 0);
  }, [data, scope.chapters]);
  const topicOptions = useMemo(() => [...new Set(topicSections.flatMap((s) => s.options))], [topicSections]);
  const counts = (rows: { name: string; count: number }[] | undefined) => Object.fromEntries((rows ?? []).map((r) => [r.name, r.count]));

  const [message, setMessage] = useState<{ tone: 'warning' | 'info'; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [browsing, setBrowsing] = useState(false);
  const [editing, setEditing] = useState(false);

  // Changing a filter takes out the picked questions that no longer fit, and says so.
  const change = (next: BankScope) => {
    const stay = keepSelected(selected, scope, next);
    onScope(next);
    setError(null);
    setMessage(stay.length < selected.length ? { tone: 'warning', text: `${questionCount(selected.length - stay.length)} no longer matched your choices, so ${selected.length - stay.length === 1 ? 'it was' : 'they were'} taken out.` } : null);
    if (stay.length < selected.length) onSelected(stay);
  };

  const [browsed, setBrowsed] = useState<Browsed>(() => EMPTY(''));
  const [retry, setRetry] = useState(0);
  const browseKey = `${key}#${retry}`;
  useEffect(() => {
    if (!browsing) return;
    let cancelled = false;
    fetchBankPage(body, 1, PAGE_SIZE).then(
      (page) => !cancelled && setBrowsed({ key: browseKey, items: page.questions, total: page.total, nextPage: 2, hasMore: page.hasMore, loading: false, more: false, error: null }),
      (e: unknown) => !cancelled && setBrowsed({ ...EMPTY(browseKey), loading: false, error: errorText(e, 'Could not load questions.') })
    );
    return () => { cancelled = true; };
  }, [browsing, body, browseKey]);
  const showing = browsed.key === browseKey ? browsed : EMPTY(browseKey);

  const loadMore = () => {
    if (showing.loading || showing.more || !showing.hasMore) return;
    const asked = showing.nextPage;
    setBrowsed((c) => (c.key === browseKey ? { ...c, more: true } : c));
    fetchBankPage(body, asked, PAGE_SIZE).then(
      (page) => setBrowsed((c) => {
        if (c.key !== browseKey) return c;
        const have = new Set(c.items.map((i) => i._id));
        return { ...c, items: [...c.items, ...page.questions.filter((i) => !have.has(i._id))], total: page.total, nextPage: asked + 1, hasMore: page.hasMore, more: false };
      }),
      (e: unknown) => setBrowsed((c) => (c.key === browseKey ? { ...c, more: false, error: errorText(e, 'Could not load more questions.') } : c))
    );
  };

  const toggle = (question: Question) => {
    setMessage(null);
    onSelected(selected.some((i) => i._id === question._id) ? removeQuestion(selected, question._id) : addQuestions(selected, [question]).list);
  };

  const countValid = Number.isInteger(count) && count >= 1 && count <= MAX_QUESTIONS;

  const randomNow = async () => {
    if (!countValid || working) return;
    setWorking(true);
    setError(null);
    try {
      const found = await fetchBankRandom(body, count, []);
      onSelected(found);
      setMessage(found.length < count
        ? { tone: 'warning', text: `Only ${questionCount(found.length)} match these choices, so all of them were selected.` }
        : { tone: 'info', text: `${questionCount(found.length)} chosen at random. Browse to swap any you don't want.` });
    } catch (e) {
      setError(errorText(e, 'Could not choose questions. Try again.'));
    } finally {
      setWorking(false);
    }
  };

  const chapterSummary = [...new Set(selected.map((q) => q.chapter).filter(Boolean))];

  return (
    <View style={{ gap: 14 }}>
      <DropdownSelect
        label="Question Source"
        required
        options={Object.values(SOURCES)}
        selected={SOURCES[scope.source]}
        onSelect={(v) => change({ ...scope, source: v === SOURCES.pyq ? 'pyq' : 'regular', chapters: [], topics: [], years: [] })}
      />
      {options.loading && !data ? <LoadingView label="Loading chapters…" /> : null}
      {options.error && !data ? <ErrorView message={options.error} onRetry={options.reload} /> : null}
      {data ? (
        <>
          <MultiSelectDropdown
            label="Chapters"
            options={data.chapters.map((c) => c.name)}
            counts={counts(data.chapters)}
            selected={scope.chapters}
            onSelect={(chapters) => change(withChapters(scope, data.chapters.map((c) => c.name).filter((n) => chapters.includes(n)), data.topics))}
            placeholder="All chapters"
            emptyText="No questions for these choices yet"
            selectedLabel={(n) => `${n} Chapter${n === 1 ? '' : 's'} Selected`}
            allWhenNone applyOnDone searchable
            icon={{ ios: 'book', android: 'menu_book', web: 'menu_book' }}
          />
          {topicOptions.length > 0 ? (
            <MultiSelectDropdown
              label="Topics"
              options={topicOptions}
              sections={topicSections}
              counts={counts(data.topics)}
              selected={scope.topics}
              onSelect={(topics) => change({ ...scope, topics: topicOptions.filter((t) => topics.includes(t)) })}
              placeholder="All topics"
              emptyText="No topics for these chapters"
              selectedLabel={(n) => `${n} Topic${n === 1 ? '' : 's'} Selected`}
              allWhenNone applyOnDone searchable
              icon={{ ios: 'list.bullet', android: 'list', web: 'list' }}
            />
          ) : null}
          {scope.source === 'pyq' && data.years.length > 0 ? (
            <MultiSelectDropdown
              label="PYQ Years"
              options={data.years.map((y) => y.name)}
              counts={counts(data.years)}
              selected={scope.years}
              onSelect={(years) => change({ ...scope, years: data.years.map((y) => y.name).filter((n) => years.includes(n)) })}
              placeholder="All years"
              selectedLabel={(n) => `${n} Year${n === 1 ? '' : 's'} Selected`}
              allWhenNone applyOnDone searchable
              icon={{ ios: 'calendar', android: 'event', web: 'event' }}
            />
          ) : null}
          <Text accessibilityLiveRegion="polite" style={{ color: palette.foreground, fontSize: 14, fontWeight: '700' }}>Available MCQs: {data.total.toLocaleString()}</Text>
          {data.total === 0 ? (
            <Notice tone="warning" title="No questions for these choices" text={scope.source === 'pyq' ? 'No verified previous-year MCQs match. Try other years or chapters, or use regular questions.' : 'The question bank has no MCQs for these choices. Try other chapters or topics.'} />
          ) : (
            <>
              <CountField label="Number of Questions" value={count} onChange={onCount} min={1} max={MAX_QUESTIONS} hint="Used to pick at random." />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Button label={browsing ? 'Hide Questions' : 'Browse Questions'} variant="secondary" icon={{ ios: 'list.bullet.rectangle', android: 'list_alt' }} onPress={() => setBrowsing((v) => !v)} />
                </View>
                <View style={{ flex: 1 }}>
                  <Button label="Pick Randomly" variant="tonal" icon={{ ios: 'dice', android: 'casino' }} loading={working} disabled={!countValid || working} onPress={() => void randomNow()} />
                </View>
              </View>
            </>
          )}
        </>
      ) : null}

      {error ? <Notice tone="danger" text={error} live /> : null}
      {message ? <Notice tone={message.tone} text={message.text} live /> : null}

      {selected.length > 0 ? (
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <Text accessibilityLiveRegion="polite" style={{ color: palette.foreground, fontSize: 14, fontWeight: '700' }}>Selected Questions: {selected.length}</Text>
            <View style={{ flexDirection: 'row', gap: 16 }}>
              <Pressable accessibilityRole="button" accessibilityLabel={editing ? 'Done editing questions' : 'Edit questions'} hitSlop={8} onPress={() => setEditing((v) => !v)}>
                <Text style={{ color: palette.primary, fontSize: 14, fontWeight: '600' }}>{editing ? 'Done' : 'Edit Questions'}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Clear selected questions" hitSlop={8} onPress={() => { onSelected([]); setEditing(false); }}>
                <Text style={{ color: palette.primary, fontSize: 14, fontWeight: '600' }}>Clear</Text>
              </Pressable>
            </View>
          </View>
          {editing ? selected.map((q, i) => (
            <View key={q._id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ color: palette.mutedForeground, fontSize: 12, width: 24 }}>{i + 1}.</Text>
              <Text numberOfLines={1} style={{ flex: 1, color: palette.foreground, fontSize: 13 }}>{[q.chapter, q.questionText.replace(/\s+/g, ' ')].filter(Boolean).join(' · ')}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel={`Remove question ${i + 1}`} hitSlop={10} onPress={() => toggle(q)}>
                <Icon name={{ ios: 'xmark.circle.fill', android: 'cancel' }} color={palette.mutedForeground} size={18} />
              </Pressable>
            </View>
          )) : <Muted>{chapterSummary.slice(0, 3).join(', ')}{chapterSummary.length > 3 ? '…' : ''}</Muted>}
        </View>
      ) : null}

      {browsing && data && data.total > 0 ? (
        <View style={{ gap: 12 }}>
          <Text accessibilityLiveRegion="polite" style={{ color: palette.mutedForeground, fontSize: 13 }}>{showing.loading ? 'Finding questions…' : `${showing.total.toLocaleString()} question${showing.total === 1 ? '' : 's'} found`}</Text>
          {showing.loading ? <ActivityIndicator color={palette.primary} /> : null}
          {showing.error && showing.items.length === 0 ? <ErrorView message={showing.error} onRetry={() => setRetry((n) => n + 1)} /> : null}
          {showing.items.map((item) => {
            const picked = selected.some((q) => q._id === item._id);
            return <PickCard key={item._id} question={item} picked={picked} replacing={false} disabled={!picked && selected.length >= MAX_QUESTIONS} onPress={toggle} />;
          })}
          {showing.more ? <ActivityIndicator color={palette.primary} /> : null}
          {showing.hasMore && !showing.more ? <Button label="Load more questions" variant="secondary" onPress={loadMore} /> : null}
          {showing.error && showing.items.length > 0 ? <Muted>{showing.error}</Muted> : null}
        </View>
      ) : null}
    </View>
  );
}
