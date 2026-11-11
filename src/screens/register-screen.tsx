import React, { useRef, useState } from 'react';
import { type TextInputInstance } from 'react-native';
import { Button, ErrorText, Field, PasswordField } from '@/components/kit';
import { useAuth } from '@/context/auth-context';
import { ApiError } from '@/services/api-client';
import { Illustration } from '@/design/illustrations';
import { AuthCard, AuthScreen, AuthTitle, AuthTopBar, BackLink, StepProgress } from '@/screens/auth-ui';

type Problems = Partial<Record<'name' | 'email' | 'password' | 'confirm', string>>;

/**
 * Anyone creates an account here. It belongs to no tuition yet: next they
 * verify their email, then ask a tuition to let them in with its joining code,
 * and it accepts them as a student or teacher.
 */
export function RegisterScreen({ onBack }: { onBack: (email?: string) => void }) {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [problems, setProblems] = useState<Problems>({});
  /** What the server said, shown above the button. */
  const [error, setError] = useState<string | null>(null);
  /** The email already has an account: offer to log in with it. */
  const [taken, setTaken] = useState(false);
  const nameRef = useRef<TextInputInstance>(null);
  const emailRef = useRef<TextInputInstance>(null);
  const phoneRef = useRef<TextInputInstance>(null);
  const passwordRef = useRef<TextInputInstance>(null);
  const confirmRef = useRef<TextInputInstance>(null);

  /** Typing in a field clears its own error. */
  const edit = (field: keyof Problems | 'phone', set: (v: string) => void) => (v: string) => {
    set(v);
    if (field !== 'phone') setProblems((p) => ({ ...p, [field]: undefined }));
    setTaken(false);
  };

  const submit = async () => {
    const address = email.trim();
    const found: Problems = {};
    if (!name.trim()) found.name = 'Enter your name.';
    if (!address) found.email = 'Enter your email.';
    else if (!address.includes('@')) found.email = 'Enter your full email, like name@example.com.';
    if (password.length < 8) found.password = 'Use at least 8 characters.';
    if (!found.password && password !== confirm) found.confirm = "This doesn't match the password above.";
    setProblems(found);
    setError(null);
    setTaken(false);
    // The first field with a problem gets the cursor.
    const first = found.name ? nameRef : found.email ? emailRef : found.password ? passwordRef : found.confirm ? confirmRef : null;
    if (first) {
      first.current?.focus();
      return;
    }
    setBusy(true);
    try {
      // Logs in on success; the app then asks for the code sent to the email.
      await register({ name: name.trim(), email: address, phone: phone.trim(), password });
    } catch (e) {
      setTaken(e instanceof ApiError && e.status === 409);
      setError(e instanceof Error ? e.message : "Couldn't create your account. Try again.");
      setBusy(false);
    }
  };

  return (
    <AuthScreen hero={<Illustration name="welcomeHero" scale={0.75} />}>
      <AuthTopBar leading={<BackLink label="Log in instead" onPress={() => onBack()} />} />
      <StepProgress step={1} style={{ marginBottom: 16 }} />
      <AuthTitle
        title="Create your account"
        lead="For students and teachers. Next, you verify your email and enter your tuition's joining code."
      />

      <AuthCard>
        <Field
          ref={nameRef}
          label="Your name"
          value={name}
          onChangeText={edit('name', setName)}
          error={problems.name}
          autoComplete="name"
          textContentType="name"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => emailRef.current?.focus()}
          maxLength={100}
          editable={!busy}
        />
        <Field
          ref={emailRef}
          label="Email"
          value={email}
          onChangeText={edit('email', setEmail)}
          error={problems.email}
          hint="You'll log in with this, and a code goes to it next."
          placeholder="name@example.com"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          autoComplete="email"
          textContentType="username"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => phoneRef.current?.focus()}
          editable={!busy}
        />
        <Field
          ref={phoneRef}
          label="Phone (optional)"
          value={phone}
          onChangeText={edit('phone', setPhone)}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          maxLength={20}
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => passwordRef.current?.focus()}
          editable={!busy}
        />
        <PasswordField
          ref={passwordRef}
          label="Password"
          value={password}
          onChangeText={edit('password', setPassword)}
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
          label="Password again"
          value={confirm}
          onChangeText={edit('confirm', setConfirm)}
          error={problems.confirm}
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="go"
          onSubmitEditing={submit}
          editable={!busy}
        />
        <ErrorText message={error} />
        {taken ? <Button label="Log in with this email" variant="tonal" onPress={() => onBack(email.trim())} /> : null}
        <Button label="Create account" onPress={submit} loading={busy} variant={taken ? 'secondary' : 'primary'} />
      </AuthCard>
    </AuthScreen>
  );
}
