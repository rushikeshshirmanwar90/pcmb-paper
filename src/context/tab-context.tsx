import React, { createContext, useContext, useRef, useState, useCallback, type PropsWithChildren } from 'react';
import type { FilterState } from '@/types/pcmb';

/** A tab's key, e.g. 'home', 'questions', 'profile'. */
export type TabName = string;

export interface PagerController {
  setPage: (page: number) => void;
  setPageWithoutAnimation?: (page: number) => void;
}

export const DEFAULT_QUESTION_FILTERS: FilterState = {
  examCategory: 'All',
  standard: 'All',
  subject: 'All',
  chapter: 'All',
  topic: 'All',
  level: 'All',
  searchQuery: '',
};

/**
 * The Questions tab opens on the create-PDF form; browsing the whole bank and
 * My PDFs (every PDF made, saved on the device) are the alternatives.
 */
export type QuestionsMode = 'create' | 'browse' | 'pdfs';
export type PapersSegment = 'papers' | 'rooms';

interface TabContextValue {
  activeTab: number;
  /** The key of the tab on screen, e.g. 'questions'. */
  activeKey: string;
  setActiveTab: (index: number) => void;
  pagerRef: React.MutableRefObject<PagerController | null>;
  questionFilters: FilterState;
  setQuestionFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  questionsMode: QuestionsMode;
  setQuestionsMode: (mode: QuestionsMode) => void;
  papersSegment: PapersSegment;
  setPapersSegment: (segment: PapersSegment) => void;
  goToTab: (tab: TabName | number, options?: { questionFilters?: Partial<FilterState> }) => void;
}

const TabContext = createContext<TabContextValue | null>(null);

export function TabProvider({ children, tabKeys }: PropsWithChildren<{ /** The signed-in role's tabs, in order. */ tabKeys: string[] }>) {
  const [activeTab, setActiveTab] = useState(0);
  const [questionFilters, setQuestionFilters] = useState<FilterState>(DEFAULT_QUESTION_FILTERS);
  const [questionsMode, setQuestionsMode] = useState<QuestionsMode>('create');
  const [papersSegment, setPapersSegment] = useState<PapersSegment>('papers');
  const pagerRef = useRef<PagerController | null>(null);

  // As text, so a new array with the same tabs doesn't make a new goToTab.
  const keyList = tabKeys.join('|');
  const goToTab = useCallback((tab: TabName | number, options?: { questionFilters?: Partial<FilterState> }) => {
    const targetIndex = typeof tab === 'number' ? tab : Math.max(0, keyList.split('|').indexOf(tab));
    if (options?.questionFilters) {
      setQuestionFilters((prev) => ({
        ...prev,
        ...options.questionFilters,
      }));
      // Filters only mean something to the question list.
      setQuestionsMode('browse');
    }
    setActiveTab(targetIndex);
    if (pagerRef.current) {
      if (pagerRef.current.setPageWithoutAnimation) {
        pagerRef.current.setPageWithoutAnimation(targetIndex);
      } else {
        pagerRef.current.setPage(targetIndex);
      }
    }
  }, [keyList]);

  return (
    <TabContext.Provider
      value={{
        activeTab,
        activeKey: keyList.split('|')[activeTab] ?? '',
        setActiveTab,
        pagerRef,
        questionFilters,
        setQuestionFilters,
        questionsMode,
        setQuestionsMode,
        papersSegment,
        setPapersSegment,
        goToTab,
      }}>
      {children}
    </TabContext.Provider>
  );
}

export function useTabNavigation() {
  const ctx = useContext(TabContext);
  if (!ctx) {
    throw new Error('useTabNavigation must be used within a TabProvider');
  }
  return ctx;
}
