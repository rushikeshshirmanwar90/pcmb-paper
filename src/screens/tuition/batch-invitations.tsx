import { clearLoadCache } from '@/services/load-cache';
import React, { useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';
import { confirmAction } from '@/components/account-section';
import { Badge, Button, Card, Chips, EmptyView, ErrorView, LoadingView, Muted, Notice, SectionTitle, useLoad, usePalette } from '@/components/kit';
import { StackScreen } from '@/components/stack-screen';
import { PROGRAM_LABELS } from '@/constants/school';
import { ActionRow, copyText, FlashNotice, InfoRow, programTone, useFlash } from '@/screens/tuition/admin-ui';
import { tuitionOnly } from '@/screens/tuition/batch-screens';
import { EXPIRY_CHOICES, EXPIRY_LABELS, expiryText, statusLabel, type Expiry } from '@/screens/tuition/invite-students';
import { batchInviteApi, enrollmentsApi, type InviteChange } from '@/services/tuition-api';

/** The code as students type it: no hyphens. */
const plainCode = (code: string) => code.replace(/-/g, '');

/** One batch's student joining code: copy, share, regenerate, change expiry or turn off. */
export const BatchInvitationsScreen = tuitionOnly(function BatchInvitationsScreen({ batchId }: { batchId: string }) {
  const palette = usePalette();
  const { data: invite, error, loading, refreshing, refresh, reload, setData } = useLoad(() => batchInviteApi.get(batchId), [batchId], { cacheKey: `invite:${batchId}` });
  // Students who joined with the code and wait for approval. Left out when it can't be read.
  const pending = useLoad(() => enrollmentsApi.pending(), [batchId], { cacheKey: `invite-pending:${batchId}` });
  const waiting = pending.data?.filter((e) => e.batch?.id === batchId).length;
  const [expiry, setExpiry] = useState<Expiry>('180');
  const [busy, setBusy] = useState(false);
  const { flash, show, clear } = useFlash();

  const days = expiry === 'never' ? null : Number(expiry);
  const code = invite?.code ? plainCode(invite.code) : null;
  const live = invite?.status === 'active' && !!code;
  const off = invite?.status === 'revoked';

  const copy = async () => {
    if (!code) return;
    clear();
    if (await copyText(code)) show('Code copied.');
    else show("Couldn't copy. Press and hold the code to copy it.", 'danger');
  };
  const share = () => {
    if (!invite || !code) return;
    Share.share({ message: `Join ${invite.batch.name} at ${invite.institute} on the PCMB app: create an account, then enter the joining code ${code}.` }).catch(() => {
      show("Couldn't open sharing.", 'danger');
    });
  };

  const run = async (change: InviteChange, message: string) => {
    setBusy(true);
    clear();
    try {
      const next = await batchInviteApi.change(batchId, change);
      clearLoadCache(); // cached copies of the code are old now
      setData(() => next);
      show(message);
    } catch (e) {
      show(e instanceof Error ? e.message : "Couldn't change the code.", 'danger');
    } finally {
      setBusy(false);
    }
  };
  const regenerate = () => {
    const go = () => run({ action: 'regenerate', expiresInDays: days }, 'New code ready. Share it with your batch.');
    if (!live) return void go();
    confirmAction('Make a new code?', "The current code stops working at once, so students can't join with it any more. Students who already joined aren't affected.", 'Regenerate', go);
  };

  return (
    <StackScreen title="Invite Students" subtitle={invite?.batch.name} onRefresh={refresh} refreshing={refreshing}>
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
              <Badge label={statusLabel[invite.status]} tone={live ? 'success' : 'warning'} />
            </View>
            {waiting !== undefined ? (
              <InfoRow
                icon={{ ios: 'person.badge.clock', android: 'pending_actions' }}
                label="Waiting for approval"
                value={waiting ? `${waiting} ${waiting === 1 ? 'student' : 'students'}` : 'None'}
                last
              />
            ) : null}
          </Card>
          {waiting ? <Muted>Approve or reject them under People › Students.</Muted> : null}

          {live ? (
            <Card>
              <Text style={[styles.label, { color: palette.mutedForeground }]}>Joining Code</Text>
              <View style={[styles.codeBox, { backgroundColor: palette.background, borderColor: palette.border }]}>
                <Text selectable accessibilityLabel={`Joining code ${code!.split('').join(' ')}`} style={[styles.code, { color: palette.foreground }]}>
                  {code}
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
                    ? 'Students can no longer join with it. Update the expiry, or regenerate a new code, below.'
                    : invite.status === 'active'
                      ? 'Regenerate a new code below. The old one no longer works.'
                      : 'The old code no longer works. Regenerate a code to let students join again.'
                }
              />
            </Card>
          )}

          <SectionTitle title="Valid for" />
          <Chips choices={EXPIRY_CHOICES} selected={expiry} onChange={setExpiry} labels={EXPIRY_LABELS} />
          <Muted>Used by the actions below, counted from today.</Muted>

          <Card>
            <ActionRow
              icon={{ ios: 'arrow.triangle.2.circlepath', android: 'autorenew' }}
              title={off ? 'Make a new code' : 'Regenerate code'}
              subtitle={off ? 'Turns joining back on.' : 'The current code stops working at once.'}
              disabled={busy}
              last={off}
              onPress={regenerate}
            />
            {!off ? (
              <>
                <ActionRow
                  icon={{ ios: 'clock.arrow.circlepath', android: 'update' }}
                  title="Update expiry"
                  subtitle={`Keep this code, valid for ${EXPIRY_LABELS[expiry].toLowerCase()} from today.`}
                  disabled={busy}
                  onPress={() => void run({ action: 'extend', expiresInDays: days }, 'Expiry updated.')}
                />
                <ActionRow
                  icon={{ ios: 'nosign', android: 'block' }}
                  title="Disable code"
                  subtitle="Nobody can join with it until you make a new one."
                  tone="danger"
                  disabled={busy}
                  last
                  onPress={() =>
                    confirmAction('Turn off joining?', "Students can't join this batch with its code until you make a new one. Students already in aren't affected.", 'Disable', () =>
                      run({ action: 'revoke' }, 'Joining turned off.')
                    )
                  }
                />
              </>
            ) : null}
          </Card>
          {off ? <Notice tone="warning" text="Joining is off for this batch." /> : null}
          <Muted>
            Students create their own account, enter this code and wait for you to approve them under People › Students. Anyone with the code can ask, so share it only with your batch.
          </Muted>
        </>
      ) : null}
    </StackScreen>
  );
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: 10 },
  badges: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  label: { fontSize: 13, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  codeBox: { borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  code: { fontSize: 30, fontWeight: '800', letterSpacing: 4, fontVariant: ['tabular-nums'] },
});
