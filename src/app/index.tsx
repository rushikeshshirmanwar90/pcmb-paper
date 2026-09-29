import React, { memo } from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { AppHeader } from '@/components/app-header';
import { Colors, getPalette, Spacing, MaxContentWidth } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTabNavigation } from '@/context/tab-context';
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

const SUBJECTS = [
  { name: 'Physics' as Subject, icon: { ios: 'atom', android: 'science', web: 'science' } },
  { name: 'Chemistry' as Subject, icon: { ios: 'flask', android: 'science', web: 'science' } },
  { name: 'Mathematics' as Subject, icon: { ios: 'function', android: 'calculate', web: 'calculate' } },
  { name: 'Biology' as Subject, icon: { ios: 'leaf', android: 'biotech', web: 'biotech' } },
  { name: 'Science' as Subject, icon: { ios: 'scope', android: 'science', web: 'science' } },
] as const;

function HomeScreenComponent() {
  const scheme = useColorScheme();
  const dark = scheme === 'dark';
  const palette = getPalette(dark);
  const colors = Colors[dark ? 'dark' : 'light'];
  const { goToTab } = useTabNavigation();

  const bg = colors.background;
  const textColor = colors.text;
  const mutedColor = colors.textSecondary;
  const cardBg = palette.card;
  const borderColor = palette.border;

  return (
    <SafeAreaView edges={['top']} style={[styles.root, { backgroundColor: bg }]}>
      <AppHeader title="Your study desk" subtitle="PCMB Practice · Foundation to NEET" />
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
    </SafeAreaView>
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
