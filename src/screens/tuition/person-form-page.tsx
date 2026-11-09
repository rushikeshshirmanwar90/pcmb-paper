import type { ComponentProps } from 'react';
import { FormPage } from '@/components/stack-screen';

/** The People forms (student and teacher): FormPage keeps the form and its footer above the keyboard. */
export function PersonFormPage(props: ComponentProps<typeof FormPage>) {
  return <FormPage {...props} />;
}
