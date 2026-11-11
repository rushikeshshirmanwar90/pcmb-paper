import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '@/components/app-text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, ErrorText, Icon, PasswordField, SectionTitle, usePalette } from '@/components/kit';
import { useAuth, useSignedInUser } from '@/context/auth-context';

export function ForcePasswordChangeScreen() {
  const palette = usePalette();
  const user = useSignedInUser();
  const { changePassword, signOut } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tuitionName = user.tuition.name || 'your tuition';

  const submit = async () => {
    if (saving) return;
    setError(null);

    if (!currentPassword) return setError('Enter your current password.');
    if (!newPassword) return setError('Enter a new password.');
    if (newPassword.length < 8) return setError('The new password needs at least 8 characters.');
    if (newPassword === currentPassword) return setError('Choose a password different from the current one.');
    if (newPassword !== confirmPassword) return setError('The passwords don’t match.');

    setSaving(true);
    try {
      await changePassword(currentPassword, newPassword);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={[styles.iconCircle, { backgroundColor: palette.primarySoft }]}>
            <Icon name={{ ios: 'lock.rotation', android: 'lock_reset' }} color={palette.primary} size={32} />
          </View>
          <Text style={[styles.title, { color: palette.foreground }]}>Create Your New Password</Text>
          <Text style={[styles.subtitle, { color: palette.mutedForeground }]}>
            Welcome to {tuitionName}! For your security, please create a new password before continuing.
          </Text>
        </View>

        <Card style={styles.card}>
          <PasswordField
            label="Current Password"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            hint="The password you received from your tuition."
            autoComplete="current-password"
          />
          <View style={styles.divider} />
          <PasswordField
            label="New Password"
            value={newPassword}
            onChangeText={setNewPassword}
            hint="At least 8 characters."
            autoComplete="new-password"
          />
          <PasswordField
            label="Confirm New Password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            autoComplete="new-password"
          />
        </Card>

        <ErrorText message={error} />

        <View style={styles.requirements}>
          <SectionTitle title="Password requirements" />
          <Requirement met={newPassword.length >= 8} label="At least 8 characters" />
          <Requirement met={!!newPassword && newPassword !== currentPassword} label="Different from your current password" />
          <Requirement met={!!newPassword && !!confirmPassword && newPassword === confirmPassword} label="Both passwords match" />
        </View>

        <Button label="Set New Password" onPress={submit} loading={saving} disabled={saving} />
        <Button label="Log out" variant="secondary" onPress={() => void signOut()} disabled={saving} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Requirement({ met, label }: { met: boolean; label: string }) {
  const palette = usePalette();
  return (
    <View style={styles.req} accessibilityLabel={`${label}: ${met ? 'met' : 'not met'}`}>
      <Icon
        name={met ? { ios: 'checkmark.circle.fill', android: 'check_circle' } : { ios: 'circle', android: 'radio_button_unchecked' }}
        color={met ? palette.success : palette.mutedForeground}
        size={16}
      />
      <Text style={[styles.reqText, { color: met ? palette.foreground : palette.mutedForeground }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 20, gap: 16, maxWidth: 480, alignSelf: 'center', width: '100%' },
  header: { alignItems: 'center', gap: 8, paddingVertical: 16 },
  iconCircle: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  title: { fontSize: 24, fontWeight: '800', textAlign: 'center' },
  subtitle: { fontSize: 15, lineHeight: 22, textAlign: 'center', paddingHorizontal: 8 },
  card: { gap: 12 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 4 },
  requirements: { gap: 6 },
  req: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reqText: { fontSize: 14 },
});
