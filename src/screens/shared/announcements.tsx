import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { confirmAction } from '@/components/account-section';
import {
  Badge,
  Button,
  Card,
  Chips,
  DetailSheet,
  EmptyView,
  ErrorText,
  Field,
  FormSheet,
  Icon,
  LoadingView,
  MultiChips,
  SectionTitle,
  useLoad,
  usePalette,
} from '@/components/kit';
import { useSignedInUser } from '@/context/auth-context';
import { bumpDataVersion, useDataVersion } from '@/context/data-version';
import { announcementsApi, timeAgo, type Announcement } from '@/services/tuition-api';

const KIND_LABELS = { update: 'Update', schedule: 'Schedule' } as const;

/** One announcement: kind, title, message, who to and when. */
export function AnnouncementCard({ item, onDelete }: { item: Announcement; onDelete?: () => void }) {
  const palette = usePalette();
  const audience = item.allBatches ? 'All batches' : item.batches.map((b) => b.name).filter(Boolean).join(', ');
  return (
    <Card>
      <View style={styles.cardTop}>
        <Badge label={KIND_LABELS[item.kind]} tone={item.kind === 'schedule' ? 'warning' : 'primary'} />
        <Text style={[styles.meta, { color: palette.mutedForeground }]} numberOfLines={1}>
          {timeAgo(item.createdAt)}
        </Text>
        {onDelete ? (
          <Pressable accessibilityRole="button" accessibilityLabel={`Delete "${item.title}"`} onPress={onDelete} hitSlop={8}>
            <Icon name={{ ios: 'trash', android: 'delete' }} color={palette.mutedForeground} size={16} />
          </Pressable>
        ) : null}
      </View>
      <Text style={[styles.title, { color: palette.foreground }]}>{item.title}</Text>
      {item.body ? <Text style={[styles.body, { color: palette.inkSoft }]}>{item.body}</Text> : null}
      <Text style={[styles.meta, { color: palette.mutedForeground }]}>
        {item.author.name} · {audience}
      </Text>
    </Card>
  );
}

/**
 * The latest announcements, with "New announcement" for those who can post
 * and "See all" for the full list.
 */
export function AnnouncementsSection({
  batches,
  canPost,
  allowAllBatches,
  limit = 3,
}: {
  /** The batches the user can post to. */
  batches: { id: string; name: string }[];
  canPost: boolean;
  /** The tuition can send to everyone at once; a teacher picks their batches. */
  allowAllBatches: boolean;
  limit?: number;
}) {
  const palette = usePalette();
  const user = useSignedInUser();
  const version = useDataVersion();
  const { data, error, loading, reload } = useLoad(() => announcementsApi.list(50), [version]);
  const [posting, setPosting] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const canDelete = (a: Announcement) => user.role === 'tuition' || a.author.id === user.id;
  const remove = (a: Announcement) =>
    confirmAction('Delete this announcement?', `"${a.title}" will be removed for everyone.`, 'Delete', async () => {
      setDeleteError(null);
      try {
        await announcementsApi.remove(a.id);
        bumpDataVersion();
      } catch (e) {
        setDeleteError(e instanceof Error ? e.message : "Couldn't delete it.");
      }
    });

  const list = data ?? [];
  const renderList = (items: Announcement[]) =>
    items.map((a) => <AnnouncementCard key={a.id} item={a} onDelete={canDelete(a) ? () => remove(a) : undefined} />);

  return (
    <>
      <SectionTitle
        title="Announcements"
        action={
          list.length > limit ? (
            <Pressable accessibilityRole="button" onPress={() => setShowAll(true)} hitSlop={8}>
              <Text style={[styles.link, { color: palette.primary }]}>See all ({list.length})</Text>
            </Pressable>
          ) : undefined
        }
      />
      {canPost ? (
        <Button
          label="New announcement"
          variant="secondary"
          icon={{ ios: 'megaphone', android: 'campaign' }}
          onPress={() => setPosting(true)}
          disabled={!allowAllBatches && batches.length === 0}
        />
      ) : null}
      <ErrorText message={deleteError} />
      {loading ? (
        <LoadingView label="Loading announcements…" />
      ) : error ? (
        <ErrorText message={error} />
      ) : list.length === 0 ? (
        <Card>
          <EmptyView icon={{ ios: 'megaphone', android: 'campaign' }} title="No announcements yet" text="Schedule changes and updates for batches show here." />
        </Card>
      ) : (
        renderList(list.slice(0, limit))
      )}

      <DetailSheet visible={showAll} title="Announcements" onClose={() => setShowAll(false)} onRefresh={reload}>
        {renderList(list)}
      </DetailSheet>
      <AnnouncementForm visible={posting} onClose={() => setPosting(false)} batches={batches} allowAllBatches={allowAllBatches} />
    </>
  );
}

const ALL = '__all__';

function AnnouncementForm({
  visible,
  onClose,
  batches,
  allowAllBatches,
}: {
  visible: boolean;
  onClose: () => void;
  batches: { id: string; name: string }[];
  allowAllBatches: boolean;
}) {
  const [kind, setKind] = useState<Announcement['kind']>('update');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [openedFor, setOpenedFor] = useState(false);
  if (visible !== openedFor) {
    setOpenedFor(visible);
    if (visible) {
      setKind('update');
      setTitle('');
      setBody('');
      setPicked(allowAllBatches ? [ALL] : batches.length === 1 ? [batches[0].id] : []);
      setError(null);
    }
  }

  const choices = [...(allowAllBatches ? [ALL] : []), ...batches.map((b) => b.id)];
  const labels: Record<string, string> = Object.fromEntries([[ALL, 'All batches'], ...batches.map((b) => [b.id, b.name])]);
  // "All batches" and single batches don't mix.
  const onPick = (next: string[]) => {
    const addedAll = next.includes(ALL) && !picked.includes(ALL);
    setPicked(addedAll ? [ALL] : next.filter((v) => v !== ALL));
  };

  const save = async () => {
    if (!title.trim()) return setError('Enter a title.');
    if (!picked.length) return setError('Pick who it is for.');
    setSaving(true);
    setError(null);
    try {
      await announcementsApi.create({ kind, title: title.trim(), body: body.trim(), batchIds: picked.includes(ALL) ? [] : picked });
      bumpDataVersion();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't post it. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormSheet visible={visible} title="New announcement" onClose={onClose} submitLabel="Post" onSubmit={save} submitting={saving} error={error}>
      <Chips label="Type" choices={['update', 'schedule'] as const} selected={kind} onChange={setKind} labels={KIND_LABELS} />
      <Field label="Title" value={title} onChangeText={setTitle} placeholder={kind === 'schedule' ? 'e.g. No class on Friday' : 'e.g. Test on Monday'} maxLength={120} />
      <Field label="Message" value={body} onChangeText={setBody} placeholder="Details (optional)" multiline maxLength={2000} style={styles.multiline} />
      <MultiChips label="Send to" choices={choices} selected={picked} onChange={onPick} labels={labels} />
    </FormSheet>
  );
}

const styles = StyleSheet.create({
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 16, fontWeight: '700' },
  body: { fontSize: 14, lineHeight: 20 },
  meta: { fontSize: 12, flex: 1 },
  link: { fontSize: 13, fontWeight: '700' },
  multiline: { minHeight: 96, textAlignVertical: 'top' },
});
