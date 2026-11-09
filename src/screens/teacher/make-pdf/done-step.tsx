import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, DetailRow, ErrorText, Icon, usePalette } from '@/components/kit';
import { openPdf, pdfContentLabel, printPdf, sharePdf, type SavedPdf } from '@/services/pdf-library';
import { marksPerQuestionFor, questionCount, type PdfKind } from '@/screens/teacher/make-pdf/model';
import { StepLayout } from '@/screens/teacher/make-pdf/ui';
import type { Question } from '@/types/pcmb';

/** The PDF (or the two PDFs of "Separate PDFs") just made: open, share or print it, find it in My PDFs, or make another. */
export function DoneStep({
  made,
  kind,
  standard,
  subject,
  onViewPdfs,
  onAnother,
  bottomInset,
}: {
  made: { pdfs: SavedPdf[]; questions: Question[] };
  kind: PdfKind;
  standard: string;
  subject: string;
  onViewPdfs?: () => void;
  onAnother: () => void;
  bottomInset: number;
}) {
  const palette = usePalette();
  const [error, setError] = useState<string | null>(null);
  const { pdfs, questions } = made;
  const lone = pdfs.length === 1;
  const smart = kind === 'smart';

  const run = async (action: (pdf: SavedPdf) => Promise<void>, pdf: SavedPdf) => {
    setError(null);
    try {
      await action(pdf);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    }
  };

  const rows: [string, string][] = [
    ['Type', smart ? 'Smart PDF (slides)' : 'Exam PDF'],
    ...(standard ? ([['Class', [standard, subject].filter(Boolean).join(' · ')]] as [string, string][]) : []),
    ['Chapters', `${new Set(questions.map((q) => q.chapter)).size}`],
    ['Questions', `${questions.length}`],
    ...(smart ? [] : ([['Total marks', `${questions.length * marksPerQuestionFor(standard)}`]] as [string, string][])),
    ...(lone
      ? ([
          ...(pdfs[0].pageCount ? [[smart ? 'Slides' : 'Pages', `${pdfs[0].pageCount}`]] : []),
          ['In the PDF', pdfContentLabel(pdfs[0])],
        ] as [string, string][])
      : []),
  ];

  return (
    <StepLayout inset={bottomInset}>
      <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <View style={[styles.icon, { backgroundColor: palette.successSoft, borderColor: palette.successBorder }]}>
          <Icon name={{ ios: 'checkmark.circle.fill', android: 'check_circle' }} color={palette.success} size={40} />
        </View>
        <Text accessibilityRole="header" style={[styles.title, { color: palette.foreground }]}>
          {lone ? pdfs[0].name : 'PDFs ready'}
        </Text>
        <Text style={[styles.text, { color: palette.mutedForeground }]}>
          {lone
            ? `Saved to My PDFs on this phone. Open it, send it to your students${smart ? ' or show it in class' : ', or print it'}.`
            : 'Both are saved to My PDFs on this phone. Open them, send them to your students, or print them.'}
        </Text>
        <View style={styles.details}>
          {rows.map(([label, value]) => (
            <DetailRow key={label} label={label} value={value} />
          ))}
        </View>
        <ErrorText message={error} />
        {pdfs.map((pdf) => (
          <View key={pdf.id} style={styles.pdf}>
            {lone ? null : (
              <View>
                <Text style={[styles.pdfName, { color: palette.foreground }]} numberOfLines={2}>
                  {pdf.name}
                </Text>
                <Text style={[styles.text, { color: palette.mutedForeground }]}>
                  {pdfContentLabel(pdf)}
                  {pdf.pageCount ? ` · ${pdf.pageCount} page${pdf.pageCount === 1 ? '' : 's'}` : ''}
                </Text>
              </View>
            )}
            <Button
              label={lone ? 'Open PDF' : `Open ${pdf.name}`}
              icon={{ ios: 'eye', android: 'visibility' }}
              variant={lone ? 'primary' : 'secondary'}
              onPress={() => run(openPdf, pdf)}
            />
            <View style={styles.actions}>
              <Button style={styles.action} label="Share" variant="secondary" icon={{ ios: 'square.and.arrow.up', android: 'share' }} accessibilityLabel={`Share ${pdf.name}`} onPress={() => run(sharePdf, pdf)} />
              <Button style={styles.action} label="Print" variant="secondary" icon={{ ios: 'printer', android: 'print' }} accessibilityLabel={`Print ${pdf.name}`} onPress={() => run(printPdf, pdf)} />
            </View>
          </View>
        ))}
        {onViewPdfs ? <Button label="My PDFs" variant="secondary" icon={{ ios: 'folder', android: 'folder' }} onPress={onViewPdfs} /> : null}
        <Button label="Make another PDF" variant="tonal" icon={{ ios: 'plus', android: 'add' }} onPress={onAnother} />
        <Text style={[styles.foot, { color: palette.mutedForeground }]}>{questionCount(questions.length)} used from the question bank, unchanged.</Text>
      </View>
    </StepLayout>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, padding: 20, gap: 14, alignItems: 'stretch' },
  icon: { alignSelf: 'center', width: 76, height: 76, borderRadius: 38, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '800', textAlign: 'center' },
  text: { fontSize: 13, lineHeight: 19, textAlign: 'center' },
  details: { gap: 2 },
  pdf: { gap: 10 },
  pdfName: { fontSize: 15, fontWeight: '700', textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 10 },
  action: { flex: 1 },
  foot: { fontSize: 12, textAlign: 'center' },
});
