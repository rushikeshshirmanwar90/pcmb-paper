import React, { useState, type PropsWithChildren } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { useReducedMotion, withSpring, withTiming } from 'react-native-reanimated';

// Motion for the student look, after Apple's fluid-interface rules: springs,
// critically damped by default (no overshoot), a response of about 0.35 s;
// movement says where things come from (forward = from the right, back = from
// the left); Reduce Motion gets a cross-fade instead of movement.

/** Damping ratio 1 (critically damped), response ≈ 0.35 s: c = 2·√(k·m). */
export const SPRING = { damping: 36, stiffness: 320, mass: 1 } as const;

const enterFrom = (dx: number, dy: number) => () => {
  'worklet';
  return {
    initialValues: { opacity: 0, transform: [{ translateX: dx }, { translateY: dy }] },
    animations: {
      opacity: withTiming(1, { duration: 160 }),
      transform: [{ translateX: withSpring(0, SPRING) }, { translateY: withSpring(0, SPRING) }],
    },
  };
};

/** +1 when `index` moved forward, −1 back, 0 at first. Tracked in state, so render stays pure. */
export function useStepDirection(index: number): -1 | 0 | 1 {
  const [seen, setSeen] = useState({ index, dir: 0 as -1 | 0 | 1 });
  if (seen.index !== index) {
    const dir = index > seen.index ? 1 : -1;
    setSeen({ index, dir });
    return dir;
  }
  return seen.dir;
}

/**
 * One step of a sequence (a question, a page of a flow). A new `step` slides in
 * from the side it came from: forward from the right, back from the left.
 */
export function StepSlide({ step, direction, style, children }: PropsWithChildren<{ step: string | number; direction: -1 | 0 | 1; style?: StyleProp<ViewStyle> }>) {
  const reduce = useReducedMotion();
  return (
    <Animated.View key={step} entering={enterFrom(reduce ? 0 : direction * 28, 0)} style={style}>
      {children}
    </Animated.View>
  );
}

/** Something that appears because of what you just did (a verdict, a result) rises a few points into place. */
export function Rise({ style, children }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  const reduce = useReducedMotion();
  return (
    <Animated.View entering={enterFrom(0, reduce ? 0 : 12)} style={style}>
      {children}
    </Animated.View>
  );
}
