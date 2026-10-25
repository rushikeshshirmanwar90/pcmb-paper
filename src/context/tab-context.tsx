import React, { createContext, useContext, useRef, useState, useCallback, type PropsWithChildren } from 'react';
import type { FilterState } from '@/types/pcmb';

export type TabName = 'home' | 'questions' | 'explore' | 'profile';

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

const TAB_NAME_MAP: Record<TabName, number> = {
  home: 0,
  questions: 1,
  explore: 2,
  profile: 3,
};

export function TabProvider({ children }: PropsWithChildren) {
  const [activeTab, setActiveTab] = useState(0);
  const [questionFilters, setQuestionFilters] = useState<FilterState>(DEFAULT_QUESTION_FILTERS);
  const [questionsMode, setQuestionsMode] = useState<QuestionsMode>('create');
  const [papersSegment, setPapersSegment] = useState<PapersSegment>('papers');
  const pagerRef = useRef<PagerController | null>(null);

  const goToTab = useCallback((tab: TabName | number, options?: { questionFilters?: Partial<FilterState> }) => {
    const targetIndex = typeof tab === 'number' ? tab : (TAB_NAME_MAP[tab] ?? 0);
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
  }, []);

  return (
    <TabContext.Provider
      value={{
        activeTab,
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
