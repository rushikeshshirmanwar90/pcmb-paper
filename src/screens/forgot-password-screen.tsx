<<<<<<< HEAD
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, type TextInputInstance, View } from 'react-native';
=======
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
>>>>>>> 8ce38ca54eb9706ddc3736c1b82fd445f3e61052
import { Button, CodeInput, ErrorText, Field, Icon, PasswordField, usePalette } from '@/components/kit';
import { KeyboardAwareScrollView } from '@/components/keyboard-safe-view';
import { emailApi } from '@/services/email-api';
import { AuthCard, AuthScreen, AuthTitle, AuthTopBar, BackLink, Bubble, FinePrint, Strong, TextLink } from '@/screens/auth-ui';

type Step = 'email' | 'code' | 'done';
type Problems = Partial<Record<'email' | 'code' | 'password' | 'confirm', string>>;

/** Forgot password: a code goes to their email, then they choose a new password. */
export function ForgotPasswordScreen({ initialEmail, onBack }: { initialEmail: string; onBack: (email?: string) => void }) {
  const palette = usePalette();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [problems, setProblems] = useState<Problems>({});
  /** What the server said, shown above the button. */
  const [error, setError] = useState<string | null>(null);
  const [wait, setWait] = useState(0);
  const emailRef = useRef<TextInputInstance>(null);
  const passwordRef = useRef<TextInputInstance>(null);
  const confirmRef = useRef<TextInputInstance>(null);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  const clear = (field: keyof Problems) => {
    setProblems((p) => ({ ...p, [field]: undefined }));
    setError(null);
  };

  const sendCode = async () => {
    const address = email.trim();
    const problem = !address ? 'Enter the email you log in with.' : !address.includes('@') ? 'Enter your full email, like name@example.com.' : undefined;
    setProblems({ email: problem });
    setError(null);
    if (problem) {
      emailRef.current?.focus();
      return;
    }
    setBusy(true);
    try {
      await emailApi.forgotPassword(address);
      setStep('code');
      setWait(60);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send the code.");
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    const found: Problems = {};
    if (code.length !== 6) found.code = 'Enter the 6-digit code from the email.';
    if (password.length < 8) found.password = 'Use at least 8 characters.';
    else if (password !== confirm) found.confirm = "This doesn't match the password above.";
    setProblems(found);
    setError(null);
    if (found.password) passwordRef.current?.focus();
    else if (found.confirm) confirmRef.current?.focus();
    if (Object.values(found).some(Boolean)) return;
    setBusy(true);
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
      <AuthScreen centered>
        <View style={styles.doneMark}>
          <Bubble size={52} variant="filled" color={palette.success}>
            <Icon name={{ ios: 'checkmark', android: 'check' }} color={palette.onPrimary} size={24} />
          </Bubble>
        </View>
        <AuthTitle title="Password changed" lead="Log in with your new password. Your other devices were logged out." />
        <Button label="Log in" onPress={() => onBack(email.trim())} />
      </AuthScreen>
    );
  }

  // The tuition may have typed a student's or teacher's email, so the code can't always reach them.
  const noAccess = 'No access to this email? Your tuition can set a new password for you. Tuitions can ask the PCMB team.';

  if (step === 'email') {
    return (
      <AuthScreen>
        <AuthTopBar leading={<BackLink label="Back to log in" onPress={() => onBack()} />} />
        <AuthTitle title="Forgot your password?" lead="Enter the email you log in with. A 6-digit code goes to it, so you can choose a new password." />
        <AuthCard>
          <Field
            ref={emailRef}
            label="Email"
            value={email}
            onChangeText={(v) => {
              setEmail(v);
              clear('email');
            }}
            error={problems.email}
            placeholder="name@example.com"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoComplete="email"
            textContentType="username"
            returnKeyType="send"
            onSubmitEditing={sendCode}
            editable={!busy}
          />
          <ErrorText message={error} />
          <Button label="Send code" onPress={sendCode} loading={busy} />
        </AuthCard>
        <FinePrint>{noAccess}</FinePrint>
      </AuthScreen>
    );
  }

  return (
<<<<<<< HEAD
    <AuthScreen>
      <AuthTopBar leading={<BackLink label="Change email" onPress={() => setStep('email')} />} />
      <AuthTitle
        title="Choose a new password"
        lead={
          <>
            If <Strong>{email.trim()}</Strong> has an account, a 6-digit code is on its way.
          </>
        }
      />
      <AuthCard>
        <View style={styles.codeField}>
          <Text style={[styles.label, { color: palette.mutedForeground }]}>Code from the email</Text>
          <CodeInput
            value={code}
            onChange={(c) => {
              setCode(c);
              clear('code');
            }}
            onComplete={() => passwordRef.current?.focus()}
          />
          <ErrorText message={problems.code} />
        </View>
        <PasswordField
          ref={passwordRef}
          label="New password"
          value={password}
          onChangeText={(v) => {
            setPassword(v);
            clear('password');
          }}
          error={problems.password}
          hint="At least 8 characters."
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => confirmRef.current?.focus()}
          editable={!busy}
        />
        <PasswordField
          ref={confirmRef}
          label="New password again"
          value={confirm}
          onChangeText={(v) => {
            setConfirm(v);
            clear('confirm');
          }}
          error={problems.confirm}
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="go"
          onSubmitEditing={reset}
          editable={!busy}
        />
        <ErrorText message={error} />
        <Button label="Change password" onPress={reset} loading={busy} />
        <TextLink label={wait > 0 ? `Send a new code in ${wait}s` : 'Send a new code'} onPress={sendCode} disabled={wait > 0 || busy} align="center" />
      </AuthCard>
      <FinePrint>Can&apos;t find it? Look in Spam or Promotions. The code works for 10 minutes. {noAccess}</FinePrint>
    </AuthScreen>
=======
    <SafeAreaView style={[styles.root, { backgroundColor: palette.background }]}>
      <KeyboardAvoidingView behavior="padding" style={styles.root}>
        <KeyboardAwareScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
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
        </KeyboardAwareScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
>>>>>>> 8ce38ca54eb9706ddc3736c1b82fd445f3e61052
  );
}

const styles = StyleSheet.create({
  doneMark: { marginBottom: 24 },
  codeField: { gap: 8 },
  label: { fontSize: 13, fontWeight: '600' },
});
