import React, { useState } from 'react';
import { Stack, useRouter, type Href } from 'expo-router';
import { programOf, programSubjects, type SchoolSubject } from '@/constants/school';
import { useSignedInUser } from '@/context/auth-context';
import { assessmentFromParams } from '@/screens/student/practice/practice-links';
import { SelfAssessmentFlow, takeHandedOff, type FlowView } from '@/screens/student/self-assessment-flow';

/**
 * Self-assessment as a page of its own (/practice/assessment): the list,
 * making one, taking it and the result, each with room to work. Steps inside
 * go back through Android's back button and the header's back; leaving the
 * page returns to where it was opened from. The swipe back is off here, so a
 * test isn't left by accident.
 */
export function AssessmentPage(params: { id?: string; new?: string; topics?: string }) {
  const router = useRouter();
  const user = useSignedInUser();
  const subjects = programSubjects(programOf(user));
  const pick = (s: string | undefined): SchoolSubject => (subjects as string[]).includes(s ?? '') ? (s as SchoolSubject) : subjects[0];
  const [start] = useState<FlowView>(() => {
    const open = assessmentFromParams(params);
    if (open.kind === 'session') return { kind: 'session', id: open.id, initial: takeHandedOff(open.id) };
    if (open.kind === 'build') return { kind: 'build', subject: pick(open.subject), preset: open.preset };
    return { kind: 'home' };
  });
  const subject = start.kind === 'build' ? start.subject : subjects[0];
  const leave = () => (router.canGoBack() ? router.back() : router.replace('/' as Href));

  return (
    <>
      <Stack.Screen options={{ gestureEnabled: false }} />
      <SelfAssessmentFlow page subject={subject} start={start} onClose={leave} />
    </>
  );
}
