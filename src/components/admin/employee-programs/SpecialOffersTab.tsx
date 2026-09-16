import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Car, Plus, Trash2, Search, Sparkles, Fuel, Loader2, Check, Layers, Building2 } from 'lucide-react';
import {
  employeeAdminApi,
  EmployeeProgramOffer,
  AvailableListing,
  AvailableRentalAssignment,
  EmployeeBenefitPolicy
} from '@/services/employee-admin.service';

interface Props {
  programId: string;
  token: string;
}

export const SpecialOffersTab: React.FC<Props> = ({ programId, token }) => {
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [sourceType, setSourceType] = useState<'FINANCING' | 'RENTAL'>('FINANCING');
  const [listingSearch, setListingSearch] = useState('');
  const [selectedListing, setSelectedListing] = useState<AvailableListing | null>(null);
  const [rentalSearch, setRentalSearch] = useState('');
  const [selectedAssignment, setSelectedAssignment] = useState<AvailableRentalAssignment | null>(null);
  const [discountPct, setDiscountPct] = useState<string>('8.0');
  const [customPricePln, setCustomPricePln] = useState<string>('');
  const [selectedPolicyId, setSelectedPolicyId] = useState<string>('');
  const [isExcluded, setIsExcluded] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch offers in program
  const { data, isLoading, isError } = useQuery({
    queryKey: ['employee-offers', programId],
    queryFn: () => employeeAdminApi.listOffers(programId, { limit: 50 }, token)
  });

  // Fetch benefit policies for selector
  const { data: policiesData } = useQuery({
    queryKey: ['employee-policies', programId],
    queryFn: () => employeeAdminApi.listBenefitPolicies(programId, token)
  });

  // Fetch available listings for picker
  const { data: listingsData, isLoading: isListingsLoading, isError: isListingsError } = useQuery({
    queryKey: ['employee-available-listings', programId, listingSearch],
    queryFn: () => employeeAdminApi.listAvailableListings(programId, listingSearch, token),
    enabled: isAddOpen && sourceType === 'FINANCING'
  });

  // Fetch available rental assignments for picker
  const { data: rentalData, isLoading: isRentalLoading, isError: isRentalError } = useQuery({
    queryKey: ['employee-available-rental-assignments', programId, rentalSearch],
    queryFn: () => employeeAdminApi.listAvailableRentalAssignments(programId, rentalSearch, token),
    enabled: isAddOpen && sourceType === 'RENTAL'
  });

  const addOfferMutation = useMutation({
    mutationFn: (payload: {
      sourceType?: 'FINANCING' | 'RENTAL';
      listingId?: string | null;
      assignmentId?: string | null;
      customPricePln?: number | null;
      discountPct?: number | null;
      benefitPolicyId?: string | null;
      isExcluded?: boolean;
    }) => employeeAdminApi.createOffer(programId, payload, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-offers', programId] });
      queryClient.invalidateQueries({ queryKey: ['employee-available-listings', programId] });
      queryClient.invalidateQueries({ queryKey: ['employee-available-rental-assignments', programId] });
      queryClient.invalidateQueries({ queryKey: ['employee-companies'] });
      setIsAddOpen(false);
      setSelectedListing(null);
      setSelectedAssignment(null);
      setCustomPricePln('');
      setDiscountPct('8.0');
      setSelectedPolicyId('');
      setIsExcluded(false);
      setSourceType('FINANCING');
    },
    onError: (err: unknown) => {
      setError(err instanceof Error ? err.message : 'Błąd podczas przypisywania oferty');
    }
  });

  const deleteOfferMutation = useMutation({
    mutationFn: (offerId: string) => employeeAdminApi.deleteOffer(offerId, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-offers', programId] });
      queryClient.invalidateQueries({ queryKey: ['employee-available-listings', programId] });
      queryClient.invalidateQueries({ queryKey: ['employee-available-rental-assignments', programId] });
      queryClient.invalidateQueries({ queryKey: ['employee-companies'] });
    }
  });

  const handleSelectListing = (listing: AvailableListing) => {
    setSelectedListing(listing);
    // calculate default price with 8% discount
    const initialDiscount = parseFloat(discountPct) || 0;
    if (initialDiscount > 0) {
      const calculated = Math.round(listing.pricePln * (1 - initialDiscount / 100));
      setCustomPricePln(String(calculated));
    } else {
      setCustomPricePln(String(listing.pricePln));
    }
  };

  const handleDiscountChange = (val: string) => {
    setDiscountPct(val);
    const num = parseFloat(val);
    if (selectedListing && !isNaN(num) && num >= 0 && num <= 100) {
      const calculated = Math.round(selectedListing.pricePln * (1 - num / 100));
      setCustomPricePln(String(calculated));
    }
  };

  const handleCustomPriceChange = (val: string) => {
    setCustomPricePln(val);
    const priceNum = parseInt(val, 10);
    if (selectedListing && !isNaN(priceNum) && priceNum > 0 && selectedListing.pricePln > 0) {
      const diffPct = ((selectedListing.pricePln - priceNum) / selectedListing.pricePln) * 100;
      setDiscountPct(diffPct >= 0 ? diffPct.toFixed(1) : '0.0');
    }
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (sourceType === 'RENTAL') {
      if (!selectedAssignment) {
        setError('Wybierz pojazd z bazy najmu');
        return;
      }
      addOfferMutation.mutate({
        sourceType: 'RENTAL',
        assignmentId: selectedAssignment.id,
        isExcluded: true
      });
      return;
    }

    if (!selectedListing) {
      setError('Wybierz pojazd z listy');
      return;
    }

    const priceNum = customPricePln ? parseInt(customPricePln, 10) : null;
    const discNum = discountPct ? parseFloat(discountPct) : null;

    addOfferMutation.mutate({
      sourceType: 'FINANCING',
      listingId: selectedListing.id,
      customPricePln: isExcluded ? null : (priceNum && !isNaN(priceNum) ? priceNum : null),
      discountPct: isExcluded ? null : (discNum && !isNaN(discNum) ? discNum : null),
      benefitPolicyId: isExcluded ? null : (selectedPolicyId || null),
      isExcluded
    });
  };

  const offers = data?.offers || [];
  const policies = policiesData?.policies || [];
  const availableListings = listingsData?.listings || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-100 shadow-xs">
        <div>
          <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-600" />
            Oferty dedykowane i wyjątki
          </h3>
          <p className="text-sm text-gray-500 mt-0.5">
            Pojazdy z bazy Motolii i floty najmu z dedykowanymi rabatami, pakietami benefitów lub regułami wykluczeń.
          </p>
        </div>
        <Button onClick={() => setIsAddOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white shrink-0">
          <Plus className="w-4 h-4 mr-1.5" />
          Dodaj ofertę lub wykluczenie
        </Button>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-gray-500">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
          Ładowanie ofert...
        </div>
      ) : isError ? (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm">
          Wystąpił błąd podczas ładowania ofert specjalnych.
        </div>
      ) : offers.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-8 text-center">
          <Car className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <h4 className="text-sm font-medium text-gray-900">Brak ofert specjalnych w programie</h4>
          <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
            Wybierz samochody z bazy Motolii lub najmu, ustal dedykowany rabat lub zdefiniuj wykluczenia ze stoku.
          </p>
          <Button onClick={() => setIsAddOpen(true)} variant="outline" size="sm" className="mt-4">
            <Plus className="w-3.5 h-3.5 mr-1" />
            Dodaj pierwszą ofertę
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {offers.map((offer: EmployeeProgramOffer) => {
            const isRental = offer.sourceType === 'RENTAL';
            const l = offer.listing;
            const a = offer.assignment;
            const vehicle = isRental ? a?.vehicle : l;
            const vehicleTitle = `${vehicle?.make || ''} ${vehicle?.model || ''}`.trim() || 'Pojazd';
            const savingsPln = !isRental && l && offer.customPricePln ? l.pricePln - offer.customPricePln : null;

            return (
              <div
                key={offer.id}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between"
              >
                <div>
                  <div className="relative h-44 bg-gray-100 overflow-hidden">
                    {(() => {
                      const imgUrl = isRental
                        ? (a?.vehicle.primaryImageUrl || a?.vehicle.imageUrls?.[0])
                        : (l?.primaryImageUrl || (l?.imageUrls && l.imageUrls[0]));
                      return imgUrl ? (
                        <img
                          src={imgUrl}
                          alt={vehicleTitle}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          <Car className="w-12 h-12" />
                        </div>
                      );
                    })()}
                    <div className="absolute top-2.5 left-2.5 flex flex-col gap-1">
                      {isRental ? (
                        <Badge className="bg-indigo-600 text-white font-medium shadow-xs">
                          {offer.isExcluded ? 'Najem - Wykluczenie ze stoku' : 'Najem długoterminowy'}
                        </Badge>
                      ) : offer.isExcluded ? (
                        <Badge className="bg-red-600 text-white font-medium shadow-xs">
                          Wykluczenie ze stoku
                        </Badge>
                      ) : (
                        <Badge className="bg-emerald-600 text-white font-medium shadow-xs">
                          Rabat: {offer.discountPct ? `${offer.discountPct}%` : 'Dedykowany'}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="p-4 space-y-2.5">
                    <div>
                      <h4 className="font-semibold text-gray-900 text-base">
                        {vehicleTitle}
                      </h4>
                      <p className="text-xs text-gray-500 line-clamp-1">
                        {vehicle?.version || 'Wersja standardowa'}
                        {isRental && a?.rentalCompany?.name ? ` · Dostawca: ${a.rentalCompany.name}` : ''}
                      </p>
                    </div>

                    <div className="flex items-baseline justify-between border-t border-gray-100 pt-2.5">
                      {isRental ? (
                        <div>
                          <div className="text-xs text-gray-400">Katalog najmu</div>
                          <div className="text-sm font-semibold text-gray-900">
                            Stawki wg matrycy dostawcy
                          </div>
                        </div>
                      ) : (
                        <>
                          <div>
                            <div className="text-xs text-gray-400 line-through">
                              {l?.pricePln ? `${l.pricePln.toLocaleString('pl-PL')} zł` : 'Cena katalogowa'}
                            </div>
                            <div className="text-lg font-bold text-gray-900">
                              {offer.customPricePln
                                ? `${offer.customPricePln.toLocaleString('pl-PL')} zł`
                                : 'Według rabatu programu'}
                            </div>
                          </div>
                          {savingsPln && savingsPln > 0 && (
                            <div className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                              Taniej o {savingsPln.toLocaleString('pl-PL')} zł
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {!isRental && offer.benefitPolicy && (
                      <div className="flex items-center gap-1.5 p-2 bg-blue-50/70 rounded-lg text-xs text-blue-900 border border-blue-100">
                        <Fuel className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span className="font-medium line-clamp-1">{offer.benefitPolicy.name}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-3 border-t border-gray-100 bg-gray-50/50 flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 text-xs"
                    disabled={deleteOfferMutation.isPending}
                    onClick={() => {
                      if (window.confirm(`Wycofać ofertę ${vehicleTitle} z tego programu?`)) {
                        deleteOfferMutation.mutate(offer.id);
                      }
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" />
                    Wycofaj ofertę
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Dialog dodawania nowej oferty */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-[650px] max-h-[85vh] overflow-y-auto">
          <form onSubmit={handleAddSubmit}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Car className="w-5 h-5 text-blue-600" />
                Przypisz ofertę lub zdefiniuj wykluczenie
              </DialogTitle>
              <DialogDescription>
                Wybierz źródło pojazdu, ustal parametry rabatowe lub wyklucz konkretny model ze stoku programu.
              </DialogDescription>
            </DialogHeader>

            {error && (
              <div className="my-3 p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">
                {error}
              </div>
            )}

            <div className="space-y-4 py-4">
              {/* Przełącznik typu: Finansowanie vs Najem */}
              <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => { setSourceType('FINANCING'); setError(null); }}
                  className={`flex-1 py-1.5 px-3 text-xs font-medium rounded-md transition-colors ${
                    sourceType === 'FINANCING'
                      ? 'bg-white text-gray-900 shadow-xs'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  Zakup / Finansowanie ze stoku
                </button>
                <button
                  type="button"
                  onClick={() => { setSourceType('RENTAL'); setIsExcluded(true); setError(null); }}
                  className={`flex-1 py-1.5 px-3 text-xs font-medium rounded-md transition-colors ${
                    sourceType === 'RENTAL'
                      ? 'bg-white text-gray-900 shadow-xs'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  Najem długoterminowy (Wykluczenie)
                </button>
              </div>

              {sourceType === 'FINANCING' ? (
                <>
                  {/* Krok 1: Wyszukiwanie auta */}
                  <div className="space-y-2">
                    <Label>1. Wybierz pojazd z bazy Motolii</Label>
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                      <Input
                        value={listingSearch}
                        onChange={(e) => setListingSearch(e.target.value)}
                        placeholder="Wyszukaj po marce, modelu, wersji..."
                        className="pl-9"
                      />
                    </div>

                    <div className="border border-gray-200 rounded-lg max-h-48 overflow-y-auto divide-y divide-gray-100 bg-gray-50/50">
                      {isListingsLoading ? (
                        <div className="p-4 text-center text-xs text-gray-500">Wyszukiwanie pojazdów...</div>
                      ) : isListingsError ? (
                        <div className="p-4 text-center text-xs text-red-600">
                          Nie udało się pobrać listy pojazdów. Spróbuj ponownie.
                        </div>
                      ) : availableListings.length === 0 ? (
                        <div className="p-4 text-center text-xs text-gray-500">
                          Brak dostępnych pojazdów (lub wszystkie są już w programie).
                        </div>
                      ) : (
                        availableListings.map((l: AvailableListing) => {
                          const isSelected = selectedListing?.id === l.id;
                          return (
                            <div
                              key={l.id}
                              onClick={() => handleSelectListing(l)}
                              className={`p-2.5 flex items-center justify-between cursor-pointer hover:bg-blue-50/60 transition-colors ${
                                isSelected ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                              }`}
                            >
                              <div>
                                <div className="font-medium text-xs text-gray-900">
                                  {l.make} {l.model} {l.version}
                                </div>
                                <div className="text-[11px] text-gray-500">
                                  Rocznik: {l.productionYear} · Paliwo: {l.fuelType || 'b/d'}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-semibold text-xs text-gray-900">
                                  {l.pricePln.toLocaleString('pl-PL')} zł
                                </div>
                                {isSelected && (
                                  <span className="inline-flex items-center gap-0.5 text-[10px] text-blue-700 font-medium">
                                    <Check className="w-3 h-3" /> Wybrano
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Krok 2: Ustalenie ceny i rabatu lub wykluczenia */}
                  {selectedListing && (
                    <div className="space-y-3">
                      <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                        <label className="flex items-start gap-2.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isExcluded}
                            onChange={(e) => setIsExcluded(e.target.checked)}
                            className="mt-0.5 rounded border-gray-300 text-red-600 focus:ring-red-500"
                          />
                          <div className="text-xs">
                            <span className="font-semibold text-gray-900">
                              Wyklucz ten pojazd ze stoku programu pracowniczego
                            </span>
                            <p className="text-gray-500">
                              Pojazd nie pojawi się w katalogu pracownika, nawet jeśli pasuje do reguły zasięgu (condition = NEW).
                            </p>
                          </div>
                        </label>
                      </div>

                      {!isExcluded ? (
                        <>
                          <div className="p-3.5 bg-blue-50/50 rounded-xl border border-blue-100 space-y-3">
                            <div className="text-xs font-semibold text-blue-900 uppercase tracking-wide">
                              2. Dedykowana cena dla pracowników
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <Label htmlFor="offer-discount" className="text-xs">
                                  Rabat procentowy (%)
                                </Label>
                                <Input
                                  id="offer-discount"
                                  type="number"
                                  step="0.1"
                                  min="0"
                                  max="100"
                                  value={discountPct}
                                  onChange={(e) => handleDiscountChange(e.target.value)}
                                  placeholder="8.0"
                                />
                              </div>

                              <div className="space-y-1">
                                <Label htmlFor="offer-price" className="text-xs">
                                  Cena w programie (PLN brutto)
                                </Label>
                                <Input
                                  id="offer-price"
                                  type="number"
                                  value={customPricePln}
                                  onChange={(e) => handleCustomPriceChange(e.target.value)}
                                  placeholder="np. 99000"
                                />
                              </div>
                            </div>

                            <div className="text-[11px] text-gray-600 flex justify-between pt-1">
                              <span>Cena bazowa Motolii: {selectedListing.pricePln.toLocaleString('pl-PL')} zł</span>
                              {customPricePln && parseInt(customPricePln, 10) < selectedListing.pricePln && (
                                <span className="font-medium text-emerald-700">
                                  Oszczędność: {(selectedListing.pricePln - parseInt(customPricePln, 10)).toLocaleString('pl-PL')} zł
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Krok 3: Pakiet benefitów */}
                          <div className="space-y-1.5">
                            <Label htmlFor="offer-policy">3. Pakiet benefitów (opcjonalnie)</Label>
                            <select
                              id="offer-policy"
                              value={selectedPolicyId}
                              onChange={(e) => setSelectedPolicyId(e.target.value)}
                              className="w-full h-9 px-3 py-1 bg-white border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="">Brak dedykowanego pakietu benefitu</option>
                              {policies.map((p: EmployeeBenefitPolicy) => (
                                <option key={p.id} value={p.id}>
                                  {p.name} {p.moyaCardAmount ? `(Karta Moya: ${p.moyaCardAmount} zł)` : ''}
                                </option>
                              ))}
                            </select>
                          </div>
                        </>
                      ) : null}
                    </div>
                  )}
                </>
              ) : (
                /* RENTAL: Wyszukiwanie pojazdu z bazy najmu do wykluczenia */
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Wybierz pojazd z bazy najmu do wykluczenia</Label>
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                      <Input
                        value={rentalSearch}
                        onChange={(e) => setRentalSearch(e.target.value)}
                        placeholder="Wyszukaj po marce, modelu, wersji..."
                        className="pl-9"
                      />
                    </div>

                    <div className="border border-gray-200 rounded-lg max-h-48 overflow-y-auto divide-y divide-gray-100 bg-gray-50/50">
                      {isRentalLoading ? (
                        <div className="p-4 text-center text-xs text-gray-500">Wyszukiwanie pojazdów najmu...</div>
                      ) : isRentalError ? (
                        <div className="p-4 text-center text-xs text-red-600">
                          Nie udało się pobrać listy pojazdów najmu.
                        </div>
                      ) : (rentalData?.assignments || []).length === 0 ? (
                        <div className="p-4 text-center text-xs text-gray-500">
                          Brak dostępnych pojazdów najmu (lub wszystkie są już wykluczone).
                        </div>
                      ) : (
                        (rentalData?.assignments || []).map((a: AvailableRentalAssignment) => {
                          const isSelected = selectedAssignment?.id === a.id;
                          return (
                            <div
                              key={a.id}
                              onClick={() => setSelectedAssignment(a)}
                              className={`p-2.5 flex items-center justify-between cursor-pointer hover:bg-indigo-50/60 transition-colors ${
                                isSelected ? 'bg-indigo-50 border-l-4 border-indigo-600' : ''
                              }`}
                            >
                              <div>
                                <div className="font-medium text-xs text-gray-900">
                                  {a.vehicle.make} {a.vehicle.model} {a.vehicle.version}
                                </div>
                                <div className="text-[11px] text-gray-500">
                                  Dostawca: {a.rentalCompany.name} · Rocznik: {a.vehicle.productionYear} · Paliwo: {a.vehicle.fuelType || 'b/d'}
                                </div>
                              </div>
                              {isSelected && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] text-indigo-700 font-medium">
                                  <Check className="w-3 h-3" /> Wybrano
                                </span>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {selectedAssignment && (
                    <div className="p-3 bg-red-50 rounded-xl border border-red-200 text-xs text-red-800 space-y-1">
                      <div className="font-semibold flex items-center gap-1.5">
                        <Building2 className="w-4 h-4" />
                        Wykluczenie z katalogu najmu:
                      </div>
                      <p>
                        Pojazd {selectedAssignment.vehicle.make} {selectedAssignment.vehicle.model} (Dostawca: {selectedAssignment.rentalCompany.name}) zostanie wykluczony i nie będzie wyświetlany dla pracowników tego programu w zakładce Najem.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>
                Anuluj
              </Button>
              <Button
                type="submit"
                disabled={
                  (sourceType === 'RENTAL' ? !selectedAssignment : !selectedListing) ||
                  addOfferMutation.isPending
                }
                className={`${
                  sourceType === 'RENTAL'
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {addOfferMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Zapisywanie...
                  </>
                ) : sourceType === 'RENTAL' ? (
                  'Wyklucz pojazd z najmu'
                ) : (
                  'Zapisz ofertę w programie'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
