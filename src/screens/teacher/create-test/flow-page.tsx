import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardSafeView } from '@/components/keyboard-safe-view';
import { ErrorText, Icon, usePalette } from '@/components/kit';
import { Footer, StepLayout } from '@/screens/teacher/make-pdf/ui';

/** A full-screen page of the Create Test flow: header with Back, a scrolling body and the pinned action(s). */
export function FlowPage({ title, subtitle, onBack, onClose, error, footer, children }: { title: string; subtitle: string; onBack: () => void; /** Leaves the whole flow (shown as a close button). */ onClose?: () => void; error?: string | null; footer: ReactNode; children: ReactNode }) {
  const palette = usePalette();
  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.flex, { backgroundColor: palette.background }]}>
      <View style={[styles.header, { borderBottomColor: palette.border, backgroundColor: palette.card }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} hitSlop={10} style={styles.back}>
          <Icon name={{ ios: 'chevron.left', android: 'arrow_back' }} color={palette.primary} size={20} />
        </Pressable>
        <View style={styles.flex}>
          <Text accessibilityRole="header" style={[styles.title, { color: palette.foreground }]} numberOfLines={1}>{title}</Text>
          <Text style={[styles.subtitle, { color: palette.mutedForeground }]}>{subtitle}</Text>
        </View>
        {onClose ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Close and discard this test" onPress={onClose} hitSlop={10} style={styles.back}>
            <Icon name={{ ios: 'xmark', android: 'close' }} color={palette.foreground} size={20} />
          </Pressable>
        ) : null}
      </View>
      <KeyboardSafeView>
        <StepLayout
          inset={0}
          footer={
            <>
              <ErrorText message={error} />
              {footer}
            </>
          }
        >
          {children}
        </StepLayout>
      </KeyboardSafeView>
    </SafeAreaView>
  );
}

export { Footer };

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  back: { width: 40, height: 40, marginLeft: -8, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '700' },
  subtitle: { fontSize: 12 },
});
