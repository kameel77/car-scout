import React from 'react';
import { Phone, Mail, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAppSettings } from '@/hooks/useAppSettings';

export function B2BCtaSection() {
  const { data: settings } = useAppSettings();
  const phone = settings?.legalContactPhone;
  const email = settings?.legalContactEmail;

  return (
    <section className="rounded-xl bg-muted p-6 md:p-8 mb-8">
      <h2 className="text-2xl font-bold mb-2">Skontaktuj się z naszym zespołem</h2>
      <p className="text-muted-foreground mb-4">
        Doradzimy w wyborze pojazdu i finansowaniu — także po szkodzie całkowitej.
      </p>
      <div className="flex flex-col md:flex-row gap-4 mb-4">
        {phone && (
          <a href={`tel:${phone}`} className="inline-flex items-center gap-2 text-base font-medium hover:text-primary">
            <Phone className="h-4 w-4" />
            {phone}
          </a>
        )}
        {email && (
          <a href={`mailto:${email}`} className="inline-flex items-center gap-2 text-base font-medium hover:text-primary">
            <Mail className="h-4 w-4" />
            {email}
          </a>
        )}
      </div>
      <Link
        to="/"
        className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
      >
        Więcej o Carsalon <ExternalLink className="h-3.5 w-3.5" />
      </Link>
    </section>
  );
}
