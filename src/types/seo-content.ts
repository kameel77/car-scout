export interface SeoContentPage {
  id: string;
  urlPath: string;
  contentMd: string;
  metaTitle: string | null;
  metaDescription: string | null;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export type SeoContentPayload = {
  id?: string;
  urlPath: string;
  contentMd: string;
  metaTitle?: string | null;
  metaDescription?: string | null;
  isPublished?: boolean;
};

// Kształt publicznej odpowiedzi GET /api/seo-content?path=... (tylko opublikowane)
export interface PublicSeoContent {
  html: string;
  metaTitle: string | null;
  metaDescription: string | null;
}
