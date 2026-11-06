import { Text, View } from 'react-native';
import { Button, Chips, ErrorText, Muted, usePalette } from '@/components/kit';
import {
  autoProblem,
  autoTotal,
  LEVELS,
  MAX_QUESTIONS,
  mixFromCount,
  mixTotal,
  questionCount,
  type AutoConfig,
  type Method,
  type QuestionType,
} from '@/screens/teacher/make-pdf/model';
import { ChoiceCard, CountField, Group, StepLayout } from '@/screens/teacher/make-pdf/ui';

const TYPE_LABELS: Record<QuestionType, string> = { any: 'Any type', MCQ: 'MCQ only', Numerical: 'Numerical only' };
const SPREAD_LABELS = { any: 'Any mix', level: 'Set by level' };
const REPEAT_LABELS = { allow: 'Allow repeats', skip: 'Skip used questions' };

/**
 * "How would you like to select questions?": automatic (a number, optionally
 * by level and type, drawn from the exam's real questions) or manual (browse
 * and pick). The automatic settings sit here; generating happens in the flow.
 */
export function MethodStep({
  method,
  onMethod,
  auto,
  onAuto,
  usedCount,
  generating,
  error,
  onGenerate,
  onBrowse,
  hasSelection,
  bottomInset,
}: {
  method: Method | null;
  onMethod: (method: Method) => void;
  auto: AutoConfig;
  onAuto: (auto: AutoConfig) => void;
  /** Questions in the PDFs already made on this phone. */
  usedCount: number;
  generating: boolean;
  error: string | null;
  onGenerate: () => void;
  onBrowse: () => void;
  /** Questions are already chosen (and kept if the teacher goes on). */
  hasSelection: boolean;
  bottomInset: number;
}) {
  const palette = usePalette();
  const problem = autoProblem(auto);
  const total = autoTotal(auto);

  return (
    <StepLayout
      inset={bottomInset}
      footer={
        method === 'auto' ? (
          <>
            <ErrorText message={error} />
            <Button
              label={generating ? 'Choosing questions…' : `Generate ${Number.isInteger(total) && total > 0 ? questionCount(total) : 'questions'}`}
              icon={{ ios: 'wand.and.stars', android: 'auto_awesome' }}
              loading={generating}
              disabled={!!problem}
              onPress={onGenerate}
            />
          </>
        ) : method === 'manual' ? (
          <Button label={hasSelection ? 'Continue to browse' : 'Browse questions'} icon={{ ios: 'arrow.right', android: 'arrow_forward' }} onPress={onBrowse} />
        ) : (
          <Muted>Choose how you want to select the questions.</Muted>
        )
      }
    >
      <Text accessibilityRole="header" style={{ color: palette.foreground, fontSize: 20, fontWeight: '800' }}>
        How would you like to select questions?
      </Text>
      <View accessibilityRole="radiogroup" style={{ gap: 10 }}>
        <ChoiceCard
          icon={{ ios: 'wand.and.stars', android: 'auto_awesome' }}
          title="Automatic generation"
          text="Choose how many; random real questions from your chapters are picked for you."
          selected={method === 'auto'}
          onPress={() => onMethod('auto')}
        />
        <ChoiceCard
          icon={{ ios: 'hand.tap', android: 'touch_app' }}
          title="Manual selection"
          text="Browse the questions, preview them and pick the ones you want."
          selected={method === 'manual'}
          onPress={() => onMethod('manual')}
        />
      </View>

      {method === 'auto' ? (
        <Group title="Automatic generation" hint="Questions are drawn only from this exam's questions in your chapters, and never invented.">
          <Chips
            label="Number of questions"
            choices={['any', 'level'] as const}
            labels={SPREAD_LABELS}
            selected={auto.byLevel ? 'level' : 'any'}
            onChange={(value) => {
              const byLevel = value === 'level';
              onAuto({ ...auto, byLevel, mix: byLevel && mixTotal(auto.mix) !== auto.count && Number.isInteger(auto.count) ? mixFromCount(auto.count) : auto.mix });
            }}
          />
          {auto.byLevel ? (
            <View style={{ gap: 10 }}>
              {LEVELS.map((level) => (
                <CountField
                  key={level}
                  label={`${level === 'Mid' ? 'Medium' : level} questions`}
                  value={auto.mix[level]}
                  min={0}
                  max={MAX_QUESTIONS}
                  onChange={(value) => onAuto({ ...auto, mix: { ...auto.mix, [level]: value } })}
                />
              ))}
              <Text accessibilityLiveRegion="polite" style={{ color: problem ? palette.dangerInk : palette.mutedForeground, fontSize: 13 }}>
                {problem ?? `${questionCount(total)} in all`}
              </Text>
            </View>
          ) : (
            <CountField
              label="How many questions"
              value={auto.count}
              min={1}
              max={MAX_QUESTIONS}
              onChange={(count) => onAuto({ ...auto, count })}
              hint={`1 to ${MAX_QUESTIONS}. Spread across your chapters.`}
            />
          )}
          <Chips
            label="Question type"
            choices={['any', 'MCQ', 'Numerical'] as const}
            labels={TYPE_LABELS}
            selected={auto.type}
            onChange={(type) => onAuto({ ...auto, type })}
          />
          <View style={{ gap: 6 }}>
            <Chips
              label="Questions used before"
              choices={['allow', 'skip'] as const}
              labels={REPEAT_LABELS}
              selected={auto.avoidUsed ? 'skip' : 'allow'}
              onChange={(value) => onAuto({ ...auto, avoidUsed: value === 'skip' })}
            />
            {auto.avoidUsed ? (
              <Muted>
                {usedCount > 0
                  ? `${questionCount(usedCount)} in the PDFs you made on this phone will be left out.`
                  : 'No earlier PDFs with kept questions on this phone, so nothing is left out.'}
              </Muted>
            ) : null}
          </View>
        </Group>
      ) : null}
    </StepLayout>
  );
}
