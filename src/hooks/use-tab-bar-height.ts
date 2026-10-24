import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const TAB_BAR_HEIGHT = 56;

/**
 * Full height of the bottom tab bar, which floats over the screens: the bar
 * itself, its 4pt top padding and 1pt border, and the home-indicator inset.
 * Screens pad their bottom edge by this so nothing hides underneath it.
 */
export function useTabBarHeight() {
  const insets = useSafeAreaInsets();
  return TAB_BAR_HEIGHT + 5 + Math.max(insets.bottom, 8);
}
