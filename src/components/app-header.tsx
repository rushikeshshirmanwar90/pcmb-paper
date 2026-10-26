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
            <Text style={[styles.brandMarkText, { color: palette.primaryInk }]}>P</Text>
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
    minHeight: 72,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 12,
  },
  brandMark: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#C6613F',
  },
  brandMarkText: { fontSize: 18, fontWeight: '800' },
  menuButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: 'transparent',
  },
  pressed: { opacity: 0.72 },
  heading: { flex: 1, minWidth: 0 },
  title: { fontSize: 17, fontWeight: '700' },
  subtitle: { fontSize: 12, marginTop: 2 },
});