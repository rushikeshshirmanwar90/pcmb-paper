import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card, Segmented, usePalette } from '@/components/kit';
import { StackScreen } from '@/components/stack-screen';
import { SAMPLES } from '@/dev/question-samples';
import { QuestionView } from '@/screens/student/question-view';

// Dev-only: every question shape that has broken the renderer before, drawn by
// the same QuestionView the test runner, self-assessment and topic practice use.
// Open it with: adb shell am start -a android.intent.action.VIEW -d "pcmb://dev/question-preview"

type Mode = 'answer' | 'reveal';
type Width = 'full' | 'narrow';

export function QuestionPreviewScreen() {
  const palette = usePalette();
  const [mode, setMode] = useState<Mode>('answer');
  const [width, setWidth] = useState<Width>('full');
  const [picked, setPicked] = useState<Record<string, string | null>>({});
  return (
    <StackScreen title="Question preview (dev)" subtitle="Tables, match-the-column, long maths, images, options">
      <Segmented label="Mode" value={mode} onChange={setMode} options={[{ value: 'answer', label: 'Answering' }, { value: 'reveal', label: 'Results' }]} />
      <Segmented label="Width" value={width} onChange={setWidth} options={[{ value: 'full', label: 'This phone' }, { value: 'narrow', label: '320px phone' }]} />
      {SAMPLES.map((s, i) => (
        <Card key={s.id} style={styles.card}>
          <Text style={[styles.title, { color: palette.foreground }]}>
            {i + 1}. {s.title}
          </Text>
          <Text style={[styles.source, { color: palette.mutedForeground }]}>{s.source}</Text>
          {/* 320px wide phone minus the screen's 16px gutters and the card's padding. */}
          <View style={width === 'narrow' ? [styles.narrow, { borderColor: palette.border }] : null}>
            <QuestionView
              question={s.question}
              selected={picked[s.id] ?? null}
              onSelect={mode === 'answer' ? (v) => setPicked((p) => ({ ...p, [s.id]: v })) : undefined}
              reveal={mode === 'reveal'}
              numberLabel={`Q${i + 1}`}
            />
          </View>
        </Card>
      ))}
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8 },
  title: { fontSize: 15, fontWeight: '700' },
  source: { fontSize: 12 },
  narrow: { width: 320 - 32 - 28, alignSelf: 'center', borderWidth: 1, borderStyle: 'dashed', padding: 4 },
});
