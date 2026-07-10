import React from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
} from '@/components/ui/pagination';
import { cn } from '@/lib/utils';
import { buildPages } from '@/utils/listingPagination';

interface ListingPaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  /** Buduje crawlowalny URL strony (np. ?page=2). Nawigacja i tak idzie przez onPageChange (SPA). */
  buildPageHref?: (page: number) => string;
}

export function ListingPagination({ page, totalPages, onPageChange, buildPageHref }: ListingPaginationProps) {
  const { t } = useTranslation();
  const pages = React.useMemo(() => buildPages(page, totalPages), [page, totalPages]);
  const isFirstPage = page <= 1;
  const isLastPage = page >= totalPages;
  const hrefFor = (target: number) => buildPageHref?.(target) ?? '#';

  return (
    <Pagination className="justify-center">
      <PaginationContent>
        {!isFirstPage && (
          <PaginationItem>
            <PaginationLink
              href={hrefFor(page - 1)}
              size="default"
              className="gap-1 pl-2.5"
              aria-label={t('common.previous')}
              onClick={(event) => {
                event.preventDefault();
                onPageChange(page - 1);
              }}
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline">{t('common.previous')}</span>
            </PaginationLink>
          </PaginationItem>
        )}

        {pages.map((pageValue) => (
          <PaginationItem key={pageValue}>
            <PaginationLink
              href={hrefFor(pageValue)}
              isActive={pageValue === page}
              className={cn(pageValue === page && 'bg-accent text-accent-foreground hover:bg-accent/90 border-transparent')}
              onClick={(event) => {
                event.preventDefault();
                onPageChange(pageValue);
              }}
            >
              {pageValue}
            </PaginationLink>
          </PaginationItem>
        ))}

        {!isLastPage && (
          <PaginationItem>
            <PaginationLink
              href={hrefFor(page + 1)}
              size="default"
              className="gap-1 pr-2.5"
              aria-label={t('common.next')}
              onClick={(event) => {
                event.preventDefault();
                onPageChange(page + 1);
              }}
            >
              <span className="hidden sm:inline">{t('common.next')}</span>
              <ChevronRight className="h-4 w-4" />
            </PaginationLink>
          </PaginationItem>
        )}
      </PaginationContent>
    </Pagination>
  );
}
