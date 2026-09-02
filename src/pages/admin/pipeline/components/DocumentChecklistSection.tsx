import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  CheckCircle2,
  Clock,
  Send,
  ShieldCheck,
  Ban,
  RotateCcw,
} from 'lucide-react';
import { PipelineDocumentSummary, PipelineDocumentStatus } from '../types';
import { usePipelineMutations } from '../api/usePipeline';
import { useToast } from '@/hooks/use-toast';

export function DocumentChecklistSection({
  opportunityId,
  documents,
  onRefresh,
}: {
  opportunityId: string;
  documents: PipelineDocumentSummary[];
  onRefresh?: () => void;
}) {
  const { updateDocumentStatus, materializeDocuments } = usePipelineMutations();
  const { toast } = useToast();

  const handleStatusChange = async (
    documentId: string,
    status: PipelineDocumentStatus
  ) => {
    try {
      await updateDocumentStatus.mutateAsync({
        documentId,
        data: {
          status,
        },
      });

      toast({
        title: 'Zaktualizowano dokument',
        description: `Status zmieniony na: ${status}`,
      });
      onRefresh?.();
    } catch (err: unknown) {
      const e = err as Error;
      toast({
        title: 'Błąd aktualizacji',
        description: e.message,
        variant: 'destructive',
      });
    }
  };

  const handleRematerialize = async () => {
    try {
      await materializeDocuments.mutateAsync(opportunityId);
      toast({
        title: 'Zaktualizowano listę',
        description: 'Wymagania dokumentowe zostały przeliczone',
      });
      onRefresh?.();
    } catch (err: unknown) {
      const e = err as Error;
      toast({
        title: 'Błąd',
        description: e.message,
        variant: 'destructive',
      });
    }
  };

  const verifiedCount = documents.filter(
    (d) => d.status === 'VERIFIED' || d.status === 'WAIVED'
  ).length;
  const totalCount = documents.length;
  const progressPct = totalCount > 0 ? Math.round((verifiedCount / totalCount) * 100) : 100;

  const getDocBadge = (status: PipelineDocumentStatus) => {
    switch (status) {
      case 'REQUIRED':
        return (
          <Badge variant="outline" className="text-xs text-amber-600 border-amber-500/30">
            <Clock className="h-3 w-3 mr-1" /> Wymagany
          </Badge>
        );
      case 'REQUESTED':
        return (
          <Badge className="bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/30 text-xs">
            <Send className="h-3 w-3 mr-1" /> Poproszono
          </Badge>
        );
      case 'RECEIVED':
        return (
          <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-xs">
            <CheckCircle2 className="h-3 w-3 mr-1" /> Otrzymano
          </Badge>
        );
      case 'VERIFIED':
        return (
          <Badge className="bg-emerald-600 text-white hover:bg-emerald-700 text-xs">
            <ShieldCheck className="h-3 w-3 mr-1" /> Zweryfikowano
          </Badge>
        );
      case 'WAIVED':
        return (
          <Badge variant="secondary" className="text-xs text-muted-foreground">
            <Ban className="h-3 w-3 mr-1" /> Odstąpiono
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">Checklista dokumentów</h3>
            <Badge variant="outline" className="text-xs">
              {verifiedCount}/{totalCount} ({progressPct}%)
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Wymogi generowane automatycznie na podstawie typu klienta i finansującego.
          </p>
        </div>

        <Button
          size="sm"
          variant="ghost"
          onClick={handleRematerialize}
          disabled={materializeDocuments.isPending}
          className="h-8 text-xs gap-1 text-muted-foreground"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Odśwież wymogi
        </Button>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
        <div
          className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {documents.length === 0 ? (
        <div className="border border-dashed rounded-lg p-6 text-center text-muted-foreground space-y-2">
          <FileText className="h-8 w-8 mx-auto text-muted-foreground/50" />
          <p className="text-sm">Brak wymaganych dokumentów dla obecnej konfiguracji.</p>
          <Button size="sm" variant="outline" onClick={handleRematerialize}>
            Generuj checklistę
          </Button>
        </div>
      ) : (
        <div className="divide-y rounded-lg border bg-card">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="p-3 flex items-center justify-between gap-3 text-sm"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-md bg-muted text-muted-foreground">
                  <FileText className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{doc.label}</span>
                    {getDocBadge(doc.status)}
                  </div>
                  {doc.note && (
                    <span className="text-xs text-muted-foreground block mt-0.5">
                      {doc.note}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {doc.status === 'REQUIRED' && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => handleStatusChange(doc.id, 'REQUESTED')}
                  >
                    <Send className="h-3 w-3 mr-1 text-blue-500" />
                    Poproś
                  </Button>
                )}

                {(doc.status === 'REQUIRED' || doc.status === 'REQUESTED') && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => handleStatusChange(doc.id, 'RECEIVED')}
                  >
                    <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-500" />
                    Otrzymano
                  </Button>
                )}

                {doc.status === 'RECEIVED' && (
                  <Button
                    size="sm"
                    className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => handleStatusChange(doc.id, 'VERIFIED')}
                  >
                    <ShieldCheck className="h-3 w-3 mr-1" />
                    Zatwierdź
                  </Button>
                )}

                {doc.status !== 'WAIVED' && doc.status !== 'VERIFIED' && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => handleStatusChange(doc.id, 'WAIVED')}
                  >
                    Odstąp
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
