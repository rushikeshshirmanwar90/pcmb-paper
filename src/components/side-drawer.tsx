import { useEffect, useState } from 'react';
import { Animated, Modal, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getPalette } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type SideDrawerProps = {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
};

export function SideDrawer({ visible, title, subtitle, onClose, children }: SideDrawerProps) {
  const { width: windowWidth } = useWindowDimensions();
  const scheme = useColorScheme();
  const palette = getPalette(scheme === 'dark');
  const [progress] = useState(() => new Animated.Value(0));
  const drawerWidth = Math.min(windowWidth * 0.88, 380);
  const useNativeDriver = Platform.OS !== 'web';

  useEffect(() => {
    if (visible) {
      progress.setValue(0);
      Animated.timing(progress, {
        toValue: 1,
        duration: 230,
        useNativeDriver,
      }).start();
    }
  }, [visible, progress, useNativeDriver]);

  function closeDrawer() {
    if (Platform.OS === 'web') {
      Animated.timing(progress, {
        toValue: 0,
        duration: 180,
        useNativeDriver: false,
      }).start();
      setTimeout(onClose, 200);
      return;
    }

    Animated.timing(progress, {
      toValue: 0,
      duration: 180,
      useNativeDriver,
    }).start(({ finished }) => {
      if (finished) onClose();
    });
  }

  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [drawerWidth, 0],
  });

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={closeDrawer}>
      <View style={styles.root}>
        <Pressable accessibilityLabel="Close panel" onPress={closeDrawer} style={styles.scrim} />
        <Animated.View
          style={[
            styles.drawer,
            {
              width: drawerWidth,
              backgroundColor: palette.sidebar,
              transform: [{ translateX }],
            },
          ]}>
          <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
            <View style={[styles.header, { borderBottomColor: palette.sidebarBorder }]}>
              <View style={styles.headerText}>
                <Text style={[styles.title, { color: palette.sidebarForeground }]}>{title}</Text>
                {subtitle ? <Text style={[styles.subtitle, { color: palette.mutedForeground }]}>{subtitle}</Text> : null}
              </View>
              <Pressable
                accessibilityLabel="Close panel"
                accessibilityRole="button"
                onPress={closeDrawer}
                style={({ pressed }) => [styles.closeButton, { backgroundColor: palette.sidebarHover }, pressed && styles.pressed]}>
                <SymbolView
                  name={{ ios: 'xmark', android: 'close', web: 'close' }}
                  tintColor={palette.sidebarForeground}
                  size={17} />
              </Pressable>
            </View>
            <View style={styles.content}>{children}</View>
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end' },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(25, 22, 18, 0.42)' },
  drawer: { height: '100%', zIndex: 1 },
  safeArea: { flex: 1 },
  header: {
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  headerText: { flex: 1, paddingRight: 16 },
  title: { fontSize: 18, fontWeight: '700' },
  subtitle: { fontSize: 12, marginTop: 4 },
  closeButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  content: { flex: 1 },
  pressed: { opacity: 0.72 },
});