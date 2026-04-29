import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { IdentificationSection } from './sections/IdentificationSection';
import { TechnicalSpecsSection } from './sections/TechnicalSpecsSection';
import { EquipmentSection } from './sections/EquipmentSection';
import { PricingSection } from './sections/PricingSection';
import { FlagsSection } from './sections/FlagsSection';
import { DescriptionSection } from './sections/DescriptionSection';
import { ImagesSection } from './sections/ImagesSection';
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
        productionYear: vehicle?.productionYear?.toString() || new Date().getFullYear().toString(),
        condition: vehicle?.condition || 'USED',
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
        catalogPrice: vehicle?.catalogPrice?.toString() || '',
        sellingPrice: vehicle?.sellingPrice?.toString() || '',
        mileageKm: vehicle?.mileageKm?.toString() || (vehicle?.condition === 'NEW' ? '0' : ''),
        firstRegistrationDate: vehicle?.firstRegistrationDate || '',
        registrationNumber: vehicle?.registrationNumber || '',
        isChineseBrand: vehicle?.isChineseBrand ?? false,
        isFeatured: vehicle?.isFeatured ?? false,
        financingPriceBase: vehicle?.financingPriceBase || 'BROKER_PRICE_PLN',
        additionalInfoHeader: vehicle?.additionalInfoHeader || '',
        additionalInfoContent: vehicle?.additionalInfoContent || '',
        equipmentAudioMultimedia: arrayToText(vehicle?.equipmentAudioMultimedia),
        equipmentSafety: arrayToText(vehicle?.equipmentSafety),
        equipmentComfortExtras: arrayToText(vehicle?.equipmentComfortExtras),
        equipmentOther: arrayToText(vehicle?.equipmentOther),
        providerId: defaultProvider,
    };
}

export function VehicleDataForm({ mode, vehicle, dealers, companies, isImported, onSave, onCancel, isSaving }: VehicleDataFormProps) {
    const [form, setForm] = useState<VehicleFormState>(() => buildInitialState(mode, vehicle));
    const [images, setImages] = useState<{ primaryImageUrl: string | null; imageUrls: string[] }>({
        primaryImageUrl: vehicle?.primaryImageUrl ?? null,
        imageUrls: vehicle?.imageUrls ?? [],
    });

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
        };

        if (mode === 'sale') {
            await onSave({
                ...basePayload,
                vin: form.vin || null,
                pricePln: form.pricePln ? parseInt(form.pricePln) : 0,
                mileageKm: form.mileageKm ? parseInt(form.mileageKm) : 0,
                firstRegistrationDate: form.firstRegistrationDate || null,
                registrationNumber: form.registrationNumber || null,
                condition: form.condition,
                financingPriceBase: form.financingPriceBase,
                isChineseBrand: form.isChineseBrand,
            });
        } else {
            let dealerId = null;
            let ownerRentalCompanyId = null;
            if (form.providerId.startsWith('dealer_')) dealerId = form.providerId.replace('dealer_', '');
            else if (form.providerId.startsWith('company_')) ownerRentalCompanyId = form.providerId.replace('company_', '');

            await onSave({
                ...basePayload,
                sellingPrice: form.sellingPrice ? parseInt(form.sellingPrice) : null,
                dealerId,
                ownerRentalCompanyId,
            });
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-8">
            <Section title="Identyfikacja">
                <IdentificationSection form={form} setField={setField} mode={mode} isImported={isImported} />
            </Section>
            <Section title="Parametry techniczne">
                <TechnicalSpecsSection form={form} setField={setField} mode={mode} isImported={isImported} />
            </Section>
            <Section title="Wyposażenie">
                <EquipmentSection form={form} setField={setField} mode={mode} isImported={isImported} />
            </Section>
            <Section title="Ceny i stan">
                <PricingSection form={form} setField={setField} mode={mode} isImported={isImported} />
            </Section>
            <Section title="Flagi">
                <FlagsSection form={form} setField={setField} mode={mode} />
            </Section>
            <Section title="Opis dodatkowy">
                <DescriptionSection form={form} setField={setField} mode={mode} />
            </Section>
            <Section title="Zdjęcia">
                <ImagesSection
                    mode={mode}
                    vehicleId={vehicle?.id}
                    primaryImageUrl={images.primaryImageUrl}
                    imageUrls={images.imageUrls}
                    onUpdated={setImages}
                />
            </Section>

            <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={onCancel}>Anuluj</Button>
                <Button type="submit" disabled={isSaving}>
                    {isSaving ? 'Zapisywanie...' : 'Zapisz'}
                </Button>
            </div>
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
