import { clearLoadCache } from '@/services/load-cache';
import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import { Share, StyleSheet, Text, View } from 'react-native';
import { confirmAction } from '@/components/account-section';
import { Button, Card, Chips, DetailSheet, EmptyView, ErrorView, LoadingView, Muted, Notice, SectionTitle, useLoad, usePalette } from '@/components/kit';
import { OFFERED_PROGRAMS, PROGRAM_LABELS } from '@/constants/school';
import { ActionRow, copyText, FlashNotice, InfoRow, useFlash } from '@/screens/tuition/admin-ui';
import { batchHref } from '@/screens/tuition/batch-nav';
import { teacherInviteApi, type Batch, type InviteChange, type JoinInvite, type TeacherInvite } from '@/services/tuition-api';

/** What differs between inviting a batch's students and inviting the institute's teachers. */
interface InviteKind<T extends JoinInvite> {
  title: string;
  /** "students" / "teachers", for the sentences around the code. */
  who: string;
  load: () => Promise<T>;
  change: (input: InviteChange) => Promise<T>;
  /** Rows under the institute: the batch for students, nothing for teachers. */
  details?: (invite: T) => React.ReactNode;
  shareMessage: (invite: T, code: string) => string;
  help: string;
  /** Whom a new code is shared with, e.g. "your batch". */
  audience: string;
  /** What joining is switched off for, e.g. "this batch". */
  where: string;
}

const cap = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * One joining code to copy or share, with Manage Code under it. Student
 * invitations (one batch's code) and teacher invitations (the institute's
 * code) both use this sheet; only what they say differs.
 */
function InviteCodeSheet<T extends JoinInvite>({ kind, scope, onClose }: { kind: InviteKind<T>; scope: string; onClose: () => void }) {
  const palette = usePalette();
  const { data: invite, error, loading, reload, setData } = useLoad(kind.load, [scope], { cacheKey: `invite:${scope}` });
  const [managing, setManaging] = useState(false);
  const { flash, show, clear } = useFlash();

  const copy = async () => {
    if (!invite?.code) return;
    clear();
    show((await copyText(invite.code)) ? 'Code copied.' : "Couldn't copy. Press and hold the code to copy it.", 'danger');
  };
  const share = () => invite?.code && Share.share({ message: kind.shareMessage(invite, invite.code) }).catch(() => {});

  const live = invite?.status === 'active' && !!invite.code;

  return (
    <DetailSheet visible title={kind.title} onClose={onClose}>
      <FlashNotice flash={flash} onDismiss={clear} />
      {loading ? (
        <LoadingView label="Getting the joining code…" />
      ) : error && !invite ? (
        <ErrorView message={error} onRetry={reload} />
      ) : invite ? (
        <>
          <Card>
            <InfoRow icon={{ ios: 'building.2', android: 'apartment' }} label="Institute" value={invite.institute} last={!kind.details} />
            {kind.details?.(invite)}
          </Card>

          {live ? (
            <Card>
              <Text style={[styles.label, { color: palette.mutedForeground }]}>{kind.who === 'teachers' ? 'Teacher Joining Code' : 'Joining Code'}</Text>
              <View style={[styles.codeBox, { backgroundColor: palette.background, borderColor: palette.border }]}>
                <Text selectable accessibilityLabel={`Joining code ${invite.code!.replace(/-/g, '').split('').join(' ')}`} style={[styles.code, { color: palette.foreground }]}>
                  {invite.code}
                </Text>
              </View>
              <Muted>{expiryText(invite)}</Muted>
              <View style={styles.row}>
                <Button label="Copy Code" variant="secondary" icon={{ ios: 'doc.on.doc', android: 'content_copy' }} onPress={copy} style={styles.flex} />
                <Button label="Share Code" icon={{ ios: 'square.and.arrow.up', android: 'share' }} onPress={share} style={styles.flex} />
              </View>
            </Card>
          ) : (
            <Card>
              <EmptyView
                icon={{ ios: 'lock', android: 'lock' }}
                title={invite.status === 'expired' ? 'This code has expired' : invite.status === 'active' ? "This code can't be shown" : 'Joining is turned off'}
                text={
                  invite.status === 'expired'
                    ? `${cap(kind.who)} can no longer join with it. Extend it, or make a new code, under Manage Code.`
                    : invite.status === 'active'
                      ? 'Make a new code under Manage Code. The old one no longer works.'
                      : `The old code no longer works. Make a new code to let ${kind.who} join again.`
                }
              />
            </Card>
          )}

          <Button label="Manage Code" variant="tonal" icon={{ ios: 'slider.horizontal.3', android: 'tune' }} onPress={() => setManaging(true)} />
          <Muted>{kind.help}</Muted>

          {managing ? (
            <ManageCodeSheet
              kind={kind}
              invite={invite}
              onClose={() => setManaging(false)}
              onChanged={(next, message) => {
                setData(() => next);
                show(message);
              }}
            />
          ) : null}
        </>
      ) : null}
    </DetailSheet>
  );
}

const TEACHER_KIND: InviteKind<TeacherInvite> = {
  title: 'Invite Teachers',
  who: 'teachers',
  load: () => teacherInviteApi.get(),
  change: (input) => teacherInviteApi.change(input),
  shareMessage: (invite, code) => `Join ${invite.institute} as a teacher on the PCMB app: create an account, then enter the teacher joining code ${code}.`,
  help: 'Teachers create their own account, enter this code, choose the subjects they teach and wait for you to approve them under People › Teachers. Anyone with the code can ask, so share it only with your teachers.',
  audience: 'your teachers',
  where: 'your institute',
};

/** Invite Teachers: the institute's code, not tied to any batch. Opened from People › Teachers. */
export function InviteTeachersSheet({ onClose }: { onClose: () => void }) {
  return <InviteCodeSheet kind={TEACHER_KIND} scope="teachers" onClose={onClose} />;
}

export const EXPIRY_CHOICES = ['30', '90', '180', 'never'] as const;
export type Expiry = (typeof EXPIRY_CHOICES)[number];
export const EXPIRY_LABELS: Record<Expiry, string> = { '30': '30 days', '90': '90 days', '180': '6 months', never: 'No expiry' };

export function expiryText(invite: JoinInvite) {
  if (!invite.expiresAt) return 'Never expires.';
  const date = new Date(invite.expiresAt);
  const days = Math.ceil((date.getTime() - Date.now()) / 86_400_000);
  const when = date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  return days <= 0 ? `Expired on ${when}.` : `Expires ${when} (${days} ${days === 1 ? 'day' : 'days'} left).`;
}

export const statusLabel = { active: 'Active', expired: 'Expired', revoked: 'Turned off' } as const;

/** Regenerate, turn off or change the expiry of a code. */
function ManageCodeSheet<T extends JoinInvite>({ kind, invite, onClose, onChanged }: { kind: InviteKind<T>; invite: T; onClose: () => void; onChanged: (invite: T, message: string) => void }) {
  const [expiry, setExpiry] = useState<Expiry>('180');
  const [busy, setBusy] = useState(false);
  const { flash, show, clear } = useFlash();
  const off = invite.status === 'revoked';
  const days = expiry === 'never' ? null : Number(expiry);

  const run = async (change: InviteChange, message: string) => {
    setBusy(true);
    clear();
    try {
      const next = await kind.change(change);
      clearLoadCache(); // the cached copy of the code is old now
      onChanged(next, message);
      onClose();
    } catch (e) {
      show(e instanceof Error ? e.message : "Couldn't change the code.", 'danger');
    } finally {
      setBusy(false);
    }
  };

  return (
    <DetailSheet visible title="Manage Code" onClose={onClose}>
      <FlashNotice flash={flash} onDismiss={clear} />
      <Card>
        <InfoRow icon={{ ios: 'checkmark.seal', android: 'verified' }} label="Status" value={statusLabel[invite.status]} />
        <InfoRow icon={{ ios: 'calendar', android: 'event' }} label="Expiry" value={off ? 'Not applicable' : expiryText(invite)} last />
      </Card>

      <SectionTitle title="Valid for" />
      <Chips choices={EXPIRY_CHOICES} selected={expiry} onChange={setExpiry} labels={EXPIRY_LABELS} />
      <Muted>Used by the actions below: counted from today.</Muted>

      <Card>
        <ActionRow
          icon={{ ios: 'arrow.triangle.2.circlepath', android: 'autorenew' }}
          title={off ? 'Make a new code' : 'Regenerate code'}
          subtitle={off ? 'Turns joining back on.' : 'The current code stops working at once.'}
          disabled={busy}
          last={off}
          onPress={() =>
            off
              ? void run({ action: 'regenerate', expiresInDays: days }, 'New code ready.')
              : confirmAction('Make a new code?', `The current code stops working. ${cap(kind.who)} who already joined aren't affected.`, 'Regenerate', () =>
                  run({ action: 'regenerate', expiresInDays: days }, `New code ready. Share it with ${kind.audience}.`)
                )
          }
        />
        {!off ? (
          <>
            <ActionRow icon={{ ios: 'clock.arrow.circlepath', android: 'update' }} title="Update expiry" subtitle={`Keep this code, valid for ${EXPIRY_LABELS[expiry].toLowerCase()} from today.`} disabled={busy} onPress={() => void run({ action: 'extend', expiresInDays: days }, 'Expiry updated.')} />
            <ActionRow
              icon={{ ios: 'nosign', android: 'block' }}
              title="Disable code"
              subtitle="Nobody can join with it until you make a new one."
              tone="danger"
              disabled={busy}
              last
              onPress={() =>
                confirmAction('Turn off joining?', `${cap(kind.who)} can't join ${kind.where} with its code until you make a new one. ${cap(kind.who)} already in aren't affected.`, 'Disable', () =>
                  run({ action: 'revoke' }, 'Joining turned off.')
                )
              }
            />
          </>
        ) : null}
      </Card>
      {off ? <Notice tone="warning" text={`Joining is off for ${kind.where}.`} /> : null}
    </DetailSheet>
  );
}

/** People › Students: choose a batch, then invite to it. */
export function InviteStudentsPicker({ batches, onClose }: { batches: Batch[]; onClose: () => void }) {
  const router = useRouter();
  const open = batches.filter((b) => OFFERED_PROGRAMS.includes(b.program)).sort((a, b) => a.name.localeCompare(b.name));
  return (
    <DetailSheet visible title="Invite Students" onClose={onClose}>
      <SectionTitle title="Which batch?" />
      {open.length ? (
        <Card>
          {open.map((b, i) => (
            <ActionRow
              key={b.id}
              icon={{ ios: 'person.3', android: 'groups' }}
              title={b.name}
              subtitle={[b.standard, PROGRAM_LABELS[b.program]].filter(Boolean).join(' · ')}
              onPress={() => {
                onClose();
                router.push(batchHref(b.id, 'invitations'));
              }}
              last={i === open.length - 1}
            />
          ))}
        </Card>
      ) : (
        <Card>
          <EmptyView icon={{ ios: 'person.3', android: 'groups' }} title="No batch to invite to" text="Make a JEE or NEET batch from the Batches tab first. Joining codes belong to a batch." />
        </Card>
      )}
      <Muted>Each batch has its own code.</Muted>
    </DetailSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: 10 },
  badges: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  label: { fontSize: 13, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  codeBox: { borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  code: { fontSize: 30, fontWeight: '800', letterSpacing: 4, fontVariant: ['tabular-nums'] },
});
