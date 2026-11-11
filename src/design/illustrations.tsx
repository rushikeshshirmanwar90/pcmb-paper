import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';
import { useIsDark } from '@/design/scope';

// The student look's artwork (design/graphics: philosophy, briefs, masters,
// export.sh). Static WebP stills at 1x/2x/3x with a dark variant each. All
// decorative: the screen's words say the same, so screen readers skip them.
// Never shown on the test intro, runner or paused screens.

export type Art = { src: number; dark: number; width: number; height: number };

export const illustrations = {
  welcomeHero: { src: require('../../assets/illustrations/welcome-hero.webp'), dark: require('../../assets/illustrations/welcome-hero-dark.webp'), width: 260, height: 200 },
  emptyTests: { src: require('../../assets/illustrations/empty-tests.webp'), dark: require('../../assets/illustrations/empty-tests-dark.webp'), width: 170, height: 140 },
  allCaughtUp: { src: require('../../assets/illustrations/all-caught-up.webp'), dark: require('../../assets/illustrations/all-caught-up-dark.webp'), width: 170, height: 140 },
  noMistakes: { src: require('../../assets/illustrations/no-mistakes.webp'), dark: require('../../assets/illustrations/no-mistakes-dark.webp'), width: 170, height: 140 },
  assessmentResult: { src: require('../../assets/illustrations/assessment-result.webp'), dark: require('../../assets/illustrations/assessment-result-dark.webp'), width: 150, height: 130 },
  offline: { src: require('../../assets/illustrations/offline.webp'), dark: require('../../assets/illustrations/offline-dark.webp'), width: 160, height: 130 },
  physics: { src: require('../../assets/illustrations/subject-physics.webp'), dark: require('../../assets/illustrations/subject-physics-dark.webp'), width: 48, height: 48 },
  chemistry: { src: require('../../assets/illustrations/subject-chemistry.webp'), dark: require('../../assets/illustrations/subject-chemistry-dark.webp'), width: 48, height: 48 },
  maths: { src: require('../../assets/illustrations/subject-maths.webp'), dark: require('../../assets/illustrations/subject-maths-dark.webp'), width: 48, height: 48 },
  biology: { src: require('../../assets/illustrations/subject-biology.webp'), dark: require('../../assets/illustrations/subject-biology-dark.webp'), width: 48, height: 48 },
  pattern: { src: require('../../assets/illustrations/pattern-doodles.webp'), dark: require('../../assets/illustrations/pattern-doodles-dark.webp'), width: 400, height: 220 },
} satisfies Record<string, Art>;

export type ArtName = keyof typeof illustrations;

/** A decorative still in the current light/dark mode, hidden from screen readers. */
export function Illustration({ name, scale = 1 }: { name: ArtName; scale?: number }) {
  const art = illustrations[name];
  const dark = useIsDark();
  return (
    <Image
      source={dark ? art.dark : art.src}
      style={{ width: art.width * scale, height: art.height * scale }}
      contentFit="contain"
      cachePolicy="memory-disk"
      transition={0}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}

/** The faint doodle pattern, filling its parent (headers only, never behind body text or questions). */
export function PatternBackdrop() {
  const dark = useIsDark();
  return (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
      <Image source={dark ? illustrations.pattern.dark : illustrations.pattern.src} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" transition={0} accessible={false} />
    </View>
  );
}

/** The subject's tile illustration, or null for a subject without one. */
export function subjectArt(subject: string): ArtName | null {
  const s = subject.toLowerCase();
  if (s.startsWith('phys')) return 'physics';
  if (s.startsWith('chem')) return 'chemistry';
  if (s.startsWith('math')) return 'maths';
  if (s.startsWith('bio')) return 'biology';
  return null;
}

/**
 * A subject at a glance in rows and cards: its tile illustration (Physics,
 * Chemistry, Maths, Biology) at `size`, or the given icon in an outlined
 * square for anything else (mixed tests). Decorative: the subject is named
 * in the text beside it.
 */
export function SubjectMark({ subject, size = 40, icon, ink, fill }: { subject: string; size?: number; icon: { ios: SFSymbol; android: AndroidSymbol }; ink: string; fill: string }) {
  const art = subjectArt(subject);
  if (art) return <Illustration name={art} scale={size / 48} />;
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants" style={{ width: size, height: size, borderRadius: 10, borderWidth: 2, borderColor: ink, backgroundColor: fill, alignItems: 'center', justifyContent: 'center' }}>
      <SymbolView name={{ ios: icon.ios, android: icon.android, web: icon.android }} tintColor={ink} size={Math.round(size * 0.48)} />
    </View>
  );
}
