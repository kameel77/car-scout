import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Car, Clock, CreditCard, Image } from 'lucide-react';

interface InquiryChipsProps {
    onSelect: (message: string) => void;
    carName: string;
}

export function InquiryChips({ onSelect, carName }: InquiryChipsProps) {
    const { t } = useTranslation();

    const chips = [
        {
            id: 'availability',
            icon: Clock,
            label: 'lead.quickInquiry.availability',
            defaultLabel: 'Czy auto jest dostępne?',
            messageKey: 'lead.quickInquiry.message.availability',
            defaultMessage: `Dzień dobry, czy oferta na model ${carName} jest aktualna i czy auto jest dostępne od ręki?`,
        },
        {
            id: 'financing',
            icon: CreditCard,
            label: 'lead.quickInquiry.financing',
            defaultLabel: 'Ofertę finansowania',
            messageKey: 'lead.quickInquiry.message.financing',
            defaultMessage: `Interesuje mnie oferta leasingu lub najmu długoterminowego dla ${carName}. Proszę o przygotowanie symulacji.`,
        },
        {
            id: 'history',
            icon: Car,
            label: 'lead.quickInquiry.history',
            defaultLabel: 'Raport historii i VIN',
            messageKey: 'lead.quickInquiry.message.history',
            defaultMessage: `Poproszę o przesłanie numeru VIN oraz raportu historii pojazdu dla modelu ${carName}.`,
        },
        {
            id: 'expert',
            icon: Image,
            label: 'lead.quickInquiry.expert',
            defaultLabel: 'Kontakt z ekspertem',
            messageKey: 'lead.quickInquiry.message.expert',
            defaultMessage: `Chciałbym skonsultować specyfikację i warunki zakupu ${carName} z Państwa doradcą.`,
        },
    ];

    return (
        <div className="flex flex-wrap gap-2 mb-6">
            {chips.map((chip) => (
                <Button
                    key={chip.id}
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={() => onSelect(t(chip.messageKey, chip.defaultMessage))}
                    className="rounded-full gap-2 hover:bg-primary/5 hover:border-primary transition-all"
                >
                    <chip.icon className="h-3.5 w-3.5 text-primary" />
                    <span className="text-xs font-medium">{t(chip.label, chip.defaultLabel)}</span>
                </Button>
            ))}
        </div>
    );
}
