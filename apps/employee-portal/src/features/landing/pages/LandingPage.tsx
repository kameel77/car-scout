import React, { useState, useEffect } from 'react';
import '../landing.css';
import { LandingHeader } from '../components/LandingHeader';
import { HeroSection } from '../components/HeroSection';
import { StatsBand } from '../components/StatsBand';
import { OfferSection } from '../components/OfferSection';
import { BenefitsSection } from '../components/BenefitsSection';
import { StepsSection } from '../components/StepsSection';
import { SampleOffers } from '../components/SampleOffers';
import { EmployerTeaserSection } from '../components/EmployerTeaserSection';
import { FaqSection } from '../components/FaqSection';
import { LandingFooter } from '../components/LandingFooter';
import { EmployeeJourneyDialog } from '../dialogs/EmployeeJourneyDialog';
import { RentalDetailsDialog } from '../dialogs/RentalDetailsDialog';
import { LeasingDetailsDialog } from '../dialogs/LeasingDetailsDialog';
import { AboutDialog } from '../dialogs/AboutDialog';
import { trackEvent } from '../../analytics/analytics';
import { useBrandConfig } from '../../../config/BrandContext';

export const LandingPage: React.FC = () => {
  const { config } = useBrandConfig();
  const [employeeOpen, setEmployeeOpen] = useState(false);
  const [rentalOpen, setRentalOpen] = useState(false);
  const [leasingOpen, setLeasingOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

  useEffect(() => {
    trackEvent('page_view', { page: 'landing' }, config.apiUrl, config.analyticsEnabled);
  }, [config.apiUrl, config.analyticsEnabled]);

  return (
    <div className="benefivo-landing">
      <LandingHeader onOpenEmployeeDialog={() => setEmployeeOpen(true)} />

      <main id="main">
        <HeroSection onOpenEmployeeDialog={() => setEmployeeOpen(true)} />
        <StatsBand />
        <BenefitsSection />
        <OfferSection
          onOpenRental={() => setRentalOpen(true)}
          onOpenLeasing={() => setLeasingOpen(true)}
        />
        <SampleOffers onOpenEmployeeDialog={() => setEmployeeOpen(true)} />
        <StepsSection onOpenEmployeeDialog={() => setEmployeeOpen(true)} />
        <FaqSection />
        <EmployerTeaserSection />
      </main>

      <LandingFooter onOpenAbout={() => setAboutOpen(true)} />

      {/* Dialogs */}
      <EmployeeJourneyDialog
        isOpen={employeeOpen}
        onClose={() => setEmployeeOpen(false)}
      />
      <RentalDetailsDialog
        isOpen={rentalOpen}
        onClose={() => setRentalOpen(false)}
        onOpenEmployee={() => setEmployeeOpen(true)}
      />
      <LeasingDetailsDialog
        isOpen={leasingOpen}
        onClose={() => setLeasingOpen(false)}
        onOpenEmployee={() => setEmployeeOpen(true)}
      />
      <AboutDialog
        isOpen={aboutOpen}
        onClose={() => setAboutOpen(false)}
      />
    </div>
  );
};

export default LandingPage;
