import { useWindowDimensions } from 'react-native';

export function useResponsive() {
  const { width, height } = useWindowDimensions();

  const isSmallPhone = width < 360;
  const isPhone = width < 768;
  const isTablet = width >= 768 && width < 1024;
  const isDesktop = width >= 1024;

  const contentMaxWidth = Math.min(840, width - (isPhone ? 24 : 48));
  const cardPadding = isSmallPhone ? 10 : isPhone ? 14 : 18;
  const modalWidth = isPhone ? '100%' : Math.min(620, width - 40);

  // Proportional font scaling helper
  const scaleFont = (size: number) => {
    if (isSmallPhone) return Math.round(size * 0.9);
    if (isTablet || isDesktop) return Math.round(size * 1.05);
    return size;
  };

  return {
    width,
    height,
    isSmallPhone,
    isPhone,
    isTablet,
    isDesktop,
    contentMaxWidth,
    cardPadding,
    modalWidth,
    scaleFont,
  };
}

export type SizeClass = 'compact' | 'medium' | 'expanded';

/**
 * Layout by window size (app-interactions responsive.md): columns, gutter and a
 * capped content width. Type is never scaled by width; it follows the phone's
 * text-size setting (`fontScale`). New screens use this; `scaleFont` above is kept
 * only for the screens that already use it.
 */
export function useLayout() {
  const { width, height, fontScale } = useWindowDimensions();
  const size: SizeClass = width >= 840 ? 'expanded' : width >= 600 ? 'medium' : 'compact';
  const gutter = width < 360 ? 16 : size === 'compact' ? 20 : 28;
  const maxContent = size === 'expanded' ? 960 : size === 'medium' ? 680 : width;
  return {
    size,
    width,
    height,
    gutter,
    fontScale,
    short: height < 480,
    columns: size === 'expanded' ? 3 : size === 'medium' ? 2 : 1,
    contentWidth: Math.min(maxContent, width - gutter * 2),
    /** Large text or a narrow phone: rows stack instead of sitting side by side. */
    stacked: width < 360 || fontScale >= 1.3,
  };
}
