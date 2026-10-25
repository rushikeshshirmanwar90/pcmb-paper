import React, { useState } from 'react';
import { Alert, Platform, StyleSheet, Text, View } from 'react-native';
import { Badge, Card, Field, FormSheet, ListRow, PasswordField, SectionTitle, usePalette } from '@/components/kit';
import { useAuth, useSignedInUser } from '@/context/auth-context';

const ROLE_LABEL = { tuition: 'Tuition', teacher: 'Teacher', student: 'Student' } as const;

/** Asks before something that can't be taken back, e.g. logging out. */
export function confirmAction(title: string, message: string, confirmLabel: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (globalThis.confirm?.(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
}

/**
 * The signed-in user's account, for every role's profile page: who they are,
 * editing their details, changing the password and logging out.
 */
export function AccountSection() {
  const palette = usePalette();
  const user = useSignedInUser();
  const { signOut } = useAuth();
  const [editing, setEditing] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  return (
    <>
      <Card>
        <View style={styles.identity}>
          <View style={[styles.avatar, { backgroundColor: palette.primary }]}>
            <Text style={[styles.avatarText, { color: palette.onPrimary }]}>{initials(user.name)}</Text>
          </View>
          <View style={styles.flex}>
            <Text style={[styles.name, { color: palette.foreground }]} numberOfLines={1}>
              {user.name}
            </Text>
            <Text style={[styles.email, { color: palette.mutedForeground }]} numberOfLines={1}>
              {user.email}
            </Text>
            <View style={styles.badges}>
              <Badge label={ROLE_LABEL[user.role]} tone="primary" />
              {user.role !== 'tuition' && user.tuition.name ? <Badge label={user.tuition.name} /> : null}
            </View>
          </View>
        </View>
      </Card>

      <SectionTitle title="Account" />
      <Card style={styles.listCard}>
        <ListRow
          icon={{ ios: 'person.text.rectangle', android: 'badge' }}
          title="Edit your details"
          subtitle={[user.phone || 'No phone number', user.role === 'student' && user.parentPhone ? `Parent: ${user.parentPhone}` : null].filter(Boolean).join(' · ')}
          onPress={() => setEditing(true)}
        />
        <ListRow
          icon={{ ios: 'key', android: 'key' }}
          title="Change password"
          subtitle="Logs you out on your other devices"
          onPress={() => setChangingPassword(true)}
        />
        <ListRow
          icon={{ ios: 'rectangle.portrait.and.arrow.right', android: 'logout' }}
          title="Log out"
          onPress={() => confirmAction('Log out?', 'You will need your email and password to log in again.', 'Log out', () => void signOut())}
          last
        />
      </Card>

      <EditDetailsSheet visible={editing} onClose={() => setEditing(false)} />
      <ChangePasswordSheet visible={changingPassword} onClose={() => setChangingPassword(false)} />
    </>
  );
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?';
}

function EditDetailsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const user = useSignedInUser();
  const { updateProfile } = useAuth();
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone);
  const [parentPhone, setParentPhone] = useState(user.parentPhone);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Start from the saved details each time the sheet opens.
  const [openedFor, setOpenedFor] = useState(false);
  if (visible !== openedFor) {
    setOpenedFor(visible);
    if (visible) {
      setName(user.name);
      setPhone(user.phone);
      setParentPhone(user.parentPhone);
      setError(null);
    }
  }

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateProfile({ name, phone, ...(user.role === 'student' ? { parentPhone } : {}) });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormSheet visible={visible} title="Your details" onClose={onClose} submitLabel="Save" onSubmit={save} submitting={saving} error={error}>
      <Field label="Name" value={name} onChangeText={setName} autoComplete="name" textContentType="name" />
      <Field label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" />
      {user.role === 'student' ? (
        <Field label="Parent's phone" value={parentPhone} onChangeText={setParentPhone} keyboardType="phone-pad" />
      ) : null}
      <Field label="Email" value={user.email} editable={false} hint="Your tuition can change the email you log in with." />
    </FormSheet>
  );
}

function ChangePasswordSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const palette = usePalette();
  const { changePassword } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const [openedFor, setOpenedFor] = useState(false);
  if (visible !== openedFor) {
    setOpenedFor(visible);
    if (visible) {
      setCurrent('');
      setNext('');
      setConfirm('');
      setError(null);
      setDone(false);
    }
  }

  const save = async () => {
    if (next.length < 8) return setError('The new password needs at least 8 characters.');
    if (next !== confirm) return setError("The new passwords don't match.");
    setSaving(true);
    setError(null);
    try {
      await changePassword(current, next);
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't change the password. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormSheet
      visible={visible}
      title="Change password"
      onClose={onClose}
      submitLabel={done ? 'Done' : 'Change password'}
      onSubmit={done ? onClose : save}
      submitting={saving}
      error={error}
    >
      {done ? (
        <Text style={[styles.done, { color: palette.foreground }]}>Your password is changed. You stay logged in here; other devices need the new password.</Text>
      ) : (
        <>
          <PasswordField label="Current password" value={current} onChangeText={setCurrent} autoComplete="current-password" textContentType="password" />
          <PasswordField label="New password" value={next} onChangeText={setNext} hint="At least 8 characters" autoComplete="new-password" textContentType="newPassword" />
          <PasswordField label="New password again" value={confirm} onChangeText={setConfirm} autoComplete="new-password" textContentType="newPassword" />
        </>
      )}
    </FormSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 20, fontWeight: '800' },
  name: { fontSize: 18, fontWeight: '800' },
  email: { fontSize: 14, marginTop: 1 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  listCard: { paddingVertical: 0 },
  done: { fontSize: 15, lineHeight: 22 },
});
