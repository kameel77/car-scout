export type FaqPage = 'home' | 'offers' | 'contact' | 'faq' | 'rental' | 'financing' | 'business';
export type FaqPageContext = 'offers' | 'rental' | 'all';

export interface FaqEntry {
  id: string;
  page: FaqPage;
  pageContext: FaqPageContext;
  financingType?: string | null;
  sortOrder: number;
  questionPl: string;
  answerPl: string;
  questionEn: string;
  answerEn: string;
  questionDe: string;
  answerDe: string;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export type FaqPayload = Partial<FaqEntry> & {
  page: FaqPage;
  financingType?: string | null;
  questionPl: string;
  answerPl: string;
  questionEn: string;
  answerEn: string;
  questionDe: string;
  answerDe: string;
};
