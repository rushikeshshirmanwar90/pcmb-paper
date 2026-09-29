import { StyleSheet, Text, View } from 'react-native';
import { getPalette } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type AppHeaderProps = {
  title: string;
  subtitle: string;
};

export function AppHeader({ title, subtitle }: AppHeaderProps) {
  const scheme = useColorScheme();
  const palette = getPalette(scheme === 'dark');

  return (
    <View style={[styles.header, { backgroundColor: palette.card, borderBottomColor: palette.border }]}>
      <View style={styles.headerInner}>
        <View style={[styles.brandMark, { backgroundColor: palette.primarySoft }]}>
          <Text style={[styles.brandMarkText, { color: palette.primaryInk }]}>P</Text>
        </View>
        <View style={styles.heading}>
          <Text style={[styles.title, { color: palette.foreground }]} numberOfLines={1}>{title}</Text>
          <Text style={[styles.subtitle, { color: palette.mutedForeground }]} numberOfLines={1}>{subtitle}</Text>
        </View>
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
  heading: { flex: 1, minWidth: 0 },
  title: { fontSize: 17, fontWeight: '700' },
  subtitle: { fontSize: 12, marginTop: 2 },
});