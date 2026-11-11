import React, { useRef, useState } from 'react';
import { StyleSheet, type TextInputInstance, View } from 'react-native';
import { Text } from '@/components/app-text';
import { Illustration } from '@/design/illustrations';
import { useLook } from '@/design/look';
import { Button, ErrorText, Field, Icon, PasswordField, usePalette } from '@/components/kit';
import { SCHOOL_SUBJECTS } from '@/constants/school';
import { useAuth } from '@/context/auth-context';
import { AuthCard, AuthScreen, AuthTitle, Bubble, BubbleText, TextLink } from '@/screens/auth-ui';
import { ForgotPasswordScreen } from '@/screens/forgot-password-screen';
import { RegisterScreen } from '@/screens/register-screen';

/** Email and password, for the tuition, its teachers and its students alike. */
export function LoginScreen() {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  // Coming back from another screen with an email fills it in here.
  const backToLogin = (used?: string) => {
    if (used) setEmail(used);
    setMode('login');
  };
  if (mode === 'register') return <RegisterScreen onBack={backToLogin} />;
  if (mode === 'forgot') return <ForgotPasswordScreen initialEmail={email} onBack={backToLogin} />;
  return <LoginForm email={email} setEmail={setEmail} onSignUp={() => setMode('register')} onForgot={() => setMode('forgot')} />;
}

function LoginForm({
  email,
  setEmail,
  onSignUp,
  onForgot,
}: {
  email: string;
  setEmail: (v: string) => void;
  onSignUp: () => void;
  onForgot: () => void;
}) {
  const palette = usePalette();
  const look = useLook();
  const { signIn } = useAuth();
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  /** What the server said, shown above the button. */
  const [error, setError] = useState<string | null>(null);
  const emailRef = useRef<TextInputInstance>(null);
  const passwordRef = useRef<TextInputInstance>(null);

  const submit = async () => {
    const address = email.trim();
    const emailProblem = !address ? 'Enter your email.' : !address.includes('@') ? 'Enter your full email, like name@example.com.' : null;
    const passwordProblem = password ? null : 'Enter your password.';
    setEmailError(emailProblem);
    setPasswordError(passwordProblem);
    setError(null);
    // Errors sit next to their field, and the first one gets the cursor.
    if (emailProblem || passwordProblem) {
      (emailProblem ? emailRef : passwordRef).current?.focus();
      return;
    }
    setSubmitting(true);
    try {
      await signIn(address, password);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't log in. Try again.");
      setSubmitting(false);
    }
  };

  return (
    <AuthScreen centered hero={<Illustration name="welcomeHero" />}>
      {look.neo ? null : <SubjectMark />}
      <AuthTitle title="Log in" lead="Your tuition's tests, timetable and results." />

      <AuthCard>
        <Field
          ref={emailRef}
          label="Email"
          value={email}
          onChangeText={(v) => {
            setEmail(v);
            setEmailError(null);
          }}
          error={emailError}
          placeholder="name@example.com"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          autoComplete="email"
          textContentType="username"
          returnKeyType="next"
          submitBehavior="submit"
          editable={!submitting}
          onSubmitEditing={() => passwordRef.current?.focus()}
        />
        <View>
          <PasswordField
            ref={passwordRef}
            label="Password"
            value={password}
            onChangeText={(v) => {
              setPassword(v);
              setPasswordError(null);
            }}
            error={passwordError}
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            editable={!submitting}
            onSubmitEditing={submit}
          />
          <View style={styles.forgot}>
            <TextLink label="Forgot password?" onPress={onForgot} disabled={submitting} align="end" />
          </View>
        </View>
        <ErrorText message={error} />
        <Button label="Log in" onPress={submit} loading={submitting} />
      </AuthCard>

      {/*
        How each role gets in the first time. Students and teachers: the tuition
        added them (log in above) or gave them a joining code (create an account).
        Tuitions: only the PCMB team creates their login, so "Create account"
        would leave them stuck on "Join tuition".
      */}
      <View style={styles.firstTime}>
        <Text accessibilityRole="header" style={[styles.firstTimeTitle, { color: palette.foreground }]}>
          First time here?
        </Text>
        <Text style={[styles.firstTimeText, { color: palette.mutedForeground }]}>
          <Text style={[styles.who, { color: palette.foreground }]}>Students and teachers: </Text>
          log in with the email and password your tuition gave you. Got a joining code instead? Create an account, then enter it.
        </Text>
        <Button label="Create account" variant="secondary" onPress={onSignUp} disabled={submitting} style={styles.firstTimeButton} />
        <Text style={[styles.firstTimeText, styles.tuitionNote, { color: palette.mutedForeground }]}>
          <Text style={[styles.who, { color: palette.foreground }]}>Tuitions: </Text>
          the PCMB team sets up your institute&apos;s login.
        </Text>
      </View>
    </AuthScreen>
  );
}

/**
 * The app's mark: a row of answer bubbles, as on an OMR sheet, one for each
 * subject in the bank (Physics, Chemistry, Mathematics, Biology).
 */
function SubjectMark() {
  return (
    <View accessible accessibilityRole="image" accessibilityLabel="PCMB Practice" style={styles.mark}>
      {SCHOOL_SUBJECTS.map((subject) => (
        <Bubble key={subject}>
          <BubbleText>{subject[0]}</BubbleText>
        </Bubble>
      ))}
    </View>
  );
}

/** A login is saved, but the server couldn't be reached to check it. */
export function UnreachableScreen({ onRetry, onLogOut }: { onRetry: () => void; onLogOut: () => void }) {
  const palette = usePalette();
  const look = useLook();
  return (
    <AuthScreen centered hero={<Illustration name="offline" />}>
      {look.neo ? null : (
        <View style={styles.statusMark}>
          <Bubble size={52} color={palette.warning}>
            <Icon name={{ ios: 'wifi.exclamationmark', android: 'wifi_off' }} color={palette.warning} size={24} />
          </Bubble>
        </View>
      )}
      <AuthTitle title="Can't reach the server" lead="Check your internet connection, then try again. You're still logged in." />
      <View style={styles.actions}>
        <Button label="Try again" onPress={onRetry} />
        <Button label="Log out" variant="secondary" onPress={onLogOut} />
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  mark: { flexDirection: 'row', gap: 6, marginBottom: 28 },
  forgot: { marginTop: 2, marginBottom: -8 },
  firstTime: { marginTop: 36, gap: 6 },
  firstTimeTitle: { fontSize: 16, fontWeight: '700' },
  firstTimeText: { fontSize: 14, lineHeight: 20 },
  firstTimeButton: { marginTop: 10 },
  who: { fontWeight: '700' },
  tuitionNote: { marginTop: 12 },
  statusMark: { marginBottom: 24 },
  actions: { gap: 10 },
});
