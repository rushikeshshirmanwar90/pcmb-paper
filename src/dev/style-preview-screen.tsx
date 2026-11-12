import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter, type Href } from 'expo-router';
import { Badge, Button, Card, Chips, EmptyView, ErrorView, ListRow, Notice, ProgressBar, SectionTitle, Segmented, StatTile, StatusChip } from '@/components/kit';
import { SubjectChips } from '@/components/subject-chips';
import type { MeSnapshot } from '@/engagement/engagement-store';
import { goalFill, goalText, levelCaption, streakCaption } from '@/engagement/progress-format';
import { usePreviewFonts } from '@/dev/preview-fonts';
import { useVibrationSetting } from '@/design/haptics';
import {
  NeoBigNumberCard,
  NeoCodeCells,
  NeoIcon,
  NeoIconButton,
  NeoKeypad,
  NeoTabBar,
  NeoTag,
  NeoText,
  NeoTile,
  Sticker,
  useNeoPalette,
  useType,
  type KeypadKey,
} from '@/design/neo-kit';
import { DesignProvider, useIsDark } from '@/design/scope';
import { STATUS, type StatusKind } from '@/design/status';
import { contrast, FONT_OPTIONS, Neo, type FontOption, type TextVariant } from '@/design/tokens';

// Dev-only: the student look (warm-yellow neobrutalism) on sample data,
// before any real screen changes. Everything is the shared kit inside the
// student design scope, so what shows here is what student screens will get.
// Open it with: adb shell am start -a android.intent.action.VIEW -d "pcmb://dev/style-preview"

type Mode = 'light' | 'dark';
type Width = 'full' | 'narrow';
const FONT_NAMES: Record<FontOption, string> = { chivo: 'Chivo', archivo: 'Archivo', spaceGrotesk: 'Space Grotesk', familjen: 'Familjen Grotesk', hanken: 'Hanken Grotesk' };

export function StylePreviewScreen() {
  // The app has one theme now: light.
  const [mode, setMode] = useState<Mode>('light');
  const [width, setWidth] = useState<Width>('full');
  const [font, setFont] = useState<FontOption>('chivo');
  const fontsReady = usePreviewFonts();
  return (
    <DesignProvider design="neo" dark={mode === 'dark'} font={font}>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      {fontsReady ? <Preview mode={mode} setMode={setMode} width={width} setWidth={setWidth} font={font} setFont={setFont} /> : <Loading />}
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

function Preview({
  mode,
  setMode,
  width,
  setWidth,
  font,
  setFont,
}: {
  mode: Mode;
  setMode: (m: Mode) => void;
  width: Width;
  setWidth: (w: Width) => void;
  font: FontOption;
  setFont: (f: FontOption) => void;
}) {
  const p = useNeoPalette();
  const router = useRouter();
  const [vibration, setVibration] = useVibrationSetting();
  return (
    <SafeAreaView edges={['top']} style={[styles.root, { backgroundColor: p.canvas }]}>
      <View style={styles.topBar}>
        <NeoIconButton
          icon={{ ios: 'chevron.left', android: 'arrow_back' }}
          label="Back"
          shape="square"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/' as Href))}
        />
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
          <Segmented label="Width" value={width} onChange={setWidth} options={[{ value: 'full', label: 'This phone' }, { value: 'narrow', label: '320px phone' }]} />
          <Chips label="Font (the app uses Chivo; see design/app-font.ts)" choices={Object.keys(FONT_NAMES) as FontOption[]} selected={font} onChange={setFont} labels={FONT_NAMES} />
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
          <FromTheReference />
          <FontCompare />
          <Palette />
          <TypeScale />
          <Buttons />
          <Cards />
          <Statuses />
          <Rows />
          <States />
          <NeoText variant="caption" soft style={styles.center}>
            {mode === 'dark' ? 'Dark' : 'Light'} · {FONT_NAMES[font]} · sunny preset
          </NeoText>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Sample student Home (our structure, the new look) ────────────────────

const ME: MeSnapshot = {
  enabled: true,
  xp: { total: 860, level: 3, levelStartXp: 600, nextLevelXp: 1000, intoLevel: 260, toNext: 140, progress: 0.65 },
  today: { date: '2026-11-12', xp: 30, goal: 50, goalKey: 'regular', goalMet: false, practiceXp: 30, practiceCap: 150 },
  streak: { current: 6, longest: 11, freezes: 1, maxFreezes: 2, securedToday: false },
};

type StudentTab = 'home' | 'tests' | 'syllabus' | 'practice' | 'profile';
const STUDENT_TABS = [
  { key: 'home', label: 'Home', icon: { ios: 'house.fill', android: 'home' } },
  { key: 'tests', label: 'Tests', icon: { ios: 'list.clipboard', android: 'assignment' } },
  { key: 'syllabus', label: 'Syllabus', icon: { ios: 'map', android: 'map' } },
  { key: 'practice', label: 'Practice', icon: { ios: 'book', android: 'menu_book' } },
  { key: 'profile', label: 'Profile', icon: { ios: 'person.crop.circle', android: 'account_circle' } },
] as const;

function SampleHome() {
  const [tab, setTab] = useState<StudentTab>('home');
  return (
    <View style={styles.section}>
      <Overline text="Sample · student Home" />
      <View style={styles.greetingRow}>
        <View style={styles.flex}>
          <NeoText variant="display">Hello, Aarav</NeoText>
          <NeoText variant="body" soft>
            Your test is due today. Then 5 quick questions.
          </NeoText>
        </View>
        <NeoIconButton icon={{ ios: 'bell', android: 'notifications' }} label="Notifications" onPress={() => {}} />
      </View>
      <ProgressStrip me={ME} />

      {/* The one big thing: what to do now. */}
      <Card>
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
        <ListRow icon={{ ios: 'sparkles', android: 'auto_awesome' }} title="Today's 5" subtitle="5 questions from chapters you're learning" right={<StatusChip kind="new" />} onPress={() => {}} />
        <ListRow icon={{ ios: 'arrow.uturn.backward', android: 'undo' }} title="Revise mistakes" subtitle="4 questions to try again" onPress={() => {}} />
        <ListRow icon={{ ios: 'book', android: 'menu_book' }} title="Continue: Electrostatics" subtitle="12 of 20 PYQs done" right={<NeoTag label="60%" tone="violet" accessibilityLabel="60 percent done" />} onPress={() => {}} last />
      </Card>

      <SectionTitle title="Coming up" />
      <Card style={styles.flush}>
        <ListRow icon={{ ios: 'doc.text', android: 'description' }} title="Organic Chemistry test" subtitle="Fri 4 PM · 25 questions" right={<StatusChip kind="upcoming" word="Fri" />} onPress={() => {}} last />
      </Card>

      <NeoTabBar tabs={STUDENT_TABS} value={tab} onChange={setTab} />
    </View>
  );
}

/** The progress header in the new look: streak · today's goal · level, big numbers. From the server only. */
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
          {levelCaption(me.xp)}
        </NeoText>
      </Card>
    </View>
  );
}

// ─── The reference's components, with student content ────────────────────

function FromTheReference() {
  const p = useNeoPalette();
  const [code, setCode] = useState('42');
  const onKey = (k: KeypadKey) => setCode((c) => (k === 'del' ? c.slice(0, -1) : k === '.' ? c : (c + k).slice(0, 6)));
  return (
    <View style={styles.section}>
      <Overline text="Big number card" />
      <NeoBigNumberCard
        label="XP this week"
        value="320"
        caption="Level 3 · 140 XP to Level 4"
        actions={[
          { label: "Today's 5", icon: { ios: 'play.fill', android: 'play_arrow' }, onPress: () => {}, primary: true },
          { label: 'Mistakes', icon: { ios: 'arrow.uturn.backward', android: 'undo' }, onPress: () => {}, tone: 'danger' },
        ]}
      />

      <Overline text="Square tiles · jump back in" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tiles}>
        <NeoTile label="Practise" icon={{ ios: 'plus', android: 'add' }} tone="success" circle="ink" onPress={() => {}} />
        <NeoTile label="Physics" icon={{ ios: 'atom', android: 'science' }} circle="violetSoft" onPress={() => {}} />
        <NeoTile label="Chemistry" icon={{ ios: 'flask', android: 'biotech' }} circle="successSoft" onPress={() => {}} />
        <NeoTile label="Maths" icon={{ ios: 'function', android: 'functions' }} circle="dangerSoft" onPress={() => {}} />
        <NeoTile label="Biology" icon={{ ios: 'leaf', android: 'eco' }} circle="primarySoft" onPress={() => {}} />
      </ScrollView>

      <Overline text="Rows with an amount chip" />
      <Card style={styles.flush}>
        <ListRow icon={{ ios: 'doc.text', android: 'description' }} title="Mock test 2" subtitle="Oct 28 · Physics" right={<NeoTag label="72/100" tone="success" />} onPress={() => {}} />
        <ListRow icon={{ ios: 'doc.text', android: 'description' }} title="Chemistry unit test" subtitle="Oct 24 · room to grow" right={<NeoTag label="38/100" tone="dangerSoft" />} onPress={() => {}} />
        <ListRow icon={{ ios: 'sparkles', android: 'auto_awesome' }} title="Electrostatics practice" subtitle="Today · 10 questions" right={<NeoTag label="+25 XP" tone="violet" />} last />
      </Card>

      <Overline text="Keypad · join a batch" />
      <Card>
        <View style={styles.between}>
          <NeoText variant="subheading">Enter the joining code</NeoText>
          <NeoIconButton icon={{ ios: 'xmark', android: 'close' }} label="Close" size={40} onPress={() => setCode('')} />
        </View>
        <NeoCodeCells value={code} />
        <NeoKeypad onKey={onKey} decimal={false} />
      </Card>

      <Overline text="Pinned bottom button" />
      <View style={[styles.footerMock, { borderColor: p.ink }]}>
        <Button label="Start practice" size="lg" onPress={() => {}} />
      </View>

      <Overline text="Stickers (highlights, results, empty states only)" />
      <View style={styles.stickers}>
        <Sticker size={112} tone="primary" label="6-day streak">
          <NeoText variant="number" style={styles.center}>
            6
          </NeoText>
          <NeoText variant="caption" style={styles.center}>
            day streak
          </NeoText>
        </Sticker>
        <Sticker size={112} tone="success" points={18} depth={0.16} rotate={5} label="Personal best">
          <NeoText variant="label" style={styles.center}>
            Personal best!
          </NeoText>
        </Sticker>
        <Sticker size={104} tone="danger" points={12} rotate={-6} label="Chapter done">
          <NeoText variant="label" style={styles.center}>
            Chapter done
          </NeoText>
        </Sticker>
        <Sticker size={104} tone="violet" points={16} rotate={3} label="New badge">
          <NeoText variant="label" style={styles.center}>
            New badge
          </NeoText>
        </Sticker>
      </View>
    </View>
  );
}

// ─── Font comparison ──────────────────────────────────────────────────────

function FontCompare() {
  const dark = useIsDark();
  return (
    <View style={styles.section}>
      <Overline text="Font options, side by side" />
      {(Object.keys(FONT_OPTIONS) as FontOption[]).map((f) => (
        <DesignProvider key={f} design="neo" dark={dark} font={f}>
          <FontSample name={FONT_NAMES[f]} />
        </DesignProvider>
      ))}
    </View>
  );
}

function FontSample({ name }: { name: string }) {
  return (
    <Card>
      <NeoText variant="overline">{name}</NeoText>
      <NeoText variant="title">Mock test 3</NeoText>
      <NeoText variant="number">72/100 · 0123456789</NeoText>
      <NeoText variant="body">A ball is thrown up at 20 m/s. Find the maximum height it reaches.</NeoText>
      <NeoText variant="caption" soft>
        13px caption: Electrostatics · 12 of 20 PYQs · Il1 O0 rn m
      </NeoText>
    </Card>
  );
}

// ─── Foundations ──────────────────────────────────────────────────────────

const SWATCHES = ['canvas', 'surface', 'subtle', 'ink', 'inkSoft', 'primary', 'primarySoft', 'danger', 'dangerSoft', 'success', 'successSoft', 'violet', 'violetSoft', 'warning', 'info', 'dangerInk'] as const;

function Palette() {
  const p = useNeoPalette();
  return (
    <View style={styles.section}>
      <Overline text="Palette (text contrast on each fill)" />
      <View style={styles.swatches}>
        {SWATCHES.map((k) => {
          const text = k === 'ink' || k === 'inkSoft' || k === 'dangerInk' ? p.canvas : k === 'canvas' || k === 'surface' || k === 'subtle' || k.endsWith('Soft') ? p.ink : p.onAccent;
          return (
            <View key={k} style={[styles.swatch, { backgroundColor: p[k], borderColor: p.ink }]}>
              <NeoText variant="label" style={{ color: text }}>
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
        Yellow: main button, current tab, chosen item. Pink, mint, lavender: status, subjects, stickers, amounts. All text is near-black.
      </NeoText>
    </View>
  );
}

const TYPE: { v: TextVariant; use: string }[] = [
  { v: 'bigNumber', use: '320' },
  { v: 'display', use: 'Home greeting' },
  { v: 'title', use: 'Screen title' },
  { v: 'heading', use: 'Section title' },
  { v: 'subheading', use: 'Card title, buttons' },
  { v: 'body', use: 'Body text' },
  { v: 'bodySm', use: 'Details' },
  { v: 'label', use: 'Labels, chips' },
  { v: 'caption', use: 'Meta, captions' },
  { v: 'overline', use: 'Group label' },
  { v: 'number', use: '72/100' },
];

function TypeScale() {
  const type = useType();
  return (
    <View style={styles.section}>
      <Overline text="Type scale" />
      <Card>
        {TYPE.map(({ v, use }) => (
          <View key={v} style={styles.typeRow}>
            <NeoText variant={v} numberOfLines={1}>
              {use}
            </NeoText>
            <NeoText variant="caption" soft>
              {v} · {type[v].fontSize}px · {type[v].fontFamily.replace('_', ' ')}
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
        <View style={styles.inline}>
          <NeoIconButton icon={{ ios: 'xmark', android: 'close' }} label="Close" onPress={() => {}} />
          <NeoIconButton icon={{ ios: 'chevron.left', android: 'arrow_back' }} label="Back" shape="square" onPress={() => {}} />
          <NeoIconButton icon={{ ios: 'bookmark', android: 'bookmark' }} label="Save question" shape="square" tone="primary" onPress={() => {}} />
        </View>
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
        <Badge label="Weak" tone="danger" />
        <Badge label="Strong" tone="success" />
      </View>
    </View>
  );
}

function Rows() {
  return (
    <View style={styles.section}>
      <Overline text="List rows and progress" />
      <Card style={styles.flush}>
        <ListRow icon={{ ios: 'atom', android: 'science' }} title="Physics" subtitle="14 of 29 chapters covered" right={<NeoTag label="48%" tone="primary" />} onPress={() => {}} />
        <ListRow icon={{ ios: 'flask', android: 'biotech' }} title="Chemistry" subtitle="Test on Friday" right={<StatusChip kind="upcoming" word="Fri" />} onPress={() => {}} />
        <ListRow icon={{ ios: 'function', android: 'functions' }} title="Maths" subtitle="Missed last week's test" right={<StatusChip kind="missed" />} last />
      </Card>
      <ProgressBar value={35} />
      <ProgressBar value={100} tone="success" />
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
  center: { textAlign: 'center' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: Neo.screenPadding, paddingTop: 8, paddingBottom: 8 },
  scroll: { padding: Neo.screenPadding, paddingBottom: 48, gap: 20 },
  controls: { gap: 12 },
  column: { gap: 32, width: '100%', maxWidth: 560, alignSelf: 'center' },
  narrow: { width: 320 - 2 * Neo.screenPadding },
  section: { gap: 12 },
  greetingRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  flush: { paddingVertical: 0, gap: 0 },
  strip: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { flexGrow: 1, flexBasis: '28%', minWidth: 92, padding: Neo.space.md, gap: 4 },
  tileWide: { flexBasis: '36%' },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tiles: { gap: 8, paddingRight: Neo.shadow.md, paddingBottom: Neo.shadow.md },
  footerMock: { borderTopWidth: Neo.border.width, paddingTop: 12 },
  stickers: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  swatch: { flexGrow: 1, flexBasis: '45%', borderWidth: Neo.border.width, borderRadius: Neo.radius.md, padding: 10, gap: 2 },
  typeRow: { gap: 2 },
  disabled: { gap: 6 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
