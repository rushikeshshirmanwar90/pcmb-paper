# React Native / Expo pitfalls for neobrutalism

## Hard shadows
- **`boxShadow` style** (`'4px 4px 0px 0px #111'`) works on iOS and Android from RN 0.76 with the **New Architecture** (default since Expo SDK 52). Check `app.json` → `newArchEnabled` is not `false`.
- **`elevation` cannot make a hard shadow** — it is always blurred and grey. Remove it everywhere.
- iOS `shadowRadius: 0, shadowOpacity: 1, shadowOffset {4,4}` also works on iOS but does nothing on Android; don't use it.
- **Fallback (old architecture, or when animating)**: a sibling ink `View` positioned `left: o, top: o, right: 0, bottom: 0` behind the face, with the parent padded `paddingRight: o, paddingBottom: o`. This is what `PressableNeo` does; use it for static cards too if `boxShadow` is unavailable.
- **Don't put `boxShadow` on `TextInput`, `Image` or `ScrollView`.** It's unreliable on Android. Put border, fill and shadow on a wrapping `View` (see `Field`).
- **`boxShadow` paints outside the view's bounds**, so it does not take layout space. Add `marginRight/marginBottom` equal to the offset (Card does this) or the next sibling / screen edge will touch it.
- **`overflow: 'hidden'` on any ancestor clips the shadow.** Common culprits: `ScrollView` content containers with `overflow`, `FlatList` cells, rounded image wrappers, `PagerView` pages. Move the clipping to an inner view.
- Horizontal lists: give `contentContainerStyle={{ paddingRight: 20 + Neo.shadow.md, paddingBottom: Neo.shadow.md }}`.
- Shadow color in dark mode is `line` (cream), not black.

## Borders
- Use whole numbers (2) or 1.5; avoid `StyleSheet.hairlineWidth`, it renders inconsistent widths across densities.
- `borderRadius` with `borderWidth` on `Image` is unreliable on Android: wrap the image in a bordered `View` with the same radius and `overflow: 'hidden'` (shadow goes on an outer wrapper).
- Dividers inside a card: a `View` with `height: 2, backgroundColor: ink, marginHorizontal: -padding` to run edge-to-edge.

## Fonts
- **Android ignores `fontWeight` for custom fonts** and may synthesize ugly faux bold. Always pick the weight with `fontFamily` (`SpaceGrotesk_700Bold`) and do not also set `fontWeight`.
- Load fonts in the root `_layout.tsx` with `useFonts`, call `SplashScreen.preventAutoHideAsync()` at module scope and `hideAsync()` once fonts are loaded (or errored).
- Set the default family in the app's base `Text` wrapper (e.g. `ThemedText`). Raw `<Text>` from `react-native` won't inherit it — the audit lists them.
- Grotesks run slightly tall on Android; set explicit `lineHeight` from the type scale and `includeFontPadding: false` on Android for tight labels inside buttons/tags.
- `TextInput` needs `fontFamily` set explicitly too.
- **Font scaling:** don't disable `allowFontScaling`. Cap it with `maxFontSizeMultiplier` (tokens.md) and test at the largest OS text size. Buttons need `numberOfLines={1}` + `flexShrink: 1`, and rows need `minWidth: 0` on the text column, or long Hindi/Marathi chapter names will push tags off-screen.
- Timers and scores: `fontVariant: ['tabular-nums']` (or the mono font) so digits don't jump while counting.

## Press animation
- Animate only `transform` on the UI thread (Reanimated shared values). Never put pressed state in React state for the visual — it re-renders the tree.
- Respect reduced motion: `useReducedMotion()` → jump instead of spring. Keep the visual pressed state even then (it is feedback, not decoration).
- Keep the full shadow-padded area inside the `Pressable` so the touch target doesn't shrink; minimum 44×44 including padding, use `hitSlop` for small icons.
- **Reserve shadow space even when the shadow is hidden** (`reserve` prop). A chip whose shadow appears on selection must not push its neighbours 2px.
- Fire haptics in `onPress`, not `onPressIn`: press-in also fires when a finger lands on an option and starts scrolling.
- Do not wrap `PressableNeo` in `TouchableOpacity` (double opacity feedback). Remove `android_ripple` from these pressables.

## Haptics
- Android: `Haptics.performAndroidHapticsAsync(AndroidHaptics.Confirm | Reject | Segment_Tick …)` uses the real haptic engine and needs no `VIBRATE` permission. `impactAsync`/`notificationAsync` are simulated with the vibration motor on Android (buzzy), so they're only the fallback. The `haptic` helper in app-interactions motion.md does this.
- Haptics don't work in the iOS Simulator or on web. Test on real devices.
- Some Android phones have haptics off system-wide. That's fine, because haptics never carry information that isn't also shown visually.

## Layout & safe areas
- Screen gutter 20; content `gap` 12–16; card padding 16 (20 on hero).
- Pinned bottom CTA: `paddingBottom: insets.bottom + 12` and add its height to the scroll view's bottom padding.
- Floating tab bar: update the app's tab-bar-height hook so every scroll view clears it.
- Small phones (360dp): two buttons side by side need `flex: 1` and `minWidth: 0`; labels `numberOfLines={1}`.

## Things to leave alone
- KaTeX/MathJax WebViews, `react-native-webview` HTML, `expo-print` templates and PDF generators: they render their own CSS; restyling them breaks print output. At most change the surrounding container.
- Native pickers/date pickers: style the trigger field, not the native sheet.
- `expo-glass-effect` / blur views: replace with flat cream or ink surfaces; they contradict the style.

## Web build (react-native-web)
- `boxShadow` passes through as CSS — works.
- Set `cursor: 'pointer'` on PressableNeo for web, and a visible focus ring: `outlineStyle: 'solid', outlineWidth: 2, outlineColor: ink, outlineOffset: 2` on focus.
