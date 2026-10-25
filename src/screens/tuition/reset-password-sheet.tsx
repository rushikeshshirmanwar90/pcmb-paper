import React, { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { FormSheet, PasswordField, usePalette } from '@/components/kit';

/** The tuition sets a new password for a teacher or student who forgot theirs. */
export function ResetPasswordSheet({
  visible,
  name,
  onClose,
  onReset,
}: {
  visible: boolean;
  name: string;
  onClose: () => void;
  onReset: (password: string) => Promise<unknown>;
}) {
  const palette = usePalette();
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const [openedFor, setOpenedFor] = useState(false);
  if (visible !== openedFor) {
    setOpenedFor(visible);
    if (visible) {
      setPassword('');
      setError(null);
      setDone(false);
    }
  }

  const save = async () => {
    if (password.length < 8) return setError('The password needs at least 8 characters.');
    setSaving(true);
    setError(null);
    try {
      await onReset(password);
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't reset the password.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormSheet
      visible={visible}
      title="Reset password"
      onClose={onClose}
      submitLabel={done ? 'Done' : 'Set new password'}
      onSubmit={done ? onClose : save}
      submitting={saving}
      error={error}
    >
      {done ? (
        <Text style={[styles.text, { color: palette.foreground }]}>
          Done. Give {name} the new password; they&apos;ve been logged out of every device.
        </Text>
      ) : (
        <>
          <Text style={[styles.text, { color: palette.mutedForeground }]}>
            Set a new password for {name}. They will be logged out everywhere and log in with this one.
          </Text>
          <PasswordField label="New password" value={password} onChangeText={setPassword} hint="At least 8 characters" autoComplete="off" />
        </>
      )}
    </FormSheet>
  );
}

const styles = StyleSheet.create({
  text: { fontSize: 15, lineHeight: 22 },
});
