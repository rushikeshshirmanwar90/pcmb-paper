import React from 'react';
import type { Role } from '@/constants/school';
import type { AppTab } from '@/navigation/tabs';
import { QuestionsScreen } from '@/app/questions';
import { AccountProfileScreen } from '@/screens/account-profile-screen';
import { WelcomeScreen } from '@/screens/welcome-screen';
import { TuitionHomeScreen } from '@/screens/tuition/tuition-home';
import { TuitionBatchesScreen } from '@/screens/tuition/tuition-batches';
import { TuitionTeachersScreen } from '@/screens/tuition/tuition-teachers';
import { TuitionStudentsScreen } from '@/screens/tuition/tuition-students';
import { TuitionProfileScreen } from '@/screens/tuition/tuition-profile';
import { TeacherHomeScreen } from '@/screens/teacher/teacher-home';
import { TeacherBatchesScreen } from '@/screens/teacher/teacher-batches';
import { TeacherTestsScreen } from '@/screens/teacher/teacher-tests';
import { TeacherProfileScreen } from '@/screens/teacher/teacher-profile';

// The bottom tabs each role sees after logging in.

const PROFILE_TAB: Omit<AppTab, 'render'> = {
  key: 'profile',
  label: 'Profile',
  icon: { sf: { default: 'person.crop.circle', selected: 'person.crop.circle.fill' }, md: 'account_circle' },
};

const HOME_ICON: AppTab['icon'] = { sf: { default: 'house', selected: 'house.fill' }, md: 'home' };

/**
 * Teacher login: their day, batches, the Test Room, and the question tools
 * (PDF papers, My PDFs, the question bank).
 */
const TEACHER_TABS: AppTab[] = [
  { key: 'home', label: 'Home', icon: HOME_ICON, render: () => <TeacherHomeScreen /> },
  {
    key: 'batches',
    label: 'Batches',
    icon: { sf: { default: 'square.grid.2x2', selected: 'square.grid.2x2.fill' }, md: 'grid_view' },
    render: () => <TeacherBatchesScreen />,
  },
  {
    key: 'tests',
    label: 'Tests',
    icon: { sf: { default: 'list.clipboard', selected: 'list.clipboard.fill' }, md: 'assignment' },
    render: () => <TeacherTestsScreen />,
  },
  {
    key: 'questions',
    label: 'Questions',
    icon: { sf: { default: 'questionmark.circle', selected: 'questionmark.circle.fill' }, md: 'quiz' },
    render: () => <QuestionsScreen />,
  },
  { ...PROFILE_TAB, render: () => <TeacherProfileScreen /> },
];

/** Tuition login: dashboard, then batches, teachers and students to manage. */
const TUITION_TABS: AppTab[] = [
  { key: 'home', label: 'Home', icon: HOME_ICON, render: () => <TuitionHomeScreen /> },
  {
    key: 'batches',
    label: 'Batches',
    icon: { sf: { default: 'square.grid.2x2', selected: 'square.grid.2x2.fill' }, md: 'grid_view' },
    render: () => <TuitionBatchesScreen />,
  },
  {
    key: 'teachers',
    label: 'Teachers',
    icon: { sf: { default: 'person.crop.rectangle.stack', selected: 'person.crop.rectangle.stack.fill' }, md: 'co_present' },
    render: () => <TuitionTeachersScreen />,
  },
  {
    key: 'students',
    label: 'Students',
    icon: { sf: { default: 'person.3', selected: 'person.3.fill' }, md: 'groups' },
    render: () => <TuitionStudentsScreen />,
  },
  { ...PROFILE_TAB, render: () => <TuitionProfileScreen /> },
];

const STUDENT_TABS: AppTab[] = [
  { key: 'home', label: 'Home', icon: HOME_ICON, render: () => <WelcomeScreen /> },
  { ...PROFILE_TAB, render: () => <AccountProfileScreen /> },
];

export function tabsFor(role: Role): AppTab[] {
  return role === 'tuition' ? TUITION_TABS : role === 'student' ? STUDENT_TABS : TEACHER_TABS;
}
