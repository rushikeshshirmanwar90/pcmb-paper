import React from 'react';
import { MultiSelectDropdown } from '@/components/multi-select-dropdown';

/** Uses the same selection modal as Chapters and Topics; API values remain batch IDs. */
export function BatchMultiSelect({ batches, selected, onChange }: {
  batches: { id: string; name: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const options = batches.map(batch => ({
    id: batch.id,
    label: batches.filter(other => other.name === batch.name).length > 1
      ? `${batch.name} (${batch.id})`
      : batch.name,
  }));
  return <MultiSelectDropdown
    label="Batches"
    options={options.map(option => option.label)}
    selected={options.filter(option => selected.includes(option.id)).map(option => option.label)}
    onSelect={values => onChange(options.filter(option => values.includes(option.label)).map(option => option.id))}
    placeholder="Select batches"
    emptyText="No batches available"
    searchable
    icon={{ ios: 'person.3', android: 'groups', web: 'groups' }}
  />;
}
