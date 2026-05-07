import React from 'react';
import { Download, Loader2 } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

export function DownloadPdfButton() {
  const [params] = useSearchParams();
  const [isLoading, setLoading] = React.useState(false);

  const handleClick = async () => {
    setLoading(true);
    const ids = params.get('ids');
    const qs = ids ? `?ids=${encodeURIComponent(ids)}` : '';
    const t = toast.loading('Generujemy PDF, chwila…');
    try {
      const res = await fetch(`/api/onepager/pdf${qs}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const cd = res.headers.get('content-disposition') || '';
      const match = cd.match(/filename="([^"]+)"/);
      a.download = match?.[1] ?? 'carsalon-oferta.pdf';
      a.click();
      URL.revokeObjectURL(url);
      toast.success('PDF pobrany', { id: t });
    } catch (err) {
      toast.error('Nie udało się wygenerować PDF', { id: t });
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className="no-print fixed bottom-6 right-6 inline-flex items-center gap-2 h-12 px-5 rounded-full bg-primary text-primary-foreground font-semibold shadow-lg hover:opacity-90 disabled:opacity-60"
    >
      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      Pobierz PDF
    </button>
  );
}
