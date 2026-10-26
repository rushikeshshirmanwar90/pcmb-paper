import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, CodeInput, ErrorText, Field, Icon, PasswordField, usePalette } from '@/components/kit';
import { emailApi } from '@/services/email-api';

type Step = 'email' | 'code' | 'done';

/** Forgot password: a code goes to their email, then they choose a new password. */
export function ForgotPasswordScreen({ initialEmail, onBack }: { initialEmail: string; onBack: (email?: string) => void }) {
  const palette = usePalette();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  const sendCode = async () => {
    if (!email.trim()) return setError('Enter the email you log in with.');
    setBusy(true);
    setError(null);
    try {
      await emailApi.forgotPassword(email.trim());
      setStep('code');
      setWait(60);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send the code.");
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (code.length !== 6) return setError('Enter the 6-digit code from the email.');
    if (password.length < 8) return setError('Your new password needs at least 8 characters.');
    if (password !== confirm) return setError("The two passwords don't match.");
    setBusy(true);
    setError(null);
    try {
      await emailApi.resetPassword(email.trim(), code, password);
      setStep('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't reset the password.");
    } finally {
      setBusy(false);
    }
  };

  if (step === 'done') {
    return (
      <SafeAreaView style={[styles.root, styles.centered, { backgroundColor: palette.background }]}>
        <View style={[styles.mark, { backgroundColor: palette.successSoft }]}>
          <Icon name={{ ios: 'checkmark.shield.fill', android: 'verified_user' }} color={palette.success} size={28} />
        </View>
        <Text accessibilityRole="header" style={[styles.title, { color: palette.foreground }]}>
          Password changed
        </Text>
        <Text style={[styles.lead, { color: palette.mutedForeground }]}>Log in with your new password. Your other devices were logged out.</Text>
        <View style={styles.actions}>
          <Button label="Log in" onPress={() => onBack(email.trim())} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: palette.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.root}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Pressable accessibilityRole="button" onPress={step === 'code' ? () => setStep('email') : () => onBack()} hitSlop={8} style={styles.back}>
            <Icon name={{ ios: 'chevron.left', android: 'arrow_back' }} color={palette.primary} size={16} />
            <Text style={[styles.backText, { color: palette.primary }]}>{step === 'code' ? 'Change email' : 'Back to log in'}</Text>
          </Pressable>
          <Text accessibilityRole="header" style={[styles.title, styles.left, { color: palette.foreground }]}>
            {step === 'email' ? 'Forgot your password?' : 'Choose a new password'}
          </Text>
          <Text style={[styles.lead, styles.left, { color: palette.mutedForeground }]}>
            {step === 'email' ? "Enter the email you log in with. We'll send a 6-digit code to reset your password." : `If ${email.trim()} has an account, a 6-digit code is on its way.`}
          </Text>

          <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
            {step === 'email' ? (
              <>
                <Field
                  label="Email"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  autoComplete="email"
                  textContentType="username"
                  returnKeyType="send"
                  onSubmitEditing={sendCode}
                />
                <ErrorText message={error} />
                <Button label="Send code" onPress={sendCode} loading={busy} />
              </>
            ) : (
              <>
                <Text style={[styles.label, { color: palette.mutedForeground }]}>Code from the email</Text>
                <CodeInput value={code} onChange={(c) => { setCode(c); setError(null); }} />
                <PasswordField label="New password" value={password} onChangeText={setPassword} hint="At least 8 characters." autoComplete="new-password" textContentType="newPassword" />
                <PasswordField label="New password again" value={confirm} onChangeText={setConfirm} autoComplete="new-password" textContentType="newPassword" returnKeyType="go" onSubmitEditing={reset} />
                <ErrorText message={error} />
                <Button label="Change password" onPress={reset} loading={busy} />
                <Pressable accessibilityRole="button" onPress={sendCode} disabled={wait > 0 || busy} style={styles.center} hitSlop={8}>
                  <Text style={[styles.link, { color: wait > 0 ? palette.mutedForeground : palette.primary }]}>
                    {wait > 0 ? `Send a new code in ${wait}s` : 'Send a new code'}
                  </Text>
                </Pressable>
              </>
            )}
          </View>
          {step === 'code' ? <Text style={[styles.small, { color: palette.mutedForeground }]}>Can&apos;t find it? Look in Spam or Promotions. The code works for 10 minutes.</Text> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 },
  content: { flexGrow: 1, padding: 24, gap: 10, width: '100%', maxWidth: 440, alignSelf: 'center' },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 6, marginBottom: 8 },
  backText: { fontSize: 15, fontWeight: '600' },
  mark: { width: 60, height: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  title: { fontSize: 26, fontWeight: '800', textAlign: 'center' },
  left: { textAlign: 'left' },
  lead: { fontSize: 15, lineHeight: 22, textAlign: 'center', marginBottom: 8 },
  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 14 },
  label: { fontSize: 13, fontWeight: '600' },
  center: { alignSelf: 'center', paddingVertical: 6 },
  link: { fontSize: 15, fontWeight: '700' },
  small: { fontSize: 13, lineHeight: 19 },
  actions: { alignSelf: 'stretch', maxWidth: 360, width: '100%', marginTop: 12, marginHorizontal: 'auto' },
});
