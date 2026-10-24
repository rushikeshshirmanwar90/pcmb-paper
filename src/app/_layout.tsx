import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AppearanceProvider } from '@/context/appearance-context';
import { TabProvider } from '@/context/tab-context';
import { RoomsProvider } from '@/context/rooms-context';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';

SplashScreen.preventAutoHideAsync();

function NavigationShell() {
  const scheme = useColorScheme();
  return (
    <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <AppTabs />
    </ThemeProvider>
  );
}

export default function TabLayout() {
  return (
    <AppearanceProvider>
      <TabProvider>
        <RoomsProvider>
          <NavigationShell />
        </RoomsProvider>
      </TabProvider>
    </AppearanceProvider>
  );
}
