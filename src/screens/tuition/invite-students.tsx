import React, { useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';
import { confirmAction } from '@/components/account-section';
import { Badge, Button, Card, Chips, DetailSheet, EmptyView, ErrorView, LoadingView, Muted, Notice, SectionTitle, useLoad, usePalette } from '@/components/kit';
import { OFFERED_PROGRAMS, PROGRAM_LABELS } from '@/constants/school';
import { ActionRow, copyText, FlashNotice, InfoRow, programTone, useFlash } from '@/screens/tuition/admin-ui';
import { batchInviteApi, type Batch, type BatchInvite, type InviteChange } from '@/services/tuition-api';

/**
 * Invite Students: one batch's joining code to copy or share, with Manage
 * Code under it. Opened from a batch's details (the batch is known) and from
 * People › Students (the admin picks the batch first): both use this sheet.
 */
export function InviteStudentsSheet({ batchId, onClose }: { batchId: string; onClose: () => void }) {
  const palette = usePalette();
  const { data: invite, error, loading, reload, setData } = useLoad(() => batchInviteApi.get(batchId), [batchId]);
  const [managing, setManaging] = useState(false);
  const { flash, show, clear } = useFlash();

  const copy = async () => {
    if (!invite?.code) return;
    clear();
    show((await copyText(invite.code)) ? 'Code copied.' : "Couldn't copy. Press and hold the code to copy it.", 'danger');
  };
  const share = () =>
    invite?.code &&
    Share.share({
      message: `Join ${invite.batch.name} at ${invite.institute} on the PCMB app: create an account, then enter the joining code ${invite.code}.`,
    }).catch(() => {});

  const live = invite?.status === 'active' && !!invite.code;

  return (
    <DetailSheet visible title="Invite Students" onClose={onClose}>
      <FlashNotice flash={flash} onDismiss={clear} />
      {loading ? (
        <LoadingView label="Getting the joining code…" />
      ) : error && !invite ? (
        <ErrorView message={error} onRetry={reload} />
      ) : invite ? (
        <>
          <Card>
            <InfoRow icon={{ ios: 'building.2', android: 'apartment' }} label="Institute" value={invite.institute} />
            <InfoRow icon={{ ios: 'person.3', android: 'groups' }} label="Batch" value={invite.batch.name} />
            <View style={styles.badges}>
              {invite.batch.standard ? <Badge label={invite.batch.standard} /> : null}
              {invite.batch.program ? <Badge label={PROGRAM_LABELS[invite.batch.program]} tone={programTone(invite.batch.program)} /> : null}
            </View>
          </Card>

          {live ? (
            <Card>
              <Text style={[styles.label, { color: palette.mutedForeground }]}>Joining Code</Text>
              <View style={[styles.codeBox, { backgroundColor: palette.background, borderColor: palette.border }]}>
                <Text selectable accessibilityLabel={`Joining code ${invite.code!.replace('-', ' ')}`} style={[styles.code, { color: palette.foreground }]}>
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
                    ? 'Students can no longer join with it. Extend it, or make a new code, under Manage Code.'
                    : invite.status === 'active'
                      ? 'Make a new code under Manage Code. The old one no longer works.'
                      : 'The old code no longer works. Make a new code to let students join again.'
                }
              />
            </Card>
          )}

          <Button label="Manage Code" variant="tonal" icon={{ ios: 'slider.horizontal.3', android: 'tune' }} onPress={() => setManaging(true)} />
          <Muted>Students create their own account, enter this code and wait for you to approve them under People › Students. Anyone with the code can ask, so share it only with your batch.</Muted>

          {managing ? (
            <ManageCodeSheet
              batchId={batchId}
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

const EXPIRY_CHOICES = ['30', '90', '180', 'never'] as const;
type Expiry = (typeof EXPIRY_CHOICES)[number];
const EXPIRY_LABELS: Record<Expiry, string> = { '30': '30 days', '90': '90 days', '180': '6 months', never: 'No expiry' };

function expiryText(invite: BatchInvite) {
  if (!invite.expiresAt) return 'Never expires.';
  const date = new Date(invite.expiresAt);
  const days = Math.ceil((date.getTime() - Date.now()) / 86_400_000);
  const when = date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  return days <= 0 ? `Expired on ${when}.` : `Expires ${when} (${days} ${days === 1 ? 'day' : 'days'} left).`;
}

const statusLabel = { active: 'Active', expired: 'Expired', revoked: 'Turned off' } as const;

/** Regenerate, turn off or change the expiry of a batch's code. */
function ManageCodeSheet({ batchId, invite, onClose, onChanged }: { batchId: string; invite: BatchInvite; onClose: () => void; onChanged: (invite: BatchInvite, message: string) => void }) {
  const [expiry, setExpiry] = useState<Expiry>('180');
  const [busy, setBusy] = useState(false);
  const { flash, show, clear } = useFlash();
  const off = invite.status === 'revoked';
  const days = expiry === 'never' ? null : Number(expiry);

  const run = async (change: InviteChange, message: string) => {
    setBusy(true);
    clear();
    try {
      onChanged(await batchInviteApi.change(batchId, change), message);
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
              : confirmAction('Make a new code?', "The current code stops working. Students who already joined aren't affected.", 'Regenerate', () =>
                  run({ action: 'regenerate', expiresInDays: days }, 'New code ready. Share it with your batch.')
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
                confirmAction('Turn off joining?', "Students can't join this batch with its code until you make a new one. Students already in the batch aren't affected.", 'Disable', () =>
                  run({ action: 'revoke' }, 'Joining turned off.')
                )
              }
            />
          </>
        ) : null}
      </Card>
      {off ? <Notice tone="warning" text="Joining is off for this batch." /> : null}
    </DetailSheet>
  );
}

/** People › Students: choose a batch, then invite to it. */
export function InviteStudentsPicker({ batches, onClose }: { batches: Batch[]; onClose: () => void }) {
  const [batchId, setBatchId] = useState<string | null>(null);
  if (batchId) return <InviteStudentsSheet batchId={batchId} onClose={onClose} />;
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
              onPress={() => setBatchId(b.id)}
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
