import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AppearanceProvider } from '@/context/appearance-context';
import { AuthProvider, useAuth } from '@/context/auth-context';
import { TabProvider, useTabNavigation } from '@/context/tab-context';
import { RoomsProvider } from '@/context/rooms-context';
import { getPalette } from '@/constants/theme';
import { ToastProvider } from '@/components/states';
import { EngagementProvider } from '@/engagement/engagement-provider';
import { useTabBarHeight } from '@/hooks/use-tab-bar-height';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { tabsFor } from '@/navigation/role-tabs';
import { onNotificationTap } from '@/services/notifications';
import { showStudents } from '@/screens/tuition/people-nav';
import { JoinTuitionScreen } from '@/screens/join-tuition-screen';
import { VerifyEmailScreen } from '@/screens/verify-email-screen';
import { ForcePasswordChangeScreen } from '@/screens/force-password-change';
import { LoginScreen, UnreachableScreen } from '@/screens/login-screen';

SplashScreen.preventAutoHideAsync();

/** Opens the tab a tapped notification is about (e.g. Tests for a new test). */
function NotificationTaps() {
  const { goToTab } = useTabNavigation();
  useEffect(
    () =>
      onNotificationTap(({ tab, showStudents: students }) => {
        if (students) showStudents();
        goToTab(tab);
      }),
    [goToTab],
  );
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
  // Admin-created students must change their password before using the app.
  if (user.mustChangePassword && user.role === 'student') return <ForcePasswordChangeScreen />;

  // Keyed by the user and workspace, so logging in as someone else, or switching an admin to the
  // Teacher workspace, starts on a fresh first tab with none of the other one's screens left over.
  const tabs = tabsFor(user.role);
  const stack = <Stack screenOptions={{ headerShown: false }} />;
  return (
    <TabProvider key={`${user.id}:${user.role}`} tabKeys={tabs.map((t) => t.key)}>
      <RoomsProvider>
        <ToastLayer>
          <NotificationTaps />
          {/* Student progress (streak, goal, level) for every student screen, tabs and pushed ones alike. */}
          {user.role === 'student' ? <EngagementProvider>{stack}</EngagementProvider> : stack}
        </ToastLayer>
      </RoomsProvider>
    </TabProvider>
  );
}

/** Toasts sit just above the floating tab bar. */
function ToastLayer({ children }: { children: React.ReactNode }) {
  return <ToastProvider bottomOffset={useTabBarHeight()}>{children}</ToastProvider>;
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
