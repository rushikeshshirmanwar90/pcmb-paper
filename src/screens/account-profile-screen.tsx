import React from 'react';
import { AccountSection } from '@/components/account-section';
import { Screen } from '@/components/kit';

/** A profile page with just the account: who's logged in, password, log out. */
export function AccountProfileScreen() {
  return (
    <Screen title="Profile" subtitle="Your account">
      <AccountSection />
    </Screen>
  );
}
