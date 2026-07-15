import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { IdentificationSection } from './sections/IdentificationSection';
import { TechnicalSpecsSection } from './sections/TechnicalSpecsSection';
import { EquipmentSection } from './sections/EquipmentSection';
import { PricingSection } from './sections/PricingSection';
import { FlagsSection } from './sections/FlagsSection';
import { DescriptionSection } from './sections/DescriptionSection';
import { ImagesSection } from './sections/ImagesSection';
import { SpecificationSection } from './sections/SpecificationSection';
import { ProviderSection } from './sections/ProviderSection';
import { FinancingAvailabilitySection } from './sections/FinancingAvailabilitySection';
import type { VehicleFormMode, VehicleFormState } from './types';

interface VehicleDataFormProps {
    mode: VehicleFormMode;
    vehicle?: any;
    dealers: Array<{ id: string; name: string; city?: string }>;
    companies?: Array<{ id: string; name: string }>;
    isImported?: boolean;
    onSave: (data: any) => Promise<void>;
    onCancel: () => void;
    isSaving: boolean;
    externalButtons?: boolean;
    formId?: string;
    serverErrors?: Record<string, string>;
}

const arrayToText = (arr?: string[] | null): string => (arr || []).join('\n');
const textToArray = (text: string): string[] =>
    text.split('\n').map(l => l.trim()).filter(Boolean);

function buildInitialState(mode: VehicleFormMode, vehicle?: any): VehicleFormState {
    const defaultProvider = vehicle?.dealerId
        ? `dealer_${vehicle.dealerId}`
        : vehicle?.ownerRentalCompanyId
        ? `company_${vehicle.ownerRentalCompanyId}`
        : '';
    return {
        make: vehicle?.make || '',
        model: vehicle?.model || '',
        version: vehicle?.version || '',
        vin: vehicle?.vin || '',
        specificationId: vehicle?.specificationId || undefined,
        primaryImageUrl: vehicle?.primaryImageUrl 
            ? vehicle.primaryImageUrl.startsWith('/uploads/')
                ? vehicle.primaryImageUrl.replace(/\.(jpg|jpeg|png)$/i, '.webp')
                : vehicle.primaryImageUrl
            : null,
        imageUrls: vehicle?.imageUrls && vehicle.imageUrls.length > 0
            ? vehicle.imageUrls.map((url: string) => url.startsWith('/uploads/') ? url.replace(/\.(jpg|jpeg|png)$/i, '.webp') : url)
            : [],
        specificationPdfUrl: vehicle?.specificationUrl ?? null,
        pendingImageFiles: [],
        pendingPdfFile: null,
        productionYear: vehicle?.productionYear?.toString() || new Date().getFullYear().toString(),
        condition: vehicle?.condition || (mode === 'rental' ? 'NEW' : 'USED'),
        bodyType: vehicle?.bodyType || '',
        fuelType: vehicle?.fuelType || '',
        transmission: vehicle?.transmission || '',
        enginePowerHp: vehicle?.enginePowerHp?.toString() || '',
        engineCapacityCm3: vehicle?.engineCapacityCm3?.toString() || '',
        drive: vehicle?.drive || '',
        doors: vehicle?.doors?.toString() || '',
        seats: vehicle?.seats?.toString() || '',
        color: vehicle?.color || '',
        paintType: vehicle?.paintType || '',
        pricePln: vehicle?.pricePln?.toString() || '',
        vatMargin: vehicle?.vatMargin ?? false,
        motoliaDiscountPln: vehicle?.motoliaDiscountPln?.toString() || '',
        displaySalePrice: vehicle?.displaySalePrice ?? false,
        catalogPrice: vehicle?.catalogPrice?.toString() || '',
        sellingPrice: vehicle?.sellingPrice?.toString() || '',
        mileageKm: vehicle?.mileageKm?.toString() || (vehicle?.condition === 'NEW' ? '0' : ''),
        firstRegistrationDate: vehicle?.firstRegistrationDate || '',
        registrationNumber: vehicle?.registrationNumber || '',
        isChineseBrand: vehicle?.isChineseBrand ?? false,
        isFeatured: vehicle?.isFeatured ?? false,
        isBusinessFeatured: vehicle?.isBusinessFeatured ?? false,
        showMotoliaDiscount: vehicle?.showMotoliaDiscount ?? false,
        financingPriceBase: vehicle?.financingPriceBase || 'BROKER_PRICE_PLN',
        additionalInfoHeader: vehicle?.additionalInfoHeader || '',
        additionalInfoContent: vehicle?.additionalInfoContent || '',
        equipmentAudioMultimedia: arrayToText(vehicle?.equipmentAudioMultimedia),
        equipmentSafety: arrayToText(vehicle?.equipmentSafety),
        equipmentComfortExtras: arrayToText(vehicle?.equipmentComfortExtras),
        equipmentOther: arrayToText(vehicle?.equipmentOther),
        providerId: defaultProvider,
        availableForPrivate: vehicle?.availableForPrivate ?? true,
        availableForCompany: vehicle?.availableForCompany ?? true,
        creditAvailable: vehicle?.creditAvailable ?? true,
        leasingAvailable: vehicle?.leasingAvailable ?? true,
        creditProductId: vehicle?.creditProductId || '',
        leasingProductId: vehicle?.leasingProductId || '',
        pricePrivateCreditPln: vehicle?.pricePrivateCreditPln?.toString() || '',
        pricePrivateLeasingPln: vehicle?.pricePrivateLeasingPln?.toString() || '',
        priceCompanyCreditPln: vehicle?.priceCompanyCreditPln?.toString() || '',
        priceCompanyLeasingPln: vehicle?.priceCompanyLeasingPln?.toString() || '',
    };
}

export function VehicleDataForm({ mode, vehicle, dealers, companies, isImported, onSave, onCancel, isSaving, externalButtons, formId, serverErrors }: VehicleDataFormProps) {
    const [form, setForm] = useState<VehicleFormState>(() => buildInitialState(mode, vehicle));

    const setField = (field: keyof VehicleFormState, value: any) => {
        setForm(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (mode === 'sale' && form.condition === 'NEW' && parseInt(form.mileageKm || '0') >= 100) {
            alert('Pojazd nowy nie może mieć przebiegu powyżej 100 km');
            return;
        }

        const basePayload: any = {
            make: form.make,
            model: form.model,
            version: form.version || null,
            specificationId: form.specificationId || null,
            bodyType: form.bodyType || null,
            fuelType: form.fuelType || null,
            transmission: form.transmission || null,
            enginePowerHp: form.enginePowerHp ? parseInt(form.enginePowerHp) : null,
            engineCapacityCm3: form.engineCapacityCm3 ? parseInt(form.engineCapacityCm3) : null,
            productionYear: parseInt(form.productionYear),
            color: form.color || null,
            paintType: form.paintType || null,
            doors: form.doors ? parseInt(form.doors) : null,
            seats: form.seats ? parseInt(form.seats) : null,
            drive: form.drive || null,
            catalogPrice: form.catalogPrice ? parseInt(form.catalogPrice) : null,
            additionalInfoHeader: form.additionalInfoHeader || null,
            additionalInfoContent: form.additionalInfoContent || null,
            isFeatured: form.isFeatured,
            equipmentAudioMultimedia: textToArray(form.equipmentAudioMultimedia),
            equipmentSafety: textToArray(form.equipmentSafety),
            equipmentComfortExtras: textToArray(form.equipmentComfortExtras),
            equipmentOther: textToArray(form.equipmentOther),
            primaryImageUrl: form.primaryImageUrl || null,
            imageUrls: form.imageUrls || [],
            specificationPdfUrl: form.specificationPdfUrl || null,
            pendingImageFiles: form.pendingImageFiles || [],
            pendingPdfFile: form.pendingPdfFile || null,
        };

        if (mode === 'sale') {
            const dealerId = form.providerId.startsWith('dealer_')
                ? form.providerId.replace('dealer_', '')
                : null;
            await onSave({
                ...basePayload,
                vin: form.vin || null,
                pricePln: form.pricePln ? parseInt(form.pricePln) : 0,
                vatMargin: form.vatMargin,
                motoliaDiscountPln: form.motoliaDiscountPln ? parseInt(form.motoliaDiscountPln) : null,
                showMotoliaDiscount: form.showMotoliaDiscount,
                displaySalePrice: form.displaySalePrice,
                mileageKm: form.mileageKm ? parseInt(form.mileageKm) : 0,
                firstRegistrationDate: form.firstRegistrationDate || null,
                registrationNumber: form.registrationNumber || null,
                condition: form.condition,
                financingPriceBase: form.financingPriceBase,
                isChineseBrand: form.isChineseBrand,
                isBusinessFeatured: form.isBusinessFeatured,
                availableForPrivate: form.availableForPrivate,
                availableForCompany: form.availableForCompany,
                creditAvailable: form.creditAvailable,
                leasingAvailable: form.leasingAvailable,
                creditProductId: form.creditProductId || null,
                leasingProductId: form.leasingProductId || null,
                pricePrivateCreditPln: form.pricePrivateCreditPln ? parseInt(form.pricePrivateCreditPln) : null,
                pricePrivateLeasingPln: form.pricePrivateLeasingPln ? parseInt(form.pricePrivateLeasingPln) : null,
                priceCompanyCreditPln: form.priceCompanyCreditPln ? parseInt(form.priceCompanyCreditPln) : null,
                priceCompanyLeasingPln: form.priceCompanyLeasingPln ? parseInt(form.priceCompanyLeasingPln) : null,
                dealerId,
            });
        } else {
            let dealerId = null;
            let ownerRentalCompanyId = null;
            if (form.providerId.startsWith('dealer_')) dealerId = form.providerId.replace('dealer_', '');
            else if (form.providerId.startsWith('company_')) ownerRentalCompanyId = form.providerId.replace('company_', '');

            await onSave({
                ...basePayload,
                condition: form.condition,
                vin: form.vin || null,
                mileageKm: form.mileageKm ? parseInt(form.mileageKm) : null,
                firstRegistrationDate: form.firstRegistrationDate || null,
                registrationNumber: form.registrationNumber || null,
                sellingPrice: form.sellingPrice ? parseInt(form.sellingPrice) : null,
                dealerId,
                ownerRentalCompanyId,
            });
        }
    };

    return (
        <form id={formId} onSubmit={handleSubmit} className="space-y-8">
            <Section title="Identyfikacja">
                <IdentificationSection form={form} setField={setField} mode={mode} isImported={isImported} errors={serverErrors} />
            </Section>
            <Section title={mode === 'sale' ? 'Dealer' : 'Dostawca'}>
                <ProviderSection form={form} setField={setField} mode={mode} dealers={dealers} companies={companies} />
            </Section>
            <Section title="Parametry techniczne">
                <TechnicalSpecsSection form={form} setField={setField} mode={mode} isImported={isImported} />
            </Section>
            <Section title="Wyposażenie">
                <EquipmentSection form={form} setField={setField} mode={mode} isImported={isImported} />
            </Section>
            <Section title="Ceny i stan">
                <PricingSection form={form} setField={setField} mode={mode} isImported={isImported} errors={serverErrors} />
            </Section>
            <Section title="Flagi">
                <FlagsSection form={form} setField={setField} mode={mode} />
            </Section>
            {mode === 'sale' && (
                <Section title="Dostępność Finansowania">
                    <FinancingAvailabilitySection form={form} setField={setField} mode={mode} />
                </Section>
            )}
            <Section title="Opis dodatkowy">
                <DescriptionSection form={form} setField={setField} mode={mode} />
            </Section>
            <Section title="Zdjęcia">
                <ImagesSection
                    mode={mode}
                    vehicleId={vehicle?.id}
                    primaryImageUrl={form.primaryImageUrl}
                    imageUrls={form.imageUrls}
                    onUpdated={data => {
                        setField('primaryImageUrl', data.primaryImageUrl);
                        setField('imageUrls', data.imageUrls);
                    }}
                    pendingImageFiles={form.pendingImageFiles}
                    onUpdatePendingFiles={files => setField('pendingImageFiles', files)}
                />
            </Section>
            <Section title="Specyfikacja">
                <SpecificationSection
                    mode={mode}
                    vehicleId={vehicle?.id}
                    specificationUrl={form.specificationPdfUrl}
                    onUpdated={url => setField('specificationPdfUrl', url)}
                    pendingPdfFile={form.pendingPdfFile}
                    onUpdatePendingFile={file => setField('pendingPdfFile', file)}
                />
            </Section>

            {!externalButtons && (
                <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={onCancel}>Anuluj</Button>
                    <Button type="submit" disabled={isSaving}>
                        {isSaving ? 'Zapisywanie...' : 'Zapisz'}
                    </Button>
                </div>
            )}
        </form>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="bg-white rounded-lg border p-4">
            <h3 className="font-semibold text-gray-800 mb-4">{title}</h3>
            {children}
        </div>
    );
}
