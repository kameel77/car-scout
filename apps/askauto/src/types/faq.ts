export type FaqPage = 'home' | 'offers' | 'contact';

export interface FaqEntry {
  id: string;
  page: FaqPage;
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
