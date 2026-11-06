import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Chips, Field, Icon, usePalette } from '@/components/kit';
import { KeyboardAwareScrollView } from '@/components/keyboard-safe-view';
import { useAuth } from '@/context/auth-context';
import { createSmartPdf, PdfRequestError, type PdfStage } from '@/services/question-pdf';
import type { SavedPdf } from '@/services/pdf-library';
import { loadSmartSlideSettings, saveSmartSlideSettings } from '@/services/smart-pdf-prefs';
import {
  chooseMcqLayout,
  DEFAULT_SMART_SLIDE_SETTINGS,
  FONT_FAMILY_CHOICES,
  FONT_SIZE_CHOICES,
  MCQ_LAYOUT_CHOICES,
  QUESTION_AREA_RANGE,
  SLIDE,
  SLIDE_THEMES,
  slideGeometry,
  THEME_CHOICES,
  type McqLayout,
  type SlideQuestion,
  type SmartSlideSettings,
} from '@/shared/smart-slide-layout';
import type { Question } from '@/types/pcmb';

// Smart PDF: the last step after picking questions. A static sample slide
// shows the layout (theme, text size, question area and options layout) as it
// changes; nothing is fetched or printed until the teacher taps Generate PDF.
// The layout is remembered per teacher on this phone.

/** The sample on the preview board; never a question from the paper. */
const SAMPLE: SlideQuestion = {
  questionText: 'A ball is thrown straight up at 20 m/s. Taking g = 10 m/s², how high does it rise before it stops?',
  optionA: '10 m',
  optionB: '20 m',
  optionC: '30 m',
  optionD: '40 m',
  answerType: 'MCQ',
  diagramUrls: [],
  optionDiagramUrls: { A: [], B: [], C: [], D: [] },
};

const COLUMNS: Record<McqLayout, number> = { horizontal: 4, grid: 2, vertical: 1 };

const labelOf = <T extends string>(choices: { value: T; label: string }[], value: T) =>
  choices.find((choice) => choice.value === value)?.label ?? value;

const labelsOf = <T extends string>(choices: { value: T; label: string }[]) =>
  Object.fromEntries(choices.map((choice) => [choice.value, choice.label])) as Record<T, string>;

const STAGE_TEXT: Record<PdfStage, string> = { making: 'Making the Smart PDF…', downloading: 'Downloading the PDF…' };

/** A 16:9 board with the sample question, laid out by the same rules the PDF is printed with. */
function SamplePreview({ settings, title, institute }: { settings: SmartSlideSettings; title: string; institute: string }) {
  const palette = usePalette();
  const [width, setWidth] = useState(0);
  const scale = width / SLIDE.width;
  const g = slideGeometry(settings);
  const colors = SLIDE_THEMES[settings.theme];
  const layout = chooseMcqLayout(SAMPLE, settings.mcqLayout, g.fontPx, g.contentWidth) ?? 'vertical';
  const columns = COLUMNS[layout];
  const font = g.fontPx * scale;
  const text = { fontSize: font, lineHeight: g.lineHeightPx * scale, color: colors.text };
  const shownInstitute = settings.showInstitute ? institute : '';

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessible
      accessibilityLabel={`Sample slide: ${labelOf(THEME_CHOICES, settings.theme)}, question in the top ${settings.questionAreaPct}%, the rest blank for writing`}
      style={[styles.board, { backgroundColor: colors.background, borderColor: palette.border }]}
    >
      {width > 0 ? (
        <View
          style={{
            height: g.regionHeight * scale,
            paddingTop: SLIDE.padTop * scale,
            paddingHorizontal: SLIDE.padX * scale,
            overflow: 'hidden',
          }}
        >
          <View style={[styles.head, { height: SLIDE.headerHeight * scale, marginBottom: SLIDE.headerGap * scale, gap: 10 * scale }]}>
            <Text allowFontScaling={false} style={{ fontSize: SLIDE.headerFont * scale, fontWeight: '700', color: colors.accent }}>
              Q1
            </Text>
            <Text allowFontScaling={false} numberOfLines={1} style={[styles.headTitle, { fontSize: SLIDE.headerFont * scale, color: colors.muted }]}>
              {title}
            </Text>
            {shownInstitute ? (
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                style={[styles.headInstitute, { fontSize: SLIDE.headerFont * scale, color: colors.muted }]}
              >
                {shownInstitute}
              </Text>
            ) : null}
          </View>
          <Text allowFontScaling={false} style={text}>
            {SAMPLE.questionText}
          </Text>
          <View style={[styles.options, { marginTop: SLIDE.gap * scale, rowGap: SLIDE.gap * scale }]}>
            {(['A', 'B', 'C', 'D'] as const).map((key) => (
              <View key={key} style={{ width: `${100 / columns}%`, paddingRight: SLIDE.gap * 2 * scale, flexDirection: 'row' }}>
                <Text allowFontScaling={false} style={[text, { width: SLIDE.markEm * font, fontWeight: '700', color: colors.accent }]}>
                  ({key})
                </Text>
                <Text allowFontScaling={false} style={[text, styles.optionText]}>
                  {SAMPLE[`option${key}`]}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
      {width > 0 ? (
        <View
          pointerEvents="none"
          style={[styles.writing, { top: g.regionHeight * scale, borderTopColor: colors.muted, height: (SLIDE.height - g.regionHeight) * scale }]}
        >
          <Text allowFontScaling={false} style={{ fontSize: SLIDE.headerFont * scale * 1.2, color: colors.muted }}>
            Writing space
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export function SmartPdfScreen({
  title,
  questions,
  standard,
  subject,
  onMade,
  bottomInset = 0,
}: {
  /** The title printed on every slide and used as the PDF's name, unless the teacher types their own; nothing of an earlier paper is kept. */
  title: string;
  questions: Question[];
  standard?: string;
  subject?: string;
  onMade: (pdf: SavedPdf) => void;
  bottomInset?: number;
}) {
  const palette = usePalette();
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const institute = user?.tuition?.name ?? '';

  const [settings, setSettings] = useState<SmartSlideSettings>(DEFAULT_SMART_SLIDE_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  // The first time, the layout is open to edit; afterwards the saved one is ready to use.
  const [editing, setEditing] = useState(false);
  const [stage, setStage] = useState<PdfStage | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The optional presentation title; empty means the paper's own title.
  const [typedTitle, setTypedTitle] = useState('');
  const presentationTitle = typedTitle.trim() || title;

  useEffect(() => {
    let cancelled = false;
    void loadSmartSlideSettings(userId).then(({ settings: restored, saved }) => {
      if (cancelled) return;
      setSettings(restored);
      setEditing(!saved);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const change = (next: SmartSlideSettings) => {
    setSettings(next);
    setError(null);
    if (userId) void saveSmartSlideSettings(userId, next);
  };
  const update = (patch: Partial<SmartSlideSettings>) => change({ ...settings, ...patch });

  const generate = async () => {
    setError(null);
    setStage('making');
    try {
      const pdf = await createSmartPdf({ title: presentationTitle, questions, standard, subject }, settings, setStage);
      onMade(pdf);
    } catch (e) {
      setError(e instanceof PdfRequestError ? e.message : 'Could not make the PDF. Try again.');
    } finally {
      setStage(null);
    }
  };

  const { min, max, step } = QUESTION_AREA_RANGE;
  const area = settings.questionAreaPct;
  const summary = [
    labelOf(THEME_CHOICES, settings.theme),
    `${area}% question area`,
    `${labelOf(FONT_FAMILY_CHOICES, settings.fontFamily)} ${labelOf(FONT_SIZE_CHOICES, settings.fontSize).toLowerCase()} text`,
    `${labelOf(MCQ_LAYOUT_CHOICES, settings.mcqLayout)} options`,
    settings.showInstitute ? 'Institute name shown' : 'Institute name hidden',
  ].join(' · ');

  if (!loaded) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={palette.primary} />
      </View>
    );
  }

  return (
    <KeyboardAwareScrollView contentContainerStyle={[styles.content, { paddingBottom: 32 + bottomInset }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={styles.intro}>
        <Text accessibilityRole="header" style={[styles.title, { color: palette.foreground }]} numberOfLines={2}>
          Smart PDF
        </Text>
        <Text style={[styles.meta, { color: palette.mutedForeground }]}>
          {questions.length} question{questions.length === 1 ? '' : 's'} · one complete question per 16:9 slide · no answers or solutions
        </Text>
      </View>

      <Field
        label="Presentation title (optional)"
        value={typedTitle}
        onChangeText={(text) => setTypedTitle(text.slice(0, 200))}
        placeholder={title}
        hint="Shown at the top of every slide, and the name of the PDF."
        returnKeyType="done"
      />

      <SamplePreview settings={settings} title={presentationTitle} institute={institute} />
      <Text style={[styles.meta, { color: palette.mutedForeground }]}>
        Sample question. Each question goes in the top {area}% of its slide with all its options; the bottom {100 - area}% stays blank for writing. A long
        question gets a taller area, smaller text, or the whole slide followed by a blank slide to solve it on. It is never split across slides.
      </Text>

      {editing ? (
        <View style={[styles.settings, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Chips
            label="Theme"
            choices={THEME_CHOICES.map((c) => c.value)}
            labels={labelsOf(THEME_CHOICES)}
            selected={settings.theme}
            onChange={(theme) => update({ theme })}
          />
          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: palette.mutedForeground }]}>Question area</Text>
            <View style={styles.stepper}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Smaller question area"
                accessibilityState={{ disabled: area <= min }}
                disabled={area <= min}
                onPress={() => update({ questionAreaPct: area - step })}
                style={({ pressed }) => [styles.stepBtn, { borderColor: palette.border, opacity: area <= min ? 0.4 : pressed ? 0.7 : 1 }]}
              >
                <Icon name={{ ios: 'minus', android: 'remove' }} color={palette.foreground} size={16} />
              </Pressable>
              <Text accessibilityLiveRegion="polite" style={[styles.stepValue, { color: palette.foreground }]}>
                {area}%
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Larger question area"
                accessibilityState={{ disabled: area >= max }}
                disabled={area >= max}
                onPress={() => update({ questionAreaPct: area + step })}
                style={({ pressed }) => [styles.stepBtn, { borderColor: palette.border, opacity: area >= max ? 0.4 : pressed ? 0.7 : 1 }]}
              >
                <Icon name={{ ios: 'plus', android: 'add' }} color={palette.foreground} size={16} />
              </Pressable>
              <Text style={[styles.meta, styles.stepHint, { color: palette.mutedForeground }]}>
                {min}–{max}% of the slide
              </Text>
            </View>
          </View>
          <Chips
            label="Font size"
            choices={FONT_SIZE_CHOICES.map((c) => c.value)}
            labels={labelsOf(FONT_SIZE_CHOICES)}
            selected={settings.fontSize}
            onChange={(fontSize) => update({ fontSize })}
          />
          <Chips
            label="Font"
            choices={FONT_FAMILY_CHOICES.map((c) => c.value)}
            labels={labelsOf(FONT_FAMILY_CHOICES)}
            selected={settings.fontFamily}
            onChange={(fontFamily) => update({ fontFamily })}
          />
          <Chips
            label="Options layout"
            choices={MCQ_LAYOUT_CHOICES.map((c) => c.value)}
            labels={labelsOf(MCQ_LAYOUT_CHOICES)}
            selected={settings.mcqLayout}
            onChange={(mcqLayout) => update({ mcqLayout })}
          />
          <Chips
            label="Institute name"
            choices={['show', 'hide'] as const}
            labels={{ show: 'Show', hide: 'Hide' }}
            selected={settings.showInstitute ? 'show' : 'hide'}
            onChange={(value) => update({ showInstitute: value === 'show' })}
          />
        </View>
      ) : (
        <Text style={[styles.summary, { color: palette.foreground }]}>{summary}</Text>
      )}

      {error ? (
        <Text accessibilityLiveRegion="polite" style={[styles.meta, { color: palette.dangerInk }]}>
          {error}
        </Text>
      ) : null}

      {stage ? (
        <View style={styles.progress}>
          <ActivityIndicator color={palette.primary} />
          <Text accessibilityLiveRegion="polite" style={[styles.meta, { color: palette.mutedForeground }]}>
            {`${STAGE_TEXT[stage]} Keep the app open until it’s ready.`}
          </Text>
        </View>
      ) : (
        <View style={styles.actions}>
          <Button
            label={`Generate Smart PDF · ${questions.length} question${questions.length === 1 ? '' : 's'}`}
            icon={{ ios: 'doc.richtext', android: 'picture_as_pdf' }}
            onPress={generate}
            disabled={questions.length === 0}
          />
          <Button
            label={editing ? 'Done Editing' : 'Edit Layout'}
            variant="secondary"
            icon={editing ? { ios: 'checkmark', android: 'check' } : { ios: 'slider.horizontal.3', android: 'tune' }}
            onPress={() => setEditing(!editing)}
          />
          <Button
            label="Reset to Default"
            variant="secondary"
            icon={{ ios: 'arrow.counterclockwise', android: 'restart_alt' }}
            onPress={() => change(DEFAULT_SMART_SLIDE_SETTINGS)}
          />
        </View>
      )}
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: 16, gap: 14 },
  intro: { gap: 4 },
  title: { fontSize: 17, fontWeight: '700' },
  meta: { fontSize: 12, lineHeight: 17 },
  board: { width: '100%', aspectRatio: 16 / 9, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'center' },
  writing: { position: 'absolute', left: 0, right: 0, borderTopWidth: StyleSheet.hairlineWidth, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', opacity: 0.7 },
  headTitle: { flexShrink: 1 },
  headInstitute: { marginLeft: 'auto', fontWeight: '700', maxWidth: '50%' },
  options: { flexDirection: 'row', flexWrap: 'wrap' },
  optionText: { flex: 1 },
  settings: { padding: 16, borderRadius: 14, borderWidth: 1, gap: 16 },
  field: { gap: 8 },
  fieldLabel: { fontSize: 12, fontWeight: '600' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepBtn: { width: 40, height: 40, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stepValue: { minWidth: 48, textAlign: 'center', fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
  stepHint: { flex: 1 },
  summary: { fontSize: 13, lineHeight: 19, fontWeight: '500' },
  progress: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  actions: { gap: 10 },
});
