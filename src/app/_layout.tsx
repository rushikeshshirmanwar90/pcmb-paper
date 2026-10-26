import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AppearanceProvider } from '@/context/appearance-context';
import { AuthProvider, useAuth } from '@/context/auth-context';
import { TabProvider, useTabNavigation } from '@/context/tab-context';
import { RoomsProvider } from '@/context/rooms-context';
import { getPalette } from '@/constants/theme';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { tabsFor } from '@/navigation/role-tabs';
import { onNotificationTap } from '@/services/notifications';
import { JoinTuitionScreen } from '@/screens/join-tuition-screen';
import { VerifyEmailScreen } from '@/screens/verify-email-screen';
import { LoginScreen, UnreachableScreen } from '@/screens/login-screen';

SplashScreen.preventAutoHideAsync();

/** Opens the tab a tapped notification is about (e.g. Tests for a new test). */
function NotificationTaps() {
  const { goToTab } = useTabNavigation();
  useEffect(() => onNotificationTap((tab) => goToTab(tab)), [goToTab]);
  return null;
}

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
  // Registered, but not yet in a tuition: first verify the email, then join.
  if (!user.role) return user.emailVerified ? <JoinTuitionScreen /> : <VerifyEmailScreen />;

  // Keyed by the user, so logging in as someone else starts on a fresh first tab.
  const tabs = tabsFor(user.role);
  return (
    <TabProvider key={user.id} tabKeys={tabs.map((t) => t.key)}>
      <RoomsProvider>
        <NotificationTaps />
        <AppTabs tabs={tabs} />
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
