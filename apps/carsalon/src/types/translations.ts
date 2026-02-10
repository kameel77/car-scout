export interface TranslationEntry {
  id: string;
  category: string;
  sourceValue: string;
  pl?: string | null;
  en?: string | null;
  de?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TranslationPayload {
  id?: string;
  category: string;
  sourceValue: string;
  pl?: string;
  en?: string;
  de?: string;
}
