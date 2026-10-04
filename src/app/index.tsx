import React, { memo, useEffect, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { AppHeader } from '@/components/app-header';
import { PdfBuilderScreen } from '@/components/pdf-builder-screen';
import { SideDrawer } from '@/components/side-drawer';
import { Colors, getPalette, Spacing, MaxContentWidth } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTabNavigation } from '@/context/tab-context';
import { useAppearance } from '@/context/appearance-context';
import type { DifficultyLevel, ExamCategory, Standard, Subject } from '@/types/pcmb';

const CATEGORIES = [
  {
    id: 'foundation-9',
    title: 'Foundation',
    subtitle: '9th Grade',
    mark: '09',
  },
  {
    id: 'foundation-10',
    title: 'Foundation',
    subtitle: '10th Grade',
    mark: '10',
  },
  {
    id: 'jee-neet-11',
    title: 'JEE / NEET',
    subtitle: '11th Grade',
    mark: '11',
  },
  {
    id: 'jee-neet-12',
    title: 'JEE / NEET',
    subtitle: '12th Grade',
    mark: '12',
  },
];

const QUICK_FILTERS = [
  { label: 'Easy', level: 'Easy' as DifficultyLevel },
  { label: 'Mid', level: 'Mid' as DifficultyLevel },
  { label: 'Hard', level: 'Hard' as DifficultyLevel },
];

type HomeShortcut = {
  label: string;
  destination: 1 | 2 | 3;
  accent: 'primary' | 'violet';
  icon: React.ComponentProps<typeof SymbolView>['name'];
};

const ACADEMY_SHORTCUTS: HomeShortcut[] = [
  { label: 'PDF', destination: 2, accent: 'primary', icon: { ios: 'doc.text', android: 'picture_as_pdf', web: 'picture_as_pdf' } },
  { label: 'PDF Lite', destination: 2, accent: 'primary', icon: { ios: 'doc.text.magnifyingglass', android: 'description', web: 'description' } },
  { label: 'OMR Users', destination: 3, accent: 'violet', icon: { ios: 'person.3.fill', android: 'groups', web: 'groups' } },
  { label: 'Theory', destination: 1, accent: 'violet', icon: { ios: 'text.book.closed.fill', android: 'menu_book', web: 'menu_book' } },
  { label: 'PYQ Practice', destination: 1, accent: 'primary', icon: { ios: 'clock.arrow.circlepath', android: 'history', web: 'history' } },
  { label: 'Question Bank', destination: 1, accent: 'violet', icon: { ios: 'books.vertical.fill', android: 'library_books', web: 'library_books' } },
  { label: 'Demo Videos', destination: 2, accent: 'primary', icon: { ios: 'play.rectangle.fill', android: 'play_circle', web: 'play_circle' } },
  { label: 'Question Count', destination: 1, accent: 'violet', icon: { ios: 'number', android: 'numbers', web: 'numbers' } },
  { label: 'Bookmark', destination: 1, accent: 'primary', icon: { ios: 'bookmark.fill', android: 'bookmark', web: 'bookmark' } },
  { label: 'Referral', destination: 3, accent: 'violet', icon: { ios: 'person.2.fill', android: 'share', web: 'share' } },
];

const MANAGE_SHORTCUTS: HomeShortcut[] = [
  { label: 'Subscription', destination: 3, accent: 'primary', icon: { ios: 'creditcard.fill', android: 'payments', web: 'payments' } },
  { label: 'Price Calculator', destination: 3, accent: 'violet', icon: { ios: 'function', android: 'calculate', web: 'calculate' } },
  { label: 'Bank Details', destination: 3, accent: 'primary', icon: { ios: 'building.columns.fill', android: 'account_balance', web: 'account_balance' } },
  { label: 'Discount Codes', destination: 3, accent: 'violet', icon: { ios: 'tag.fill', android: 'sell', web: 'sell' } },
  { label: 'User Setting', destination: 3, accent: 'primary', icon: { ios: 'person.crop.circle', android: 'manage_accounts', web: 'manage_accounts' } },
  { label: 'Device Management', destination: 3, accent: 'violet', icon: { ios: 'iphone.gen3', android: 'devices', web: 'devices' } },
  { label: 'Issue List', destination: 3, accent: 'primary', icon: { ios: 'exclamationmark.bubble.fill', android: 'report_problem', web: 'report_problem' } },
  { label: 'Product List', destination: 2, accent: 'violet', icon: { ios: 'shippingbox.fill', android: 'inventory_2', web: 'inventory_2' } },
];

const SUBJECTS = [
  { name: 'Physics' as Subject, icon: { ios: 'atom', android: 'science', web: 'science' } },
  { name: 'Chemistry' as Subject, icon: { ios: 'flask', android: 'science', web: 'science' } },
  { name: 'Mathematics' as Subject, icon: { ios: 'function', android: 'calculate', web: 'calculate' } },
  { name: 'Biology' as Subject, icon: { ios: 'leaf', android: 'biotech', web: 'biotech' } },
  { name: 'Science' as Subject, icon: { ios: 'scope', android: 'science', web: 'science' } },
] as const;

function HomeScreenComponent({
  registerOpenMenu,
}: {
  registerOpenMenu?: (openMenu: (() => void) | null) => void;
}) {
  const [menuVisible, setMenuVisible] = useState(false);
  const [pdfBuilderVisible, setPdfBuilderVisible] = useState(false);
  const scheme = useColorScheme();
  const dark = scheme === 'dark';
  const palette = getPalette(dark);
  const colors = Colors[dark ? 'dark' : 'light'];
  const { goToTab } = useTabNavigation();
  const { mode, setMode } = useAppearance();

  const bg = colors.background;
  const textColor = colors.text;
  const mutedColor = colors.textSecondary;
  const cardBg = palette.card;
  const borderColor = palette.border;

  useEffect(() => {
    registerOpenMenu?.(() => setMenuVisible(true));
    return () => registerOpenMenu?.(null);
  }, [registerOpenMenu]);

  return (
    <SafeAreaView edges={['top']} style={[styles.root, { backgroundColor: bg }]}>
      <AppHeader
        title="Your study desk"
        subtitle="PCMB Practice · Foundation to NEET"
        onMenuPress={() => setMenuVisible(true)}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { maxWidth: MaxContentWidth, paddingBottom: 90 }]}
        style={{ alignSelf: 'center', width: '100%' }}>
        
        {/* ── Hero Banner ── */}
        <View style={[styles.heroCard, { backgroundColor: cardBg, borderColor }]}>
          <Text style={[styles.heroEyebrow, { color: palette.primary }]}>MAKE YOUR NEXT SESSION COUNT</Text>
          <Text style={[styles.heroTitle, { color: palette.mutedForeground }]}>Practice with a plan.</Text>
          <Text style={[styles.heroSubtitle, { color: palette.mutedForeground }]}>
            Build confidence in Physics, Chemistry, Mathematics and Biology.
          </Text>
          <View style={styles.heroActions}>
            <Pressable
              style={({ pressed }) => [styles.heroPrimaryBtn, { backgroundColor: palette.primary }, pressed && styles.pressed]}
              onPress={() => goToTab(1)}>
              <Text style={[styles.heroPrimaryBtnText, { color: palette.onPrimary }]}>Start practicing</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.heroSecondaryBtn, { backgroundColor: cardBg, borderColor }, pressed && styles.pressed]}
              onPress={() => goToTab(2)}>
              <Text style={[styles.heroSecondaryBtnText, { color: palette.foreground }]}>Browse papers</Text>
            </Pressable>
          </View>
        </View>

        {/* ── Track Selector ── */}
        <Text style={[styles.sectionTitle, { color: textColor }]}>Choose your track</Text>
        <Text style={[styles.sectionSubtitle, { color: mutedColor }]}>Pick a grade to focus your practice.</Text>
        <View style={styles.categoryGrid}>
          {CATEGORIES.map((cat) => (
            <Pressable
              key={cat.id}
              style={({ pressed }) => [
                styles.categoryCard,
                {
                  backgroundColor: cardBg,
                  borderColor,
                  borderLeftColor: palette.primary,
                  opacity: pressed ? 0.72 : 1,
                },
              ]}
              onPress={() => {
                const examCat: ExamCategory = cat.title === 'Foundation' ? 'Foundation' : 'JEE/NEET';
                const grade = cat.subtitle.replace(' Grade', '') as Standard;
                goToTab(1, { questionFilters: { examCategory: examCat, standard: grade } });
              }}
            >
              <View style={styles.categoryTopRow}>
                <Text style={[styles.categoryMark, { color: dark ? palette.cardForeground : palette.primary }]}>{cat.mark}</Text>
                <SymbolView
                  name={{ ios: 'arrow.up.right', android: 'arrow_outward', web: 'arrow_outward' }}
                  tintColor={palette.primary}
                  size={16} />
              </View>
              <Text style={[styles.categoryTitle, { color: textColor }]}>{cat.subtitle}</Text>
              <Text style={[styles.categorySubtitle, { color: mutedColor }]}>{cat.title}</Text>
            </Pressable>
          ))}
        </View>

        {/* ── Quick level filters ── */}
        <Text style={[styles.sectionTitle, { color: textColor }]}>Practice by level</Text>
        <View style={styles.levelRow}>
          {QUICK_FILTERS.map((f) => {
            const status = f.level === 'Easy'
              ? { bg: palette.successSoft, text: palette.successInk, border: palette.successBorder }
              : f.level === 'Hard'
                ? { bg: palette.dangerSoft, text: palette.dangerInk, border: palette.dangerBorder }
                : { bg: palette.warningSoft, text: palette.warningInk, border: palette.warningBorder };
            return (
              <Pressable
                key={f.level}
                style={({ pressed }) => [styles.levelChip, { backgroundColor: status.bg, borderColor: status.border }, pressed && styles.pressed]}
                onPress={() => goToTab(1, { questionFilters: { level: f.level } })}>
                <Text style={[styles.levelChipMeta, { color: status.text }]}>LEVEL</Text>
                <Text style={[styles.levelChipText, { color: status.text }]}>{f.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* ── Subject shortcuts ── */}
        <Text style={[styles.sectionTitle, { color: textColor }]}>Explore a subject</Text>
        <View style={styles.subjectGrid}>
          {SUBJECTS.map((subj) => (
            <Pressable
              key={subj.name}
              style={({ pressed }) => [
                styles.subjectCard,
                {
                  backgroundColor: cardBg,
                  borderColor,
                  opacity: pressed ? 0.72 : 1,
                },
              ]}
              onPress={() => goToTab(1, { questionFilters: { subject: subj.name } })}
            >
              <SymbolView name={subj.icon} tintColor={palette.violet} size={20} />
              <Text style={[styles.subjectName, { color: textColor }]}>{subj.name}</Text>
            </Pressable>
          ))}
        </View>

      </ScrollView>
      <SideDrawer
        visible={menuVisible}
        title="PCMB Paper"
        subtitle="Your learning workspace"
        side="left"
        onClose={() => setMenuVisible(false)}>
        <View style={styles.drawerContent}>
          <ScrollView
            style={styles.drawerMenuScroll}
            contentContainerStyle={styles.drawerMenu}
            showsVerticalScrollIndicator={false}>
            <Text style={[styles.drawerSectionLabel, { color: palette.mutedForeground }]}>ACADEMY</Text>
            <View style={styles.drawerGroup}>
              {ACADEMY_SHORTCUTS.map((shortcut) => (
                <DrawerItem
                  key={shortcut.label}
                  label={shortcut.label}
                  icon={shortcut.icon}
                  palette={palette}
                  onPress={shortcut.label === 'PDF' ? () => {
                    setMenuVisible(false);
                    setTimeout(() => setPdfBuilderVisible(true), 220);
                  } : undefined}
                />
              ))}
            </View>

            <Text style={[styles.drawerSectionLabel, styles.drawerSectionSpaced, { color: palette.mutedForeground }]}>MANAGE</Text>
            <View style={styles.drawerGroup}>
              {MANAGE_SHORTCUTS.map((shortcut) => (
                <DrawerItem
                  key={shortcut.label}
                  label={shortcut.label}
                  icon={shortcut.icon}
                  palette={palette}
                />
              ))}
            </View>
          </ScrollView>

          <View style={[styles.appearanceFooter, { borderTopColor: palette.sidebarBorder }]}>
            <View style={styles.appearanceHeading}>
              <View style={[styles.appearanceIcon, { backgroundColor: palette.primarySoft }]}>
                <SymbolView
                  name={{ ios: 'circle.lefthalf.filled', android: 'palette', web: 'palette' }}
                  tintColor={palette.primary}
                  size={17}
                />
              </View>
              <View>
                <Text style={[styles.appearanceTitle, { color: palette.sidebarForeground }]}>Appearance</Text>
                <Text style={[styles.appearanceSubtitle, { color: palette.mutedForeground }]}>Choose your theme</Text>
              </View>
            </View>
            <View style={[styles.themeToggle, { backgroundColor: palette.sidebarHover }]}>
              {(['light', 'dark'] as const).map((theme) => {
                const selected = mode === theme;
                return (
                  <Pressable
                    key={theme}
                    accessibilityRole="button"
                    accessibilityLabel={`${theme === 'light' ? 'Light' : 'Dark'} mode`}
                    accessibilityState={{ selected }}
                    onPress={() => setMode(theme)}
                    style={({ pressed }) => [
                      styles.themeToggleOption,
                      selected && { backgroundColor: palette.card },
                      pressed && styles.pressed,
                    ]}>
                    <SymbolView
                      name={theme === 'light'
                        ? { ios: 'sun.max.fill', android: 'light_mode', web: 'light_mode' }
                        : { ios: 'moon.fill', android: 'dark_mode', web: 'dark_mode' }}
                      tintColor={selected ? palette.primary : palette.mutedForeground}
                      size={16}
                    />
                    <Text style={[
                      styles.themeToggleText,
                      { color: selected ? palette.foreground : palette.mutedForeground },
                    ]}>
                      {theme === 'light' ? 'Light' : 'Dark'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </SideDrawer>
      <PdfBuilderScreen visible={pdfBuilderVisible} onClose={() => setPdfBuilderVisible(false)} />
    </SafeAreaView>
  );
}

function DrawerItem({
  label,
  icon,
  palette,
  onPress,
}: {
  label: string;
  icon: HomeShortcut['icon'];
  palette: ReturnType<typeof getPalette>;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={label}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.drawerItem,
        pressed && onPress ? styles.pressed : undefined,
      ]}>
      <SymbolView
        name={icon}
        tintColor={palette.mutedForeground}
        size={19}
      />
      <Text style={[styles.drawerItemLabel, { color: palette.sidebarForeground }]}>
        {label}
      </Text>
    </Pressable>
  );
}

export const HomeScreen = memo(HomeScreenComponent);
export default HomeScreen;

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.three, paddingTop: Spacing.four },

  // Hero
  heroCard: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 22,
    marginBottom: 24,
    alignItems: 'flex-start',
  },
  heroEyebrow: { fontSize: 11, fontWeight: '700', marginBottom: 10 },
  heroTitle: { fontSize: 26, fontWeight: '800', textAlign: 'left', fontFamily: 'serif' },
  heroSubtitle: { fontSize: 14, marginTop: 8, lineHeight: 21, maxWidth: 480 },
  heroActions: { flexDirection: 'row', gap: 10, marginTop: 18, flexWrap: 'wrap' },
  heroPrimaryBtn: {
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  heroPrimaryBtnText: { fontWeight: '700', fontSize: 14 },
  heroSecondaryBtn: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  heroSecondaryBtnText: { fontWeight: '600', fontSize: 14 },
  pressed: { opacity: 0.72 },

  // Section title
  sectionTitle: { fontSize: 17, fontWeight: '700', marginBottom: 6 },
  sectionSubtitle: { fontSize: 13, marginBottom: 14 },

  drawerContent: { flex: 1 },
  drawerMenuScroll: { flex: 1 },
  drawerMenu: { padding: 16, paddingBottom: 22 },
  drawerSectionLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.1, marginBottom: 8 },
  drawerSectionSpaced: { marginTop: 22 },
  drawerGroup: { gap: 3 },
  drawerItem: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 11,
    borderRadius: 9,
  },
  drawerItemLabel: { flex: 1, fontSize: 13, fontWeight: '500' },
  appearanceFooter: { borderTopWidth: 1, paddingHorizontal: 18, paddingTop: 14, paddingBottom: 12 },
  appearanceHeading: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  appearanceIcon: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  appearanceTitle: { fontSize: 13, fontWeight: '700' },
  appearanceSubtitle: { fontSize: 11, marginTop: 2 },
  themeToggle: { flexDirection: 'row', padding: 3, borderRadius: 10, gap: 4 },
  themeToggleOption: {
    flex: 1,
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: 8,
  },
  themeToggleText: { fontSize: 12, fontWeight: '600' },

  // Category grid (2x2)
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  categoryCard: {
    width: '48%',
    minHeight: 116,
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderLeftWidth: 3,
    justifyContent: 'space-between',
  },
  categoryTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  categoryMark: { fontSize: 24, lineHeight: 28, fontWeight: '800' },
  categoryTitle: { fontSize: 14, fontWeight: '700' },
  categorySubtitle: { fontSize: 12, fontWeight: '500', marginTop: 3 },

  // Level chips
  levelRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  levelChip: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelChipMeta: { fontSize: 9, fontWeight: '700', marginBottom: 4 },
  levelChipText: { fontSize: 14, fontWeight: '700' },

  // Subject grid
  subjectGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  subjectCard: {
    width: '31.5%',
    minHeight: 82,
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  subjectName: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
});
