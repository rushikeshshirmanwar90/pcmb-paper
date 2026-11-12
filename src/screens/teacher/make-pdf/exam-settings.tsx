import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Chips, ErrorText, Field, Icon, Muted, Notice, useLoad, usePalette } from '@/components/kit';
import { cleanWatermark, MAX_WATERMARK } from '@/shared/watermark';
import {
  COLUMN_CHOICES,
  FONT_CHOICES,
  FONT_SIZE_CHOICES,
  SPACING_CHOICES,
  WATERMARK_OPACITY_CHOICES,
  type PaperStyle,
} from '@/shared/paper-style';
import { PDF_CHOICES, type PdfChoice, type PdfStage } from '@/services/question-pdf';
import { fetchInstituteLogo } from '@/services/institute-logo';
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

const OPACITY_NAMES: Record<string, string> = { '10': 'Faint', '16': 'Light', '25': 'Medium', '40': 'Strong' };
const nearestOpacity = (value: number) => WATERMARK_OPACITY_CHOICES.reduce((best, choice) => (Math.abs(choice - value) < Math.abs(best - value) ? choice : best));

const STAGE_TEXT: Record<PdfStage, (count: number) => string> = {
  making: (n) => `Making your paper of ${questionCount(n)}…`,
  downloading: () => 'Downloading your paper…',
};

const labelsOf = <T extends string | number>(choices: { value: T; label: string }[]) =>
  Object.fromEntries(choices.map((choice) => [String(choice.value), choice.label])) as Record<string, string>;

/**
 * The details of an exam paper. What every paper needs comes first (title, date,
 * what to print; a paper made here has no time limit printed on it); the rest (class label, paper set, look, institute
 * logo, watermark) is under "More options", closed until asked for, with a
 * line saying what is in use. Nothing here is asked for a Smart PDF, which has
 * its own settings.
 */
export function ExamSettingsStep({
  form,
  onForm,
  titleDefault,
  standardDefault,
  institute,
  subject,
  questionTotal,
  stage,
  error,
  onGenerate,
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
  /** While the PDF is being made. */
  stage: { stage: PdfStage; count: number } | null;
  error: string | null;
  /** Makes the PDF, in this style: the logo is only asked for when the institute has one. */
  onGenerate: (style: PaperStyle) => void;
  bottomInset: number;
}) {
  const palette = usePalette();
  const logo = useLoad(fetchInstituteLogo, []);
  const patchStyle = (patch: Partial<PaperStyle>) => onForm({ ...form, style: { ...form.style, ...patch } });
  const title = form.title ?? titleDefault;
  const missing = !title.trim() ? 'Add a paper title.' : null;
  const busy = stage !== null;
  const hasLogo = !!logo.data;
  const logoGone = !logo.loading && !logo.error && !logo.data;
  const [more, setMore] = useState(false);
  // What the folded options are set to, so nothing is hidden from the teacher.
  const inUse = [
    FONT_CHOICES.find((c) => c.value === form.style.fontFamily)?.label,
    form.style.columns === 2 ? '2 columns' : '1 column',
    form.style.logo && hasLogo ? 'logo' : 'no logo',
    form.watermark.trim() ? 'watermark' : 'no watermark',
    `set ${form.paperSet.trim() || '1'}`,
  ].filter(Boolean).join(' · ');

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
              onPress={() => onGenerate({ ...form.style, logo: form.style.logo && !logoGone })}
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
          placeholder="e.g. 11th Physics chapter test"
          returnKeyType="done"
        />
        <View style={styles.details}>
          <Muted>Institute: {institute || '—'}</Muted>
          <Muted>Subject: {subject || '—'}</Muted>
          <Muted>
            Total marks: {questionTotal * marksPerQuestionFor(form.standard ?? standardDefault)} ({marksPerQuestionFor(form.standard ?? standardDefault)} per question)
          </Muted>
        </View>
        <DateField label="Date" value={form.date} minimumDate={startOfToday()} onChange={(date) => onForm({ ...form, date })} />
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

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: more }}
        accessibilityLabel={`More options: ${inUse}`}
        onPress={() => setMore((v) => !v)}
        style={({ pressed }) => [styles.more, { backgroundColor: palette.card, borderColor: palette.border, opacity: pressed ? 0.8 : 1 }]}
      >
        <View style={styles.rowItem}>
          <Text style={[styles.moreTitle, { color: palette.foreground }]}>More options</Text>
          <Text style={[styles.moreText, { color: palette.mutedForeground }]}>{more ? 'Class label, paper set, look, logo and watermark' : `Now: ${inUse}`}</Text>
        </View>
        <Icon name={more ? { ios: 'chevron.up', android: 'expand_less' } : { ios: 'chevron.down', android: 'expand_more' }} color={palette.foreground} size={18} />
      </Pressable>

      {more ? <>
      <Group title="Class and paper set" hint="Both are printed in the header.">
        <Field
          label="Class"
          value={form.standard ?? standardDefault}
          onChangeText={(text) => onForm({ ...form, standard: text === '' ? null : text.slice(0, 40) })}
          placeholder="e.g. 11th"
          hint="Filled in from your questions. Edit it if you like."
          returnKeyType="done"
        />
        <Field
          label="Paper set"
          value={form.paperSet}
          onChangeText={(text) => onForm({ ...form, paperSet: text.slice(0, 10) })}
          placeholder="1"
          hint="For more than one version of the same paper: 1, 2, A, B…"
          returnKeyType="done"
        />
      </Group>

      <Group title="Look of the paper" hint="Your choices are remembered for the next paper.">
        <Chips
          label="Font"
          choices={FONT_CHOICES.map((c) => c.value)}
          labels={labelsOf(FONT_CHOICES)}
          selected={form.style.fontFamily}
          onChange={(fontFamily) => patchStyle({ fontFamily })}
        />
        <Chips
          label="Text size"
          choices={FONT_SIZE_CHOICES.map((c) => c.value)}
          labels={labelsOf(FONT_SIZE_CHOICES)}
          selected={form.style.fontSize}
          onChange={(fontSize) => patchStyle({ fontSize })}
        />
        <Chips
          label="Page layout"
          choices={SPACING_CHOICES.map((c) => c.value)}
          labels={labelsOf(SPACING_CHOICES)}
          selected={form.style.spacing}
          onChange={(spacing) => patchStyle({ spacing })}
        />
        <Chips
          label="Columns"
          choices={COLUMN_CHOICES.map((c) => String(c.value))}
          labels={labelsOf(COLUMN_CHOICES)}
          selected={String(form.style.columns)}
          onChange={(columns) => patchStyle({ columns: columns === '1' ? 1 : 2 })}
        />
      </Group>

      <Group title="Institute logo" hint="Printed at the left of the institute's name on every page.">
        {logo.loading ? (
          <View style={styles.progress}>
            <ActivityIndicator color={palette.primary} />
            <Muted>Checking for your institute&apos;s logo…</Muted>
          </View>
        ) : null}
        {logo.error ? <Notice tone="warning" title="Couldn't check for a logo" text={logo.error} /> : null}
        {hasLogo ? (
          <View style={styles.logoRow}>
            <Image
              accessibilityLabel="Your institute's logo"
              source={{ uri: logo.data!.dataUri }}
              resizeMode="contain"
              style={[styles.logo, { borderColor: palette.border, backgroundColor: '#fff' }]}
            />
            <View style={styles.rowItem}>
              <Chips
                choices={['show', 'hide'] as const}
                labels={{ show: 'Show logo', hide: 'No logo' }}
                selected={form.style.logo ? 'show' : 'hide'}
                onChange={(value) => patchStyle({ logo: value === 'show' })}
              />
            </View>
          </View>
        ) : null}
        {logoGone ? (
          <Muted>Your institute has no logo yet. The tuition&apos;s admin can add one in their Profile.</Muted>
        ) : null}
      </Group>

      <Group title="Watermark" hint="Optional. Printed in light grey across every page, behind the questions. Leave empty for none.">
        <Field
          label="Watermark text"
          value={form.watermark}
          onChangeText={(text) => onForm({ ...form, watermark: text.slice(0, MAX_WATERMARK) })}
          onEndEditing={() => onForm({ ...form, watermark: cleanWatermark(form.watermark) })}
          maxLength={MAX_WATERMARK}
          placeholder={institute ? `e.g. ${cleanWatermark(institute)}` : 'e.g. Your institute name'}
          returnKeyType="done"
        />
        {form.watermark.trim() ? (
          <Chips
            label="Strength"
            choices={WATERMARK_OPACITY_CHOICES.map(String)}
            labels={OPACITY_NAMES}
            selected={String(nearestOpacity(form.style.watermarkOpacity))}
            onChange={(value) => patchStyle({ watermarkOpacity: Number(value) })}
          />
        ) : null}
      </Group>
      </> : null}
    </StepLayout>
  );
}

const styles = StyleSheet.create({
  details: { gap: 2 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  rowItem: { flex: 1 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  logo: { width: 64, height: 64, borderWidth: 1, borderRadius: 10 },
  progress: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  progressText: { flex: 1, fontSize: 13, lineHeight: 18 },
  more: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1, borderRadius: 14 },
  moreTitle: { fontSize: 15, fontWeight: '700' },
  moreText: { fontSize: 13, lineHeight: 18, marginTop: 2 },
});
