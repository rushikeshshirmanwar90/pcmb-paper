import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { getPalette } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

// Figures extracted from an uploaded paper (question, option or solution
// diagrams). Each image is sized to its real aspect ratio once it loads, and
// never drawn wider than it was cut from the page.

function Diagram({ uri, maxHeight, borderColor }: { uri: string; maxHeight: number; borderColor: string }) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const aspectRatio = size ? size.width / size.height : 4 / 3;

  // A broken image would otherwise leave an empty box between the question
  // and its options.
  if (failed) return null;

  return (
    // Diagrams are dark line art on white; keep a white ground in dark mode.
    <View style={[styles.frame, { borderColor }]}>
      <Image
        source={{ uri }}
        contentFit="contain"
        accessibilityLabel="Diagram"
        onError={() => setFailed(true)}
        onLoad={(e) => setSize({ width: e.source.width, height: e.source.height })}
        style={[
          styles.image,
          { aspectRatio, maxHeight, maxWidth: size ? size.width : '100%' },
        ]}
      />
    </View>
  );
}

export function Diagrams({ urls, maxHeight = 260 }: { urls?: string[]; maxHeight?: number }) {
  const dark = useColorScheme() === 'dark';
  const palette = getPalette(dark);
  if (!urls || urls.length === 0) return null;

  return (
    <View style={styles.list}>
      {urls.map((uri) => (
        <Diagram key={uri} uri={uri} maxHeight={maxHeight} borderColor={palette.border} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 8,
    marginVertical: 6,
  },
  frame: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    padding: 6,
  },
  image: {
    width: '100%',
  },
});
