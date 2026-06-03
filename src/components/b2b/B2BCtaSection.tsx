import React from 'react';
import { Phone, Mail, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAppSettings } from '@/hooks/useAppSettings';
import { useTrackedUrl } from '@/hooks/useTrackedUrl';
import { formatPhoneForTelLink } from '@/utils/formatters';

export function B2BCtaSection() {
  const { data: settings } = useAppSettings();
  const phone = settings?.salesContactPhone || settings?.legalContactPhone;
  const email = settings?.legalContactEmail;
  const homeHref = useTrackedUrl('/');

  return (
    <section className="rounded-xl bg-muted p-6 md:p-8 mb-8 print:p-4 print:mb-0 print:rounded-md print:border print:border-gray-200">
      <h2 className="text-2xl font-bold mb-2 print:text-xl print:mb-2">Skontaktuj się z naszym zespołem</h2>
      <p className="text-muted-foreground mb-4 print:text-sm print:mb-3">
        Doradzimy w wyborze pojazdu i finansowaniu - także po szkodzie całkowitej.
      </p>
      <div className="flex flex-col md:flex-row gap-4 mb-4 print:flex-row print:gap-4 print:mb-3">
        {phone && (
          <a href={`tel:${formatPhoneForTelLink(phone)}`} className="inline-flex items-center gap-2 text-base font-medium hover:text-primary print:text-sm">
            <Phone className="h-4 w-4 print:h-4 print:w-4" />
            {phone}
          </a>
        )}
        {email && (
          <a href={`mailto:${email}`} className="inline-flex items-center gap-2 text-base font-medium hover:text-primary print:text-sm">
            <Mail className="h-4 w-4 print:h-4 print:w-4" />
            {email}
          </a>
        )}
      </div>
      <Link
        to={homeHref}
        className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline print:text-sm"
      >
        Więcej o Carsalon <ExternalLink className="h-3.5 w-3.5 print:h-3.5 print:w-3.5" />
      </Link>
    </section>
  );
}
