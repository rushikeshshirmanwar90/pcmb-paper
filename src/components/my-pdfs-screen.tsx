import React, { memo, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { AppHeader } from '@/components/app-header';
import { getPalette, MaxContentWidth, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTabBarHeight } from '@/hooks/use-tab-bar-height';
import {
  deletePdf,
  openPdf,
  PDF_CONTENT_LABELS,
  pdfLibraryAvailable,
  printPdf,
  renamePdf,
  sharePdf,
  totalLibrarySize,
  usePdfLibrary,
  type PdfContent,
  type SavedPdf,
} from '@/services/pdf-library';
import { createPdfVersion } from '@/services/question-pdf';

type Palette = ReturnType<typeof getPalette>;
type SortKey = 'newest' | 'oldest' | 'name' | 'size';

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'newest', label: 'Newest' },
  { key: 'oldest', label: 'Oldest' },
  { key: 'name', label: 'Name' },
  { key: 'size', label: 'Size' },
];

const ALL = 'All';

// ─── Formatting ────────────────────────────────────────────────────────────

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return sameDay
    ? `Today, ${date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
    : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function contentColors(content: PdfContent, palette: Palette) {
  if (content === 'answers') return { bg: palette.violetSoft, text: palette.violet };
  if (content === 'solutions') return { bg: palette.successSoft, text: palette.successInk };
  return { bg: palette.secondary, text: palette.mutedForeground };
}

/** Runs a file action, showing what went wrong instead of failing silently. */
async function attempt(action: () => unknown) {
  try {
    await action();
  } catch (error) {
    Alert.alert('Something went wrong', error instanceof Error ? error.message : 'Try again.');
  }
}

// ─── One PDF ───────────────────────────────────────────────────────────────

const PdfCard = memo(function PdfCard({
  pdf,
  palette,
  onMore,
}: {
  pdf: SavedPdf;
  palette: Palette;
  onMore: (pdf: SavedPdf) => void;
}) {
  const badge = contentColors(pdf.content, palette);
  const classLine = [pdf.standard, pdf.subject].filter(Boolean).join(' · ');
  const detailLine = [
    `${pdf.questionCount} question${pdf.questionCount === 1 ? '' : 's'}`,
    pdf.totalMarks ? `${pdf.totalMarks} marks` : null,
    pdf.pageCount ? `${pdf.pageCount} page${pdf.pageCount === 1 ? '' : 's'}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${pdf.name}`}
        accessibilityHint="Opens the PDF in a PDF app on your phone"
        onPress={() => attempt(() => openPdf(pdf))}
        onLongPress={() => onMore(pdf)}
        style={({ pressed }) => [styles.cardMain, pressed && styles.pressed]}
      >
        <View style={[styles.fileIcon, { backgroundColor: palette.primarySoft }]}>
          <SymbolView
            name={{ ios: 'doc.richtext.fill', android: 'picture_as_pdf', web: 'picture_as_pdf' }}
            tintColor={palette.primary}
            size={22}
          />
        </View>
        <View style={styles.cardCopy}>
          <Text style={[styles.cardTitle, { color: palette.foreground }]} numberOfLines={2}>
            {pdf.name}
          </Text>
          {classLine ? (
            <Text style={[styles.cardMeta, { color: palette.foreground }]} numberOfLines={1}>
              {classLine}
              {pdf.chapters.length === 1 ? `  ·  ${pdf.chapters[0]}` : pdf.chapters.length > 1 ? `  ·  ${pdf.chapters.length} chapters` : ''}
            </Text>
          ) : null}
          <Text style={[styles.cardMeta, { color: palette.mutedForeground }]} numberOfLines={1}>
            {detailLine}
          </Text>
          <View style={styles.cardFooter}>
            <View style={[styles.badge, { backgroundColor: badge.bg }]}>
              <Text style={[styles.badgeText, { color: badge.text }]}>{PDF_CONTENT_LABELS[pdf.content]}</Text>
            </View>
            <Text style={[styles.cardSmall, { color: palette.mutedForeground }]} numberOfLines={1}>
              {formatBytes(pdf.sizeBytes)} · {formatDate(pdf.createdAt)}
            </Text>
          </View>
        </View>
      </Pressable>

      <View style={[styles.cardActions, { borderTopColor: palette.border }]}>
        <CardAction label="Open" icon={{ ios: 'eye', android: 'visibility', web: 'visibility' }} palette={palette}
          onPress={() => attempt(() => openPdf(pdf))} />
        <CardAction label="Share" icon={{ ios: 'square.and.arrow.up', android: 'share', web: 'share' }} palette={palette}
          onPress={() => attempt(() => sharePdf(pdf))} />
        <CardAction label="More" icon={{ ios: 'ellipsis.circle', android: 'more_horiz', web: 'more_horiz' }} palette={palette}
          onPress={() => onMore(pdf)} accessibilityLabel={`More actions for ${pdf.name}`} />
      </View>
    </View>
  );
});

function CardAction({
  label,
  icon,
  palette,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  icon: React.ComponentProps<typeof SymbolView>['name'];
  palette: Palette;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      style={({ pressed }) => [styles.cardAction, pressed && { backgroundColor: palette.secondary }]}
    >
      <SymbolView name={icon} tintColor={palette.primary} size={16} />
      <Text style={[styles.cardActionText, { color: palette.primary }]}>{label}</Text>
    </Pressable>
  );
}

// ─── More actions sheet ────────────────────────────────────────────────────

function ActionSheet({
  pdf,
  palette,
  onClose,
  onRename,
  onNotice,
}: {
  pdf: SavedPdf;
  palette: Palette;
  onClose: () => void;
  onRename: () => void;
  onNotice: (pdf: SavedPdf) => void;
}) {
  const [busy, setBusy] = useState<PdfContent | null>(null);
  const otherVersions = (Object.keys(PDF_CONTENT_LABELS) as PdfContent[]).filter((c) => c !== pdf.content);

  // iOS can't show the share sheet or another dialog while this one is still
  // sliding away, so those wait for it to close.
  const afterClose = (action: () => void) => {
    onClose();
    setTimeout(action, Platform.OS === 'ios' ? 400 : 0);
  };

  const makeVersion = async (content: PdfContent) => {
    setBusy(content);
    try {
      const made = await createPdfVersion(pdf, content);
      onClose();
      if (made) onNotice(made);
    } catch (error) {
      Alert.alert('Could not make the PDF', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setBusy(null);
    }
  };

  const confirmDelete = () => {
    Alert.alert('Delete this PDF?', `"${pdf.name}" will be removed from this device. This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          onClose();
          attempt(() => deletePdf(pdf.id));
        },
      },
    ]);
  };

  const rows: {
    key: string;
    label: string;
    hint?: string;
    icon: React.ComponentProps<typeof SymbolView>['name'];
    onPress: () => void;
    danger?: boolean;
    loading?: boolean;
    disabled?: boolean;
  }[] = [
    { key: 'open', label: 'Open', icon: { ios: 'eye', android: 'visibility', web: 'visibility' }, onPress: () => afterClose(() => attempt(() => openPdf(pdf))) },
    { key: 'share', label: 'Share', hint: 'WhatsApp, email, Drive…', icon: { ios: 'square.and.arrow.up', android: 'share', web: 'share' }, onPress: () => afterClose(() => attempt(() => sharePdf(pdf))) },
    { key: 'print', label: 'Print', icon: { ios: 'printer', android: 'print', web: 'print' }, onPress: () => afterClose(() => attempt(() => printPdf(pdf))) },
    { key: 'rename', label: 'Rename', icon: { ios: 'pencil', android: 'edit', web: 'edit' }, onPress: () => afterClose(onRename) },
    ...(pdf.hasQuestions
      ? otherVersions.map((content) => ({
          key: content,
          label: `Make a copy: ${PDF_CONTENT_LABELS[content].toLowerCase()}`,
          hint: 'Same questions, as a new PDF',
          icon: { ios: 'doc.on.doc', android: 'content_copy', web: 'content_copy' } as const,
          onPress: () => makeVersion(content),
          loading: busy === content,
          disabled: busy !== null,
        }))
      : []),
    { key: 'delete', label: 'Delete', icon: { ios: 'trash', android: 'delete', web: 'delete' }, onPress: confirmDelete, danger: true },
  ];

  return (
    <Modal visible transparent animationType="slide" onRequestClose={busy ? undefined : onClose}>
      <Pressable accessibilityLabel="Close" style={styles.sheetBackdrop} onPress={busy ? undefined : onClose} />
      <View style={[styles.sheet, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <View style={[styles.sheetHandle, { backgroundColor: palette.border }]} />
        <Text style={[styles.sheetTitle, { color: palette.foreground }]} numberOfLines={2}>
          {pdf.name}
        </Text>
        <ScrollView contentContainerStyle={styles.sheetRows}>
          {rows.map((row) => {
            const color = row.danger ? palette.danger : palette.foreground;
            return (
              <Pressable
                key={row.key}
                accessibilityRole="button"
                accessibilityState={{ disabled: !!row.disabled, busy: !!row.loading }}
                disabled={row.disabled}
                onPress={row.onPress}
                style={({ pressed }) => [
                  styles.sheetRow,
                  pressed && { backgroundColor: palette.secondary },
                  row.disabled && !row.loading && styles.disabled,
                ]}
              >
                {row.loading ? (
                  <ActivityIndicator size="small" color={palette.primary} />
                ) : (
                  <SymbolView name={row.icon} tintColor={row.danger ? palette.danger : palette.mutedForeground} size={19} />
                )}
                <View style={styles.sheetRowCopy}>
                  <Text style={[styles.sheetRowText, { color }]}>{row.loading ? 'Making the PDF…' : row.label}</Text>
                  {row.hint ? <Text style={[styles.sheetRowHint, { color: palette.mutedForeground }]}>{row.hint}</Text> : null}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Rename dialog ─────────────────────────────────────────────────────────

function RenameDialog({ pdf, palette, onClose }: { pdf: SavedPdf; palette: Palette; onClose: () => void }) {
  const [name, setName] = useState(pdf.name);
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    try {
      renamePdf(pdf.id, name);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not rename the PDF.');
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.dialogBackdrop}>
        <View style={[styles.dialog, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text style={[styles.dialogTitle, { color: palette.foreground }]}>Rename PDF</Text>
          <View style={[styles.renameInput, { borderColor: error ? palette.danger : palette.border, backgroundColor: palette.background }]}>
            <TextInput
              value={name}
              onChangeText={(text) => {
                setName(text);
                setError(null);
              }}
              autoFocus
              selectTextOnFocus
              returnKeyType="done"
              onSubmitEditing={save}
              maxLength={80}
              accessibilityLabel="PDF name"
              style={[styles.renameText, { color: palette.foreground }]}
            />
            <Text style={[styles.renameSuffix, { color: palette.mutedForeground }]}>.pdf</Text>
          </View>
          {error ? <Text style={[styles.dialogError, { color: palette.dangerInk }]}>{error}</Text> : null}
          <View style={styles.dialogActions}>
            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              style={({ pressed }) => [styles.dialogBtn, { borderColor: palette.border, borderWidth: 1 }, pressed && styles.pressed]}
            >
              <Text style={[styles.dialogBtnText, { color: palette.foreground }]}>Cancel</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !name.trim() }}
              disabled={!name.trim()}
              onPress={save}
              style={({ pressed }) => [
                styles.dialogBtn,
                { backgroundColor: palette.primary },
                !name.trim() && styles.disabled,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.dialogBtnText, { color: palette.onPrimary }]}>Save</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Screen ────────────────────────────────────────────────────────────────

export function MyPdfsScreen({ onBack, onCreate }: { onBack: () => void; onCreate: () => void }) {
  const palette = getPalette(useColorScheme() === 'dark');
  const tabBarHeight = useTabBarHeight();
  const library = usePdfLibrary();

  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('newest');
  const [subject, setSubject] = useState(ALL);
  const [sheetPdf, setSheetPdf] = useState<SavedPdf | null>(null);
  const [renaming, setRenaming] = useState<SavedPdf | null>(null);
  const [notice, setNotice] = useState<SavedPdf | null>(null);

  const subjects = useMemo(
    () => [...new Set(library.map((pdf) => pdf.subject).filter((s): s is string => !!s))].sort(),
    [library]
  );
  const activeSubject = subjects.includes(subject) ? subject : ALL;

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = library.filter((pdf) => {
      if (activeSubject !== ALL && pdf.subject !== activeSubject) return false;
      if (!q) return true;
      return [pdf.name, pdf.subject, pdf.standard, ...pdf.chapters].some((s) => s?.toLowerCase().includes(q));
    });
    const byDate = (a: SavedPdf, b: SavedPdf) => b.createdAt.localeCompare(a.createdAt);
    return [...list].sort(
      sort === 'newest'
        ? byDate
        : sort === 'oldest'
        ? (a, b) => byDate(b, a)
        : sort === 'name'
        ? (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })
        : (a, b) => b.sizeBytes - a.sizeBytes
    );
  }, [library, search, sort, activeSubject]);

  // The notice's PDF may have been renamed or deleted since.
  const noticePdf = notice ? library.find((pdf) => pdf.id === notice.id) : undefined;

  return (
    <SafeAreaView edges={['top']} style={[styles.root, { backgroundColor: palette.background }]}>
      <AppHeader title="My PDFs" subtitle="Papers you've made, saved on this device" />
      <View style={[styles.main, { maxWidth: MaxContentWidth }]}>
        <Pressable
          accessibilityRole="button"
          onPress={onBack}
          style={({ pressed }) => [styles.backRow, pressed && styles.pressed]}
        >
          <SymbolView name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} tintColor={palette.primary} size={16} />
          <Text style={[styles.backRowText, { color: palette.primary }]}>Create a PDF</Text>
        </Pressable>

        {!pdfLibraryAvailable ? (
          <EmptyState
            palette={palette}
            title="My PDFs is in the phone app"
            text="The web version can't make or keep PDFs. Open the app on your iPhone or Android phone to make one."
            onCreate={onCreate}
          />
        ) : library.length === 0 ? (
          <EmptyState
            palette={palette}
            title="No PDFs yet"
            text="Every PDF you make from the Questions tab is saved here, so you can open, share or print it again any time."
            onCreate={onCreate}
          />
        ) : (
          <>
            <View style={styles.controls}>
              <View style={[styles.searchBox, { backgroundColor: palette.card, borderColor: palette.border }]}>
                <SymbolView name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }} tintColor={palette.mutedForeground} size={18} />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search by name, subject or chapter"
                  placeholderTextColor={palette.mutedForeground}
                  accessibilityLabel="Search PDFs"
                  returnKeyType="search"
                  style={[styles.searchInput, { color: palette.foreground }]}
                />
                {search ? (
                  <Pressable accessibilityLabel="Clear search" hitSlop={8} onPress={() => setSearch('')}>
                    <SymbolView name={{ ios: 'xmark.circle.fill', android: 'cancel', web: 'cancel' }} tintColor={palette.mutedForeground} size={18} />
                  </Pressable>
                ) : null}
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {SORTS.map((option) => (
                  <Chip key={option.key} label={option.label} selected={sort === option.key} palette={palette}
                    onPress={() => setSort(option.key)} />
                ))}
                {subjects.length > 1 ? <View style={[styles.chipDivider, { backgroundColor: palette.border }]} /> : null}
                {subjects.length > 1
                  ? [ALL, ...subjects].map((name) => (
                      <Chip key={name} label={name === ALL ? 'All subjects' : name} selected={activeSubject === name}
                        palette={palette} onPress={() => setSubject(name)} />
                    ))
                  : null}
              </ScrollView>

              <Text style={[styles.summary, { color: palette.mutedForeground }]}>
                {shown.length === library.length
                  ? `${library.length} PDF${library.length === 1 ? '' : 's'}`
                  : `${shown.length} of ${library.length} PDFs`}
                {' · '}
                {formatBytes(totalLibrarySize(library))} used
              </Text>
            </View>

            {noticePdf ? (
              <View style={[styles.notice, { backgroundColor: palette.successSoft, borderColor: palette.successBorder }]}>
                <Text style={[styles.noticeText, { color: palette.successInk }]} numberOfLines={2}>
                  Saved “{noticePdf.name}”
                </Text>
                <Pressable accessibilityRole="button" hitSlop={6} onPress={() => attempt(() => openPdf(noticePdf))}>
                  <Text style={[styles.noticeAction, { color: palette.successInk }]}>Open</Text>
                </Pressable>
                <Pressable accessibilityLabel="Dismiss" hitSlop={8} onPress={() => setNotice(null)}>
                  <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} tintColor={palette.successInk} size={14} />
                </Pressable>
              </View>
            ) : null}

            <FlatList
              data={shown}
              keyExtractor={(pdf) => pdf.id}
              renderItem={({ item }) => <PdfCard pdf={item} palette={palette} onMore={setSheetPdf} />}
              ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
              ListEmptyComponent={
                <Text style={[styles.noMatch, { color: palette.mutedForeground }]}>No PDFs match your search.</Text>
              }
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={[styles.list, { paddingBottom: tabBarHeight + 32 }]}
              showsVerticalScrollIndicator={false}
            />
          </>
        )}
      </View>

      {sheetPdf ? (
        <ActionSheet
          pdf={library.find((pdf) => pdf.id === sheetPdf.id) ?? sheetPdf}
          palette={palette}
          onClose={() => setSheetPdf(null)}
          onRename={() => setRenaming(library.find((pdf) => pdf.id === sheetPdf.id) ?? sheetPdf)}
          onNotice={(pdf) => {
            setNotice(pdf);
            setSort('newest');
          }}
        />
      ) : null}
      {renaming ? <RenameDialog pdf={renaming} palette={palette} onClose={() => setRenaming(null)} /> : null}
    </SafeAreaView>
  );
}

function Chip({ label, selected, palette, onPress }: { label: string; selected: boolean; palette: Palette; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? palette.primarySoft : palette.card,
          borderColor: selected ? palette.primary : palette.border,
        },
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.chipText, { color: selected ? palette.primaryInk : palette.foreground, fontWeight: selected ? '700' : '500' }]}>
        {label}
      </Text>
    </Pressable>
  );
}

function EmptyState({ palette, title, text, onCreate }: { palette: Palette; title: string; text: string; onCreate: () => void }) {
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: palette.primarySoft }]}>
        <SymbolView name={{ ios: 'doc.richtext', android: 'picture_as_pdf', web: 'picture_as_pdf' }} tintColor={palette.primary} size={32} />
      </View>
      <Text style={[styles.emptyTitle, { color: palette.foreground }]}>{title}</Text>
      <Text style={[styles.emptyText, { color: palette.mutedForeground }]}>{text}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={onCreate}
        style={({ pressed }) => [styles.emptyBtn, { backgroundColor: palette.primary }, pressed && styles.pressed]}
      >
        <SymbolView name={{ ios: 'plus', android: 'add', web: 'add' }} tintColor={palette.onPrimary} size={16} />
        <Text style={[styles.emptyBtnText, { color: palette.onPrimary }]}>Create a PDF</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  main: { flex: 1, width: '100%', alignSelf: 'center' },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.45 },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    minHeight: 44,
    paddingHorizontal: Spacing.three,
  },
  backRowText: { fontSize: 14, fontWeight: '600' },

  controls: { paddingHorizontal: Spacing.three, gap: 10, paddingBottom: 8 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    minHeight: 44,
  },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 8 },
  chipRow: { gap: 8, alignItems: 'center' },
  chip: { minHeight: 36, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1, justifyContent: 'center' },
  chipText: { fontSize: 13 },
  chipDivider: { width: 1, height: 22, marginHorizontal: 2 },
  summary: { fontSize: 12, fontWeight: '600' },

  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: Spacing.three,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  noticeText: { flex: 1, fontSize: 13, fontWeight: '600' },
  noticeAction: { fontSize: 13, fontWeight: '800' },

  list: { paddingHorizontal: Spacing.three, paddingTop: 4 },
  noMatch: { textAlign: 'center', fontSize: 14, paddingVertical: 32 },

  card: { borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  cardMain: { flexDirection: 'row', gap: 12, padding: 14 },
  fileIcon: { width: 44, height: 52, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  cardCopy: { flex: 1, minWidth: 0, gap: 3 },
  cardTitle: { fontSize: 15, fontWeight: '700', lineHeight: 20 },
  cardMeta: { fontSize: 12.5 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 5 },
  cardSmall: { flex: 1, fontSize: 11.5 },
  badge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  cardActions: { flexDirection: 'row', borderTopWidth: 1 },
  cardAction: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44 },
  cardActionText: { fontSize: 13, fontWeight: '700' },

  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    maxHeight: '80%',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingTop: 8,
    paddingBottom: Platform.select({ ios: 34, default: 16 }),
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  sheetTitle: { fontSize: 16, fontWeight: '700', paddingHorizontal: 20, marginBottom: 6 },
  sheetRows: { paddingHorizontal: 8 },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 52, paddingHorizontal: 12, borderRadius: 10 },
  sheetRowCopy: { flex: 1 },
  sheetRowText: { fontSize: 15, fontWeight: '600' },
  sheetRowHint: { fontSize: 12, marginTop: 1 },

  dialogBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 },
  dialog: { width: '100%', maxWidth: 420, alignSelf: 'center', borderRadius: 14, borderWidth: 1, padding: 20 },
  dialogTitle: { fontSize: 17, fontWeight: '700', marginBottom: 14 },
  renameInput: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.2, borderRadius: 10, paddingHorizontal: 12, minHeight: 46 },
  renameText: { flex: 1, fontSize: 15, paddingVertical: 10 },
  renameSuffix: { fontSize: 14 },
  dialogError: { fontSize: 13, marginTop: 8 },
  dialogActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  dialogBtn: { flex: 1, minHeight: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  dialogBtnText: { fontSize: 15, fontWeight: '700' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.four, paddingBottom: 80, gap: 10 },
  emptyIcon: { width: 68, height: 68, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  emptyTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  emptyText: { fontSize: 14, lineHeight: 20, textAlign: 'center', maxWidth: 320 },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 46, paddingHorizontal: 18, borderRadius: 10, marginTop: 10 },
  emptyBtnText: { fontSize: 15, fontWeight: '700' },
});
