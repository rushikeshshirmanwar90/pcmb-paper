import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  Animated,
  PanResponder,
  LayoutChangeEvent,
} from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getPalette, MaxContentWidth } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTabNavigation } from '@/context/tab-context';

import { HomeScreen } from '@/app/index';
import { QuestionsScreen } from '@/app/questions';
import { ExploreScreen } from '@/app/explore';
import { ProfileScreen } from '@/app/profile';

const TABS = [
  {
    key: 'home',
    label: 'Home',
    icon: {
      sf: { default: 'house', selected: 'house.fill' },
      md: 'home',
    },
  },
  {
    key: 'questions',
    label: 'Questions',
    icon: {
      sf: { default: 'questionmark.circle', selected: 'questionmark.circle.fill' },
      md: 'quiz',
    },
  },
  {
    key: 'explore',
    label: 'Papers',
    icon: {
      sf: { default: 'doc.text', selected: 'doc.text.fill' },
      md: 'description',
    },
  },
  {
    key: 'profile',
    label: 'Profile',
    icon: {
      sf: { default: 'person.crop.circle', selected: 'person.crop.circle.fill' },
      md: 'account_circle',
    },
  },
] as const;

const PILL_WIDTH = 64;
const PILL_HEIGHT = 32;
const TAB_BAR_HEIGHT = 56;

export default function AppTabs() {
  const { width: windowWidth } = useWindowDimensions();
  const scheme = useColorScheme();
  const palette = getPalette(scheme === 'dark');
  const insets = useSafeAreaInsets();
  const { activeTab, setActiveTab, pagerRef } = useTabNavigation();

  const [translateX] = useState(() => new Animated.Value(0));
  const [containerWidth, setContainerWidth] = useState(0);
  const [pillTranslateX] = useState(() => new Animated.Value(0));

  const scrollToTab = useCallback(
    (index: number, animated = true) => {
      setActiveTab(index);
      if (animated) {
        Animated.spring(translateX, {
          toValue: -index * windowWidth,
          useNativeDriver: false,
          friction: 9,
          tension: 60,
        }).start();
      } else {
        translateX.setValue(-index * windowWidth);
      }
    },
    [setActiveTab, translateX, windowWidth]
  );

  useEffect(() => {
    pagerRef.current = {
      setPage: (page: number) => {
        scrollToTab(page, true);
      },
      setPageWithoutAnimation: (page: number) => {
        scrollToTab(page, false);
      },
    };
  }, [pagerRef, scrollToTab]);

  // Animate sliding pill background on navbar
  useEffect(() => {
    if (containerWidth > 0) {
      const tabWidth = containerWidth / TABS.length;
      const targetX = activeTab * tabWidth + (tabWidth - PILL_WIDTH) / 2;
      Animated.spring(pillTranslateX, {
        toValue: targetX,
        useNativeDriver: false,
        friction: 8,
        tension: 70,
      }).start();
    }
  }, [activeTab, containerWidth, pillTranslateX]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => {
          return Math.abs(gesture.dx) > 18 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5;
        },
        onPanResponderMove: (_, gesture) => {
          const base = -activeTab * windowWidth;
          translateX.setValue(base + gesture.dx);
        },
        onPanResponderRelease: (_, gesture) => {
          const threshold = windowWidth * 0.18;
          let targetIdx = activeTab;

          if (gesture.dx < -threshold && activeTab < TABS.length - 1) {
            targetIdx = activeTab + 1;
          } else if (gesture.dx > threshold && activeTab > 0) {
            targetIdx = activeTab - 1;
          }

          scrollToTab(targetIdx, true);
        },
      }),
    [activeTab, scrollToTab, translateX, windowWidth]
  );

  const handleLayout = (e: LayoutChangeEvent) => {
    setContainerWidth(e.nativeEvent.layout.width);
  };

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      {/* ── Web Horizontal Sliding Container ── */}
      <View style={styles.sliderViewport} {...panResponder.panHandlers}>
        <Animated.View
          style={[
            styles.sliderTrack,
            {
              width: windowWidth * 4,
              transform: [{ translateX }],
            },
          ]}>
          <View style={[styles.page, { width: windowWidth }]}>
            <HomeScreen />
          </View>
          <View style={[styles.page, { width: windowWidth }]}>
            <QuestionsScreen />
          </View>
          <View style={[styles.page, { width: windowWidth }]}>
            <ExploreScreen />
          </View>
          <View style={[styles.page, { width: windowWidth }]}>
            <ProfileScreen />
          </View>
        </Animated.View>
      </View>

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
          {TABS.map((tab, index) => {
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
                onPress={() => scrollToTab(index, false)}
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
    overflow: 'hidden',
  },
  sliderViewport: {
    flex: 1,
    overflow: 'hidden',
  },
  sliderTrack: {
    flex: 1,
    flexDirection: 'row',
  },
  page: {
    flex: 1,
    height: '100%',
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
    zIndex: 100,
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
    cursor: 'pointer' as any,
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
