import type React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { getPalette } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type AppHeaderProps = {
  title: string;
  subtitle: string;
  onMenuPress?: () => void;
  /** e.g. the notifications bell. */
  right?: React.ReactNode;
};

export function AppHeader({ title, subtitle, onMenuPress, right }: AppHeaderProps) {
  const scheme = useColorScheme();
  const palette = getPalette(scheme === 'dark');

  return (
    <View style={[styles.header, { backgroundColor: palette.card, borderBottomColor: palette.border }]}>
      <View style={styles.headerInner}>
        {onMenuPress ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open navigation menu"
            onPress={onMenuPress}
            style={({ pressed }) => [styles.menuButton, pressed && styles.pressed]}>
            <SymbolView
              name={{ ios: 'line.3.horizontal', android: 'menu', web: 'menu' }}
              tintColor="#000000"
              size={21}
            />
          </Pressable>
        ) : (
          <View style={[styles.brandMark, { backgroundColor: palette.primarySoft }]}>
            <Text style={[styles.brandMarkText, { color: palette.primaryInk }]}>Q</Text>
          </View>
        )}
        <View style={styles.heading}>
          <Text style={[styles.title, { color: palette.foreground }]} numberOfLines={1}>{title}</Text>
          <Text style={[styles.subtitle, { color: palette.mutedForeground }]} numberOfLines={1}>{subtitle}</Text>
        </View>
        {right}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    borderBottomWidth: 1,
  },
  headerInner: {
    width: '100%',
    maxWidth: 900,
    minHeight: 68,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 16,
  },
  brandMark: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#C6613F',
  },
  brandMarkText: { fontSize: 20, fontWeight: '800' },
  menuButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: 'transparent',
  },
  pressed: { opacity: 0.72 },
  heading: { flex: 1, minWidth: 0 },
  title: { fontSize: 18, fontWeight: '700', letterSpacing: -0.3 },
  subtitle: { fontSize: 11, marginTop: 4 },
});