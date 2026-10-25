import { AppHeader } from '@/components/app-header';
import { getPalette } from '@/constants/theme';
import { useAppearance } from '@/context/appearance-context';
import { useTabNavigation } from '@/context/tab-context';
import { SymbolView } from 'expo-symbols';
import { memo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const GRADES = ['9th', '10th', '11th', '12th'] as const;
const EXAM_TRACKS = ['Foundation', 'JEE', 'NEET'] as const;
const SUBJECTS = ['Physics', 'Chemistry', 'Mathematics', 'Biology', 'Science'] as const;

function ProfileScreenComponent() {
  const { mode } = useAppearance();
  const palette = getPalette(mode === 'dark');
  const insets = useSafeAreaInsets();
  const { goToTab, setQuestionsMode } = useTabNavigation();
  const [name, setName] = useState('');
  const [grade, setGrade] = useState<string | null>(null);
  const [examTrack, setExamTrack] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [expandedPolicy, setExpandedPolicy] = useState<'privacy' | 'terms' | null>(null);

  return (
    <SafeAreaView edges={['top']} style={[styles.root, { backgroundColor: palette.background }]}>
        <AppHeader title="Profile" subtitle="Manage your study profile and preferences" />
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: Math.max(insets.bottom, 20) + 120 },
          ]}
          showsVerticalScrollIndicator={false}>
          {/* ── Learner Identity Card ── */}
          <View style={[styles.profileCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <View style={[styles.avatar, { backgroundColor: palette.primary }]}>
              <View style={styles.avatarIconFrame}>
                <SymbolView
                  name={{ ios: 'person.fill', android: 'person', web: 'person' }}
                  tintColor={palette.onPrimary}
                  size={34}
                  style={styles.avatarIcon}
                />
              </View>
            </View>
            <Text style={[styles.profileTitle, { color: palette.foreground }]}>
              {name.trim() || 'Learner Profile'}
            </Text>
            <View style={styles.profileBadgeRow}>
              {grade ? (
                <View style={[styles.profileBadge, { backgroundColor: palette.primarySoft }]}>
                  <Text style={[styles.profileBadgeText, { color: palette.primaryInk }]}>{grade} Grade</Text>
                </View>
              ) : null}
              {examTrack ? (
                <View style={[styles.profileBadge, { backgroundColor: palette.secondary }]}>
                  <Text style={[styles.profileBadgeText, { color: palette.foreground }]}>{examTrack}</Text>
                </View>
              ) : null}
              {!grade && !examTrack ? (
                <Text style={[styles.profileSubtitle, { color: palette.mutedForeground }]}>
                  Set your study track below to personalize questions
                </Text>
              ) : null}
            </View>
          </View>

          {/* ── Personal Details Section ── */}
          <View style={[styles.section, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <View style={styles.sectionHeaderRow}>
              <View style={[styles.sectionIconWrap, { backgroundColor: palette.primarySoft }]}>
                <SymbolView
                  name={{ ios: 'person.text.rectangle', android: 'badge', web: 'badge' }}
                  tintColor={palette.primary}
                  size={18}
                />
              </View>
              <View style={styles.sectionHeaderCopy}>
                <Text style={[styles.sectionTitle, { color: palette.foreground }]}>Personal details</Text>
                <Text style={[styles.sectionSubtitle, { color: palette.mutedForeground }]}>
                  Your name displayed on tests
                </Text>
              </View>
            </View>
            <Text style={[styles.fieldLabel, { color: palette.mutedForeground }]}>YOUR NAME</Text>
            <TextInput
              accessibilityLabel="Your name"
              onChangeText={setName}
              placeholder="Enter your name"
              placeholderTextColor={palette.mutedForeground}
              value={name}
              style={[styles.textInput, { borderColor: palette.input, color: palette.foreground, backgroundColor: palette.background }]}
            />
          </View>

          {/* ── Study Preferences Section ── */}
          <View style={[styles.section, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <View style={styles.sectionHeaderRow}>
              <View style={[styles.sectionIconWrap, { backgroundColor: palette.primarySoft }]}>
                <SymbolView
                  name={{ ios: 'graduationcap', android: 'school', web: 'school' }}
                  tintColor={palette.primary}
                  size={18}
                />
              </View>
              <View style={styles.sectionHeaderCopy}>
                <Text style={[styles.sectionTitle, { color: palette.foreground }]}>Study preferences</Text>
                <Text style={[styles.sectionSubtitle, { color: palette.mutedForeground }]}>
                  Target exam track & subjects
                </Text>
              </View>
            </View>

            <Text style={[styles.fieldLabel, { color: palette.mutedForeground }]}>GRADE</Text>
            <View style={styles.optionRow}>
              {GRADES.map((option) => {
                const isSelected = grade === option;
                return (
                  <Pressable
                    key={option}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => setGrade(isSelected ? null : option)}
                    style={({ pressed }) => [
                      styles.option,
                      {
                        backgroundColor: isSelected ? palette.primary : palette.card,
                        borderColor: isSelected ? palette.primary : palette.border,
                      },
                      pressed && styles.pressed,
                    ]}>
                    <Text
                      style={[
                        styles.optionText,
                        { color: isSelected ? palette.onPrimary : palette.inkSoft },
                      ]}>
                      {option}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.fieldLabel, { color: palette.mutedForeground }, styles.examLabel]}>
              EXAM TRACK
            </Text>
            <View style={styles.optionRow}>
              {EXAM_TRACKS.map((option) => {
                const isSelected = examTrack === option;
                return (
                  <Pressable
                    key={option}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => setExamTrack(isSelected ? null : option)}
                    style={({ pressed }) => [
                      styles.option,
                      {
                        backgroundColor: isSelected ? palette.primary : palette.card,
                        borderColor: isSelected ? palette.primary : palette.border,
                      },
                      pressed && styles.pressed,
                    ]}>
                    <Text
                      style={[
                        styles.optionText,
                        { color: isSelected ? palette.onPrimary : palette.inkSoft },
                      ]}>
                      {option}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.fieldLabel, { color: palette.mutedForeground }, styles.subjectsLabel]}>
              SUBJECTS
            </Text>
            <View style={styles.optionRow}>
              {SUBJECTS.map((subject) => {
                const selected = subjects.includes(subject);
                return (
                  <Pressable
                    key={subject}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() =>
                      setSubjects((current) =>
                        selected ? current.filter((item) => item !== subject) : [...current, subject]
                      )
                    }
                    style={({ pressed }) => [
                      styles.option,
                      {
                        backgroundColor: selected ? palette.primary : palette.card,
                        borderColor: selected ? palette.primary : palette.border,
                      },
                      pressed && styles.pressed,
                    ]}>
                    <Text
                      style={[
                        styles.optionText,
                        { color: selected ? palette.onPrimary : palette.inkSoft },
                      ]}>
                      {subject}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* ── My PDFs: every paper made, saved on this phone ── */}
          <View style={[styles.section, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setQuestionsMode('pdfs');
                goToTab('questions');
              }}
              style={({ pressed }) => [styles.policyRow, pressed && { opacity: 0.75 }]}>
              <View style={[styles.policyIcon, { backgroundColor: palette.primarySoft }]}>
                <SymbolView
                  name={{ ios: 'folder.fill', android: 'folder', web: 'folder' }}
                  tintColor={palette.primary}
                  size={18}
                />
              </View>
              <View style={styles.policyTextGroup}>
                <Text style={[styles.policyTitle, { color: palette.foreground }]}>See your saved PDFs</Text>
                <Text style={[styles.policySubtitle, { color: palette.mutedForeground }]}>
                  Open, share or print the papers you made
                </Text>
              </View>
              <SymbolView
                name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
                tintColor={palette.mutedForeground}
                size={18}
              />
            </Pressable>
          </View>

          {/* ── Policies & Terms Section ── */}
          <View style={[styles.section, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <View style={styles.sectionHeaderRow}>
              <View style={[styles.sectionIconWrap, { backgroundColor: palette.primarySoft }]}>
                <SymbolView
                  name={{ ios: 'shield', android: 'security', web: 'security' }}
                  tintColor={palette.primary}
                  size={18}
                />
              </View>
              <View style={styles.sectionHeaderCopy}>
                <Text style={[styles.sectionTitle, { color: palette.foreground }]}>Policies & terms</Text>
                <Text style={[styles.sectionSubtitle, { color: palette.mutedForeground }]}>
                  Data usage & guidelines
                </Text>
              </View>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: expandedPolicy === 'privacy' }}
              onPress={() => setExpandedPolicy((current) => (current === 'privacy' ? null : 'privacy'))}
              style={[styles.policyRow, { borderBottomColor: palette.border }]}>
              <View style={[styles.policyIcon, { backgroundColor: palette.primarySoft }]}>
                <SymbolView
                  name={{ ios: 'hand.raised', android: 'policy', web: 'policy' }}
                  tintColor={palette.primary}
                  size={18}
                />
              </View>
              <View style={styles.policyTextGroup}>
                <Text style={[styles.policyTitle, { color: palette.foreground }]}>Privacy & data</Text>
                <Text style={[styles.policySubtitle, { color: palette.mutedForeground }]}>
                  What this app stores and sends
                </Text>
              </View>
              <SymbolView
                name={{
                  ios: expandedPolicy === 'privacy' ? 'chevron.up' : 'chevron.down',
                  android: expandedPolicy === 'privacy' ? 'expand_less' : 'expand_more',
                  web: expandedPolicy === 'privacy' ? 'expand_less' : 'expand_more',
                }}
                tintColor={palette.mutedForeground}
                size={18}
              />
            </Pressable>
            {expandedPolicy === 'privacy' && (
              <Text style={[styles.policyBody, { color: palette.inkSoft }]}>
                Your profile name, grade, exam track, and subject choices stay in this device for your current session. Question and paper filters are sent to the practice service to retrieve curated results.
              </Text>
            )}

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: expandedPolicy === 'terms' }}
              onPress={() => setExpandedPolicy((current) => (current === 'terms' ? null : 'terms'))}
              style={styles.policyRow}>
              <View style={[styles.policyIcon, { backgroundColor: palette.warningSoft }]}>
                <SymbolView
                  name={{ ios: 'doc.text', android: 'description', web: 'description' }}
                  tintColor={palette.warning}
                  size={18}
                />
              </View>
              <View style={styles.policyTextGroup}>
                <Text style={[styles.policyTitle, { color: palette.foreground }]}>Terms of use</Text>
                <Text style={[styles.policySubtitle, { color: palette.mutedForeground }]}>
                  Study responsibly
                </Text>
              </View>
              <SymbolView
                name={{
                  ios: expandedPolicy === 'terms' ? 'chevron.up' : 'chevron.down',
                  android: expandedPolicy === 'terms' ? 'expand_less' : 'expand_more',
                  web: expandedPolicy === 'terms' ? 'expand_less' : 'expand_more',
                }}
                tintColor={palette.mutedForeground}
                size={18}
              />
            </Pressable>
            {expandedPolicy === 'terms' && (
              <Text style={[styles.policyBody, { color: palette.inkSoft }]}>
                Use practice content as a study aid. Confirm important answers with trusted course materials and consult official sources for current syllabus and exam requirements.
              </Text>
            )}
            <Text style={[styles.policyDisclaimer, { color: palette.mutedForeground }]}>
              In-app summaries only; no external policy documents are configured.
            </Text>
          </View>

          {/* ── Brand Footer ── */}
          <View style={[styles.brandFooter, { borderTopColor: palette.border }]}>
            <Text style={[styles.brandEyebrow, { color: palette.mutedForeground }]}>DESIGNED & DEVELOPED BY</Text>
            <Text style={[styles.brandName, { color: palette.primary }]}>EXPONENTOR</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
  );
}

export const ProfileScreen = memo(ProfileScreenComponent);
export default ProfileScreen;

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 140,
    gap: 16,
  },
  profileCard: {
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 24,
  },
  avatar: {
    width: 76,
    height: 76,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 38,
    marginBottom: 14,
  },
  avatarIconFrame: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  avatarIcon: { width: 34, height: 34 },
  profileTitle: { fontSize: 20, fontWeight: '700' },
  profileSubtitle: { fontSize: 13, marginTop: 6, textAlign: 'center' },
  profileBadgeRow: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap', justifyContent: 'center' },
  profileBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
  },
  profileBadgeText: { fontSize: 12, fontWeight: '700' },

  // Section card
  section: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 18,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  sectionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeaderCopy: { flex: 1 },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  sectionSubtitle: { fontSize: 12, marginTop: 2 },

  // Form Fields & Options
  fieldLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, marginBottom: 8 },
  textInput: {
    height: 46,
    borderWidth: 1,
    borderRadius: 8,
    fontSize: 14,
    paddingHorizontal: 14,
  },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: {
    minWidth: 64,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: 8,
  },
  optionText: { fontSize: 13, fontWeight: '600' },
  examLabel: { marginTop: 18 },
  subjectsLabel: { marginTop: 18 },

  // Policy
  policyRow: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1,
    paddingVertical: 8,
  },
  policyIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  policyTextGroup: { flex: 1 },
  policyTitle: { fontSize: 14, fontWeight: '600' },
  policySubtitle: { fontSize: 12, marginTop: 2 },
  policyBody: { fontSize: 13, lineHeight: 20, paddingTop: 12, paddingBottom: 16 },
  policyDisclaimer: { fontSize: 11, lineHeight: 16, paddingTop: 12 },

  // Footer
  brandFooter: { alignItems: 'center', borderTopWidth: 1, paddingTop: 20 },
  brandEyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  brandName: { fontSize: 14, fontWeight: '800', marginTop: 4, letterSpacing: 1 },
  pressed: { opacity: 0.72 },
});