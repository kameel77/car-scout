import React from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
} from '@/components/ui/pagination';
import { cn } from '@/lib/utils';

interface ListingPaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

type PageElement = number | 'ellipsis';

const buildPages = (current: number, total: number): PageElement[] => {
  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }

  const pages: PageElement[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  if (start > 2) {
    pages.push('ellipsis');
  }

  for (let page = start; page <= end; page += 1) {
    pages.push(page);
  }

  if (end < total - 1) {
    pages.push('ellipsis');
  }

  pages.push(total);
  return pages;
};

export function ListingPagination({ page, totalPages, onPageChange }: ListingPaginationProps) {
  const { t } = useTranslation();
  const pages = React.useMemo(() => buildPages(page, totalPages), [page, totalPages]);
  const isFirstPage = page <= 1;
  const isLastPage = page >= totalPages;

  return (
    <Pagination className="justify-end">
      <PaginationContent>
        <PaginationItem>
          <PaginationLink
            href="#"
            size="default"
            className={cn('gap-1 pl-2.5', isFirstPage && 'pointer-events-none opacity-50')}
            aria-label={t('common.previous')}
            onClick={(event) => {
              event.preventDefault();
              if (!isFirstPage) {
                onPageChange(page - 1);
              }
            }}
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline">{t('common.previous')}</span>
          </PaginationLink>
        </PaginationItem>

        {pages.map((pageValue, index) => (
          <PaginationItem key={`${pageValue}-${index}`}>
            {pageValue === 'ellipsis' ? (
              <PaginationEllipsis />
            ) : (
              <PaginationLink
                href="#"
                isActive={pageValue === page}
                onClick={(event) => {
                  event.preventDefault();
                  onPageChange(pageValue);
                }}
              >
                {pageValue}
              </PaginationLink>
            )}
          </PaginationItem>
        ))}

        <PaginationItem>
          <PaginationLink
            href="#"
            size="default"
            className={cn('gap-1 pr-2.5', isLastPage && 'pointer-events-none opacity-50')}
            aria-label={t('common.next')}
            onClick={(event) => {
              event.preventDefault();
              if (!isLastPage) {
                onPageChange(page + 1);
              }
            }}
          >
            <span className="hidden sm:inline">{t('common.next')}</span>
            <ChevronRight className="h-4 w-4" />
          </PaginationLink>
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
