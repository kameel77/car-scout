import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Loader2, Building2 } from 'lucide-react';
import { employeeAdminApi } from '@/services/employee-admin.service';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  token: string;
  onSuccess: () => void;
}

export const CompanyCreateDialog: React.FC<Props> = ({ open, onOpenChange, token, onSuccess }) => {
  const [name, setName] = useState('');
  const [nip, setNip] = useState('');
  const [defaultDiscountPct, setDefaultDiscountPct] = useState<string>('5.0');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Nazwa firmy jest wymagana');
      return;
    }

    setIsSubmitting(true);
    try {
      const discountNum = defaultDiscountPct ? parseFloat(defaultDiscountPct) : null;
      await employeeAdminApi.createCompany(
        {
          name: trimmedName,
          nip: nip.trim() || null,
          defaultDiscountPct: discountNum && !isNaN(discountNum) ? discountNum : null,
          description: description.trim() || null
        },
        token
      );
      setName('');
      setNip('');
      setDescription('');
      onOpenChange(false);
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Wystąpił błąd podczas tworzenia firmy');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-600" />
              Nowa firma partnerska
            </DialogTitle>
            <DialogDescription>
              Utwórz organizację partnerską (np. Action) i automatycznie zainicjuj jej program samochodowy oraz pakiet benefitów powitalnych.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="my-3 p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">
              {error}
            </div>
          )}

          <div className="grid gap-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="company-name">Nazwa firmy *</Label>
              <Input
                id="company-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="np. Action S.A."
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="company-nip">NIP (opcjonalnie)</Label>
              <Input
                id="company-nip"
                value={nip}
                onChange={(e) => setNip(e.target.value)}
                placeholder="np. 5260001234"
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="company-discount">Domyślny rabat programu na flotę (%)</Label>
              <Input
                id="company-discount"
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={defaultDiscountPct}
                onChange={(e) => setDefaultDiscountPct(e.target.value)}
                placeholder="5.0"
                disabled={isSubmitting}
              />
              <p className="text-xs text-gray-500">
                Wszystkie nowe auta w programie otrzymają ten rabat referencyjny automatycznie.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="company-desc">Opis / Notatka programu</Label>
              <Textarea
                id="company-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="np. Program flotowy dla centrali i oddziałów w Polsce (ok. 700 uprawnionych pracowników)"
                rows={3}
                disabled={isSubmitting}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Anuluj
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white">
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Tworzenie...
                </>
              ) : (
                'Utwórz firmę i program'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
