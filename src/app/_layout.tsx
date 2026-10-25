import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AppearanceProvider } from '@/context/appearance-context';
import { AuthProvider, useAuth } from '@/context/auth-context';
import { TabProvider } from '@/context/tab-context';
import { RoomsProvider } from '@/context/rooms-context';
import { getPalette } from '@/constants/theme';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { tabsFor } from '@/navigation/role-tabs';
import { LoginScreen, UnreachableScreen } from '@/screens/login-screen';

SplashScreen.preventAutoHideAsync();

/** The login screen, or the signed-in role's tabs. */
function SignedInGate() {
  const { status, user, retry, signOut } = useAuth();
  const palette = getPalette(useColorScheme() === 'dark');

  if (status === 'loading') {
    return (
      <View style={[styles.loading, { backgroundColor: palette.background }]}>
        <ActivityIndicator color={palette.primary} />
      </View>
    );
  }
  if (status === 'unreachable') return <UnreachableScreen onRetry={retry} onLogOut={() => void signOut()} />;
  if (!user) return <LoginScreen />;

  // Keyed by the user, so logging in as someone else starts on a fresh first tab.
  return (
    <TabProvider key={user.id}>
      <RoomsProvider>
        <AppTabs tabs={tabsFor(user.role)} />
      </RoomsProvider>
    </TabProvider>
  );
}

function NavigationShell() {
  const scheme = useColorScheme();
  return (
    <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <SignedInGate />
    </ThemeProvider>
  );
}

export default function TabLayout() {
  return (
    <AppearanceProvider>
      <AuthProvider>
        <NavigationShell />
      </AuthProvider>
    </AppearanceProvider>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
