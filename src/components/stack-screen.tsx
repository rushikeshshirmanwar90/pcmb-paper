import { useEffect, useRef, type ComponentRef, type PropsWithChildren, type ReactNode, type Ref } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { usePreventRemove, useRouter } from 'expo-router';
import { confirmAction } from '@/components/account-section';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, ErrorText, Icon, usePalette } from '@/components/kit';
import { MaxContentWidth } from '@/constants/theme';

/** Goes back to the screen this one was opened from; to the tabs when opened with no history (e.g. from a link). */
export function useGoBack() {
  const router = useRouter();
  return () => (router.canGoBack() ? router.back() : router.replace('/'));
}

/**
 * Asks before the screen is left while `dirty`: for the header back button, Android's Back
 * and the swipe back alike. Returns a function that switches the question off, to call
 * just before leaving on purpose (after saving, or deleting).
 */
export function useDiscardGuard(dirty: boolean, title = 'Discard changes?', message = 'Your unsaved changes will be lost.') {
  const allowRef = useRef<() => void>(() => {});
  // Set when leaving on purpose: a re-render before the navigation lands must not bring the question back.
  const leaving = useRef(false);
  const allowLeave = usePreventRemove(dirty, ({ repeat }) => {
    if (leaving.current) {
      allowRef.current();
      repeat();
      return;
    }
    confirmAction(title, message, 'Discard', () => {
      allowRef.current();
      repeat();
    });
  });
  useEffect(() => {
    allowRef.current = allowLeave;
  });
  return () => {
    leaving.current = true;
    allowLeave();
  };
}

/**
 * A pushed screen (not a tab): a header with a back button, then scrolling
 * content, and an optional footer pinned under it. Android's Back button and
 * the iOS swipe go back through the router.
 */
export function StackScreen({
  title,
  subtitle,
  children,
  onBack,
  onRefresh,
  refreshing = false,
  footer,
  scrollRef,
  keyboard = false,
}: PropsWithChildren<{
  title: string;
  subtitle?: string;
  /** Called by the header's back button instead of going straight back, e.g. to ask about unsaved changes. */
  onBack?: () => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  footer?: ReactNode;
  scrollRef?: Ref<ComponentRef<typeof ScrollView>>;
  keyboard?: boolean;
}>) {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const goBack = useGoBack();
  return (
    <SafeAreaView edges={['top']} style={[styles.flex, { backgroundColor: palette.background }]}>
      <View style={[styles.header, { backgroundColor: palette.card, borderBottomColor: palette.border }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack ?? goBack} hitSlop={10} style={styles.back}>
          <Icon name={{ ios: 'chevron.left', android: 'arrow_back' }} color={palette.foreground} size={20} />
        </Pressable>
        <View style={styles.flex}>
          <Text accessibilityRole="header" style={[styles.title, { color: palette.foreground }]} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: palette.mutedForeground }]} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' && keyboard ? 'padding' : undefined} style={styles.flex}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[styles.body, { paddingBottom: footer ? 16 : Math.max(insets.bottom, 16) + 8 }]}
          keyboardShouldPersistTaps="handled"
          refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.primary} /> : undefined}
        >
          {children}
        </ScrollView>
        {footer ? <View style={[styles.footer, { borderTopColor: palette.border, backgroundColor: palette.card, paddingBottom: Math.max(insets.bottom, 12) }]}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** A sheet's frame as a full screen, so a sheet's body can open as a page (same props as DetailSheet). */
export function PageFrame({ title, onClose, footer, scrollRef, children }: PropsWithChildren<{ visible?: boolean; title: string; onClose: () => void; footer?: ReactNode; scrollRef?: Ref<ComponentRef<typeof ScrollView>> }>) {
  return (
    <StackScreen title={title} onBack={onClose} footer={footer} scrollRef={scrollRef}>
      {children}
    </StackScreen>
  );
}

/** A form as a full screen with its save button pinned under it. */
export function FormPage({ title, onBack, children, submitLabel, onSubmit, submitting = false, error, extraAction }: PropsWithChildren<{
  title: string;
  onBack: () => void;
  submitLabel: string;
  onSubmit: () => void;
  submitting?: boolean;
  error?: string | null;
  extraAction?: ReactNode;
}>) {
  return (
    <StackScreen
      title={title}
      onBack={onBack}
      keyboard
      footer={
        <>
          <ErrorText message={error} />
          <Button label={submitLabel} onPress={onSubmit} loading={submitting} />
          {extraAction}
        </>
      }
    >
      {children}
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1 },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 17, fontWeight: '700' },
  subtitle: { fontSize: 12, marginTop: 1 },
  body: { padding: 16, gap: 16, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  footer: { padding: 16, gap: 10, borderTopWidth: 1 },
});
