import React from 'react';
import { Card, EmptyView, Screen } from '@/components/kit';
import { useSignedInUser } from '@/context/auth-context';

/** A greeting home for a role whose own screens are still to come. */
export function WelcomeScreen() {
  const user = useSignedInUser();
  return (
    <Screen title={`Hello, ${user.name.split(' ')[0]}`} subtitle={user.tuition.name || 'Welcome'}>
      <Card>
        <EmptyView
          icon={{ ios: 'sparkles', android: 'auto_awesome' }}
          title="You're logged in"
          text="Your screens are on their way in the next update of the app."
        />
      </Card>
    </Screen>
  );
}
