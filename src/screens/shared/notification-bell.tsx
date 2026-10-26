import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon, usePalette } from '@/components/kit';

/** The header's bell: a red count when something is waiting. */
export function NotificationBell({ count, onPress }: { count: number; onPress: () => void }) {
  const palette = usePalette();
  const label = count ? `Notifications, ${count} waiting` : 'Notifications';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.button, { backgroundColor: palette.secondary }, pressed && styles.pressed]}
    >
      <Icon name={{ ios: count ? 'bell.badge.fill' : 'bell', android: count ? 'notifications_active' : 'notifications' }} color={palette.foreground} size={20} />
      {count ? (
        <View style={[styles.badge, { backgroundColor: palette.danger, borderColor: palette.card }]}>
          <Text style={styles.badgeText}>{count > 9 ? '9+' : count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.75 },
  badge: { position: 'absolute', top: -2, right: -2, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 4, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
});
