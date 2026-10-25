import React from 'react';
import { Muted, SectionTitle } from '@/components/kit';

/** Topic-by-topic understanding of a test, once students have submitted. */
export function TestAnalysisSection({ submitted }: { testId: string; submitted: number }) {
  return (
    <>
      <SectionTitle title="Topic understanding" />
      <Muted>{submitted ? 'Topic analysis comes in the next update.' : 'Shows once students submit.'}</Muted>
    </>
  );
}
