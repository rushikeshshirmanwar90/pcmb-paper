import React from 'react';
import { Platform, StyleSheet, Text as RNText, TextInput as RNTextInput, type TextInputProps, type TextProps, type TextStyle } from 'react-native';
import { neoAppPalette } from '@/design/palette';
import { useDesign, useFontOption, useIsDark } from '@/design/scope';
import { faceForWeight, FONT_OPTIONS } from '@/design/tokens';

// Drop-in Text and TextInput for screens that render in both looks. Classic:
// exactly React Native's components, untouched. Student look: the weight
// becomes the right face of the app font (Android ignores fontWeight on
// custom fonts), and an accent colour used as text turns to ink (yellow,
// pink or mint text fails contrast; accents are fills, never text).

const ACCENTS = ['primary', 'success', 'warning', 'danger', 'violet', 'info', 'highlight', 'doodle', 'primaryHover', 'brand', 'tabSelected'] as const;

function useNeoTextStyle(style: TextProps['style']): TextStyle[] {
  const option = useFontOption();
  const p = neoAppPalette(useIsDark());
  const flat = (StyleSheet.flatten(style) ?? {}) as TextStyle;
  const out: { fontFamily?: string; fontWeight?: TextStyle['fontWeight']; color?: string } = {};
  const family = flat.fontFamily;
  const keepFamily = family && (family.includes('_') || /mono/i.test(family));
  if (!keepFamily) {
    out.fontFamily = faceForWeight(FONT_OPTIONS[option], flat.fontWeight as string | undefined, flat.fontSize ?? 14);
    out.fontWeight = 'normal';
  }
  if (typeof flat.color === 'string' && ACCENTS.some((k) => p[k] === flat.color)) out.color = p.ink;
  return Platform.OS === 'android' ? [out as TextStyle, { includeFontPadding: false }] : [out as TextStyle];
}

function NeoMappedText({ style, ...rest }: TextProps) {
  const extra = useNeoTextStyle(style);
  return <RNText maxFontSizeMultiplier={1.6} {...rest} style={[style, ...extra]} />;
}

export function Text(props: TextProps & { ref?: React.Ref<React.ComponentRef<typeof RNText>> }) {
  return useDesign() === 'neo' ? <NeoMappedText {...props} /> : <RNText {...props} />;
}

function NeoMappedInput({ style, ...rest }: TextInputProps) {
  const extra = useNeoTextStyle(style);
  return <RNTextInput maxFontSizeMultiplier={1.4} {...rest} style={[style, ...extra]} />;
}

export function TextInput(props: TextInputProps & { ref?: React.Ref<React.ComponentRef<typeof RNTextInput>> }) {
  return useDesign() === 'neo' ? <NeoMappedInput {...props} /> : <RNTextInput {...props} />;
}
