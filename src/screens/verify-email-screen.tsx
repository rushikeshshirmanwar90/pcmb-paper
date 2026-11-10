import React, { useEffect, useState } from 'react';
import { confirmAction } from '@/components/account-section';
import { Button, CodeInput, ErrorText, Notice } from '@/components/kit';
import { useAuth, useSignedInUser } from '@/context/auth-context';
import { emailApi } from '@/services/email-api';
import { AuthCard, AuthScreen, AuthTitle, AuthTopBar, FinePrint, StepProgress, Strong, TextLink } from '@/screens/auth-ui';

const RESEND_SECONDS = 60;

/** After registering: the 6-digit code from the email proves the address is theirs. */
export function VerifyEmailScreen() {
  const user = useSignedInUser();
  const { refresh, signOut } = useAuth();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  // Registration just sent a code, so the first resend waits a minute.
  const [wait, setWait] = useState(RESEND_SECONDS);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  const verify = async (value = code) => {
    if (value.length !== 6) return setError('Enter the 6-digit code from the email.');
    setBusy(true);
    setError(null);
    try {
      await emailApi.verify(value);
      // The app moves on to "Join your tuition".
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't check the code.");
      setCode('');
      setBusy(false);
    }
  };

  const resend = async () => {
    setSending(true);
    setError(null);
    setNote(null);
    try {
      const { resendAfter } = await emailApi.sendVerification();
      setWait(resendAfter || RESEND_SECONDS);
      setNote(`A new code is on its way to ${user.email}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send a new code.");
    } finally {
      setSending(false);
    }
  };

  const logOut = () => confirmAction('Log out?', 'You can log in again and finish verifying later.', 'Log out', () => void signOut());

  return (
    <AuthScreen>
      <AuthTopBar leading={<StepProgress step={2} />} trailing={<TextLink label="Log out" onPress={logOut} />} />
      <AuthTitle
        title="Check your email"
        lead={
          <>
            Enter the 6-digit code sent to <Strong>{user.email}</Strong>.
          </>
        }
      />

      <AuthCard>
        <CodeInput
          value={code}
          onChange={(c) => {
            setCode(c);
            setError(null);
          }}
          onComplete={(c) => void verify(c)}
        />
        <ErrorText message={error} />
        {note ? <Notice tone="success" text={note} live /> : null}
        <Button label="Verify email" onPress={() => verify()} loading={busy} disabled={code.length !== 6} />
        <TextLink
          label={sending ? 'Sending…' : wait > 0 ? `Send a new code in ${wait}s` : 'Send a new code'}
          onPress={resend}
          disabled={wait > 0 || sending}
          align="center"
        />
      </AuthCard>

      <FinePrint>
        Can&apos;t find it? Look in Spam or Promotions. The code works for 10 minutes. Typed the wrong email? Log out, then create your account again.
      </FinePrint>
    </AuthScreen>
  );
}
