import React from 'react';
import { Phone, Mail, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAppSettings } from '@/hooks/useAppSettings';
import { useTrackedUrl } from '@/hooks/useTrackedUrl';

export function B2BCtaSection() {
  const { data: settings } = useAppSettings();
  const phone = settings?.legalContactPhone;
  const email = settings?.legalContactEmail;
  const homeHref = useTrackedUrl('/');

  return (
    <section className="rounded-xl bg-muted p-6 md:p-8 mb-8 print:p-3 print:mb-0 print:rounded-md">
      <h2 className="text-2xl font-bold mb-2 print:text-base print:mb-1">Skontaktuj się z naszym zespołem</h2>
      <p className="text-muted-foreground mb-4 print:text-xs print:mb-2">
        Doradzimy w wyborze pojazdu i finansowaniu — także po szkodzie całkowitej.
      </p>
      <div className="flex flex-col md:flex-row gap-4 mb-4 print:flex-row print:gap-3 print:mb-2">
        {phone && (
          <a href={`tel:${phone}`} className="inline-flex items-center gap-2 text-base font-medium hover:text-primary print:text-xs">
            <Phone className="h-4 w-4 print:h-3 print:w-3" />
            {phone}
          </a>
        )}
        {email && (
          <a href={`mailto:${email}`} className="inline-flex items-center gap-2 text-base font-medium hover:text-primary print:text-xs">
            <Mail className="h-4 w-4 print:h-3 print:w-3" />
            {email}
          </a>
        )}
      </div>
      <Link
        to={homeHref}
        className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline print:text-xs"
      >
        Więcej o Carsalon <ExternalLink className="h-3.5 w-3.5 print:h-3 print:w-3" />
      </Link>
    </section>
  );
}
