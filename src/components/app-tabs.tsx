import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  LayoutChangeEvent,
} from 'react-native';
import PagerView from 'react-native-pager-view';
import { SymbolView } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getPalette, MaxContentWidth } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTabNavigation } from '@/context/tab-context';
import { TAB_BAR_HEIGHT } from '@/hooks/use-tab-bar-height';

import type { AppTab } from '@/navigation/tabs';

const PILL_WIDTH = 64;
const PILL_HEIGHT = 32;

/** The bottom tab bar and its swipeable pages, for the signed-in role's tabs. */
export default function AppTabs({ tabs }: { tabs: AppTab[] }) {
  const scheme = useColorScheme();
  const palette = getPalette(scheme === 'dark');
  const insets = useSafeAreaInsets();
  const { activeTab, setActiveTab, pagerRef } = useTabNavigation();
  const internalPagerRef = useRef<PagerView>(null);

  const [containerWidth, setContainerWidth] = useState(0);
  const [pillTranslateX] = useState(() => new Animated.Value(0));

  useEffect(() => {
    pagerRef.current = {
      setPage: (page: number) => {
        internalPagerRef.current?.setPage(page);
      },
      setPageWithoutAnimation: (page: number) => {
        internalPagerRef.current?.setPageWithoutAnimation(page);
      },
    };
  }, [pagerRef]);

  // Animate sliding pill background whenever activeTab or containerWidth changes
  useEffect(() => {
    if (containerWidth > 0) {
      const tabWidth = containerWidth / tabs.length;
      const targetX = activeTab * tabWidth + (tabWidth - PILL_WIDTH) / 2;
      Animated.spring(pillTranslateX, {
        toValue: targetX,
        useNativeDriver: true,
        friction: 8,
        tension: 70,
      }).start();
    }
  }, [activeTab, containerWidth, pillTranslateX, tabs.length]);

  const handleTabPress = (index: number) => {
    setActiveTab(index);
    internalPagerRef.current?.setPageWithoutAnimation(index);
  };

  const handleLayout = (e: LayoutChangeEvent) => {
    const width = e.nativeEvent.layout.width;
    setContainerWidth(width);
  };

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      {/* ── Native Slider (PagerView) ── */}
      <PagerView
        ref={internalPagerRef}
        style={styles.pager}
        initialPage={0}
        orientation="horizontal"
        offscreenPageLimit={tabs.length - 1}
        onPageSelected={(e) => {
          setActiveTab(e.nativeEvent.position);
        }}>
        {tabs.map((tab) => (
          <View key={`${tab.key}-page`} style={styles.page}>
            {tab.render({})}
          </View>
        ))}
      </PagerView>

      {/* ── Bottom Navigation Bar ── */}
      <View
        style={[
          styles.tabBarContainer,
          {
            backgroundColor: palette.card,
            borderTopColor: palette.border,
            paddingBottom: Math.max(insets.bottom, 8),
          },
        ]}>
        <View style={styles.tabBarInner} onLayout={handleLayout}>
          {/* ── Sliding Active Background Pill ── */}
          {containerWidth > 0 && (
            <Animated.View
              style={[
                styles.slidingPill,
                {
                  backgroundColor: palette.primarySoft,
                  transform: [{ translateX: pillTranslateX }],
                },
              ]}
            />
          )}

          {/* ── Tab Triggers ── */}
          {tabs.map((tab, index) => {
            const isSelected = activeTab === index;
            const iconName = isSelected ? tab.icon.sf.selected : tab.icon.sf.default;
            const iconColor = isSelected ? palette.primary : palette.mutedForeground;
            const labelColor = isSelected ? palette.foreground : palette.mutedForeground;

            return (
              <Pressable
                key={tab.key}
                accessibilityRole="button"
                accessibilityLabel={tab.label}
                accessibilityState={{ selected: isSelected }}
                onPress={() => handleTabPress(index)}
                style={({ pressed }) => [
                  styles.tabButton,
                  pressed && styles.tabButtonPressed,
                ]}>
                <View style={styles.tabContent}>
                  {/* Icon Slot */}
                  <View style={styles.iconSlot}>
                    <SymbolView
                      name={{
                        ios: iconName,
                        android: tab.icon.md,
                        web: tab.icon.md,
                      }}
                      tintColor={iconColor}
                      size={25}
                    />
                  </View>

                  {/* Label */}
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.tabLabel,
                      {
                        color: labelColor,
                        fontWeight: isSelected ? '700' : '500',
                      },
                    ]}>
                    {tab.label}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  pager: {
    flex: 1,
  },
  page: {
    flex: 1,
  },
  tabBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    paddingTop: 4,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
  },
  tabBarInner: {
    flexDirection: 'row',
    alignItems: 'stretch',
    height: TAB_BAR_HEIGHT,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    position: 'relative',
  },
  slidingPill: {
    position: 'absolute',
    top: (TAB_BAR_HEIGHT - (PILL_HEIGHT + 18)) / 2,
    left: 0,
    width: PILL_WIDTH,
    height: PILL_HEIGHT,
    borderRadius: 16,
    zIndex: 0,
  },
  tabButton: {
    flex: 1,
    height: TAB_BAR_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  tabButtonPressed: {
    opacity: 0.75,
  },
  tabContent: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  iconSlot: {
    width: PILL_WIDTH,
    height: PILL_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  tabLabel: {
    fontSize: 11.5,
    letterSpacing: 0.1,
    marginTop: 2,
    textAlign: 'center',
    alignSelf: 'center',
    width: '100%',
  },
});
