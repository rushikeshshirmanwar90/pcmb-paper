import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Button, Chips, ErrorText, Field, Muted, usePalette } from '@/components/kit';
import { cleanWatermark, MAX_WATERMARK } from '@/shared/watermark';
import { type PaperStyle } from '@/shared/paper-style';
import { PDF_CHOICES, type PdfChoice, type PdfStage } from '@/services/question-pdf';
import { DateField } from '@/screens/teacher/date-field';
import { marksPerQuestionFor, questionCount } from '@/screens/teacher/make-pdf/model';
import { Group, StepLayout } from '@/screens/teacher/make-pdf/ui';

export interface ExamForm {
  /** What the teacher typed for the paper's title; null until they do (the chapters' names are used). */
  title: string | null;
  /** The standard as typed; null until they do (the questions' own are used). */
  standard: string | null;
  paperSet: string;
  date: Date;
  choice: PdfChoice;
  watermark: string;
  style: PaperStyle;
}

export const startOfToday = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

/** A day as yyyy-mm-dd, in the phone's own calendar. */
export const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const STAGE_TEXT: Record<PdfStage, (count: number) => string> = {
  making: (n) => `Making your paper of ${questionCount(n)}…`,
  downloading: () => 'Downloading your paper…',
};

/**
 * The details of an exam paper: title, date, what to print, and an optional
 * watermark. Everything about the paper's look (font, size, layout, columns,
 * logo, class label, paper set) uses the defaults, so there is nothing else to set.
 * Nothing here is asked for a Smart PDF, which has its own settings.
 */
export function ExamSettingsStep({
  form,
  onForm,
  titleDefault,
  standardDefault,
  institute,
  subject,
  questionTotal,
  blocked,
  stage,
  error,
  onGenerate,
  onWatermarkSave,
  bottomInset,
}: {
  form: ExamForm;
  onForm: (form: ExamForm) => void;
  /** The title used when none is typed. */
  titleDefault: string;
  standardDefault: string;
  institute: string;
  subject: string;
  questionTotal: number;
  /** Why the paper cannot be made yet (questions without a subject); disables Generate. */
  blocked: string | null;
  /** While the PDF is being made. */
  stage: { stage: PdfStage; count: number } | null;
  error: string | null;
  /** Makes the PDF, in this style: the logo is only asked for when the institute has one. */
  onGenerate: (style: PaperStyle) => void;
  /** Keeps the watermark on this phone as soon as the teacher finishes typing it. */
  onWatermarkSave: (watermark: string) => void;
  bottomInset: number;
}) {
  const palette = usePalette();
  const title = form.title ?? titleDefault;
  const missing = blocked ? blocked : !title.trim() ? 'Add a paper title.' : null;
  const busy = stage !== null;
  return (
    <StepLayout
      inset={bottomInset}
      footer={
        busy ? (
          <View style={styles.progress}>
            <ActivityIndicator color={palette.primary} />
            <Text accessibilityLiveRegion="polite" style={[styles.progressText, { color: palette.mutedForeground }]}>
              {STAGE_TEXT[stage.stage](stage.count)} Keep the app open until it is ready.
            </Text>
          </View>
        ) : (
          <>
            <ErrorText message={error} />
            <Button
              label={`Make paper · ${questionCount(questionTotal)}`}
              icon={{ ios: 'doc.richtext', android: 'picture_as_pdf' }}
              disabled={!!missing}
              onPress={() => onGenerate(form.style)}
            />
            {missing ? <Muted>{missing}</Muted> : null}
          </>
        )
      }
    >
      <Group title="Paper details" hint="Printed at the top of the paper.">
        <Field
          label="Paper title"
          value={title}
          onChangeText={(text) => onForm({ ...form, title: text === '' ? null : text.slice(0, 200) })}
          placeholder="e.g. 11th Physics Kinematics"
          returnKeyType="done"
        />
        <View style={styles.details}>
          <Muted>Institute: {institute || '—'}</Muted>
          <Muted>Subject: {subject || '—'}</Muted>
          <Muted>
            Total marks: {questionTotal * marksPerQuestionFor(form.standard ?? standardDefault)} ({marksPerQuestionFor(form.standard ?? standardDefault)} per question)
          </Muted>
        </View>
        <DateField label="Date printed on the paper" value={form.date} onChange={(date) => onForm({ ...form, date })} />
      </Group>

      <Group title="What to print">
        <Chips
          choices={PDF_CHOICES.map((choice) => choice.value)}
          labels={Object.fromEntries(PDF_CHOICES.map((choice) => [choice.value, choice.label]))}
          selected={form.choice}
          onChange={(choice) => onForm({ ...form, choice })}
        />
        <Muted>{PDF_CHOICES.find((choice) => choice.value === form.choice)?.hint}</Muted>
      </Group>

      <Group title="Watermark" hint="Optional. Printed in light grey across every page, behind the questions. What you type is kept for your next paper.">
        <Field
          label="Watermark text"
          value={form.watermark}
          onChangeText={(text) => onForm({ ...form, watermark: text.slice(0, MAX_WATERMARK) })}
          onEndEditing={() => {
            const watermark = cleanWatermark(form.watermark);
            onForm({ ...form, watermark });
            onWatermarkSave(watermark);
          }}
          maxLength={MAX_WATERMARK}
          placeholder={institute ? `e.g. ${cleanWatermark(institute)}` : 'e.g. Your institute name'}
          hint="Leave it empty for no watermark."
          returnKeyType="done"
        />
      </Group>
    </StepLayout>
  );
}

const styles = StyleSheet.create({
  details: { gap: 2 },
  progress: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  progressText: { flex: 1, fontSize: 13, lineHeight: 18 },
});
