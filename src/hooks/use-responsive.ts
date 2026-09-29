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
