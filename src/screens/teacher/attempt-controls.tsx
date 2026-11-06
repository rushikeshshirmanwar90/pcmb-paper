import React, { useRef, useState } from 'react';
import { Button, Chips, DetailRow, DetailSheet, ErrorText, Field, Muted, Notice } from '@/components/kit';
import { dateTimeLabel, schoolApi, type TestMonitorRow } from '@/services/school-api';

export function AttemptControls({ testId, row, onClose, onChanged }: {
  testId: string; row: TestMonitorRow; onClose: () => void; onChanged: (message: string) => void;
}) {
  const [mode, setMode] = useState<'extend' | 'resume' | 'finalize' | null>(null);
  const [minutes, setMinutes] = useState('5');
  const [busy, setBusy] = useState(false);
  const [requestLocked, setRequestLocked] = useState(false);
  const inFlight = useRef(false);
  // Keep the same key and payload after an uncertain network response.
  const request = useRef<{ id: string; action: 'extend' | 'resume' | 'finalize'; minutes?: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const added = Number(minutes);
  const valid = /^\d+$/.test(minutes) && added >= 1 && added <= 120;
  const newDeadline = row.deadline && valid ? new Date(new Date(row.deadline).getTime() + added * 60_000).toISOString() : null;
  const confirm = async () => {
    if (!mode || inFlight.current || (mode === 'extend' && !valid)) return;
    inFlight.current = true; setBusy(true); setRequestLocked(true); setError(null);
    request.current ??= { id: `${Date.now()}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`, action: mode, ...(mode === 'extend' ? { minutes: added } : {}) };
    try {
      const payload = request.current;
      await schoolApi.controlAttempt(testId, { studentId: row.student.id, action: payload.action, requestId: payload.id, minutes: payload.minutes, suspendedAt: row.suspendedAt });
      onChanged(payload.action === 'extend' ? `Added ${payload.minutes} minutes for ${row.student.name}.` : payload.action === 'resume' ? `${row.student.name} can continue the same test attempt.` : `Finalized ${row.student.name}'s attempt.`);
      onClose();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not confirm. Retry with the same request.'); }
    finally { inFlight.current = false; setBusy(false); }
  };
  return <DetailSheet visible title={row.student.name} onClose={() => { if (!busy) onClose(); }}>
    <DetailRow label="Examination progress" value={`${row.answered} of ${row.total} answered`} />
    <DetailRow label="Current deadline" value={row.deadline ? dateTimeLabel(row.deadline) : 'Unavailable'} />
    {row.remainingSeconds !== null ? <DetailRow label="Remaining examination time" value={`${Math.ceil(row.remainingSeconds / 60)} minutes`} /> : null}
    {row.events?.filter(event => event.ended).map((event, i) => <Muted key={`${event.at}-${i}`}>Left examination for {Math.round(event.awayMs / 1000)} seconds · {dateTimeLabel(event.at)}</Muted>)}
    {!mode ? <>
      {row.state === 'in-progress' ? <Button label="Extend Time" onPress={() => setMode('extend')} /> : null}
      {row.resumable ? <><Notice title="Test paused due to violations" text="The same attempt, saved answers and remaining time will be restored if you resume it." /><Button label="Resume Test" onPress={() => setMode('resume')} /><Button label="Finalize attempt" variant="danger" onPress={() => setMode('finalize')} /></> : null}
    </> : <>
      {mode === 'extend' ? <>
        <Chips choices={['5', '10', '15', '30', 'Custom']} labels={{ '5': '+5 minutes', '10': '+10 minutes', '15': '+15 minutes', '30': '+30 minutes', Custom: 'Custom minutes' }} selected={['5', '10', '15', '30'].includes(minutes) ? minutes : 'Custom'} onChange={value => { if (!request.current) setMinutes(value === 'Custom' ? '' : value); }} />
        <Field label="Additional minutes" hint="1–120 whole minutes per extension" value={minutes} onChangeText={value => { if (!request.current) setMinutes(value); }} keyboardType="number-pad" editable={!busy && !requestLocked} />
        <DetailRow label="New deadline" value={newDeadline ? dateTimeLabel(newDeadline) : 'Enter valid additional minutes'} />
      </> : <Notice title={mode === 'resume' ? 'Resume this attempt?' : 'Finalize this attempt?'} text={mode === 'resume' ? 'The remaining time starts again when you confirm. Previous answers and violation evidence are preserved.' : 'Saved answers will be scored. This attempt cannot be resumed afterward.'} />}
      <ErrorText message={error} />
      <Button label={mode === 'extend' ? 'Confirm extension' : mode === 'resume' ? 'Confirm resume' : 'Confirm finalization'} loading={busy} disabled={busy || (mode === 'extend' && !valid)} onPress={() => void confirm()} />
    </>}
  </DetailSheet>;
}
