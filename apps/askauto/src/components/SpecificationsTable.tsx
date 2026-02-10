import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { translateTechnicalValue } from '@/utils/i18n-utils';

interface Specification {
  label: string;
  value: string;
}

interface SpecificationsTableProps {
  specifications: Specification[];
  initialVisibleCount?: number;
}

export function SpecificationsTable({
  specifications,
  initialVisibleCount = 6,
}: SpecificationsTableProps) {
  const { t } = useTranslation();
  const [showAll, setShowAll] = React.useState(false);

  const visibleSpecs = showAll
    ? specifications
    : specifications.slice(0, initialVisibleCount);

  const hasMore = specifications.length > initialVisibleCount;

  // Highlight important specs
  const importantLabels = ['VIN', 'Data pierwszej rejestracji', 'Numer rejestracyjny', 'First registration', 'Erstzulassung'];

  return (
    <div className="space-y-3">
      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableBody>
            {visibleSpecs.map((spec, index) => {
              const isImportant = importantLabels.some((l) =>
                spec.label.toLowerCase().includes(l.toLowerCase())
              );

              // Extract category from label if it follows 'specs.category' format
              const categoryMatch = spec.label.match(/^specs\.(\w+)/);
              const category = categoryMatch ? categoryMatch[1] : 'specs';
              const translatedValue = translateTechnicalValue(category, spec.value, t);

              return (
                <motion.tr
                  key={index}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2, delay: index * 0.03 }}
                  className={cn(
                    'border-b last:border-0',
                    isImportant && 'bg-primary/5'
                  )}
                >
                  <TableCell className="font-medium text-muted-foreground w-1/2 py-3">
                    {t(spec.label)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      'py-3',
                      isImportant && 'font-semibold text-foreground'
                    )}
                  >
                    {translatedValue}
                  </TableCell>
                </motion.tr>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {hasMore && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowAll(!showAll)}
          className="w-full gap-2"
        >
          {showAll ? (
            <>
              {t('common.showLess')}
              <ChevronUp className="h-4 w-4" />
            </>
          ) : (
            <>
              {t('common.showMore')} ({specifications.length - initialVisibleCount})
              <ChevronDown className="h-4 w-4" />
            </>
          )}
        </Button>
      )}
    </div>
  );
}
