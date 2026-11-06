import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type PropsWithChildren,
  type Ref,
} from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type EmitterSubscription,
  type ScrollViewInstance,
  type ScrollViewProps,
  type ViewInstance,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

/** Space kept between a focused field's group and the keyboard (or the footer above it). */
const FOCUS_MARGIN = 24;
/**
 * Time for the avoiding view to shrink the scroller, and for Android's own
 * scroll to the focused input to finish, once the keyboard is up. Measuring
 * before that races those two and scrolls to a stale position.
 */
const LAYOUT_SETTLE_MS = 300;
/** Waiting for a keyboard that may never come (a hardware keyboard), then scrolling anyway. */
const NO_KEYBOARD_MS = 500;

/**
 * Keeps a form and its pinned footer above the keyboard. Android apps are
 * edge-to-edge, so the window no longer resizes for the keyboard and a view
 * with no `behavior` stays under it; `padding` works on both platforms.
 * Put the scrolling fields and the footer inside it, so the fields shrink
 * and scroll to the focused input while the footer stays reachable.
 * Use a KeyboardAwareScrollView for the fields.
 */
export function KeyboardSafeView({ children, style, offset = 0 }: PropsWithChildren<{ style?: StyleProp<ViewStyle>; offset?: number }>) {
  return (
    <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={offset} style={[styles.fill, style]}>
      {children}
    </KeyboardAvoidingView>
  );
}

/**
 * Whether the keyboard is up. A pinned footer drops its bottom safe-area
 * padding while it is: the keyboard covers the navigation bar, so that
 * padding would only leave a gap between the footer and the keyboard.
 */
export function useKeyboardVisible() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', () => setVisible(true));
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return visible;
}

type ScrollIntoView = (target: ViewInstance | null) => void;

const ScrollIntoViewContext = createContext<ScrollIntoView | null>(null);

/**
 * Scrolls the nearest KeyboardAwareScrollView so a whole field group (label,
 * input, helper and error text) is in view with room above the keyboard.
 * Null outside one, so a field there simply doesn't scroll.
 */
export function useScrollIntoView() {
  return useContext(ScrollIntoViewContext);
}

/**
 * A ScrollView for forms. Android only scrolls the focused input itself into
 * view, so the helper text under it, and the room above the keyboard, were
 * left hidden. When a Field is focused this waits for the keyboard and the
 * shrunken layout, then scrolls its whole group in. While the keyboard is up
 * it also ends with a little spare room, so fields at the very end of a form
 * can reach that margin; nothing is added when the keyboard is closed.
 */
export function KeyboardAwareScrollView({ ref, children, ...props }: ScrollViewProps & { ref?: Ref<ScrollViewInstance> }) {
  const scroller = useRef<ScrollViewInstance>(null);
  const cancelPending = useRef<(() => void) | null>(null);
  const keyboardVisible = useKeyboardVisible();
  useImperativeHandle(ref, () => scroller.current as ScrollViewInstance);

  useEffect(() => () => cancelPending.current?.(), []);

  const scrollIntoView = useCallback<ScrollIntoView>((target) => {
    cancelPending.current?.();
    cancelPending.current = null;
    if (!target) return;

    const timers: ReturnType<typeof setTimeout>[] = [];
    let subscription: EmitterSubscription | null = null;
    cancelPending.current = () => {
      timers.forEach(clearTimeout);
      subscription?.remove();
    };

    const reveal = () => {
      timers.push(
        setTimeout(() => {
          const view = scroller.current;
          if (!view) return;
          const content = view.getInnerViewRef();
          view.measureInWindow((_x, top, _width, height) => {
            target.measureInWindow((_tx, groupTop, _tw, groupHeight) => {
              const above = groupTop < top + 8;
              const below = groupTop + groupHeight + FOCUS_MARGIN > top + height;
              if (!content || (!above && !below)) return;
              // Where the group sits inside the scrolled content, so the target doesn't depend on the current offset.
              target.measureLayout(content, (_lx, y, _lw, h) => {
                const showTop = y - 8;
                // Clear the keyboard by the margin, but never push the group's own top out of view.
                const showBottom = Math.min(y + h + FOCUS_MARGIN - height, showTop);
                view.scrollTo({ y: Math.max(0, above ? showTop : showBottom), animated: true });
              });
            });
          });
        }, LAYOUT_SETTLE_MS)
      );
    };

    if (Keyboard.isVisible()) {
      reveal();
      return;
    }
    // The keyboard is on its way: the scroller only shrinks once it has shown.
    subscription = Keyboard.addListener('keyboardDidShow', () => {
      subscription?.remove();
      subscription = null;
      reveal();
    });
    timers.push(setTimeout(reveal, NO_KEYBOARD_MS));
  }, []);

  return (
    <ScrollIntoViewContext.Provider value={scrollIntoView}>
      <ScrollView {...props} ref={scroller}>
        {children}
        {keyboardVisible ? <View style={styles.spare} /> : null}
      </ScrollView>
    </ScrollIntoViewContext.Provider>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, minWidth: 0 },
  spare: { height: FOCUS_MARGIN },
});
