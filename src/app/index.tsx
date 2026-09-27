import { StyleSheet, Text, View, ScrollView, Pressable, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Colors, Spacing, BottomTabInset, MaxContentWidth } from '@/constants/theme';

const CATEGORIES = [
  {
    id: 'foundation-9',
    title: 'Foundation',
    subtitle: '9th Grade',
    emoji: '🌱',
    gradient: ['#6366F1', '#818CF8'],
    bg: '#EEF2FF',
    darkBg: '#1E1B4B',
    color: '#4338CA',
    darkColor: '#A5B4FC',
  },
  {
    id: 'foundation-10',
    title: 'Foundation',
    subtitle: '10th Grade',
    emoji: '📐',
    gradient: ['#8B5CF6', '#A78BFA'],
    bg: '#F5F3FF',
    darkBg: '#2E1065',
    color: '#6D28D9',
    darkColor: '#C4B5FD',
  },
  {
    id: 'jee-neet-11',
    title: 'JEE / NEET',
    subtitle: '11th Grade',
    emoji: '⚗️',
    gradient: ['#0EA5E9', '#38BDF8'],
    bg: '#F0F9FF',
    darkBg: '#0C4A6E',
    color: '#0369A1',
    darkColor: '#7DD3FC',
  },
  {
    id: 'jee-neet-12',
    title: 'JEE / NEET',
    subtitle: '12th Grade',
    emoji: '🎯',
    gradient: ['#10B981', '#34D399'],
    bg: '#ECFDF5',
    darkBg: '#064E3B',
    color: '#047857',
    darkColor: '#6EE7B7',
  },
];

const QUICK_FILTERS = [
  { label: '⚡ Easy', level: 'Easy', color: '#065F46', bg: '#D1FAE5' },
  { label: '🔥 Mid', level: 'Mid', color: '#92400E', bg: '#FEF3C7' },
  { label: '💎 Hard', level: 'Hard', color: '#991B1B', bg: '#FEE2E2' },
];

const SUBJECTS = [
  { name: 'Physics', emoji: '⚛️', color: '#5B21B6', bg: '#EDE9FE', darkBg: '#2E1065' },
  { name: 'Chemistry', emoji: '🧪', color: '#065F46', bg: '#ECFDF5', darkBg: '#064E3B' },
  { name: 'Mathematics', emoji: '📊', color: '#1E40AF', bg: '#EFF6FF', darkBg: '#1E3A5F' },
  { name: 'Biology', emoji: '🌿', color: '#9A3412', bg: '#FFF7ED', darkBg: '#431407' },
  { name: 'Science', emoji: '🔬', color: '#075985', bg: '#F0F9FF', darkBg: '#0C4A6E' },
];

function navigateToQuestions(params: Record<string, string>) {
  // Navigate to questions tab with pre-applied filters
  // Expo Router: we push the questions tab directly
  router.push({ pathname: '/questions', params });
}

export default function HomeScreen() {
  const scheme = useColorScheme();
  const dark = scheme === 'dark';
  const colors = Colors[dark ? 'dark' : 'light'];

  const bg = colors.background;
  const textColor = colors.text;
  const mutedColor = colors.textSecondary;
  const cardBg = dark ? '#1C1C1E' : '#FFFFFF';
  const borderColor = dark ? '#2D2D30' : '#E2E8F0';

  return (
    <View style={[styles.root, { backgroundColor: bg }]}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { maxWidth: MaxContentWidth }]}
        style={{ alignSelf: 'center', width: '100%' }}
      >
        <SafeAreaView edges={['top']}>

          {/* ── Hero header ── */}
          <View style={[styles.heroCard, { backgroundColor: '#6366F1' }]}>
            <Text style={styles.heroEmoji}>📚</Text>
            <Text style={styles.heroTitle}>PCMB Practice</Text>
            <Text style={styles.heroSubtitle}>
              Foundation (9–10) · JEE / NEET (11–12){'\n'}
              Filter by Subject · Chapter · Topic · Level
            </Text>
            <View style={styles.heroActions}>
              <Pressable
                style={styles.heroPrimaryBtn}
                onPress={() => router.push('/questions')}
              >
                <Text style={styles.heroPrimaryBtnText}>Browse Questions →</Text>
              </Pressable>
              <Pressable
                style={styles.heroSecondaryBtn}
                onPress={() => router.push('/explore')}
              >
                <Text style={styles.heroSecondaryBtnText}>View Papers</Text>
              </Pressable>
            </View>
          </View>

          {/* ── Competitive categories ── */}
          <Text style={[styles.sectionTitle, { color: textColor }]}>Competitive Exam</Text>
          <View style={styles.categoryGrid}>
            {CATEGORIES.map((cat) => (
              <Pressable
                key={cat.id}
                style={({ pressed }) => [
                  styles.categoryCard,
                  {
                    backgroundColor: dark ? cat.darkBg : cat.bg,
                    borderColor,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
                onPress={() => {
                  const [examCat, , grade] = [
                    cat.title === 'Foundation' ? 'Foundation' : 'JEE/NEET',
                    '',
                    cat.subtitle.replace(' Grade', '') as any,
                  ];
                  navigateToQuestions({ examCategory: examCat, standard: grade });
                }}
              >
                <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
                <Text style={[styles.categoryTitle, { color: dark ? cat.darkColor : cat.color }]}>
                  {cat.title}
                </Text>
                <Text style={[styles.categorySubtitle, { color: dark ? cat.darkColor : cat.color, opacity: 0.75 }]}>
                  {cat.subtitle}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* ── Quick level filters ── */}
          <Text style={[styles.sectionTitle, { color: textColor }]}>Quick Level</Text>
          <View style={styles.levelRow}>
            {QUICK_FILTERS.map((f) => (
              <Pressable
                key={f.level}
                style={[styles.levelChip, { backgroundColor: f.bg }]}
                onPress={() => navigateToQuestions({ level: f.level })}
              >
                <Text style={[styles.levelChipText, { color: f.color }]}>{f.label}</Text>
              </Pressable>
            ))}
          </View>

          {/* ── Subject shortcuts ── */}
          <Text style={[styles.sectionTitle, { color: textColor }]}>By Subject</Text>
          <View style={styles.subjectGrid}>
            {SUBJECTS.map((subj) => (
              <Pressable
                key={subj.name}
                style={({ pressed }) => [
                  styles.subjectCard,
                  {
                    backgroundColor: dark ? subj.darkBg : subj.bg,
                    borderColor,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
                onPress={() => navigateToQuestions({ subject: subj.name })}
              >
                <Text style={styles.subjectEmoji}>{subj.emoji}</Text>
                <Text style={[styles.subjectName, { color: dark ? '#E2E8F0' : subj.color }]}>
                  {subj.name}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* ── Info card ── */}
          <View style={[styles.infoCard, { backgroundColor: cardBg, borderColor }]}>
            <Text style={[styles.infoTitle, { color: textColor }]}>ℹ️  How it works</Text>
            <Text style={[styles.infoBody, { color: mutedColor }]}>
              Questions are uploaded via the web admin panel. Each PDF is tagged with competitive
              exam category, standard, subject, chapter, topic and level — so you can filter down
              to exactly what you need.
            </Text>
          </View>

          <View style={{ height: BottomTabInset + Spacing.four }} />
        </SafeAreaView>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.three },

  // Hero
  heroCard: {
    borderRadius: 20,
    padding: 24,
    marginTop: 16,
    marginBottom: 24,
    alignItems: 'center',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  },
  heroEmoji: { fontSize: 44, marginBottom: 8 },
  heroTitle: { fontSize: 28, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5, textAlign: 'center' },
  heroSubtitle: { fontSize: 14, color: '#C7D2FE', marginTop: 6, textAlign: 'center', lineHeight: 20 },
  heroActions: { flexDirection: 'row', gap: 10, marginTop: 20, flexWrap: 'wrap', justifyContent: 'center' },
  heroPrimaryBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  heroPrimaryBtnText: { color: '#6366F1', fontWeight: '800', fontSize: 14 },
  heroSecondaryBtn: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  heroSecondaryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },

  // Section title
  sectionTitle: { fontSize: 17, fontWeight: '800', letterSpacing: -0.2, marginBottom: 12 },

  // Category grid (2x2)
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  categoryCard: {
    width: '47.5%',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    alignItems: 'flex-start',
  },
  categoryEmoji: { fontSize: 28, marginBottom: 8 },
  categoryTitle: { fontSize: 14, fontWeight: '800' },
  categorySubtitle: { fontSize: 12, fontWeight: '600', marginTop: 2 },

  // Level chips
  levelRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  levelChip: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelChipText: { fontSize: 14, fontWeight: '700' },

  // Subject grid
  subjectGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  subjectCard: {
    width: '30%',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    alignItems: 'center',
  },
  subjectEmoji: { fontSize: 24, marginBottom: 6 },
  subjectName: { fontSize: 12, fontWeight: '700', textAlign: 'center' },

  // Info card
  infoCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 8,
  },
  infoTitle: { fontSize: 14, fontWeight: '700', marginBottom: 6 },
  infoBody: { fontSize: 13, lineHeight: 20 },
});
