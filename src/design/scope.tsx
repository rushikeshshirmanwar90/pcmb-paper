import React, { createContext, useContext, type PropsWithChildren } from 'react';
import { useColorScheme } from '@/hooks/use-color-scheme';

// Which look a part of the app uses: the student login gets the neobrutalism
// look, teacher and tuition keep the classic one exactly. Set once at the root
// from the signed-in role; the kit reads it and renders one look or the other,
// so screens never fork per role.

export type Design = 'classic' | 'neo';

/**
 * Off until the student look is approved (Step 3 stops at the style preview).
 * While off, every role renders classic, pixel for pixel as before.
 */
export const STUDENT_LOOK_LIVE = false;

export const designForRole = (role?: string | null): Design => (STUDENT_LOOK_LIVE && role === 'student' ? 'neo' : 'classic');

type Scope = { design: Design; dark?: boolean };
const DesignContext = createContext<Scope>({ design: 'classic' });

/** `dark` forces light or dark inside (the style preview); otherwise the app's appearance setting applies. */
export function DesignProvider({ design, dark, children }: PropsWithChildren<{ design: Design; dark?: boolean }>) {
  return <DesignContext.Provider value={{ design, dark }}>{children}</DesignContext.Provider>;
}

export const useDesign = () => useContext(DesignContext).design;

/** Dark mode for this part of the tree. */
export function useIsDark() {
  const forced = useContext(DesignContext).dark;
  const scheme = useColorScheme();
  return forced ?? scheme === 'dark';
}
