#!/usr/bin/env bash
# Neobrutalism redesign audit for Expo / React Native projects.
# Usage: bash audit.sh [src-dir] [--leaks classic-dir ...]   (default: ./src, falls back to ./app)
#   --leaks: scoped apps only. Lists neo-only symbols found in folders that must stay classic (e.g. src/screens/teacher).
# Lists the theme file, the shared kit, and every style value that bypasses tokens.
set -uo pipefail

SRC="${1:-}"
LEAK_DIRS=()
if [[ "${2:-}" == "--leaks" ]]; then shift 2; LEAK_DIRS=("$@"); fi
if [[ -z "$SRC" ]]; then
  if [[ -d src ]]; then SRC=src; elif [[ -d app ]]; then SRC=app; else SRC=.; fi
fi
[[ -d "$SRC" ]] || { echo "No such directory: $SRC" >&2; exit 1; }

INC=(--include='*.tsx' --include='*.ts' --include='*.jsx' --include='*.js')
EXC=(--exclude-dir=node_modules --exclude-dir=.expo --exclude-dir=dist --exclude-dir=build --exclude-dir=ios --exclude-dir=android)

hr() { printf '\n== %s ==\n' "$1"; }
count() { grep -rE "${INC[@]}" "${EXC[@]}" "$1" "$SRC" 2>/dev/null | wc -l | tr -d ' '; }
files() { grep -rlE "${INC[@]}" "${EXC[@]}" "$1" "$SRC" 2>/dev/null; }
top() { grep -rcE "${INC[@]}" "${EXC[@]}" "$1" "$SRC" 2>/dev/null | grep -v ':0$' | sort -t: -k2 -nr | head -"${2:-12}" | sed 's/^/  /'; }

echo "Neobrutalism audit for: $SRC"

hr "Theme / token files"
files "export (const|function) (Colors|Palette|palette|theme|Theme|getPalette|lightPalette|darkPalette)\b|const (light|dark)(Palette|Theme|Colors)\b|createTheme\(" | sed 's/^/  /'

hr "Theme hooks and how widely they are used"
for h in usePalette useTheme useThemeColor useColorScheme; do
  n=$(files "\b$h\(" | wc -l | tr -d ' ')
  [[ "$n" != "0" ]] && echo "  $h(): $n files"
done

hr "Shared component kit candidates (most imported component modules)"
grep -rhoE "${INC[@]}" "${EXC[@]}" "from ['\"]@?/?[^'\"]*components/[^'\"]+['\"]" "$SRC" 2>/dev/null \
  | sed -E "s/from ['\"]//; s/['\"]$//" | sort | uniq -c | sort -nr | head -10 | sed 's/^/  /'

hr "Fonts"
echo "  useFonts calls:          $(count 'useFonts\(')"
echo "  fontFamily usages:       $(count 'fontFamily')"
echo "  fontWeight usages:       $(count 'fontWeight')   <- replace with per-weight fontFamily"
grep -q '@expo-google-fonts' package.json 2>/dev/null && grep -o '"@expo-google-fonts/[^"]*"' package.json | sed 's/^/  installed: /'

hr "Hard-coded colors outside theme (hex / rgb)"
echo "  total: $(count "['\"](#[0-9A-Fa-f]{3,8}|rgba?\()")"
top "['\"](#[0-9A-Fa-f]{3,8}|rgba?\()"

hr "borderRadius values (map to radius.sm/md/lg/full)"
echo "  total: $(count 'borderRadius')"
grep -rhoE "${INC[@]}" "${EXC[@]}" 'borderRadius: *[0-9]+' "$SRC" 2>/dev/null | sed -E 's/borderRadius: *//' | sort -n | uniq -c | sort -nr | head -12 | awk '{printf "  radius %-4s x%s\n", $2, $1}'

hr "Soft shadows / elevation (replace with hardShadow or remove)"
echo "  total: $(count '(shadowColor|shadowOpacity|shadowRadius|shadowOffset|elevation:)')"
top '(shadowColor|shadowOpacity|shadowRadius|shadowOffset|elevation:)'

hr "Thin borders (borderWidth 1 / hairline)"
echo "  total: $(count '(borderWidth: *(0\.5|1)\b|hairlineWidth)')"
top '(borderWidth: *(0\.5|1)\b|hairlineWidth)'

hr "Pressables to route through PressableNeo"
echo "  TouchableOpacity:        $(count 'TouchableOpacity')"
echo "  TouchableHighlight:      $(count 'TouchableHighlight')"
echo "  Pressable:               $(count '<Pressable')"
echo "  android_ripple:          $(count 'android_ripple')"

hr "overflow: hidden (can clip hard shadows)"
echo "  total: $(count "overflow: *['\"]hidden")"
top "overflow: *['\"]hidden" 8

hr "Styles that contradict the look"
echo "  gradients:               $(count '(LinearGradient|expo-linear-gradient)')"
echo "  blur / glass:            $(count '(BlurView|expo-blur|GlassView|expo-glass-effect)')"
echo "  StyleSheet.create blocks:$(count 'StyleSheet\.create')"

hr "Accent colors used as TEXT (fails contrast; use ink + a colored fill instead)"
echo "  total: $(count "color: *[a-zA-Z]+\\.(primary|success|danger|warning|violet|info|accent|brand)\\b")"
top "color: *[a-zA-Z]+\\.(primary|success|danger|warning|violet|info|accent|brand)\\b" 8

hr "Existing motion & haptics (check against the motion budget)"
echo "  expo-haptics calls:      $(count 'Haptics\.')"
echo "  Vibration API:           $(count 'Vibration\.vibrate')"
echo "  reanimated springs/timing:$(count '(withSpring|withTiming|withSequence|withRepeat)\(')"
echo "  withRepeat (loops):      $(count 'withRepeat\(')   <- only test-timer pulse may loop"
echo "  layout entering/exiting: $(count '(entering|exiting)=')"
echo "  RN Animated API:         $(count '(Animated\.timing|Animated\.spring|new Animated\.Value)')   <- migrate to reanimated"
echo "  LayoutAnimation:         $(count 'LayoutAnimation\.')"

hr "Likely no-touch zones (math, webviews, print/PDF)"
files '(katex|mathjax|WebView|expo-print|printToFileAsync|<html|\.pdf)' | sed 's/^/  /' | head -20

echo
echo "Re-run after each folder of the screen sweep; counts outside the theme file should approach zero."

if (( ${#LEAK_DIRS[@]} )); then
  hr "Scope leak check (neo-only symbols in classic folders; must be empty)"
  LEAKS=$(grep -rnE "${INC[@]}" "${EXC[@]}" "NeoText|PressableNeo|hardShadow|textStyles\.|Neo\.(radius|shadow|border|space)|\bSticker\b|GridPaper|Headline\b|useInk\(" "${LEAK_DIRS[@]}" 2>/dev/null)
  if [[ -z "$LEAKS" ]]; then echo "  clean"; else echo "$LEAKS" | sed 's/^/  LEAK /' | head -40; fi
fi
