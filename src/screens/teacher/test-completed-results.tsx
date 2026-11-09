import React from 'react';
import { TestResultsSection } from './test-results-section';
import { TestAnalysisSection } from './test-analysis';
import type { TestQuestionCopy, TestSummary } from '@/services/school-api';

/** Completed tests expose results only; participation and access are read-only. */
export function TestCompletedResults({ test, questions }: { test: TestSummary; questions: TestQuestionCopy[] }) {
  if (test.status !== 'closed') return null;
  return <><TestResultsSection test={test} questions={questions} /><TestAnalysisSection testId={test.id} submitted={test.submitted} /></>;
}
