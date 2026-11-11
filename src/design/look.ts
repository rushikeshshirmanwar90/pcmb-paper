import { StyleSheet, type ViewStyle } from 'react-native';
import { neoAppPalette } from '@/design/palette';
import { useDesign, useIsDark } from '@/design/scope';
import { hardShadow, Neo } from '@/design/tokens';

type Radius = keyof typeof Neo.radius;
type Shadow = keyof typeof Neo.shadow | 'none';

/**
 * Styles for code that renders in both looks (kit pieces, shared screens):
 * each helper returns null in the classic look, so classic screens stay
 * exactly as they were, and the student look's frame in the neo look.
 *   style={[styles.card, look.frame('lg', 'md')]}
 */
export function useLook() {
  const neo = useDesign() === 'neo';
  const dark = useIsDark();
  const ink = neoAppPalette(dark).ink;
  /** A 2px ink outline with a hard shadow (the shadow's space is kept with margins). */
  const frame = (radius: Radius = 'lg', shadow: Shadow = 'md'): ViewStyle | null => {
    if (!neo) return null;
    const s = shadow === 'none' ? 0 : Neo.shadow[shadow];
    return { borderWidth: Neo.border.width, borderColor: ink, borderRadius: Neo.radius[radius], marginRight: s, marginBottom: s, ...(hardShadow(s, ink) as ViewStyle) };
  };
  /** A 2px ink outline, no shadow (chips, inner boxes, inputs inside a card). */
  const outline = (radius: Radius = 'md'): ViewStyle | null => (neo ? { borderWidth: Neo.border.width, borderColor: ink, borderRadius: Neo.radius[radius] } : null);
  /** Dividers: 2px ink instead of a hairline. */
  const rule = (side: 'top' | 'bottom' = 'top'): ViewStyle | null =>
    neo ? (side === 'top' ? { borderTopWidth: Neo.border.width, borderTopColor: ink } : { borderBottomWidth: Neo.border.width, borderBottomColor: ink }) : null;
  /** Radius by role in the student look; null keeps the classic value. */
  const radius = (role: Radius): ViewStyle | null => (neo ? { borderRadius: Neo.radius[role] } : null);
  /** Lifts overflow: hidden (it would clip the hard shadow). */
  const unclip: ViewStyle | null = neo ? { overflow: 'visible' } : null;
  return { neo, ink, frame, outline, rule, radius, unclip, hairline: neo ? Neo.border.width : StyleSheet.hairlineWidth };
}
