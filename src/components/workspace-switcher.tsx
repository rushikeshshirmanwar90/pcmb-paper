import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { confirmAction } from '@/components/confirm-action';
import { getPalette } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useTabNavigation } from '@/context/tab-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { WORKSPACE_LABEL } from '@/services/workspace';

/**
 * "Admin ▾" / "Teacher ▾" at the right of the header, for accounts that can open
 * more than one workspace (a tuition admin). It opens a small account menu:
 * who is signed in, the workspaces to switch between, profile settings and log out.
 * Nobody else sees it.
 */
export function WorkspaceSwitcher() {
  const { user, workspaces, workspace, switchWorkspace, signOut } = useAuth();
  const { goToTab } = useTabNavigation();
  const palette = getPalette(useColorScheme() === 'dark');
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  if (!user || workspaces.length < 2 || !workspace) return null;

  const label = WORKSPACE_LABEL[workspace] ?? 'Workspace';
  const close = () => setOpen(false);
  const choose = (next: (typeof workspaces)[number]) => {
    close();
    switchWorkspace(next);
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label} workspace. Open account menu`}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.pill, { backgroundColor: palette.primarySoft }, pressed && styles.pressed]}>
        <Text style={[styles.pillText, { color: palette.primaryInk }]}>{label}</Text>
        <SymbolView name={{ ios: 'chevron.down', android: 'expand_more', web: 'expand_more' }} tintColor={palette.primaryInk} size={11} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <Pressable accessibilityLabel="Close account menu" style={styles.backdrop} onPress={close}>
          <Pressable
            accessible={false}
            style={[styles.menu, { top: insets.top + 56, backgroundColor: palette.card, borderColor: palette.border }]}>
            <View style={[styles.section, { borderBottomColor: palette.border }]} accessible accessibilityLabel={`${user.name}, ${user.email}`}>
              <Text style={[styles.name, { color: palette.foreground }]} numberOfLines={1}>{user.name}</Text>
              <Text style={[styles.meta, { color: palette.mutedForeground }]} numberOfLines={1}>{user.email}</Text>
              {user.tuition.name ? <Text style={[styles.meta, { color: palette.mutedForeground }]} numberOfLines={1}>{user.tuition.name}</Text> : null}
            </View>

            <View style={[styles.section, { borderBottomColor: palette.border }]}>
              <Text accessibilityRole="header" style={[styles.heading, { color: palette.mutedForeground }]}>SWITCH WORKSPACE</Text>
              {workspaces.map((w) => {
                const selected = w === workspace;
                return (
                  <Pressable
                    key={w}
                    accessibilityRole="button"
                    accessibilityLabel={`${WORKSPACE_LABEL[w] ?? w} workspace`}
                    accessibilityState={{ selected }}
                    onPress={() => choose(w)}
                    style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
                    <Text style={[styles.rowText, { color: palette.foreground, fontWeight: selected ? '700' : '500' }]}>{WORKSPACE_LABEL[w] ?? w}</Text>
                    {selected ? <SymbolView name={{ ios: 'checkmark', android: 'check', web: 'check' }} tintColor={palette.primary} size={16} /> : null}
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Profile settings"
              onPress={() => {
                close();
                goToTab('profile');
              }}
              style={({ pressed }) => [styles.row, styles.rowPad, pressed && styles.pressed]}>
              <Text style={[styles.rowText, { color: palette.foreground }]}>Profile Settings</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Log out"
              onPress={() => {
                close();
                confirmAction('Log out?', 'You will need your email and password to log in again.', 'Log out', () => void signOut());
              }}
              style={({ pressed }) => [styles.row, styles.rowPad, pressed && styles.pressed]}>
              <Text style={[styles.rowText, { color: palette.dangerInk }]}>Logout</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 36, paddingHorizontal: 12, borderRadius: 18 },
  pillText: { fontSize: 13, fontWeight: '700' },
  pressed: { opacity: 0.72 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)' },
  menu: { position: 'absolute', right: 16, width: 260, borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  section: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, gap: 2 },
  name: { fontSize: 15, fontWeight: '700' },
  meta: { fontSize: 12 },
  heading: { fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 4 },
  row: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowPad: { paddingHorizontal: 16 },
  rowText: { fontSize: 14 },
});
