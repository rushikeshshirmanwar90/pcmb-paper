import React from 'react';
import { Card, DetailSheet, EmptyView } from '@/components/kit';

/** A student's strong and weak topics, from their test answers. */
export function StudentInsightSheet({ onClose }: { studentId: string; onClose: () => void }) {
  return (
    <DetailSheet visible title="Student" onClose={onClose}>
      <Card>
        <EmptyView
          icon={{ ios: 'chart.bar', android: 'bar_chart' }}
          title="Analysis comes next"
          text="Strong and weak topics show here once students start taking tests."
        />
      </Card>
    </DetailSheet>
  );
}
