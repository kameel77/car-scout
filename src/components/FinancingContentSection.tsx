import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { MarkdownText } from '@/components/MarkdownText';
import { faqApi } from '@/services/api';
import { Button } from '@/components/ui/button';
import { splitLeadParagraph } from '@/components/financing/splitLeadParagraph';
import {
  type FinancingContentType,
  useFinancingArticle,
} from '@/components/financing/useFinancingArticle';

// Preserve the historical module exports for existing callers while SearchPage imports
// the light modules directly and can defer this below-the-fold renderer.
export { splitLeadParagraph } from '@/components/financing/splitLeadParagraph';
export { type FinancingContentType, useFinancingArticle } from '@/components/financing/useFinancingArticle';

/**
 * Sekcja treści filarowej + FAQ pod listingiem na stronach kategorii finansowania
 * (/leasing, /kredyt, /wynajem-dlugoterminowy). Treść artykułu pochodzi z backendu
 * (jedno źródło dla SSR i UI), FAQ z CMS (page=financing + financingType).
 * hideTitle: gdy strona już wyrenderowała H1 + lead z tego samego artykułu wyżej
 * (trasy filarowe w SearchPage) — pomijamy nagłówek i pierwszy akapit, żeby ich nie zdublować.
 */
export function FinancingContentSection({ type, hideTitle }: { type: FinancingContentType; hideTitle?: boolean }) {
  const [expanded, setExpanded] = React.useState(false);

  const { data: article } = useFinancingArticle(type);

  const { data: faqData } = useQuery({
    queryKey: ['financing-faq', type],
    queryFn: () => faqApi.list({ page: 'financing', financingType: type }),
    staleTime: 60 * 60 * 1000,
  });

  const faqEntries = (faqData?.entries ?? []).filter((e) => e.isPublished !== false);

  if (!article && faqEntries.length === 0) return null;

  const displayHtml = article ? (hideTitle ? splitLeadParagraph(article.html).rest : article.html) : '';

  return (
    <div className="container mt-12 mb-8 space-y-10 max-w-3xl">
      {article && (
        <section>
          {!hideTitle && <h2 className="text-2xl font-bold mb-4">{article.h1}</h2>}
          <div className="relative">
            <div
              className={`text-sm leading-relaxed text-muted-foreground [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-foreground [&_h3]:mt-5 [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-foreground [&_p]:mb-3 [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1 [&_a]:text-primary [&_a]:underline [&_strong]:text-foreground [&_table]:mb-3 [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-border [&_th]:p-2 [&_th]:text-left [&_th]:font-semibold [&_th]:text-foreground [&_td]:border [&_td]:border-border [&_td]:p-2 ${expanded ? '' : 'max-h-[36rem] overflow-hidden'}`}
              dangerouslySetInnerHTML={{ __html: displayHtml }}
            />
            {!expanded && (
              <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background to-transparent" />
            )}
          </div>
          {!expanded && (
            <div className="mt-2 text-center">
              <Button variant="outline" onClick={() => setExpanded(true)}>
                Czytaj dalej
              </Button>
            </div>
          )}
        </section>
      )}

      {faqEntries.length > 0 && (
        <section>
          <h2 className="text-2xl font-bold mb-4">Najczęstsze pytania</h2>
          <Accordion type="single" collapsible className="w-full">
            {faqEntries.map((entry) => (
              <AccordionItem key={entry.id} value={entry.id}>
                <AccordionTrigger className="text-left">{entry.questionPl}</AccordionTrigger>
                <AccordionContent>
                  <MarkdownText text={entry.answerPl} />
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>
      )}
    </div>
  );
}
