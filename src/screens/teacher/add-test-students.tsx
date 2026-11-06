import React, { useRef, useState } from 'react';
import { Button, DetailSheet, ErrorText, Muted, Notice } from '@/components/kit';
import { SearchBox } from '@/screens/tuition/admin-ui';
import { studentsToAdd } from '@/screens/teacher/test-management';
import { StudentSelectionList } from '@/screens/teacher/test-access';
import { dateTimeLabel, schoolApi, type TestMonitor, type TestSummary } from '@/services/school-api';

export function AddTestStudents({ test, monitor, onClose, onChanged }: { test: TestSummary; monitor: TestMonitor | null; onClose: () => void; onChanged: (added: number) => void }) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const candidates = monitor ? studentsToAdd(monitor) : [];
  const available = monitor?.accessStudents?.filter(row => row.eligible) ?? [];
  const chosen = candidates.filter(r => selected.includes(r.student.id));
  const shown = available.filter(r => r.student.name.toLowerCase().includes(query.trim().toLowerCase()));
  const add = async () => {
    if (inFlight.current || !chosen.length) return;
    inFlight.current = true;
    setBusy(true); setError(null);
    const failures: string[] = [];
    const messages: string[] = [];
    for (const row of chosen) {
      try { await schoolApi.testAccess(test.id, row.student.id, 'grant'); }
      catch (e) { failures.push(row.student.id); messages.push(`${row.student.name}: ${e instanceof Error ? e.message : 'Could not add student.'}`); }
    }
    setSelected(failures);
    inFlight.current = false;
    setBusy(false);
    onChanged(chosen.length - failures.length);
    if (failures.length) setError(messages.join('\n'));
    else onClose();
  };
  return <DetailSheet visible title="Add students to test" onClose={() => { if (!busy) onClose(); }} footer={<Button label={`Allow ${chosen.length || ''} student${chosen.length === 1 ? '' : 's'}`} disabled={!chosen.length || busy} loading={busy} onPress={() => void add()} />}>
    <Notice title={test.status === 'open' ? 'Students can join the ongoing test' : 'Give students permission to start'} text={`Only activated students enrolled in the selected batches are listed. The test still closes ${dateTimeLabel(test.closesAt)}. Late starters receive only the time remaining.`} />
    <SearchBox label="Search students to add" placeholder="Search students" value={query} onChangeText={setQuery} />
    <ErrorText message={error} />
    {!monitor?.accessStudents ? <Notice title="Student access is unavailable" text="Refresh Test Management and try again. If access records remain unavailable, the running backend needs the test-access update. No permissions have been changed." /> : null}
    <Muted>{chosen.length} selected</Muted>
    {shown.length ? <StudentSelectionList students={shown.map(row => ({ ...row.student, disabled: row.allowed || row.started, subtitle: [row.batch?.name, row.allowed || row.started ? 'Already has access' : row.request === 'pending' ? 'Requested access' : 'Does not have access yet'].filter(Boolean).join(' | ') }))} selected={[...selected, ...available.filter(row => row.allowed || row.started).map(row => row.student.id)]} onChange={ids => setSelected([...new Set(ids)].filter(id => candidates.some(row => row.student.id === id)))} disabled={busy} /> : <Muted>{candidates.length ? 'No students match your search.' : 'No eligible students to add. Legacy tests already allow eligible batch students; existing permissions and attempts stay unchanged.'}</Muted>}
  </DetailSheet>;
}

