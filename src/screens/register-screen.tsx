import React, { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, ErrorText, Field, Icon, PasswordField, usePalette, type IconName } from '@/components/kit';
import { useAuth } from '@/context/auth-context';

const STEPS: { icon: IconName; text: string }[] = [
  { icon: { ios: 'person.badge.plus', android: 'person_add' }, text: 'Create your account' },
  { icon: { ios: 'number', android: 'pin' }, text: "Enter your tuition's join code" },
  { icon: { ios: 'checkmark.seal', android: 'verified' }, text: 'Your tuition adds you as a student or teacher' },
];

/**
 * Anyone creates an account here. It belongs to no tuition yet: next they ask
 * a tuition to let them in, and it accepts them as a student or teacher.
 */
export function RegisterScreen({ onBack }: { onBack: () => void }) {
  const palette = usePalette();
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const emailRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);

  const submit = async () => {
    if (!name.trim()) return setError('Enter your name.');
    if (!email.trim()) return setError('Enter your email; you log in with it.');
    if (password.length < 8) return setError('Your password needs at least 8 characters.');
    if (password !== confirm) return setError("The two passwords don't match.");
    setBusy(true);
    setError(null);
    try {
      // Logs in on success; the app then shows "Join a tuition".
      await register({ name: name.trim(), email: email.trim(), phone: phone.trim(), password });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create your account. Try again.");
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: palette.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.root}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Pressable accessibilityRole="button" onPress={onBack} hitSlop={8} style={styles.back}>
            <Icon name={{ ios: 'chevron.left', android: 'arrow_back' }} color={palette.primary} size={16} />
            <Text style={[styles.backText, { color: palette.primary }]}>Log in instead</Text>
          </Pressable>

          <Text accessibilityRole="header" style={[styles.title, { color: palette.foreground }]}>
            Create your account
          </Text>
          <Text style={[styles.lead, { color: palette.mutedForeground }]}>
            For students and teachers. After this, you ask your tuition to let you in.
          </Text>

          <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Field
              label="Your name"
              value={name}
              onChangeText={setName}
              autoComplete="name"
              textContentType="name"
              returnKeyType="next"
              onSubmitEditing={() => emailRef.current?.focus()}
              maxLength={100}
            />
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
              returnKeyType="next"
              onSubmitEditing={() => phoneRef.current?.focus()}
            />
            <Field ref={phoneRef} label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" maxLength={20} />
            <PasswordField label="Password" value={password} onChangeText={setPassword} hint="At least 8 characters." autoComplete="new-password" textContentType="newPassword" />
            <PasswordField label="Password again" value={confirm} onChangeText={setConfirm} autoComplete="new-password" textContentType="newPassword" returnKeyType="go" onSubmitEditing={submit} />
            <ErrorText message={error} />
            <Button label="Create account" onPress={submit} loading={busy} />
          </View>

          <View style={styles.next}>
            {STEPS.map(({ icon, text }, i) => (
              <View key={text} style={styles.nextRow}>
                <View style={[styles.nextIcon, { backgroundColor: i === 0 ? palette.primary : palette.secondary }]}>
                  <Icon name={icon} color={i === 0 ? palette.onPrimary : palette.mutedForeground} size={15} />
                </View>
                <Text style={[styles.nextText, { color: i === 0 ? palette.foreground : palette.mutedForeground }]}>{text}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flexGrow: 1, padding: 24, gap: 10, width: '100%', maxWidth: 480, alignSelf: 'center' },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 6, marginBottom: 8 },
  backText: { fontSize: 15, fontWeight: '600' },
  title: { fontSize: 26, fontWeight: '800' },
  lead: { fontSize: 15, lineHeight: 22, marginBottom: 8 },
  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 14 },
  next: { gap: 10, marginTop: 16, paddingHorizontal: 4 },
  nextRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  nextIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  nextText: { fontSize: 14, fontWeight: '600', flex: 1 },
});
