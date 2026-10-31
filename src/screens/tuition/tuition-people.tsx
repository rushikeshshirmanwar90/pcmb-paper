import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader } from '@/components/app-header';
import { Segmented, usePalette } from '@/components/kit';
import { MaxContentWidth } from '@/constants/theme';
import { resetPeopleNav, setPeopleSegment, usePeopleNav, type PeopleSegment } from '@/screens/tuition/people-nav';
import { StudentsPanel } from '@/screens/tuition/tuition-students';
import { TeachersPanel } from '@/screens/tuition/tuition-teachers';

const SEGMENTS: { value: PeopleSegment; label: string }[] = [
  { value: 'students', label: 'Students' },
  { value: 'teachers', label: 'Teachers' },
];

const PANELS: Record<PeopleSegment, () => React.JSX.Element> = { students: StudentsPanel, teachers: TeachersPanel };

const SUBTITLE: Record<PeopleSegment, string> = {
  students: 'Add students and assign their batch',
  teachers: 'Who teaches which subjects and batches',
};

/**
 * The tuition's people: Students and Teachers under one tab, switched at the
 * top. Each half stays loaded once opened, so switching back keeps its
 * search, filters and scroll position without loading again.
 */
export function TuitionPeopleScreen() {
  const palette = usePalette();
  const { segment } = usePeopleNav();
  // Teachers load the first time they're shown.
  const [opened, setOpened] = useState<Record<PeopleSegment, boolean>>({ students: true, teachers: false });
  if (!opened[segment]) setOpened((o) => ({ ...o, [segment]: true }));
  // Logging out removes this tab: the next login starts on Students.
  useEffect(() => () => resetPeopleNav(), []);

  return (
    <SafeAreaView edges={['top']} style={[styles.root, { backgroundColor: palette.background }]}>
      <AppHeader title="People" subtitle={SUBTITLE[segment]} />
      <View style={[styles.switcher, { borderBottomColor: palette.border }]}>
        <View style={styles.switcherInner}>
          <Segmented label="Show students or teachers" options={SEGMENTS} value={segment} onChange={setPeopleSegment} />
        </View>
      </View>
      {SEGMENTS.map(({ value }) => {
        const Panel = PANELS[value];
        const shown = segment === value;
        return (
          <View
            key={value}
            style={[styles.root, !shown && styles.hidden]}
            accessibilityElementsHidden={!shown}
            importantForAccessibility={shown ? 'auto' : 'no-hide-descendants'}
          >
            {opened[value] ? <Panel /> : null}
          </View>
        );
      })}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hidden: { display: 'none' },
  switcher: { borderBottomWidth: StyleSheet.hairlineWidth },
  switcherInner: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 10 },
});
