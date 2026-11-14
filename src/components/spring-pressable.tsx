import { type ComponentProps } from 'react';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * A Pressable that answers the finger on press-down: it settles in on a critically
 * damped spring (no bounce) from wherever it currently is, and springs back on release
 * or when the press is dragged away, so a quick tap or a cancelled press never jumps.
 * With Reduce Motion on it does not move at all (the caller's own pressed styling still applies).
 */
export function SpringPressable({
  pressedScale = 0.98,
  style,
  onPressIn,
  onPressOut,
  ...props
}: Omit<ComponentProps<typeof Pressable>, 'style'> & { pressedScale?: number; style?: StyleProp<ViewStyle> }) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const to = (value: number) => {
    scale.set(reduceMotion ? 1 : withSpring(value, { duration: 300, dampingRatio: 1 }));
  };
  return (
    <AnimatedPressable
      {...props}
      onPressIn={(event) => {
        to(pressedScale);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        to(1);
        onPressOut?.(event);
      }}
      style={[style, animated]}
    />
  );
}
