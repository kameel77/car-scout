export type FaqPage = 'home' | 'offers' | 'contact' | 'faq' | 'rental';
export type FaqPageContext = 'offers' | 'rental' | 'all';

export interface FaqEntry {
  id: string;
  page: FaqPage;
  pageContext: FaqPageContext;
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
  questionPl: string;
  answerPl: string;
  questionEn: string;
  answerEn: string;
  questionDe: string;
  answerDe: string;
};
