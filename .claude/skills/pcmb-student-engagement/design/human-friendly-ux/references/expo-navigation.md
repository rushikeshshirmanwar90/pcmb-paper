# Expo Router recipes for well-structured apps

Implementation patterns for the containers in restructure-playbook.md. Use the app's own UI kit for visuals (e.g. the neobrutalism-expo components); this file is about **structure and behavior**. Check the installed versions first (`expo-router`, `react-native-screens`, `@react-navigation/*`), since option names below match Expo Router v4+ / React Navigation 7.

## 1. Route map conventions

```
app/
  _layout.tsx                 ← root Stack (auth gate, fonts, providers)
  (tabs)/_layout.tsx          ← 3–5 top-level tabs, each a noun
  (tabs)/home.tsx
  (tabs)/classes/_layout.tsx  ← Stack inside a tab (lists → details)
  (tabs)/classes/index.tsx
  (tabs)/classes/[id]/index.tsx   ← object screen with a segmented control
  exam/new/_layout.tsx        ← stepper flow presented as a modal stack
  exam/new/basics.tsx · questions.tsx · settings.tsx · review.tsx
  sheets/add-student.tsx      ← short focused task as a form sheet
```

Rules: a folder per flow, a file per screen, **no screen file over ~400 lines** (move sections into `components/<feature>/`), and route params for IDs only (objects go through a store or query cache).

If the app uses a custom tab pager (e.g. a swipeable four-tab `PagerView`), keep it, but keep the same discipline: each tab gets its own stack, and flows open *above* the tabs, not inside a tab's modes.

## 2. Form sheet for short tasks

```tsx
// app/_layout.tsx (root Stack)
<Stack>
  <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
  <Stack.Screen
    name="sheets/add-student"
    options={{
      presentation: 'formSheet',
      sheetAllowedDetents: [0.5, 1],   // half height, expandable
      sheetGrabberVisible: true,
      sheetCornerRadius: 16,
      headerShown: false,
    }}
  />
  <Stack.Screen name="exam/new" options={{ presentation: 'modal', headerShown: false }} />
</Stack>
```

Inside the sheet, put a header row with **Cancel** (left) and **Done/Add** (right, primary), then the content. Close with `router.back()`. If `formSheet` isn't supported by the installed version, use the kit's bottom sheet, with the same rules: one sheet at a time and nothing stacked on top.

## 3. Stepper flow with autosaved draft

```tsx
// app/exam/new/_layout.tsx
import { Stack, usePathname } from 'expo-router';

const STEPS = ['basics', 'questions', 'settings', 'review'] as const;

export default function NewExamLayout() {
  return (
    <ExamDraftProvider>
      <Stack screenOptions={{ header: () => <StepHeader steps={STEPS} /> }} />
    </ExamDraftProvider>
  );
}

function StepHeader({ steps }: { steps: readonly string[] }) {
  const path = usePathname();
  const i = Math.max(0, steps.findIndex((s) => path.endsWith(s)));
  return (
    <View accessibilityRole="header" accessibilityLabel={`Step ${i + 1} of ${steps.length}`}>
      {/* Close (saves draft) · "Step 2 of 4" · step title · a ProgressBar at (i + 1) / steps.length */}
    </View>
  );
}
```

```tsx
// ExamDraftProvider: one source of truth for the whole flow, autosaved
type Draft = { name: string; classId?: string; subject?: string; questionIds: string[]; durationMin: number; updatedAt: number };
const DraftCtx = createContext<{ draft: Draft; patch: (p: Partial<Draft>) => void; clear: () => void } | null>(null);

export function ExamDraftProvider({ children }: PropsWithChildren) {
  const [draft, setDraft] = useState<Draft>(() => ({ name: '', questionIds: [], durationMin: 30, updatedAt: Date.now() }));
  useEffect(() => { loadDraft('exam').then((d) => d && setDraft(d)); }, []);          // resume
  useEffect(() => {
    const t = setTimeout(() => saveDraft('exam', draft), 400);                          // debounced autosave
    return () => clearTimeout(t);
  }, [draft]);
  const value = useMemo(() => ({
    draft,
    patch: (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p, updatedAt: Date.now() })),
    clear: () => { removeDraft('exam'); setDraft({ name: '', questionIds: [], durationMin: 30, updatedAt: Date.now() }); },
  }), [draft]);
  return <DraftCtx.Provider value={value}>{children}</DraftCtx.Provider>;
}
export const useExamDraft = () => useContext(DraftCtx)!;
// loadDraft/saveDraft/removeDraft: wrap AsyncStorage or the app's preferences store (JSON). Not SecureStore: drafts aren't secrets.
```

Each step screen: ≤ 5 inputs, smart defaults (pre-fill class and subject from the current context), a primary **Next** pinned at the bottom (disabled with a visible reason), Back keeps data, and the **Review** step shows a summary of each step with "Edit" links. After success: `clear()` and replace the flow with an outcome screen (`router.replace`).

## 4. Segmented views of one object (swipeable)

```tsx
import PagerView from 'react-native-pager-view';

const VIEWS = ['Students', 'Tests', 'Schedule'] as const;

export default function ClassScreen() {
  const [index, setIndex] = useState(0);
  const pager = useRef<PagerView>(null);
  return (
    <Screen>
      <ObjectHeader />                                      {/* name + 2 key stats, stays fixed */}
      <Segmented options={VIEWS} value={index} onChange={(i) => { setIndex(i); pager.current?.setPage(i); }} />
      <PagerView ref={pager} style={{ flex: 1 }} initialPage={0} onPageSelected={(e) => setIndex(e.nativeEvent.position)}>
        <StudentsView key="0" />
        <TestsView key="1" />
        <ScheduleView key="2" />
      </PagerView>
    </Screen>
  );
}
```

Each view is its own component file with its own list, empty state and primary action. Persist the last selected view per object if users usually return to it (recognition). For route-based top tabs, use `@react-navigation/material-top-tabs` with Expo Router's `withLayoutContext`.

## 5. Summary section with "See all"

```tsx
export function SummarySection<T>({ title, items, render, onSeeAll, empty }: {
  title: string; items: T[]; render: (item: T) => ReactNode; onSeeAll: () => void; empty: ReactNode;
}) {
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <SectionHeader title={title} />
        {items.length > 3 && <Button variant="ghost" size="sm" label={`See all (${items.length})`} onPress={onSeeAll} />}
      </View>
      {items.length ? items.slice(0, 3).map(render) : empty}
    </View>
  );
}
```

## 6. Disclosure ("More options")

A pressable row with a label, a short summary of the current values ("Shuffle on · 2 marks each") and a chevron that rotates. On expand, render the extra fields under it (`entering={FadeIn.duration(150)}`). Keep it collapsed by default, and **never hide required fields** in it.

## 7. Undo instead of "Are you sure?"

```tsx
// Optimistic remove + 5s undo window; commit only if not undone.
function useUndoableRemove<T extends { id: string }>(items: T[], setItems: (f: (x: T[]) => T[]) => void, commit: (id: string) => Promise<void>) {
  return (item: T) => {
    setItems((xs) => xs.filter((x) => x.id !== item.id));
    let undone = false;
    showSnackbar({
      message: `Removed ${'name' in item ? (item as any).name : 'item'}`,
      action: { label: 'Undo', onPress: () => { undone = true; setItems((xs) => [item, ...xs]); } },
      duration: 5000,
      onHide: () => { if (!undone) commit(item.id).catch(() => { setItems((xs) => [item, ...xs]); showSnackbar({ message: 'Couldn’t remove. Restored.' }); }); },
    });
  };
}
```

Keep confirmation dialogs only for **irreversible** actions that can't be delayed (deleting a published test with results, removing a teacher's access).

## 8. "Continue where you left off"

```tsx
type Resume = { kind: 'test' | 'draft' | 'practice'; title: string; progress: string; href: string; at: number };
// When a long task starts or progresses, save { kind, title, progress: '12/30 answered', href }.
// Home renders the newest unfinished item as the first card: title, progress, a primary "Continue" button → router.push(href).
// Remove it when the task completes. Show at most one (the most recent); older ones go in a "Unfinished" list.
```

## 9. Guard unsaved changes

```tsx
import { usePreventRemove } from '@react-navigation/native';

usePreventRemove(isDirty && !isSaving, ({ data }) => {
  // Prefer saving a draft silently and leaving. Ask only if the work can't be saved:
  Alert.alert('Discard changes?', 'Your changes to this question haven’t been saved.', [
    { text: 'Keep editing', style: 'cancel' },
    { text: 'Discard', style: 'destructive', onPress: () => navigation.dispatch(data.action) },
  ]);
});
```

## 10. Lists that scale

- Search in the header (sticky), the 3 most-used filters as chips, and the rest in a "Filters (n)" sheet. Show active filters as removable chips.
- Group by meaning: "Due today / This week / Later", or by first letter for people.
- Row = the primary info left, one status right, tap → detail. Secondary actions via swipe or long-press, with the same actions also available on the detail screen (discoverability).
- Every list has three non-happy states: **loading** (skeleton rows), **empty** (why it's empty + the one action that fills it), **error** (what happened + Retry).
- Remember scroll position and filters when coming back from a detail screen (don't reset the list).

## 11. Tests and timed tasks (learning apps)

- Full-screen modal stack, with tabs hidden while in a test (focus mode).
- Answers are saved locally on every change; the app survives backgrounding, calls and crashes.
- The question palette lives in a sheet. Submitting goes through a review screen (unanswered/flagged counts with jump links).
- Leaving mid-test: "Your answers are saved. You can continue until 4:30 PM." Never discard silently.
