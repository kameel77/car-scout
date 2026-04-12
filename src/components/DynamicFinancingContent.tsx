import React from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, PiggyBank, Wrench, ShieldCheck, Car, Calculator, User, Key, Banknote, Calendar, ClipboardCheck, TrendingUp, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { type FinancingType, getListingUrlPath } from '@/utils/url-utils';

export interface DynamicFinancingContentProps {
  financingType: FinancingType;
  listing: {
    listing_id: string;
    make: string;
    model: string;
    production_year: number;
    body_type?: string | null;
    fuel_type?: string | null;
    transmission?: string | null;
    engine_power_hp?: number | null;
  };
}

export const DynamicFinancingContent: React.FC<DynamicFinancingContentProps> = ({ financingType, listing }) => {
  const { t } = useTranslation();

  if (financingType === 'gotowka') {
    return null;
  }

  const { make, model, production_year: year, body_type, fuel_type, transmission, engine_power_hp } = listing;

  const carDetailsParts = [make, model, year, body_type, fuel_type].filter(Boolean);
  const carDetails = carDetailsParts.join(', ');
  const carName = `${make} ${model}`;
  
  const isElectric = fuel_type?.toLowerCase() === 'elektryczny';
  const isPHEV = fuel_type?.toLowerCase().includes('plug-in');
  const isSUV = body_type?.toLowerCase() === 'suv';
  const isVan = body_type?.toLowerCase() === 'van' || body_type?.toLowerCase() === 'minivan';
  const isKombi = body_type?.toLowerCase() === 'kombi';
  const isAuto = transmission?.toLowerCase() === 'automatyczna';
  const isHighPower = engine_power_hp ? engine_power_hp > 200 : false;

  const renderTextWithHtml = (text: string) => {
    // Replace **text** with <strong>text</strong>
    const htmlText = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    return <span dangerouslySetInnerHTML={{ __html: htmlText }} />;
  };

  const renderLeasing = () => (
    <div className="space-y-6">
      <div className="bg-muted/50 rounded-xl p-6 border border-border">
        <h2 className="font-heading text-xl font-bold mb-3">{t('financing.leasing.title', `Co obejmuje leasing operacyjny - ${carName} ${year}`)}</h2>
        <p className="text-muted-foreground leading-relaxed">
          {renderTextWithHtml(t('financing.leasing.lead', `Leasing operacyjny to najpopularniejsza forma finansowania samochodów wśród polskich przedsiębiorców. Miesięczna rata jest kosztem uzyskania przychodu, a VAT można odliczać na bieżąco - bez angażowania firmowej gotówki w zakup pojazdu. Poniżej znajdziesz szczegóły oferty leasingu na pojazd: **${carDetails}**.`))}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="flex gap-4">
          <div className="mt-1 bg-accent/10 p-2.5 rounded-lg h-fit text-accent">
            <Building2 className="w-5 h-5" />
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold text-foreground">{t('financing.leasing.who.title', 'Dla kogo jest leasing operacyjny?')}</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t('financing.leasing.who.desc', 'Leasing operacyjny jest przeznaczony dla firm i jednoosobowych działalności gospodarczych rozliczających VAT. Jeśli szukasz sposobu na optymalizację kosztów podatkowych i chcesz korzystać z nowego pojazdu bez angażowania kapitału - to rozwiązanie stworzone dla Ciebie. Osoby prywatne mogą skorzystać z leasingu konsumenckiego na analogicznych zasadach.')}
            </p>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="mt-1 bg-accent/10 p-2.5 rounded-lg h-fit text-accent">
            <PiggyBank className="w-5 h-5" />
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold text-foreground">{t('financing.leasing.tax.title', 'Korzyści podatkowe')}</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t('financing.leasing.tax.desc', 'Rata leasingowa w całości stanowi koszt uzyskania przychodu i obniża podstawę opodatkowania. Czynni podatnicy VAT odliczają 50% lub 100% podatku od rat i wydatków eksploatacyjnych - zależnie od sposobu użytkowania pojazdu.')}
            </p>
            {isElectric && (
              <p className="text-sm font-medium mt-2 text-foreground/90">
                {t('financing.leasing.tax.electric', `Pojazd elektryczny: ${carName} daje dostęp do dodatkowych ulg i możliwości pełnego odliczenia VAT bez limitu wartości pojazdu.`)}
              </p>
            )}
            {isPHEV && (
              <p className="text-sm font-medium mt-2 text-foreground/90">
                {t('financing.leasing.tax.phev', `Hybrydę plug-in: ${carName} można leasingować z odliczeniem VAT na preferencyjnych warunkach - sprawdź aktualne limity z doradcą.`)}
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-4">
          <div className="mt-1 bg-accent/10 p-2.5 rounded-lg h-fit text-accent">
            <Wrench className="w-5 h-5" />
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold text-foreground">{t('financing.leasing.service.title', 'Serwis i naprawy')}</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t('financing.leasing.service.desc', `Serwisowanie pojazdu: ${carName} w autoryzowanej sieci dealerskiej jest dostępne w pakiecie serwisowym doliczanym do raty.`)}
            </p>
            {isSUV && (
              <p className="text-sm font-medium mt-2 text-foreground/90">
                {t('financing.leasing.service.suv', 'SUV-y są intensywnie eksploatowane w terenie i na długich trasach - pakiet serwisowy gwarantuje pełną sprawność techniczną niezależnie od warunków użytkowania.')}
              </p>
            )}
            {isVan && (
              <p className="text-sm font-medium mt-2 text-foreground/90">
                {t('financing.leasing.service.van', 'Vany i samochody dostawcze wymagają częstszych przeglądów - pakiet serwisowy eliminuje ryzyko kosztownych przestojów w działalności.')}
              </p>
            )}
            <p className="text-sm text-muted-foreground leading-relaxed mt-2">
              {t('financing.leasing.service.summary', 'Regularne przeglądy i naprawy wliczone w ratę oznaczają zero niespodziewanych faktur i pełną przewidywalność kosztów użytkowania.')}
            </p>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="mt-1 bg-accent/10 p-2.5 rounded-lg h-fit text-accent">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold text-foreground">{t('financing.leasing.insurance.title', 'Ubezpieczenie')}</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t('financing.leasing.insurance.desc', `Do leasingu pojazdu: ${carName} możesz dołączyć ubezpieczenie OC/AC/GAP w stawkach wynegocjowanych przez firmę leasingową dla całej floty. Ubezpieczenie GAP zabezpiecza różnicę między wartością rynkową a kwotą pozostałą do rozliczenia w przypadku kradzieży lub szkody całkowitej. Składka wliczona w ratę stanowi koszt podatkowy - bez dodatkowych formalności.`)}
            </p>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="mt-1 bg-accent/10 p-2.5 rounded-lg h-fit text-accent">
            <Car className="w-5 h-5" />
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold text-foreground">{t('financing.leasing.replacement.title', 'Auto zastępcze')}</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t('financing.leasing.replacement.desc', `W trakcie serwisu lub naprawy pojazdu: ${carName} przysługuje Ci auto zastępcze bez dodatkowych kosztów. Assistance działa całą dobę przez 7 dni w tygodniu - w Polsce i w całej Europie.`)}
            </p>
            {isSUV && (
              <p className="text-sm font-medium mt-2 text-foreground/90">
                {t('financing.leasing.replacement.suv', 'Jeśli użytkujesz pojazd poza granicami lub w trudnym terenie, assistance 24/7 to szczególnie ważna ochrona.')}
              </p>
            )}
            <p className="text-sm text-muted-foreground leading-relaxed mt-2">
              {t('financing.leasing.replacement.summary', 'Dzięki temu Twoja firma zachowuje pełną mobilność operacyjną przez cały rok.')}
            </p>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="mt-1 bg-accent/10 p-2.5 rounded-lg h-fit text-accent">
            <Calculator className="w-5 h-5" />
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold text-foreground">{t('financing.leasing.transparency.title', 'Przejrzystość kosztów')}</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t('financing.leasing.transparency.desc', `Stała miesięczna rata leasingowa na pojazd: ${carName} jest niezmienna przez cały okres umowy - bez wahań kursu, ukrytych opłat i niespodzianek. Po zakończeniu umowy możesz wykupić pojazd za z góry ustaloną wartość rezydualną, przedłużyć leasing lub wymienić go na nowy model. Pełna kontrola nad budżetem firmowym od pierwszego do ostatniego dnia umowy.`)}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-8 p-4 bg-primary/5 rounded-xl border border-primary/20 flex flex-col sm:flex-row items-center gap-4">
        <div className="flex-1">
          <h4 className="font-semibold text-primary">{t('financing.leasing.crosslink.title', 'Szukasz pojazdu na własność?')}</h4>
          <p className="text-sm text-foreground/80 mt-1">
            {t('financing.leasing.crosslink.desc', 'Jeśli wolisz, aby auto było wpisane do dowodu jako Twoja własność od pierwszego dnia i nie zależy Ci na optymalizacji VAT, sprawdź ofertę kredytu.')}
          </p>
        </div>
        <Button asChild variant="outline" className="shrink-0 border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground">
          <Link to={getListingUrlPath({ ...listing, id: listing.listing_id, version: '' } as any, 'kredyt')}>
            {t('financing.leasing.crosslink.button', 'Zobacz ten model w kredycie')}
          </Link>
        </Button>
      </div>
    </div>
  );

  const renderKredyt = () => (
    <div className="space-y-6">
      <div className="bg-muted/50 rounded-xl p-6 border border-border">
        <h2 className="font-heading text-xl font-bold mb-3">{t('financing.kredyt.title', `Kredyt samochodowy - ${carName} ${year} Twoja własność od pierwszego dnia`)}</h2>
        <p className="text-muted-foreground leading-relaxed">
          {renderTextWithHtml(t('financing.kredyt.lead', `Kredyt samochodowy to rozwiązanie dla tych, którym zależy na pełnej własności pojazdu. Po podpisaniu umowy pojazd: **${carName}, ${year}, ${body_type || ''}** jest wpisany na Ciebie do dowodu rejestracyjnego - możesz nim dysponować bez żadnych ograniczeń. Kredyt jest dostępny zarówno dla osób prywatnych, jak i dla firm.`))}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="flex gap-4">
          <div className="mt-1 bg-accent/10 p-2.5 rounded-lg h-fit text-accent">
            <User className="w-5 h-5" />
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold text-foreground">{t('financing.kredyt.who.title', 'Dla kogo jest kredyt samochodowy?')}</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t('financing.kredyt.who.desc', 'Kredyt samochodowy jest skierowany do osób prywatnych i przedsiębiorców, dla których kluczowe jest posiadanie pojazdu na własność od pierwszego dnia użytkowania. To idealne rozwiązanie, jeśli planujesz długoterminowe użytkowanie pojazdu lub chcesz go swobodnie modyfikować i odsprzedać w dowolnym momencie. Wymaga pozytywnej historii kredytowej i udokumentowanego dochodu.')}
            </p>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="mt-1 bg-accent/10 p-2.5 rounded-lg h-fit text-accent">
            <Key className="w-5 h-5" />
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold text-foreground">{t('financing.kredyt.ownership.title', 'Własność i swoboda użytkowania')}</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t('financing.kredyt.ownership.desc', `Pojazd: ${carName} jest Twój od chwili zakupu - brak limitów kilometrów, brak opłat za użytkowanie ponad normę i brak konieczności zwrotu auta po zakończeniu umowy.`)}
            </p>
            {isSUV && (
              <p className="text-sm font-medium mt-2 text-foreground/90">
                {t('financing.kredyt.ownership.suv', 'SUV-y często służą do intensywnej eksploatacji, jazdy w terenie lub holowania przyczep - kredyt daje pełną swobodę bez ryzyka kar za zużycie.')}
              </p>
            )}
            {isKombi && (
              <p className="text-sm font-medium mt-2 text-foreground/90">
                {t('financing.kredyt.ownership.kombi', 'Kombi użytkowane jako auto rodzinne lub firmowe bywa bardzo intensywnie eksploatowane - przy kredycie nie ma żadnych ograniczeń w tym zakresie.')}
              </p>
            )}
            <p className="text-sm text-muted-foreground leading-relaxed mt-2">
              {t('financing.kredyt.ownership.summary', 'Możesz sprzedać pojazd, wynająć go lub przekazać komuś innemu w dowolnym momencie.')}
            </p>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="mt-1 bg-accent/10 p-2.5 rounded-lg h-fit text-accent">
            <Banknote className="w-5 h-5" />
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold text-foreground">{t('financing.kredyt.deposit.title', 'Wkład własny i dostępność')}</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t('financing.kredyt.deposit.desc', `Kredyt na pojazd: ${carName} jest dostępny z wkładem własnym lub bez - już od 0% wartości pojazdu. Wniesienie wkładu własnego obniża miesięczną ratę i łączny koszt finansowania. Decyzja kredytowa zapada zazwyczaj w ciągu jednego dnia roboczego - szybko i bez zbędnych formalności.`)}
            </p>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="mt-1 bg-accent/10 p-2.5 rounded-lg h-fit text-accent">
            <Calendar className="w-5 h-5" />
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold text-foreground">{t('financing.kredyt.period.title', 'Elastyczny okres spłaty')}</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t('financing.kredyt.period.desc', 'Sam decydujesz, jak długo chcesz spłacać kredyt - okresy kredytowania wynoszą zazwyczaj od 12 do 96 miesięcy. Krótszy okres oznacza wyższe raty, ale niższy łączny koszt odsetek; dłuższy obniża miesięczne zobowiązanie i poprawia płynność budżetu.')}
            </p>
            {isHighPower && (
              <p className="text-sm font-medium mt-2 text-foreground/90">
                {t('financing.kredyt.period.highpower', `Pojazdy o mocy powyżej 200 KM (w tym ${carName}) mogą podlegać wyższym wymaganiom banku co do wkładu własnego - warto zapytać doradcę.`)}
              </p>
            )}
            <p className="text-sm text-muted-foreground leading-relaxed mt-2">
              {t('financing.kredyt.period.summary', 'Wcześniejsza spłata jest możliwa w każdym momencie - często bez prowizji lub z minimalną opłatą.')}
            </p>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="mt-1 bg-accent/10 p-2.5 rounded-lg h-fit text-accent">
            <Shield className="w-5 h-5" />
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold text-foreground">{t('financing.kredyt.insurance.title', 'Ubezpieczenie i ochrona kredytu')}</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t('financing.kredyt.insurance.desc', `Bank może wymagać polisy AC przez cały okres kredytowania oraz cesji praw z ubezpieczenia na rzecz kredytodawcy. Ubezpieczenie GAP jest opcjonalne, ale szczególnie polecane przy nowych pojazdach - chroni przed stratą finansową w przypadku szkody całkowitej lub kradzieży pojazdu: ${carName}.`)}
            </p>
            {isElectric && (
              <p className="text-sm font-medium mt-2 text-foreground/90">
                {t('financing.kredyt.insurance.electric', `Elektryczny ${carName} ma wysoką wartość - GAP jest tu szczególnie ważny ze względu na dynamiczne zmiany wartości rynkowej aut elektrycznych.`)}
              </p>
            )}
            <p className="text-sm text-muted-foreground leading-relaxed mt-2">
              {t('financing.kredyt.insurance.summary', 'Wszystkie ubezpieczenia możesz spiąć razem z kredytem w jednym miejscu.')}
            </p>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="mt-1 bg-accent/10 p-2.5 rounded-lg h-fit text-accent">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold text-foreground">{t('financing.kredyt.history.title', 'Historia kredytowa i zdolność')}</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t('financing.kredyt.history.desc', `Terminowa spłata kredytu samochodowego pozytywnie wpływa na scoring w BIK i buduje Twoją wiarygodność jako kredytobiorcy. To ważne, jeśli w najbliższych latach planujesz kredyt hipoteczny lub inne większe zobowiązanie. Pojazd: ${carName} może być jednocześnie inwestycją w Twoją przyszłą zdolność kredytową.`)}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-8 p-4 bg-primary/5 rounded-xl border border-primary/20 flex flex-col sm:flex-row items-center gap-4">
        <div className="flex-1">
          <h4 className="font-semibold text-primary">{t('financing.kredyt.crosslink.title', 'Zoptymalizuj koszty w firmie')}</h4>
          <p className="text-sm text-foreground/80 mt-1">
            {t('financing.kredyt.crosslink.desc', 'Jeśli zależy Ci jednak na optymalizacji kosztów VAT dla Twojej firmy i wpisaniu raty w 100% w koszty uzyskania przychodu, lepszym wariantem na to auto będzie leasing.')}
          </p>
        </div>
        <Button asChild variant="outline" className="shrink-0 border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground">
          <Link to={getListingUrlPath({ ...listing, id: listing.listing_id, version: '' } as any, 'leasing')}>
            {t('financing.kredyt.crosslink.button', 'Sprawdź ten model w leasingu')}
          </Link>
        </Button>
      </div>
    </div>
  );

  const renderWynajem = () => (
    <div className="space-y-6">
      <div className="bg-muted/50 rounded-xl p-6 border border-border">
        <h2 className="font-heading text-xl font-bold mb-3">{t('financing.wynajem.title', `Wynajem długoterminowy - ${carName} ${year} w jednej miesięcznej racie`)}</h2>
        <p className="text-muted-foreground leading-relaxed">
          {renderTextWithHtml(t('financing.wynajem.lead', `Wynajem długoterminowy (najem długoterminowy, abonament samochodowy) to najprostszy sposób na korzystanie z nowego samochodu - bez wkładu własnego, bez martwienia się o serwis, ubezpieczenie i przeglądy. Płacisz jedną stałą ratę i po prostu jeździsz. Pojazd: **${carDetails}** czeka na Ciebie gotowy do drogi od pierwszego dnia.`))}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="flex gap-4">
          <div className="mt-1 bg-accent/10 p-2.5 rounded-lg h-fit text-accent">
            <User className="w-5 h-5" />
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold text-foreground">{t('financing.wynajem.who.title', 'Dla kogo jest wynajem długoterminowy?')}</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t('financing.wynajem.who.desc', 'Wynajem długoterminowy sprawdza się dla firm zarządzających flotą, jak i dla osób prywatnych ceniących wygodę i zero formalności. To idealne rozwiązanie, jeśli chcesz zawsze jeździć nowym pojazdem bez kłopotów ze sprzedażą używanego auta i bez angażowania gotówki.')}
            </p>
            {isVan && (
              <p className="text-sm font-medium mt-2 text-foreground/90">
                {t('financing.wynajem.who.van', 'Dla firm potrzebujących pojazdów dostawczych wynajem długoterminowy eliminuje ryzyko przestojów i kosztów serwisowych - wszystko jest wliczone w ratę.')}
              </p>
            )}
            <p className="text-sm text-muted-foreground leading-relaxed mt-2">
              {t('financing.wynajem.who.summary', 'Minimalne okresy wynajmu zaczynają się zazwyczaj od 12 miesięcy - z opcją przedłużenia lub wymiany na nowy model.')}
            </p>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="mt-1 bg-accent/10 p-2.5 rounded-lg h-fit text-accent">
            <ClipboardCheck className="w-5 h-5" />
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold text-foreground">{t('financing.wynajem.whatsincluded.title', 'Co zawiera miesięczna rata?')}</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t('financing.wynajem.whatsincluded.desc', `W racie wynajmu długoterminowego pojazdu: ${carName} standardowo mieści się: użytkowanie pojazdu, pełne ubezpieczenie OC/AC/GAP, serwis i przeglądy, wymiana opon sezonowych oraz assistance 24/7. Zakres pakietu możesz dopasować do swoich potrzeb i wybranego limitu kilometrów.`)}
            </p>
            {isElectric && (
              <p className="text-sm font-medium mt-2 text-foreground/90">
                {t('financing.wynajem.whatsincluded.electric', `Wynajem elektryczny ${carName} może obejmować dodatkowo dostęp do sieci ładowania lub instalację wallboxa - zapytaj doradcę o szczegóły.`)}
              </p>
            )}
            <p className="text-sm text-muted-foreground leading-relaxed mt-2">
              {t('financing.wynajem.whatsincluded.summary', 'Jeden przelew miesięcznie - i nie musisz myśleć o niczym innym.')}
            </p>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="mt-1 bg-accent/10 p-2.5 rounded-lg h-fit text-accent">
            <Wrench className="w-5 h-5" />
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold text-foreground">{t('financing.wynajem.service.title', 'Serwis i przeglądy - zero dopłat')}</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t('financing.wynajem.service.desc', `Wszystkie przeglądy okresowe, wymiana płynów i filtrów oraz naprawy wynikające z normalnej eksploatacji pojazdu: ${carName} są objęte umową wynajmu - bez dodatkowych faktur. Korzystasz z autoryzowanej sieci serwisowej, co gwarantuje oryginalne części i pełną historię serwisową pojazdu.`)}
            </p>
            {isAuto && (
              <p className="text-sm font-medium mt-2 text-foreground/90">
                {t('financing.wynajem.service.auto', 'Automatyczna skrzynia biegów wymaga specjalistycznych przeglądów - w wynajmie długoterminowym są one w pełni pokryte umową serwisową.')}
              </p>
            )}
            <p className="text-sm text-muted-foreground leading-relaxed mt-2">
              {t('financing.wynajem.service.summary', 'System powiadamia Cię z wyprzedzeniem o zbliżającym się terminie przeglądu - koniec z zapominaniem.')}
            </p>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="mt-1 bg-accent/10 p-2.5 rounded-lg h-fit text-accent">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold text-foreground">{t('financing.wynajem.insurance.title', 'Ubezpieczenie w cenie - OC, AC i GAP')}</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t('financing.wynajem.insurance.desc', `Pełne ubezpieczenie pojazdu: ${carName} jest standardową częścią raty wynajmu - nie szukasz ubezpieczyciela, nie porównujesz ofert i nie płacisz polisy z góry. Firma wynajmująca negocjuje stawki dla całej floty, dzięki czemu korzystasz z warunków niedostępnych dla klientów indywidualnych. W razie szkody całą procedurę obsługuje wynajmujący - od pierwszego telefonu do zamknięcia sprawy.`)}
            </p>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="mt-1 bg-accent/10 p-2.5 rounded-lg h-fit text-accent">
            <Car className="w-5 h-5" />
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold text-foreground">{t('financing.wynajem.replacement.title', 'Auto zastępcze - zawsze i bez opłat')}</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t('financing.wynajem.replacement.desc', `Podczas serwisu, naprawy lub wypadku pojazdu: ${carName} przysługuje Ci auto zastępcze bez dodatkowych kosztów i bez biurokracji. Assistance działa 24 godziny na dobę, 7 dni w tygodniu - na terenie całej Polski i Europy.`)}
            </p>
            {isSUV && (
              <p className="text-sm font-medium mt-2 text-foreground/90">
                {t('financing.wynajem.replacement.suv', 'Jeśli regularnie wyjeżdżasz poza miasto lub za granicę, całodobowe assistance przy wynajmie SUV-a to realna ochrona, a nie tylko zapis w umowie.')}
              </p>
            )}
            <p className="text-sm text-muted-foreground leading-relaxed mt-2">
              {t('financing.wynajem.replacement.summary', 'Nigdy nie zostajesz bez pojazdu - nawet przy poważniejszej awarii lub kolizji.')}
            </p>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="mt-1 bg-accent/10 p-2.5 rounded-lg h-fit text-accent">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold text-foreground">{t('financing.wynajem.transparency.title', 'Stała rata - pełna przewidywalność kosztów')}</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t('financing.wynajem.transparency.desc', `Rata wynajmu długoterminowego pojazdu: ${carName} jest ustalona z góry i nie zmienia się przez cały okres umowy - niezależnie od wahań cen ubezpieczeń, części i usług. Po zakończeniu umowy oddajesz auto i możesz od razu wziąć nowy model - bez straty na wartości, bez szukania kupca i bez żadnych formalności. To jedyny produkt finansowy, który daje Ci pełną i długoterminową przewidywalność kosztów mobilności.`)}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-8 p-4 bg-primary/5 rounded-xl border border-primary/20 flex flex-col sm:flex-row items-center gap-4">
        <div className="flex-1">
          <h4 className="font-semibold text-primary">{t('financing.wynajem.crosslink.title', 'Wolisz spłacać na własność?')}</h4>
          <p className="text-sm text-foreground/80 mt-1">
            {t('financing.wynajem.crosslink.desc', 'Jeśli zamiast modelu stałej "opłaty abonamentowej" wolisz sukcesywnie spłacać wartość kapitałową tego modelu by w przyszłości przejąć go na własność, najlepszym wariantem będzie standardowy leasing.')}
          </p>
        </div>
        <Button asChild variant="outline" className="shrink-0 border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground">
          <Link to={getListingUrlPath({ ...listing, id: listing.listing_id, version: '' } as any, 'leasing')}>
            {t('financing.wynajem.crosslink.button', 'Poznaj leasing tego pojazdu')}
          </Link>
        </Button>
      </div>
    </div>
  );

  return (
    <section className="mb-8 pt-8">
      {financingType === 'leasing' && renderLeasing()}
      {financingType === 'kredyt' && renderKredyt()}
      {financingType === 'wynajem' && renderWynajem()}
    </section>
  );
};
