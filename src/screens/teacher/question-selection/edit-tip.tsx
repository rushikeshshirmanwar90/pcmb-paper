import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon, usePalette } from '@/components/kit';
import { loadPreference, savePreference } from '@/services/preferences';

const KEY = 'pcmb.tip.editQuestion';

/**
 * A one-time tip that each question can be edited for this paper or test.
 * It says where the button is and that the bank stays as it is; once closed
 * (Got it) it does not come back on this phone.
 */
export function EditTip() {
  const p = usePalette();
  const [show, setShow] = useState(false);
  useEffect(() => {
    let alive = true;
    void loadPreference(KEY).then((seen) => { if (alive && seen !== 'seen') setShow(true); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  if (!show) return null;
  const close = () => { setShow(false); void savePreference(KEY, 'seen').catch(() => {}); };
  return <View accessibilityRole="summary" style={[styles.tip, { backgroundColor: p.primarySoft, borderColor: p.primaryBorder }]}>
    <View style={[styles.icon, { backgroundColor: p.primary }]}>
      <Icon name={{ ios: 'pencil', android: 'edit' }} color={p.onPrimary} size={16} />
    </View>
    <View style={styles.copy}>
      <Text style={[styles.title, { color: p.foreground }]}>You can edit any question</Text>
      <Text style={[styles.text, { color: p.mutedForeground }]}>Tap Edit under a question to fix its wording, options or correct answer. It changes only this paper or test, never the question bank.</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Got it, hide this tip" onPress={close} hitSlop={6} style={styles.ok}>
        <Text style={[styles.okText, { color: p.primaryInk }]}>Got it</Text>
      </Pressable>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  tip: { flexDirection: 'row', gap: 12, padding: 14, borderRadius: 16, borderWidth: 1 },
  icon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, gap: 4 },
  title: { fontSize: 15, fontWeight: '700' },
  text: { fontSize: 13, lineHeight: 18 },
  ok: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  okText: { fontSize: 14, fontWeight: '700' },
});
