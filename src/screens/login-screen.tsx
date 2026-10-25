import React, { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, ErrorText, Field, Icon, PasswordField, usePalette } from '@/components/kit';
import { useAuth } from '@/context/auth-context';

/** Email and password, for the tuition, its teachers and its students alike. */
export function LoginScreen() {
  const palette = usePalette();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordRef = useRef<TextInput>(null);

  const submit = async () => {
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't log in. Try again.");
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: palette.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.root}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={[styles.mark, { backgroundColor: palette.primary }]}>
            <Icon name={{ ios: 'graduationcap.fill', android: 'school' }} color={palette.onPrimary} size={30} />
          </View>
          <Text accessibilityRole="header" style={[styles.title, { color: palette.foreground }]}>
            Log in
          </Text>
          <Text style={[styles.subtitle, { color: palette.mutedForeground }]}>
            For tuitions, teachers and students.
          </Text>

          <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Field
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              autoComplete="email"
              textContentType="username"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
            />
            <PasswordField
              ref={passwordRef}
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="Your password"
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={submit}
            />
            <ErrorText message={error} />
            <Button label="Log in" onPress={submit} loading={submitting} />
          </View>

          <Text style={[styles.note, { color: palette.mutedForeground }]}>
            Teachers and students get their login from their tuition. Forgot your password? Ask your tuition to reset it.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** A login is saved, but the server couldn't be reached to check it. */
export function UnreachableScreen({ onRetry, onLogOut }: { onRetry: () => void; onLogOut: () => void }) {
  const palette = usePalette();
  return (
    <SafeAreaView style={[styles.root, styles.centered, { backgroundColor: palette.background }]}>
      <View style={[styles.mark, { backgroundColor: palette.warningSoft }]}>
        <Icon name={{ ios: 'wifi.exclamationmark', android: 'wifi_off' }} color={palette.warning} size={28} />
      </View>
      <Text accessibilityRole="header" style={[styles.title, { color: palette.foreground }]}>
        Can&apos;t reach the server
      </Text>
      <Text style={[styles.subtitle, { color: palette.mutedForeground, textAlign: 'center' }]}>
        Check your internet connection, then try again.
      </Text>
      <View style={styles.actions}>
        <Button label="Try again" onPress={onRetry} />
        <Button label="Log out" variant="secondary" onPress={onLogOut} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  content: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 8, width: '100%', maxWidth: 440, alignSelf: 'center' },
  mark: { width: 60, height: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 8 },
  title: { fontSize: 26, fontWeight: '800', textAlign: 'center' },
  subtitle: { fontSize: 15, textAlign: 'center', marginBottom: 16 },
  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 14 },
  note: { fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 12 },
  actions: { alignSelf: 'stretch', gap: 10, marginTop: 12, maxWidth: 360, width: '100%', marginHorizontal: 'auto' },
});
