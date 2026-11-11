import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QuestionActionMenu, type MenuAnchor, type QuestionAction } from './action-menu';
import { SelectedReorderList } from './reorder-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, DetailSheet, ErrorView, Field, Icon, Muted, Notice, SkeletonCards, useLoad, usePalette } from '@/components/kit';
import { useCacheKeys } from '@/hooks/use-cache-keys';
import { Explanation } from '@/components/explanation';
import { Diagrams } from '@/components/diagrams';
import { confirmAction } from '@/components/confirm-action';
import { DropdownSelect } from '@/components/dropdown-select';
import { MultiSelectDropdown } from '@/components/multi-select-dropdown';
import { KeyboardSafeView } from '@/components/keyboard-safe-view';
import { fetchBankOptions, fetchBankPage, fetchBankRandom } from '@/services/pdf-questions';
import { bankBody, bankKey, sourceOptions, withChapters, type BankScope } from '@/screens/teacher/make-pdf/bank-scope';
import { SelectionCard, SelectedQuestionRow } from './question-card';
import { addQuestions, moveQuestion, removeQuestion, replaceQuestion } from '@/screens/teacher/make-pdf/model';
import { QuestionPreview, questionMeta } from '@/screens/teacher/make-pdf/question-preview';
import { CountField } from '@/screens/teacher/make-pdf/ui';
import { equalTargets, remaining, selectSubjects, targetTotal, type SubjectSelection } from './model';
import type { Question } from '@/types/pcmb';

const PAGE_SIZE = 20;

/** Shared setup and review. Subject chips are deliberately disabled. */
export function SubjectSelector({ sessions, onChange, subjects, base, total = 30, label = 'Subjects', searchable }: {
  sessions: SubjectSelection[]; onChange: (sessions: SubjectSelection[]) => void;
  subjects: string[]; base: BankScope; total?: number; label?: string; searchable?: boolean;
}) {
  const [active, setActive] = useState<string | null>(null);
  const current = useRef(sessions);
  useEffect(() => { current.current = sessions; });
  const changeSubjects = (names: string[]) => {
    const apply = () => onChange(selectSubjects(sessions, names, base, total));
    const lost = sessions.filter(s => !names.includes(s.subject) && s.questions.length);
    if (lost.length) {
      const count = lost.reduce((n, s) => n + s.questions.length, 0);
      confirmAction('Remove subjects?', `${lost.map(s => s.subject).join(', ')} will be removed, along with ${count} selected question${count === 1 ? '' : 's'}. Questions from other subjects are kept.`, 'Remove', apply);
    } else apply();
  };
  const index = sessions.findIndex(s => s.subject === active);
  return <View style={{ gap: 12 }}>
    <MultiSelectDropdown label={label} searchable={searchable} options={subjects} selected={sessions.map(s => s.subject)} onSelect={changeSubjects}
      placeholder="Select subjects" selectedLabel={n => `${n} Subjects Selected`} applyOnDone showSelectedChips={false} />
    {sessions.map(s => <View key={s.subject} style={{ gap: 6 }}>
      <CountField label={`${s.subject} target`} value={s.target} min={0} max={300}
        onChange={target => onChange(sessions.map(item => item.subject === s.subject ? { ...item, target } : item))} />
      <Button label={`${s.subject}: ${s.questions.length}/${s.target} — Select Questions`} variant="secondary" onPress={() => setActive(s.subject)} />
    </View>)}
    {sessions.length ? <>
      <Muted>Total: {sessions.reduce((n, s) => n + s.questions.length, 0)}/{targetTotal(sessions)}</Muted>
      <Button label="Distribute Equally" variant="secondary" onPress={() => {
        const targets = equalTargets(targetTotal(sessions) || total, sessions.map(s => s.subject));
        onChange(sessions.map((s, i) => ({ ...s, target: targets[i] })));
      }} />
    </> : null}
    {index >= 0 ? <SubjectBrowser key={active} session={sessions[index]} subjects={sessions.map(s => s.subject)}
      totalSelected={sessions.reduce((n, s) => n + s.questions.length, 0)}
      onChange={session => onChange(current.current.map(s => s.subject === session.subject ? session : s))}
      onSubject={setActive} onClose={() => setActive(null)} /> : null}
  </View>;
}

function SubjectBrowser({ session, subjects, totalSelected, onChange, onSubject, onClose }: {
  session: SubjectSelection; subjects: string[]; totalSelected: number;
  onChange: (session: SubjectSelection) => void; onSubject: (subject: string) => void; onClose: () => void;
}) {
  const palette = usePalette();
  const live = useRef({ session, totalSelected });
  useEffect(() => { live.current = { session, totalSelected }; });
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const scope = session.scope;
  const key = bankKey(scope);
  const liveKey = useRef(key);
  useEffect(() => { liveKey.current = key; }, [key]);
  const body = useMemo(() => bankBody(scope), [scope]);
  // Kept per scope: going back to filters already seen shows their lists at once, without a new request.
  const optionsKey = useCacheKeys().bankOptions(key);
  const options = useLoad(async () => ({ key, data: await fetchBankOptions(body) }), [key, optionsKey], { cacheKey: optionsKey });
  const [pages, setPages] = useState<{ key: string; items: Question[]; total: number; page: number; more: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const paging = useRef(false);
  const generation = useRef(0);
  const randomBusy = useRef(false);
  const [working, setWorking] = useState(false);
  const [retry, setRetry] = useState(0);
  const [review, setReview] = useState(false);
  const [replacing, setReplacing] = useState<string | null>(null);
  const [preview, setPreview] = useState<Question | null>(null);
  const [menu, setMenu] = useState<{ question: Question; anchor: MenuAnchor } | null>(null);
  const pendingAction = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (!menu && pendingAction.current) {
      const action = pendingAction.current; pendingAction.current = null; action();
    }
  }, [menu]);
  const [reorder, setReorder] = useState(false);
  const [removed, setRemoved] = useState<{ question: Question; index: number } | null>(null);
  const [search, setSearch] = useState(scope.search ?? '');
  useEffect(() => {
    const timer = setTimeout(() => {
      if (search !== (live.current.session.scope.search ?? '')) onChange({ ...live.current.session, scope: { ...live.current.session.scope, search } });
    }, 350);
    return () => clearTimeout(timer);
  }, [search, onChange]);
  useEffect(() => {
    let cancelled = false;
    generation.current++;
    Promise.resolve().then(() => { if (!cancelled) { setLoading(true); setLoadingMore(false); setError(null); paging.current = false; } });
    fetchBankPage(body, 1, PAGE_SIZE).then(page => {
      if (!cancelled) setPages({ key, items: page.questions, total: page.total, page: 1, more: page.hasMore });
    }).catch(e => { if (!cancelled) setError(e.message); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [key, body, retry]);
  const loadMore = async () => {
    if (paging.current || loading || pages?.key !== key || !pages.more || error) return;
    paging.current = true;
    setLoadingMore(true);
    const askedGeneration = generation.current;
    try {
      const next = await fetchBankPage(body, pages.page + 1, PAGE_SIZE);
      if (alive.current && liveKey.current === key && generation.current === askedGeneration) setPages(previous => previous?.key === key ? {
        key, items: addQuestions(previous.items, next.questions).list.slice(-200), total: next.total, page: previous.page + 1, more: next.hasMore,
      } : previous);
    } catch (e) { if (alive.current && liveKey.current === key && generation.current === askedGeneration) setError(e instanceof Error ? e.message : 'Could not load more.'); }
    finally { if (alive.current && liveKey.current === key && generation.current === askedGeneration) { paging.current = false; setLoadingMore(false); } }
  };
  const changeScope = (next: BankScope) => {
    onChange({ ...session, scope: next });
    setMessage('Filters apply to browsing and random additions. Your selected questions are kept.');
  };
  const toggle = (question: Question) => {
    const current = live.current.session;
    const questions = replacing ? replaceQuestion(current.questions, replacing, question) : current.questions.some(q => q._id === question._id)
      ? removeQuestion(current.questions, question._id)
      : addQuestions(current.questions, [question], current.questions.length + Math.max(0, 300 - live.current.totalSelected)).list;
    if (questions) {
      live.current = { session: { ...current, questions }, totalSelected: live.current.totalSelected + questions.length - current.questions.length };
      onChange({ ...current, questions });
    }
    if (replacing && questions) { setReplacing(null); setReview(true); }
  };
  const random = async (requested: number) => {
    if (randomBusy.current || requested < 1) return;
    randomBusy.current = true; setWorking(true); setError(null);
    const count = Math.min(requested, 300 - totalSelected);
    try {
      if (count < 1) throw new Error('The selection already has 300 questions.');
      const found = await fetchBankRandom(body, count, session.questions.map(q => q._id));
      if (!alive.current || liveKey.current !== key) return;
      const current = live.current.session;
      const result = addQuestions(current.questions, found, Math.min(current.target, current.questions.length + Math.max(0, 300 - live.current.totalSelected)));
      onChange({ ...current, questions: result.list });
      setMessage(`Added ${result.added} of ${requested} requested. ${result.added < requested ? 'Not enough eligible questions; adjust the filters or target.' : ''}`);
    } catch (e) { if (alive.current) setError(e instanceof Error ? e.message : 'Could not choose questions.'); }
    finally { randomBusy.current = false; if (alive.current) setWorking(false); }
  };
  const data = options.data?.key === key ? options.data.data : null;
  const topics = (data?.topics ?? []).filter(t => !scope.chapters.length || scope.chapters.some(c => c.toLowerCase() === t.chapter.toLowerCase()));
  const sources = scope.sources?.length ? scope.sources : [scope.source];
  const availableSources = sourceOptions(scope);
  const index = subjects.indexOf(session.subject);
  const items = review ? session.questions : pages?.key === key ? pages.items : [];
  const selected = (q: Question) => session.questions.some(item => item._id === q._id);
  const cannotAdd = (q: Question) => working || (replacing ? selected(q) : !selected(q) && totalSelected >= 300);
  const remove = (question: Question) => {
    const current = live.current.session;
    const at = current.questions.findIndex(q => q._id === question._id);
    if (at < 0) return;
    setRemoved({ question, index: at });
    toggle(question);
    setMessage('Question removed.');
  };
  const undo = () => {
    if (!removed) return;
    const current = live.current.session;
    if (current.questions.some(q => q._id === removed.question._id)) { setRemoved(null); return; }
    if (live.current.totalSelected >= 300) { setMessage('The selection already has 300 questions.'); return; }
    const questions = [...current.questions];
    questions.splice(Math.min(removed.index, questions.length), 0, removed.question);
    onChange({ ...current, questions });
    setRemoved(null); setMessage('Question restored.');
  };
  const move = (from: number, to: number) => {
    const current = live.current.session;
    const questions = moveQuestion(current.questions, from, to);
    live.current = { ...live.current, session: { ...current, questions } };
    onChange({ ...current, questions });
  };
  const runMenuAction = (action: QuestionAction) => {
    if (!menu) return;
    const question = menu.question;
    // Execute after the popup's removal has committed, including on Android.
    pendingAction.current = () => {
      if (action === 'details') setPreview(question);
      else if (action === 'replace') { setReplacing(question._id); setReview(false); }
      else remove(question);
    };
    setMenu(null);
  };
  const compactButton = { minHeight: 48, paddingVertical: 8 };
  return <Modal visible animationType="slide" onRequestClose={() => { if (menu) setMenu(null); else if (reorder) setReorder(false); else onClose(); }}>
    <GestureHandlerRootView style={{ flex: 1 }}>
    <KeyboardSafeView>
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 8, gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text accessibilityRole="header" style={{ color: palette.foreground, fontSize: 20, fontWeight: '700', flexShrink: 1 }}>{review ? 'Selected Questions' : 'Select Questions'}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Back to Subjects" onPress={onClose} style={{ minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={{ ios: 'xmark', android: 'close' }} color={palette.foreground} size={20} />
          </Pressable>
        </View>
        <DropdownSelect label={`${index + 1} of ${subjects.length}`} options={subjects} selected={session.subject} onSelect={onSubject} required />
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <Text accessibilityLiveRegion="polite" style={{ color: palette.foreground }}>Selected: {session.questions.length}/{session.target}</Text>
          <Pressable accessibilityRole="button" onPress={() => { setReview(!review); setReplacing(null); setReorder(false); }} style={{ minHeight: 48, justifyContent: 'center', paddingHorizontal: 8 }}>
            <Text style={{ color: palette.primaryInk, fontWeight: '600' }}>{review ? 'Browse Questions' : 'View Selected >'}</Text>
          </Pressable>
        </View>
      </View>
      {review ? <View style={{ paddingHorizontal: 12, paddingBottom: 8, gap: 4 }}>
        <Button label={reorder ? 'Done' : 'Reorder'} variant="secondary" style={compactButton}
          onPress={() => { setMenu(null); setReorder(!reorder); }} disabled={!reorder && (working || session.questions.length < 2)} />
        {reorder ? <Muted>Hold a handle and drag. Use accessibility actions to move up or down.</Muted> : null}
      </View> : null}
      {review && reorder ? <SelectedReorderList questions={session.questions} onMove={move} /> : <FlatList key={review ? 'selected' : 'bank'} data={items} keyExtractor={q => q._id} extraData={[session.questions, replacing, review, working]}
        initialNumToRender={4} maxToRenderPerBatch={4} windowSize={5} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
        contentContainerStyle={{ padding: 12, gap: review ? 0 : 10 }} onEndReached={() => { if (!review) void loadMore(); }} onEndReachedThreshold={0.4}
        ListHeaderComponent={<View style={{ gap: 10, paddingBottom: 10 }}>
          {replacing ? <><Notice text="Select a checkbox to replace the question. Existing selections stay until then." /><Button label="Cancel Replacement" variant="secondary" style={compactButton} onPress={() => { setReplacing(null); setReview(true); }} /></> : null}
          {!review ? <>
            <MultiSelectDropdown label="Chapters / Topics" options={data?.chapters.map(c => c.name) ?? []} counts={Object.fromEntries((data?.chapters ?? []).map(c => [c.name, c.count]))} selected={scope.chapters} placeholder="All chapters" allWhenNone applyOnDone searchable showSelectedChips={false}
              onSelect={chapters => changeScope(withChapters(scope, chapters, data?.topics ?? []))} />
            {topics.length ? <MultiSelectDropdown label="Topics" options={[...new Set(topics.map(t => t.name))]} selected={scope.topics} placeholder="All topics" allWhenNone applyOnDone searchable showSelectedChips={false}
              sections={(data?.chapters ?? []).map(c => ({ title: c.name, options: topics.filter(t => t.chapter === c.name).map(t => t.name) })).filter(s => s.options.length)}
              onSelect={topics => changeScope({ ...scope, topics })} /> : null}
            <MultiSelectDropdown label="Question Sources" options={availableSources.map(s => s.label)}
              selected={availableSources.filter(s => sources.includes(s.value)).map(s => s.label)} placeholder="Select sources" applyOnDone showSelectedChips={false}
              onSelect={values => {
                const next = availableSources.filter(s => values.includes(s.label)).map(s => s.value);
                if (next.length) changeScope({ ...scope, source: next[0], sources: next });
              }} />
            {sources.length === 1 && sources[0] === 'pyq' ? <MultiSelectDropdown label="PYQ Years" options={data?.years.map(y => y.name) ?? []} selected={scope.years}
              placeholder="All years" allWhenNone applyOnDone showSelectedChips={false} onSelect={years => changeScope({ ...scope, years })} /> : null}
            {options.error ? <ErrorView message={options.error} onRetry={options.reload} /> : null}
            <Field label="Search Questions" value={search} onChangeText={setSearch} maxLength={300} returnKeyType="search" />
            <Muted>{pages?.key === key ? `${pages.total} Questions Available` : 'Finding questions…'}</Muted>
            {pages && pages.page > 10 ? <Button label="Back to First Page" variant="secondary" style={compactButton} onPress={() => { setPages(null); setRetry(n => n + 1); }} /> : null}
          </> : null}
          {error ? <ErrorView message={error} onRetry={() => { setError(null); setRetry(n => n + 1); }} /> : null}
          {message ? <Notice text={message} /> : null}
          {removed ? <Button label="Undo Remove" variant="secondary" style={compactButton} onPress={undo} disabled={working} /> : null}
          {!review && loading && items.length ? <ActivityIndicator color={palette.primary} /> : null}
        </View>}
        ListEmptyComponent={loading ? (review ? undefined : <SkeletonCards count={3} lines={4} label="Loading questions" />) : !loading ? <Muted>{review ? 'No questions selected. Browse questions or fill the remaining target.' : error ? '' : 'No questions match these filters.'}</Muted> : undefined}
        ListFooterComponent={loadingMore ? <ActivityIndicator color={palette.primary} /> : undefined}
        renderItem={({ item, index: at }) => review
          ? <SelectedQuestionRow question={item} index={at} onDetails={setPreview} onMenu={(question, anchor) => setMenu({ question, anchor })} />
          : <SelectionCard question={item} picked={selected(item)} disabled={cannotAdd(item)} onToggle={toggle} onDetails={setPreview} />} />}
      {!reorder ? <View style={{ paddingHorizontal: 12, paddingVertical: 8, gap: 6, borderTopWidth: 1, borderTopColor: palette.border }}>
        <Button label={remaining(session) ? `Fill Remaining ${remaining(session)}` : 'Target Complete'} onPress={() => void random(remaining(session))} disabled={working || !!replacing || !remaining(session)} loading={working} style={compactButton} />
        <Button label={index < subjects.length - 1 ? 'Next Subject' : 'Review Subjects / Continue'} variant="secondary" style={compactButton} disabled={working} onPress={() => index < subjects.length - 1 ? onSubject(subjects[index + 1]) : onClose()} />
      </View> : null}
      <DetailSheet visible={!!preview} title="Question Details" onClose={() => setPreview(null)} footer={preview ? <Button
        label={replacing ? 'Use as Replacement' : selected(preview) ? 'Remove Selection' : 'Add Selection'} disabled={cannotAdd(preview)}
        onPress={() => { if (selected(preview) && !replacing) remove(preview); else toggle(preview); setPreview(null); }} /> : undefined}>
        {preview ? <View style={{ gap: 16 }}>
          <QuestionPreview question={preview} showAnswers />
          <Muted>{questionMeta(preview) || 'Source, chapter and topic unavailable.'}</Muted>
          {preview.explanation?.trim()
            ? <Explanation key={preview._id} text={preview.explanation} diagramUrls={preview.explanationDiagramUrls} source={preview.source} showAnswer={false} defaultCollapsed={false} />
            : preview.explanationDiagramUrls?.length ? <Diagrams urls={preview.explanationDiagramUrls} />
            : <Muted>Explanation / solution unavailable.</Muted>}
        </View> : null}
      </DetailSheet>
      {menu ? <QuestionActionMenu anchor={menu.anchor} disabled={working} onClose={() => setMenu(null)} onAction={runMenuAction} /> : null}
    </SafeAreaView>
    </KeyboardSafeView>
    </GestureHandlerRootView>
  </Modal>;
}
