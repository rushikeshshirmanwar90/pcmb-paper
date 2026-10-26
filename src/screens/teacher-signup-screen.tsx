import React, { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, ErrorText, Field, Icon, MultiChips, PasswordField, usePalette } from '@/components/kit';
import { SCHOOL_SUBJECTS, type SchoolSubject } from '@/constants/school';
import { signupApi } from '@/services/signup-api';

type Step = 'code' | 'details' | 'sent';

/**
 * A teacher signs up with their tuition's join code: check the code (and
 * see which tuition it is), then their details. The tuition approves the
 * account before they can log in.
 */
export function TeacherSignupScreen({ onBack }: { onBack: () => void }) {
  const palette = usePalette();
  const [step, setStep] = useState<Step>('code');
  const [code, setCode] = useState('');
  const [tuition, setTuition] = useState<{ name: string; address: string } | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [subjects, setSubjects] = useState<SchoolSubject[]>([]);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const emailRef = useRef<TextInput>(null);

  const checkCode = async () => {
    const cleaned = code.replace(/[^a-z0-9]/gi, '');
    if (cleaned.length !== 8) return setError('The join code has 8 letters and numbers, like K7Q2-M9TA.');
    setBusy(true);
    setError(null);
    try {
      setTuition(await signupApi.checkCode(cleaned));
      setStep('details');
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't check the code.");
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    if (!name.trim()) return setError('Enter your name.');
    if (!email.trim()) return setError('Enter your email; you log in with it.');
    if (!subjects.length) return setError('Pick the subjects you teach.');
    if (password.length < 8) return setError('Your password needs at least 8 characters.');
    if (password !== confirm) return setError("The two passwords don't match.");
    setBusy(true);
    setError(null);
    try {
      await signupApi.joinAsTeacher({ code, name: name.trim(), email: email.trim(), phone: phone.trim(), subjects, password });
      setStep('sent');
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send your request. Try again.");
    } finally {
      setBusy(false);
    }
  };

  // "k7q2m9ta" → "K7Q2-M9TA" as they type.
  const typeCode = (value: string) => {
    const raw = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    setCode(raw.length > 4 ? `${raw.slice(0, 4)}-${raw.slice(4)}` : raw);
    setError(null);
  };

  if (step === 'sent') {
    return (
      <SafeAreaView style={[styles.root, styles.centered, { backgroundColor: palette.background }]}>
        <View style={[styles.mark, { backgroundColor: palette.successSoft }]}>
          <Icon name={{ ios: 'paperplane.fill', android: 'send' }} color={palette.success} size={28} />
        </View>
        <Text accessibilityRole="header" style={[styles.title, { color: palette.foreground }]}>
          Request sent
        </Text>
        <Text style={[styles.lead, { color: palette.mutedForeground }]}>
          {tuition?.name} has been asked to approve your account. Once they do, log in with {email.trim()} and your password.
        </Text>
        <View style={[styles.note, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text style={[styles.noteText, { color: palette.foreground }]}>
            If it takes a while, remind your tuition to check the Teachers tab in their app.
          </Text>
        </View>
        <View style={styles.actions}>
          <Button label="Back to log in" onPress={onBack} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: palette.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.root}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Pressable accessibilityRole="button" onPress={step === 'details' ? () => setStep('code') : onBack} hitSlop={8} style={styles.back}>
            <Icon name={{ ios: 'chevron.left', android: 'arrow_back' }} color={palette.primary} size={16} />
            <Text style={[styles.backText, { color: palette.primary }]}>{step === 'details' ? 'Change code' : 'Log in instead'}</Text>
          </Pressable>

          <Text accessibilityRole="header" style={[styles.title, styles.left, { color: palette.foreground }]}>
            Join your tuition as a teacher
          </Text>

          {/* Where they are: two steps. */}
          <View style={styles.steps} accessibilityLabel={`Step ${step === 'code' ? 1 : 2} of 2`}>
            {(['code', 'details'] as const).map((s, i) => (
              <View key={s} style={[styles.stepBar, { backgroundColor: step === 'code' && i === 1 ? palette.border : palette.primary }]} />
            ))}
          </View>
          <Text style={[styles.stepLabel, { color: palette.mutedForeground }]}>
            Step {step === 'code' ? 1 : 2} of 2: {step === 'code' ? "your tuition's code" : 'your details'}
          </Text>

          <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
            {step === 'code' ? (
              <>
                <Text style={[styles.body, { color: palette.foreground }]}>
                  Ask your tuition for its join code. They find it on the Teachers tab of their app.
                </Text>
                <Field
                  label="Join code"
                  value={code}
                  onChangeText={typeCode}
                  placeholder="K7Q2-M9TA"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={9}
                  returnKeyType="next"
                  onSubmitEditing={checkCode}
                  style={styles.codeInput}
                />
                <ErrorText message={error} />
                <Button label="Continue" onPress={checkCode} loading={busy} />
              </>
            ) : (
              <>
                <View style={[styles.tuition, { backgroundColor: palette.primarySoft }]}>
                  <Icon name={{ ios: 'building.2', android: 'apartment' }} color={palette.primaryInk} size={18} />
                  <View style={styles.flex}>
                    <Text style={[styles.tuitionLabel, { color: palette.primaryInk }]}>You&apos;re joining</Text>
                    <Text style={[styles.tuitionName, { color: palette.foreground }]}>{tuition?.name}</Text>
                    {tuition?.address ? <Text style={[styles.tuitionAddress, { color: palette.mutedForeground }]}>{tuition.address}</Text> : null}
                  </View>
                </View>
                <Field label="Your name" value={name} onChangeText={setName} autoComplete="name" textContentType="name" returnKeyType="next" onSubmitEditing={() => emailRef.current?.focus()} maxLength={100} />
                <Field
                  ref={emailRef}
                  label="Email"
                  value={email}
                  onChangeText={setEmail}
                  hint="You log in with this."
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  autoComplete="email"
                  textContentType="username"
                />
                <Field label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" maxLength={20} />
                <MultiChips label="Subjects you teach" choices={SCHOOL_SUBJECTS} selected={subjects} onChange={setSubjects} />
                <PasswordField label="Password" value={password} onChangeText={setPassword} hint="At least 8 characters." autoComplete="new-password" textContentType="newPassword" />
                <PasswordField label="Password again" value={confirm} onChangeText={setConfirm} autoComplete="new-password" textContentType="newPassword" />
                <ErrorText message={error} />
                <Button label="Send request to join" onPress={send} loading={busy} />
                <Text style={[styles.small, { color: palette.mutedForeground }]}>
                  Your tuition approves your account before you can log in.
                </Text>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 },
  content: { flexGrow: 1, padding: 24, gap: 10, width: '100%', maxWidth: 480, alignSelf: 'center' },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 6, marginBottom: 8 },
  backText: { fontSize: 15, fontWeight: '600' },
  mark: { width: 60, height: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  title: { fontSize: 26, fontWeight: '800', textAlign: 'center' },
  left: { textAlign: 'left' },
  lead: { fontSize: 15, lineHeight: 22, textAlign: 'center', maxWidth: 380 },
  steps: { flexDirection: 'row', gap: 6, marginTop: 6 },
  stepBar: { flex: 1, height: 4, borderRadius: 2 },
  stepLabel: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 16 },
  body: { fontSize: 15, lineHeight: 22 },
  codeInput: { fontSize: 22, fontWeight: '700', letterSpacing: 3, textAlign: 'center' },
  tuition: { flexDirection: 'row', gap: 12, borderRadius: 12, padding: 12, alignItems: 'flex-start' },
  tuitionLabel: { fontSize: 12, fontWeight: '700' },
  tuitionName: { fontSize: 17, fontWeight: '800', marginTop: 1 },
  tuitionAddress: { fontSize: 13, marginTop: 1 },
  small: { fontSize: 13, textAlign: 'center' },
  note: { borderWidth: 1, borderRadius: 12, padding: 14, maxWidth: 380, marginTop: 8 },
  noteText: { fontSize: 14, lineHeight: 20 },
  actions: { alignSelf: 'stretch', maxWidth: 360, width: '100%', marginTop: 12, marginHorizontal: 'auto' },
});
