import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDesign } from '@/design/scope';

export const TAB_BAR_HEIGHT = 56;

/**
 * Full height of the bottom tab bar, which floats over the screens: the bar
 * itself, its 4pt top padding and 1pt border, and the home-indicator inset.
 * Screens pad their bottom edge by this so nothing hides underneath it.
 */
export function useTabBarHeight() {
  const insets = useSafeAreaInsets();
  const neo = useDesign() === 'neo';
  // Student look: the floating ink pill (48 + 2×8 padding) sits 8 above the inset.
  return neo ? NEO_TAB_BAR_HEIGHT + 8 + Math.max(insets.bottom, 8) : TAB_BAR_HEIGHT + 5 + Math.max(insets.bottom, 8);
}

/** The student look's floating tab bar, without its bottom gap. */
export const NEO_TAB_BAR_HEIGHT = 64;
