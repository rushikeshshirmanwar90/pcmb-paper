import React, { type PropsWithChildren } from 'react';
import { View, StyleSheet } from 'react-native';

/**
 * Legacy SwipeTabNavigation placeholder.
 * Tab sliding and gestures are now handled directly by AppTabs with hardware-accelerated PagerView.
 */
export function SwipeTabNavigation({ children }: PropsWithChildren) {
  return <View style={styles.container}>{children}</View>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default SwipeTabNavigation;