import { useRef, useState, type ComponentRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { usePalette } from '@/components/kit';

export type MenuAnchor = { x: number; y: number; width: number; height: number };
export type QuestionAction = 'details' | 'edit' | 'replace' | 'remove';

/** Coordinates are relative to the same native window as the anchor. */
export function menuPosition(anchor: MenuAnchor, bounds: MenuAnchor, size: { width: number; height: number }) {
  const gap = 4;
  const edge = 8;
  const below = anchor.y - bounds.y + anchor.height + gap;
  const above = anchor.y - bounds.y - size.height - gap;
  return {
    left: Math.max(edge, Math.min(anchor.x - bounds.x + anchor.width - size.width, bounds.width - size.width - edge)),
    top: Math.max(edge, Math.min(below + size.height <= bounds.height - edge ? below : above, bounds.height - size.height - edge)),
  };
}

/** Small transparent dismissal layer inside the subject's existing modal. */
export function QuestionActionMenu({ anchor, disabled, onClose, onAction, actions = ['details', 'edit', 'replace', 'remove'] }: {
  anchor: MenuAnchor; disabled: boolean; onClose: () => void; onAction: (action: QuestionAction) => void;
  /** Which actions to offer; a paper has no question to swap in a live test, so Make a paper leaves out Replace. */
  actions?: readonly QuestionAction[];
}) {
  const p = usePalette();
  const root = useRef<ComponentRef<typeof View>>(null);
  const [bounds, setBounds] = useState<MenuAnchor | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const ready = !!bounds && size.width > 0;
  return <View ref={root} style={StyleSheet.absoluteFill} onLayout={() => {
    root.current?.measureInWindow((x, y, width, height) => setBounds({ x, y, width, height }));
  }}>
    <Pressable accessibilityRole="button" accessibilityLabel="Dismiss question actions" style={StyleSheet.absoluteFill} onPress={onClose} />
    <View accessibilityViewIsModal onAccessibilityEscape={onClose}
      onLayout={e => setSize(e.nativeEvent.layout)}
      style={[styles.menu, { backgroundColor: p.popover, borderColor: p.border, opacity: ready ? 1 : 0,
        maxWidth: bounds ? Math.max(0, bounds.width - 16) : '95%',
        ...(bounds ? menuPosition(anchor, bounds, size) : { top: 0, left: 0 }) }]}>
      {actions.map(action => {
        const label = { details: 'View Details', edit: 'Edit Question', replace: 'Replace Question', remove: 'Remove Question' }[action];
        const blocked = disabled && action !== 'details';
        return <Pressable key={action} accessibilityRole="button" accessibilityLabel={label} disabled={blocked}
          accessibilityState={{ disabled: blocked }} onPress={() => onAction(action)} style={styles.action}>
          <Text style={{ color: blocked ? p.mutedForeground : action === 'remove' ? p.danger : p.foreground, fontSize: 15 }}>{label}</Text>
        </Pressable>;
      })}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  menu: { position: 'absolute', borderWidth: 1, borderRadius: 12, paddingVertical: 4, elevation: 8,
    shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
  action: { minHeight: 48, paddingHorizontal: 16, justifyContent: 'center' },
});
