import type { ReactNode } from 'react';
import type { AndroidSymbol, SFSymbol } from 'expo-symbols';

/** What a tab's screen gets from the tab bar. */
export interface TabScreenProps {
  /** Web only: lets the Home screen open its menu on an edge swipe. */
  registerOpenMenu?: (openMenu: (() => void) | null) => void;
}

/** One tab of the bottom bar: its button and the screen it shows. */
export interface AppTab {
  key: string;
  label: string;
  icon: {
    sf: { default: SFSymbol; selected: SFSymbol };
    md: AndroidSymbol;
  };
  render: (props: TabScreenProps) => ReactNode;
}
