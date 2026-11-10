import { Redirect } from 'expo-router';
import type { ComponentType } from 'react';

// Dev-only route: in a release build __DEV__ is false, the ternary folds to
// null at build time, and the preview screen and its samples aren't bundled.
const Preview: ComponentType | null = __DEV__
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('@/dev/question-preview-screen') as typeof import('@/dev/question-preview-screen')).QuestionPreviewScreen
  : null;

export default function QuestionPreviewRoute() {
  if (!Preview) return <Redirect href="/" />;
  return <Preview />;
}
