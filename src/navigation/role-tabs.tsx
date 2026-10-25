import React from 'react';
import type { Role } from '@/constants/school';
import type { AppTab } from '@/navigation/tabs';
import { HomeScreen } from '@/app/index';
import { QuestionsScreen } from '@/app/questions';
import { ExploreScreen } from '@/app/explore';
import { ProfileScreen } from '@/app/profile';
import { AccountProfileScreen } from '@/screens/account-profile-screen';
import { WelcomeScreen } from '@/screens/welcome-screen';

// The bottom tabs each role sees after logging in.

const PROFILE_TAB: Omit<AppTab, 'render'> = {
  key: 'profile',
  label: 'Profile',
  icon: { sf: { default: 'person.crop.circle', selected: 'person.crop.circle.fill' }, md: 'account_circle' },
};

const HOME_ICON: AppTab['icon'] = { sf: { default: 'house', selected: 'house.fill' }, md: 'home' };

/** The question tools the app started as: rooms, PDFs, the question bank and papers. */
const TEACHER_TABS: AppTab[] = [
  { key: 'home', label: 'Home', icon: HOME_ICON, render: (props) => <HomeScreen {...props} /> },
  {
    key: 'questions',
    label: 'Questions',
    icon: { sf: { default: 'questionmark.circle', selected: 'questionmark.circle.fill' }, md: 'quiz' },
    render: () => <QuestionsScreen />,
  },
  {
    key: 'explore',
    label: 'Papers',
    icon: { sf: { default: 'doc.text', selected: 'doc.text.fill' }, md: 'description' },
    render: () => <ExploreScreen />,
  },
  { ...PROFILE_TAB, render: () => <ProfileScreen /> },
];

const TUITION_TABS: AppTab[] = [
  { key: 'home', label: 'Home', icon: HOME_ICON, render: () => <WelcomeScreen /> },
  { ...PROFILE_TAB, render: () => <AccountProfileScreen /> },
];

const STUDENT_TABS: AppTab[] = [
  { key: 'home', label: 'Home', icon: HOME_ICON, render: () => <WelcomeScreen /> },
  { ...PROFILE_TAB, render: () => <AccountProfileScreen /> },
];

export function tabsFor(role: Role): AppTab[] {
  return role === 'tuition' ? TUITION_TABS : role === 'student' ? STUDENT_TABS : TEACHER_TABS;
}
