import type { ComponentProps } from 'react';
import { Platform } from 'react-native';
import { FormPage } from '@/components/stack-screen';

/** Native scrolling plus keyboard avoidance keeps the People form and footer within the viewport. */
export function PersonFormPage(props: ComponentProps<typeof FormPage>) {
  return <FormPage {...props} keyboardBehavior={Platform.OS === 'ios' ? 'padding' : 'height'} />;
}
