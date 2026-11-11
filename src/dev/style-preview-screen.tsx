import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter, type Href } from 'expo-router';
import { Badge, Button, Card, Chips, EmptyView, ErrorView, ListRow, Notice, ProgressBar, SectionTitle, Segmented, StatTile, StatusChip } from '@/components/kit';
import { SubjectChips } from '@/components/subject-chips';
import type { MeSnapshot } from '@/engagement/engagement-store';
import { goalFill, goalText, levelCaption, levelFill, streakCaption } from '@/engagement/progress-format';
import { useNeoFonts } from '@/design/fonts';
import { useVibrationSetting } from '@/design/haptics';
import { NeoIcon, NeoText, PressableNeo, useNeoPalette } from '@/design/neo-kit';
import { DesignProvider } from '@/design/scope';
import { STATUS, type StatusKind } from '@/design/status';
import { contrast, Neo, textStyles, type TextVariant } from '@/design/tokens';

// Dev-only: the student look (neobrutalism, lavender) on sample data, before
// any real screen changes. Every piece is the shared kit inside the student
// design scope, so what shows here is what student screens will get.
// Open it with: adb shell am start -a android.intent.action.VIEW -d "pcmb://dev/style-preview"

type Mode = 'light' | 'dark';
type Width = 'full' | 'narrow';

export function StylePreviewScreen() {
  const [mode, setMode] = useState<Mode>('light');
  const [width, setWidth] = useState<Width>('full');
  const fontsReady = useNeoFonts();
  return (
    <DesignProvider design="neo" dark={mode === 'dark'}>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      {fontsReady ? <Preview mode={mode} setMode={setMode} width={width} setWidth={setWidth} /> : <Loading />}
    </DesignProvider>
  );
}

function Loading() {
  const p = useNeoPalette();
  return (
    <View style={[styles.loading, { backgroundColor: p.canvas }]}>
      <ActivityIndicator color={p.ink} />
    </View>
  );
}

function Preview({ mode, setMode, width, setWidth }: { mode: Mode; setMode: (m: Mode) => void; width: Width; setWidth: (w: Width) => void }) {
  const p = useNeoPalette();
  const router = useRouter();
  const [vibration, setVibration] = useVibrationSetting();
  return (
    <SafeAreaView edges={['top']} style={[styles.root, { backgroundColor: p.canvas }]}>
      <View style={styles.topBar}>
        <PressableNeo
          radius={Neo.radius.sm}
          offset={Neo.shadow.sm}
          accessibilityLabel="Back"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/' as Href))}
          faceStyle={styles.back}
        >
          <NeoIcon name={{ ios: 'chevron.left', android: 'arrow_back' }} size={18} />
        </PressableNeo>
        <View style={styles.flex}>
          <NeoText variant="title" numberOfLines={1}>
            Style preview
          </NeoText>
          <NeoText variant="caption" soft numberOfLines={1}>
            The student look, before real screens change
          </NeoText>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.controls}>
          <Segmented label="Theme" value={mode} onChange={setMode} options={[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} />
          <Segmented label="Width" value={width} onChange={setWidth} options={[{ value: 'full', label: 'This phone' }, { value: 'narrow', label: '320px phone' }]} />
          <Chips
            label="Vibration (haptics on the main buttons and chips)"
            choices={['on', 'off'] as const}
            selected={vibration ? 'on' : 'off'}
            onChange={(v) => setVibration(v === 'on')}
            labels={{ on: 'On', off: 'Off' }}
          />
        </View>
        <View style={[styles.column, width === 'narrow' && styles.narrow]}>
          <SampleHome />
          <Palette />
          <TypeScale />
          <Buttons />
          <Cards />
          <Statuses />
          <Rows />
          <States />
          <NeoText variant="caption" soft style={styles.footer}>
            {mode === 'dark' ? 'Dark' : 'Light'} · Lexend + Unbounded · lavender preset
          </NeoText>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Sample student Home ──────────────────────────────────────────────────

const ME: MeSnapshot = {
  enabled: true,
  xp: { total: 860, level: 3, levelStartXp: 600, nextLevelXp: 1000, intoLevel: 260, toNext: 140, progress: 0.65 },
  today: { date: '2026-11-12', xp: 30, goal: 50, goalKey: 'regular', goalMet: false, practiceXp: 30, practiceCap: 150 },
  streak: { current: 6, longest: 11, freezes: 1, maxFreezes: 2, securedToday: false },
};

function SampleHome() {
  return (
    <View style={styles.section}>
      <Overline text="Sample · student Home" />
      <View style={styles.greeting}>
        <NeoText variant="display">Hi, Aarav</NeoText>
        <NeoText variant="body" soft>
          Your test is due today. Then 5 quick questions.
        </NeoText>
      </View>
      <ProgressStrip me={ME} />

      {/* The one big thing: what to do now. */}
      <Card style={styles.hero}>
        <View style={styles.between}>
          <NeoText variant="overline">Next up</NeoText>
          <StatusChip kind="due" />
        </View>
        <NeoText variant="heading">Mock test 3: Mechanics</NeoText>
        <SubjectChips subjects="Physics, Maths" />
        <NeoText variant="bodySm" soft>
          30 questions · 45 min · closes 6 PM
        </NeoText>
        <Button label="Start test" icon={{ ios: 'play.fill', android: 'play_arrow' }} onPress={() => {}} />
      </Card>

      <SectionTitle title="Today's practice" />
      <Card style={styles.flush}>
        <View>
          <ListRow
            icon={{ ios: 'sparkles', android: 'auto_awesome' }}
            title="Today's 5"
            subtitle="5 questions from chapters you're learning"
            right={<StatusChip kind="new" />}
            onPress={() => {}}
          />
          <ListRow icon={{ ios: 'arrow.uturn.backward', android: 'undo' }} title="Revise mistakes" subtitle="4 questions to try again" onPress={() => {}} />
          <ListRow icon={{ ios: 'book', android: 'menu_book' }} title="Continue: Electrostatics" subtitle="12 of 20 PYQs done" right={<Badge label="60%" tone="violet" />} onPress={() => {}} last />
        </View>
      </Card>

      <SectionTitle title="Coming up" />
      <Card style={styles.flush}>
        <View>
          <ListRow icon={{ ios: 'doc.text', android: 'description' }} title="Organic Chemistry test" subtitle="Fri 4 PM · 25 questions" right={<StatusChip kind="upcoming" word="Fri" />} onPress={() => {}} last />
        </View>
      </Card>
    </View>
  );
}

/** The progress header in the student look: streak · today's goal · level. Numbers from the server only. */
function ProgressStrip({ me }: { me: MeSnapshot }) {
  return (
    <View style={styles.strip}>
      <Card style={styles.tile}>
        <View style={styles.inline}>
          <NeoIcon name={{ ios: 'flame.fill', android: 'local_fire_department' }} size={18} />
          <NeoText variant="number">{me.streak.current}</NeoText>
        </View>
        <NeoText variant="caption" soft numberOfLines={1}>
          {streakCaption(me.streak)}
        </NeoText>
      </Card>
      <Card style={[styles.tile, styles.tileWide]}>
        <View style={styles.inline}>
          <NeoIcon name={{ ios: 'target', android: 'track_changes' }} size={18} />
          <NeoText variant="number">{goalText(me.today)}</NeoText>
        </View>
        <ProgressBar value={goalFill(me.today) * 100} tone={me.today.goalMet ? 'success' : 'primary'} />
        <NeoText variant="caption" soft numberOfLines={1}>
          {me.today.goalMet ? 'Goal done' : 'XP today'}
        </NeoText>
      </Card>
      <Card style={styles.tile}>
        <View style={styles.inline}>
          <NeoIcon name={{ ios: 'star.fill', android: 'star' }} size={18} />
          <NeoText variant="number">L{me.xp.level}</NeoText>
        </View>
        <NeoText variant="caption" soft numberOfLines={1}>
          {levelCaption(me.xp)} ({Math.round(levelFill(me.xp) * 100)}%)
        </NeoText>
      </Card>
    </View>
  );
}

// ─── Foundations ──────────────────────────────────────────────────────────

const SWATCHES = ['canvas', 'surface', 'subtle', 'ink', 'inkSoft', 'primary', 'primarySoft', 'highlight', 'success', 'successSoft', 'warning', 'warningSoft', 'danger', 'dangerSoft', 'info', 'infoSoft'] as const;

function Palette() {
  const p = useNeoPalette();
  return (
    <View style={styles.section}>
      <Overline text="Palette" />
      <View style={styles.swatches}>
        {SWATCHES.map((k) => {
          const text = k === 'ink' || k === 'inkSoft' ? p.canvas : k === 'canvas' || k === 'surface' || k === 'subtle' || k.endsWith('Soft') ? p.ink : p.onAccent;
          return (
            <View key={k} style={[styles.swatch, { backgroundColor: p[k], borderColor: p.ink }]}>
              <NeoText variant="caption" style={{ color: text, fontFamily: textStyles.label.fontFamily }}>
                {k}
              </NeoText>
              <NeoText variant="caption" style={{ color: text }}>
                {p[k]} · {contrast(text, p[k]).toFixed(1)}:1
              </NeoText>
            </View>
          );
        })}
      </View>
      <NeoText variant="caption" soft>
        Selection uses purple (primary). Where you are uses lime (highlight). Accents are fills, never text colours.
      </NeoText>
    </View>
  );
}

const TYPE: { v: TextVariant; use: string }[] = [
  { v: 'display', use: 'Home greeting' },
  { v: 'title', use: 'Screen title' },
  { v: 'heading', use: 'Section title' },
  { v: 'subheading', use: 'Card title, buttons' },
  { v: 'body', use: 'Reading text, questions' },
  { v: 'bodySm', use: 'Details' },
  { v: 'caption', use: 'Meta, chips' },
  { v: 'overline', use: 'Group label' },
  { v: 'number', use: 'Scores, counts' },
];

function TypeScale() {
  return (
    <View style={styles.section}>
      <Overline text="Type scale" />
      <Card>
        {TYPE.map(({ v, use }) => (
          <View key={v} style={styles.typeRow}>
            <NeoText variant={v} numberOfLines={1}>
              {v === 'number' ? '72/100' : use}
            </NeoText>
            <NeoText variant="caption" soft>
              {v} · {textStyles[v].fontSize}px · {textStyles[v].fontFamily.replace('_', ' ')}
            </NeoText>
          </View>
        ))}
      </Card>
    </View>
  );
}

function Buttons() {
  const [busy, setBusy] = useState(false);
  return (
    <View style={styles.section}>
      <Overline text="Buttons" />
      <Card>
        <Button label="Start practice" icon={{ ios: 'play.fill', android: 'play_arrow' }} onPress={() => {}} />
        <Button label="See results" variant="secondary" onPress={() => {}} />
        <Button label="Revise mistakes" variant="tonal" onPress={() => {}} />
        <Button label="Leave the test" variant="danger" onPress={() => {}} />
        <Button label="Not now" variant="ghost" onPress={() => {}} />
        <View style={styles.disabled}>
          <Button label="Submit" disabled onPress={() => {}} />
          <NeoText variant="caption" soft>
            Disabled says why: answer at least one question first.
          </NeoText>
        </View>
        <Button
          label={busy ? 'Saving…' : 'Save (tap: busy for 2 s)'}
          loading={busy}
          onPress={() => {
            setBusy(true);
            setTimeout(() => setBusy(false), 2000);
          }}
        />
      </Card>
    </View>
  );
}

function Cards() {
  const [filter, setFilter] = useState<'All' | 'Physics' | 'Chemistry' | 'Maths'>('All');
  return (
    <View style={styles.section}>
      <Overline text="Cards, numbers, filters" />
      <Card>
        <NeoText variant="subheading">Laws of Motion</NeoText>
        <NeoText variant="bodySm" soft>
          A card has at most three text sizes: title, details, meta.
        </NeoText>
        <NeoText variant="caption" soft>
          Physics · 42 PYQs
        </NeoText>
      </Card>
      <View style={styles.stats}>
        <StatTile label="Accuracy" value="78%" icon={{ ios: 'scope', android: 'my_location' }} tone="success" />
        <StatTile label="Tests" value={12} icon={{ ios: 'doc.text', android: 'description' }} tone="violet" />
      </View>
      <Chips label="Subject" choices={['All', 'Physics', 'Chemistry', 'Maths'] as const} selected={filter} onChange={setFilter} />
    </View>
  );
}

function Statuses() {
  return (
    <View style={styles.section}>
      <Overline text="Status chips (colour + word + icon)" />
      <View style={styles.wrap}>
        {(Object.keys(STATUS) as StatusKind[]).map((k) => (
          <StatusChip key={k} kind={k} />
        ))}
      </View>
      <Overline text="Subject chips" />
      <SubjectChips subjects="Physics, Chemistry, Maths, Biology" />
      <View style={styles.wrap}>
        <Badge label="NEET" />
        <Badge label="Weak" tone="warning" />
        <Badge label="Strong" tone="success" />
      </View>
    </View>
  );
}

function Rows() {
  return (
    <View style={styles.section}>
      <Overline text="List rows" />
      <Card style={styles.flush}>
        <View>
          <ListRow icon={{ ios: 'atom', android: 'science' }} title="Physics" subtitle="14 of 29 chapters covered" right={<ProgressMini value={48} />} onPress={() => {}} />
          <ListRow icon={{ ios: 'flask', android: 'science' }} title="Chemistry" subtitle="Test on Friday" right={<StatusChip kind="upcoming" word="Fri" />} onPress={() => {}} />
          <ListRow icon={{ ios: 'function', android: 'functions' }} title="Maths" subtitle="All done for this week" right={<StatusChip kind="done" />} last />
        </View>
      </Card>
      <ProgressBar value={35} />
      <ProgressBar value={100} tone="success" />
    </View>
  );
}

function ProgressMini({ value }: { value: number }) {
  return (
    <View style={styles.mini}>
      <ProgressBar value={value} />
    </View>
  );
}

function States() {
  return (
    <View style={styles.section}>
      <Overline text="Empty, error, notices" />
      <Card>
        <EmptyView
          icon={{ ios: 'doc.text.magnifyingglass', android: 'quiz' }}
          title="No tests yet"
          text="Your teacher's tests show here. Practise a chapter meanwhile."
          action={<Button label="Practise a chapter" variant="secondary" onPress={() => {}} />}
        />
      </Card>
      <Card>
        <ErrorView message="Couldn't load your tests. Check your internet and try again." onRetry={() => {}} />
      </Card>
      <Notice tone="info" title="Results come out on Monday" text="Your teacher releases them after everyone has taken the test." />
      <Notice tone="success" title="Saved" text="Your answers are safe." />
      <Notice tone="warning" title="You're offline" text="Showing your last numbers. Pull down to refresh." />
    </View>
  );
}

function Overline({ text }: { text: string }) {
  return <NeoText variant="overline">{text}</NeoText>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1, minWidth: 0 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: Neo.screenPadding, paddingTop: 8, paddingBottom: 8 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: Neo.screenPadding, paddingBottom: 48, gap: 20 },
  controls: { gap: 12 },
  column: { gap: 28, width: '100%', maxWidth: 560, alignSelf: 'center' },
  narrow: { width: 320 - 2 * Neo.screenPadding, alignSelf: 'center' },
  section: { gap: 12 },
  greeting: { gap: 4 },
  hero: { gap: 10 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  flush: { paddingVertical: 0, gap: 0 },
  strip: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { flexGrow: 1, flexBasis: '28%', minWidth: 92, padding: Neo.space.md, gap: 4 },
  tileWide: { flexBasis: '36%' },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  swatch: { flexGrow: 1, flexBasis: '45%', borderWidth: Neo.border.width, borderRadius: Neo.radius.md, padding: 10, gap: 2 },
  typeRow: { gap: 2 },
  disabled: { gap: 6 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  mini: { width: 64 },
  footer: { textAlign: 'center' },
});
