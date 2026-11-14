import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QuestionActionMenu, type MenuAnchor, type QuestionAction } from './action-menu';
import { SelectedReorderList } from './reorder-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, DetailSheet, ErrorView, Field, Icon, Muted, Notice, SkeletonCards, useLoad, usePalette } from '@/components/kit';
import { useCacheKeys } from '@/hooks/use-cache-keys';
import { haptic } from '@/design/haptics';
import { Explanation } from '@/components/explanation';
import { Diagrams } from '@/components/diagrams';
import { confirmAction } from '@/components/confirm-action';
import { DropdownSelect } from '@/components/dropdown-select';
import { MultiSelectDropdown } from '@/components/multi-select-dropdown';
import { KeyboardSafeView } from '@/components/keyboard-safe-view';
import { fetchBankOptions, fetchBankPage, fetchBankRandom } from '@/services/pdf-questions';
import { bankBody, bankKey, LEVEL_OPTIONS, sourceOptions, withChapters, type BankScope } from '@/screens/teacher/make-pdf/bank-scope';
import { SelectionCard, SelectedQuestionRow } from './question-card';
import { addQuestions, moveQuestion, removeQuestion, replaceQuestion } from '@/screens/teacher/make-pdf/model';
import { QuestionPreview, questionMeta } from '@/screens/teacher/make-pdf/question-preview';
import { MAX_SELECTED, selectedCount, selectSubjects, type SubjectSelection } from './model';
import type { Question } from '@/types/pcmb';

const PAGE_SIZE = 20;

/**
 * Questions for one or more subjects: pick the subjects, then each subject's
 * button opens its question bank. A subject's count is simply what's picked
 * there; nothing is pre-filled. Shared by Create Test, Edit test and Make PDF.
 */
export function SubjectSelector({ sessions, onChange, subjects, base, label = 'Subjects', searchable }: {
  sessions: SubjectSelection[]; onChange: (sessions: SubjectSelection[]) => void;
  subjects: string[]; base: BankScope; label?: string; searchable?: boolean;
}) {
  const [active, setActive] = useState<string | null>(null);
  const current = useRef(sessions);
  useEffect(() => { current.current = sessions; });
  const changeSubjects = (names: string[]) => {
    const apply = () => onChange(selectSubjects(sessions, names, base));
    const lost = sessions.filter(s => !names.includes(s.subject) && s.questions.length);
    if (lost.length) {
      const count = lost.reduce((n, s) => n + s.questions.length, 0);
      confirmAction('Remove subjects?', `${lost.map(s => s.subject).join(', ')} will be removed, along with ${count} selected question${count === 1 ? '' : 's'}. Questions from other subjects are kept.`, 'Remove', apply);
    } else apply();
  };
  const index = sessions.findIndex(s => s.subject === active);
  const total = selectedCount(sessions);
  return <View style={{ gap: 12 }}>
    <MultiSelectDropdown label={label} searchable={searchable} options={subjects} selected={sessions.map(s => s.subject)} onSelect={changeSubjects}
      placeholder="Select subjects" selectedLabel={n => `${n} Subject${n === 1 ? '' : 's'} Selected`} applyOnDone showSelectedChips={false} />
    {sessions.map(s => {
      const n = s.questions.length;
      return <Button key={s.subject} label={n ? `${s.subject}: ${n} question${n === 1 ? '' : 's'} · Change` : `${s.subject}: Choose questions`}
        variant={n ? 'secondary' : 'tonal'} icon={n ? { ios: 'checkmark.circle', android: 'check_circle' } : { ios: 'plus.circle', android: 'add_circle' }}
        onPress={() => setActive(s.subject)} />;
    })}
    {sessions.length ? <Muted>{total ? `Total: ${total} question${total === 1 ? '' : 's'}` : 'Open a subject to choose its questions: tick them one by one, or add some at random.'}</Muted> : null}
    {index >= 0 ? <SubjectBrowser key={active} session={sessions[index]} subjects={sessions.map(s => s.subject)}
      totalSelected={total}
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
  // The lists of chapters, topics and years come from the subject and sources only, not from the
  // chapters or topics picked: picking a chapter must not reload them (the Topics field would vanish
  // while they load) or shrink the Chapters list to what's picked.
  const listsBody = useMemo(() => bankBody({ ...scope, chapters: [], topics: [], years: [], levels: [], search: '' }), [scope]);
  const listsKey = JSON.stringify(listsBody);
  // Kept per scope: going back to filters already seen shows their lists at once, without a new request.
  const optionsKey = useCacheKeys().bankOptions(listsKey);
  const options = useLoad(async () => ({ key: listsKey, data: await fetchBankOptions(listsBody) }), [listsKey, optionsKey], { cacheKey: optionsKey });
  const [pages, setPages] = useState<{ key: string; items: Question[]; total: number; page: number; more: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  // What the last "Add at random" did, shown right under its button.
  // While it shows, the number box and its button are hidden; "Edit number of questions" brings them back.
  const [added, setAdded] = useState<{ tone: 'success' | 'warning'; title: string; text: string } | null>(null);
  // How many the running "Add at random" asked for, for its loading line.
  const [adding, setAdding] = useState(0);
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
  // Number of questions to add at random: empty until the teacher types one.
  const [randomText, setRandomText] = useState('');
  const randomCount = Math.min(Number(randomText) || 0, Math.max(0, MAX_SELECTED - totalSelected));
  // The form comes first: no questions are loaded or shown until the teacher taps Show questions.
  // Changing a filter afterwards hides them again until the next tap.
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!shown) return;
    let cancelled = false;
    generation.current++;
    Promise.resolve().then(() => { if (!cancelled) { setLoading(true); setLoadingMore(false); setError(null); paging.current = false; } });
    fetchBankPage(body, 1, PAGE_SIZE).then(page => {
      if (!cancelled) setPages({ key, items: page.questions, total: page.total, page: 1, more: page.hasMore });
    }).catch(e => { if (!cancelled) setError(e.message); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [key, body, retry, shown]);
  const loadMore = async () => {
    if (!shown || paging.current || loading || pages?.key !== key || !pages.more || error) return;
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
    setAdded(null);
    setShown(false);
    setMessage(null);
  };
  const toggle = (question: Question) => {
    const current = live.current.session;
    const questions = replacing ? replaceQuestion(current.questions, replacing, question) : current.questions.some(q => q._id === question._id)
      ? removeQuestion(current.questions, question._id)
      : addQuestions(current.questions, [question], current.questions.length + Math.max(0, MAX_SELECTED - live.current.totalSelected)).list;
    if (questions) {
      live.current = { session: { ...current, questions }, totalSelected: live.current.totalSelected + questions.length - current.questions.length };
      onChange({ ...current, questions });
    }
    if (replacing && questions) { setReplacing(null); setReview(true); }
  };
  const random = async (requested: number) => {
    if (randomBusy.current || requested < 1) return;
    randomBusy.current = true; setWorking(true); setError(null); setAdded(null); setAdding(requested);
    const count = Math.min(requested, MAX_SELECTED - totalSelected);
    try {
      if (count < 1) throw new Error(`The selection already has ${MAX_SELECTED} questions.`);
      const found = await fetchBankRandom(body, count, session.questions.map(q => q._id));
      if (!alive.current || liveKey.current !== key) return;
      const current = live.current.session;
      // Exactly as many as asked for (never past the overall limit), even if the bank sends more.
      const result = addQuestions(current.questions, found, current.questions.length + Math.min(count, Math.max(0, MAX_SELECTED - live.current.totalSelected)));
      onChange({ ...current, questions: result.list });
      setMessage(null);
      const now = `${current.subject} now has ${result.list.length} question${result.list.length === 1 ? '' : 's'} selected.`;
      if (result.added) haptic.success();
      else haptic.warning();
      const n = `${result.added} question${result.added === 1 ? '' : 's'}`;
      setAdded(!result.added
        ? { tone: 'warning', title: 'No questions added', text: 'No more questions match these filters. Choose more chapters or topics, or another source.' }
        : result.added < requested
          ? { tone: 'warning', title: `${n} added`, text: `Only ${result.added} of ${requested} matched these filters. ${now}` }
          : { tone: 'success', title: `${n} added successfully`, text: now });
    } catch (e) { if (alive.current) setError(e instanceof Error ? e.message : 'Could not choose questions.'); }
    finally { randomBusy.current = false; if (alive.current) { setWorking(false); setAdding(0); } }
  };
  const fresh = options.data?.key === listsKey ? options.data.data : null;
  // While other lists load (another source), the last ones stay, so no field disappears.
  const [kept, setKept] = useState<typeof fresh>(null);
  if (fresh && kept !== fresh) setKept(fresh);
  const data = fresh ?? kept;
  const topics = (data?.topics ?? []).filter(t => !scope.chapters.length || scope.chapters.some(c => c.toLowerCase() === t.chapter.toLowerCase()));
  // Nothing is chosen until the teacher picks: then every question counts (regular is the whole bank).
  const sources = scope.sources ?? (scope.source === 'pyq' ? ['pyq'] : []);
  const availableSources = sourceOptions(scope);
  const index = subjects.indexOf(session.subject);
  const items = review ? session.questions : shown && pages?.key === key ? pages.items : [];
  const selected = (q: Question) => session.questions.some(item => item._id === q._id);
  const cannotAdd = (q: Question) => working || (replacing ? selected(q) : !selected(q) && totalSelected >= MAX_SELECTED);
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
    if (live.current.totalSelected >= MAX_SELECTED) { setMessage(`The selection already has ${MAX_SELECTED} questions.`); return; }
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
          <Text accessibilityLiveRegion="polite" style={{ color: palette.foreground, fontWeight: '600' }}>{session.questions.length} selected</Text>
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
            {/* Always shown: its list follows the chapters picked. */}
            <MultiSelectDropdown label="Topics" options={[...new Set(topics.map(t => t.name))]} selected={scope.topics} placeholder="All topics" emptyText="These chapters have no topics" allWhenNone applyOnDone searchable showSelectedChips={false}
              sections={(data?.chapters ?? []).map(c => ({ title: c.name, options: topics.filter(t => t.chapter.toLowerCase() === c.name.toLowerCase()).map(t => t.name) })).filter(s => s.options.length)}
              onSelect={topics => changeScope({ ...scope, topics })} />
            <MultiSelectDropdown label="Question Sources" options={availableSources.map(s => s.label)}
              selected={availableSources.filter(s => sources.includes(s.value)).map(s => s.label)} placeholder="All questions" allWhenNone applyOnDone showSelectedChips={false}
              onSelect={values => {
                const next = availableSources.filter(s => values.includes(s.label)).map(s => s.value);
                // None picked: the whole bank (regular includes PYQs); PYQs alone narrows it.
                changeScope({ ...scope, source: next.length === 1 ? next[0] : 'regular', sources: next });
              }} />
            <MultiSelectDropdown label="Question level" options={LEVEL_OPTIONS.map(l => l.label)}
              selected={LEVEL_OPTIONS.filter(l => scope.levels?.includes(l.value)).map(l => l.label)} placeholder="All levels" allWhenNone applyOnDone showSelectedChips={false}
              onSelect={values => changeScope({ ...scope, levels: LEVEL_OPTIONS.filter(l => values.includes(l.label)).map(l => l.value) })} />
            {sources.length === 1 && sources[0] === 'pyq' ? <MultiSelectDropdown label="PYQ Years" options={data?.years.map(y => y.name) ?? []} selected={scope.years}
              placeholder="All years" allWhenNone applyOnDone showSelectedChips={false} onSelect={years => changeScope({ ...scope, years })} /> : null}
            {options.error ? <ErrorView message={options.error} onRetry={options.reload} /> : null}
            {!shown ? <>
              <Button label="Show questions" icon={{ ios: 'list.bullet.rectangle', android: 'list_alt' }} style={compactButton} onPress={() => { setMessage(null); setShown(true); }} />
              <Muted>Choose the chapters, topics, sources and level you want, then tap Show questions.</Muted>
            </> : <>
              <Muted>{pages?.key === key && !loading ? `${pages.total} question${pages.total === 1 ? '' : 's'} match your choices` : 'Finding questions…'}</Muted>
            {/* Add at random, in three states: the number and its button; adding (loading); done (what happened, and a way to add more). */}
            {working && adding ? (
              <View accessible accessibilityLiveRegion="polite" accessibilityLabel={`Adding ${adding} questions`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.card }}>
                <ActivityIndicator color={palette.primary} />
                <Text style={{ color: palette.foreground, fontSize: 14, fontWeight: '600' }}>Adding {adding} question{adding === 1 ? '' : 's'}…</Text>
              </View>
            ) : added ? (
              <View style={{ gap: 6 }}>
                <Notice tone={added.tone} title={added.title} text={added.text} live />
                <Pressable accessibilityRole="button" accessibilityLabel="Edit number of questions" hitSlop={8} onPress={() => setAdded(null)} style={{ alignSelf: 'flex-start', minHeight: 32, justifyContent: 'center' }}>
                  <Text style={{ color: palette.primaryInk, fontSize: 13, fontWeight: '600', textDecorationLine: 'underline' }}>Edit number of questions</Text>
                </Pressable>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Field label="Number of questions" value={randomText} onChangeText={v => setRandomText(v.replace(/[^0-9]/g, '').slice(0, 3))} placeholder="e.g. 10" keyboardType="number-pad" maxLength={3} returnKeyType="done" />
                </View>
                <Button label={randomCount ? `Add ${randomCount} at random` : 'Add at random'} variant="tonal" icon={{ ios: 'dice', android: 'casino' }} onPress={() => void random(randomCount)} disabled={working || !!replacing || !randomCount} style={compactButton} />
              </View>
            )}
              {pages && pages.page > 10 ? <Button label="Back to First Page" variant="secondary" style={compactButton} onPress={() => { setPages(null); setRetry(n => n + 1); }} /> : null}
            </>}
          </> : null}
          {error ? <ErrorView message={error} onRetry={() => { setError(null); setRetry(n => n + 1); }} /> : null}
          {message ? <Notice text={message} /> : null}
          {removed ? <Button label="Undo Remove" variant="secondary" style={compactButton} onPress={undo} disabled={working} /> : null}
          {!review && loading && items.length ? <ActivityIndicator color={palette.primary} /> : null}
        </View>}
        ListEmptyComponent={!review && !shown ? undefined : loading ? (review ? undefined : <SkeletonCards count={3} lines={4} label="Loading questions" />) : !loading ? <Muted>{review ? 'No questions selected yet. Browse the questions and tick the ones you want, or add some at random.' : error ? '' : 'No questions match these filters.'}</Muted> : undefined}
        ListFooterComponent={loadingMore ? <ActivityIndicator color={palette.primary} /> : undefined}
        renderItem={({ item, index: at }) => review
          ? <SelectedQuestionRow question={item} index={at} onDetails={setPreview} onMenu={(question, anchor) => setMenu({ question, anchor })} />
          : <SelectionCard question={item} picked={selected(item)} disabled={cannotAdd(item)} onToggle={toggle} onDetails={setPreview} />} />}
      {!reorder ? <View style={{ paddingHorizontal: 12, paddingVertical: 8, gap: 6, borderTopWidth: 1, borderTopColor: palette.border }}>
        {/* Done closes the question list; the picks are already kept. Another subject opens from its own button. */}
        <Button label="Done" style={compactButton} disabled={working} onPress={onClose} />
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
