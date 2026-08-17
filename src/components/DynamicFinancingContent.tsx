import React from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, PiggyBank, Wrench, ShieldCheck, Car, Calculator, User, Key, Banknote, Calendar, ClipboardCheck, TrendingUp, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { type FinancingType, getListingUrlPath } from '@/utils/url-utils';
import { useBrand } from '@/contexts/BrandContext';
import { MarkdownText } from '@/components/MarkdownText';

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
  const { config } = useBrand();
  const isCarsalon = config.id === 'carsalon';

  const getT = (key: string, defaultMotolia: string, defaultCarsalon: string) => {
    return isCarsalon ? t(`cs.${key}`, defaultCarsalon) : t(key, defaultMotolia);
  };

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

  const renderLeasing = () => (
    <div className="space-y-6">
      <div className="bg-muted/50 rounded-xl p-6 border border-border">
        <h2 className="font-heading text-xl font-bold mb-3">{getT('financing.leasing.title', `Co obejmuje leasing operacyjny - ${carName} ${year}`, `Leasing operacyjny w szczegółach - ${carName} ${year}`)}</h2>
        <p className="text-muted-foreground leading-relaxed">
          <MarkdownText text={getT('financing.leasing.lead', `Leasing operacyjny to najpopularniejsza forma finansowania samochodów wśród polskich przedsiębiorców. Miesięczna rata jest kosztem uzyskania przychodu, a VAT można odliczać na bieżąco - bez angażowania firmowej gotówki w zakup pojazdu. Poniżej znajdziesz szczegóły oferty leasingu na pojazd: **${carDetails}**.`, `Leasing operacyjny stanowi najchętniej wybierany model finansowania wśród przedsiębiorców w Polsce. Twoja comiesięczna rata staje się kosztem prowadzenia działalności, a podatek VAT odliczasz na bieżąco. Pozwala to na użytkowanie auta bez zamrażania kapitału firmowego. Poznaj warunki leasingowe dla auta: **${carDetails}**.`)} />
        </p>
        <p className="text-sm mt-3">
          <Link to="/leasing" className="text-primary underline hover:no-underline">
            Jak działa leasing samochodu - operacyjny i konsumencki, rata i wniosek
          </Link>
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="flex gap-4">
          <div className="mt-1 bg-accent/10 p-2.5 rounded-lg h-fit text-primary">
            <Building2 className="w-5 h-5" />
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-foreground">{getT('financing.leasing.who.title', 'Dla kogo jest leasing operacyjny?', 'Do kogo skierowany jest leasing operacyjny?')}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {getT('financing.leasing.who.desc', 'Leasing operacyjny jest przeznaczony dla firm i jednoosobowych działalności gospodarczych rozliczających VAT. Jeśli szukasz sposobu na optymalizację kosztów podatkowych i chcesz korzystać z nowego pojazdu bez angażowania kapitału - to rozwiązanie stworzone dla Ciebie. Osoby prywatne mogą skorzystać z leasingu konsumenckiego na analogicznych zasadach.', 'Z tej formy finansowania najczęściej korzystają firmy oraz jednoosobowe działalności (B2B) będące czynnymi płatnikami VAT. To doskonała opcja, by zoptymalizować księgowość i jeździć nowoczesnym autem bez konieczności jego natychmiastowego wykupu. Dla osób fizycznych dostępna jest identyczna w założeniach forma leasingu konsumenckiego.')}
            </p>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="mt-1 bg-accent/10 p-2.5 rounded-lg h-fit text-primary">
            <PiggyBank className="w-5 h-5" />
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-foreground">{getT('financing.leasing.tax.title', 'Korzyści podatkowe', 'Optymalizacja podatkowa')}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {getT('financing.leasing.tax.desc', 'Rata leasingowa w całości stanowi koszt uzyskania przychodu i obniża podstawę opodatkowania. Czynni podatnicy VAT odliczają 50% lub 100% podatku od rat i wydatków eksploatacyjnych - zależnie od sposobu użytkowania pojazdu.', 'Pełna kwota netto z faktury leasingowej wliczana jest w koszty firmy, zmniejszając należny podatek dochodowy. Podatnicy VAT mają również prawo do odliczenia 50% lub 100% podatku (w zależności od tego, jak wykorzystywane jest to konkretne auto).')}
            </p>
            {isElectric && (
              <p className="text-sm font-medium mt-2 text-foreground/90">
                {getT('financing.leasing.tax.electric', `Pojazd elektryczny: ${carName} daje dostęp do dodatkowych ulg i możliwości pełnego odliczenia VAT bez limitu wartości pojazdu.`, `Wybierając model w 100% elektryczny: ${carName}, zyskujesz dodatkowe przywileje podatkowe i szansę na pełne odliczenie VAT bez standardowych progów zaporowych.`)}
              </p>
            )}
            {isPHEV && (
              <p className="text-sm font-medium mt-2 text-foreground/90">
                {getT('financing.leasing.tax.phev', `Hybrydę plug-in: ${carName} można leasingować z odliczeniem VAT na preferencyjnych warunkach - sprawdź aktualne limity z doradcą.`, `Ten wariant hybrydy plug-in: ${carName} kwalifikuje się do odliczenia VAT na elastycznych, przyjaznych warunkach firmowych - zapytaj nas o aktualne przepisy.`)}
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-4">
          <div className="mt-1 bg-accent/10 p-2.5 rounded-lg h-fit text-primary">
            <Wrench className="w-5 h-5" />
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-foreground">{getT('financing.leasing.service.title', 'Serwis i naprawy', 'Opieka serwisowa i awarie')}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {getT('financing.leasing.service.desc', `Serwisowanie pojazdu: ${carName} w autoryzowanej sieci dealerskiej jest dostępne w pakiecie serwisowym doliczanym do raty.`, `Przeglądy i opieka ASO dla modelu: ${carName} mogą zostać w pełni ujęte w wygodnym pakiecie serwisowym, doliczanym wprost do Twojej raty.`)}
            </p>
            {isSUV && (
              <p className="text-sm font-medium mt-2 text-foreground/90">
                {getT('financing.leasing.service.suv', 'SUV-y są intensywnie eksploatowane w terenie i na długich trasach - pakiet serwisowy gwarantuje pełną sprawność techniczną niezależnie od warunków użytkowania.', 'Z uwagi na charakterystyczną trakcję i podwyższone warunki pracy SUV-ów, pakiet serwisowy zapewnia bezpieczeństwo na asfalcie oraz poza utartymi szlakami.')}
              </p>
            )}
            {isVan && (
              <p className="text-sm font-medium mt-2 text-foreground/90">
                {getT('financing.leasing.service.van', 'Vany i samochody dostawcze wymagają częstszych przeglądów - pakiet serwisowy eliminuje ryzyko kosztownych przestojów w działalności.', 'Flota uwarunkowana logistycznie (dostawcze) narzuca konieczność szybkiej interwencji. Posiadanie zakontraktowanego serwisu to gwarancja braku opóźnień operacyjnych.')}
              </p>
            )}
            <p className="text-sm text-muted-foreground leading-relaxed mt-2">
              {getT('financing.leasing.service.summary', 'Regularne przeglądy i naprawy wliczone w ratę oznaczają zero niespodziewanych faktur i pełną przewidywalność kosztów użytkowania.', 'Wszystkie rutynowe koszty warsztatowe zawarte "w racie" pozwalają z góry założyć stabilność Twojego rocznego budżetu flotowego.')}
            </p>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="mt-1 bg-accent/10 p-2.5 rounded-lg h-fit text-primary">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-foreground">{getT('financing.leasing.insurance.title', 'Ubezpieczenie', 'Pakiety ubezpieczeń')}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {getT('financing.leasing.insurance.desc', `Do leasingu pojazdu: ${carName} możesz dołączyć ubezpieczenie OC/AC/GAP w stawkach wynegocjowanych przez firmę leasingową dla całej floty. Ubezpieczenie GAP zabezpiecza różnicę między wartością rynkową a kwotą pozostałą do rozliczenia w przypadku kradzieży lub szkody całkowitej. Składka wliczona w ratę stanowi koszt podatkowy - bez dodatkowych formalności.`, `Formuła finansowania modelu: ${carName} zakłada możliwość dopięcia kompleksowych polis komunikacyjnych (OC/AC/NNW) i wartościowych ubezpieczeń (GAP wieloletni). Polisa GAP to tarcza przed gwałtownym spadkiem rynkowej wartości pojazdu. Raty ubezpieczeniowe rozkładać można wraz z czynszami poleasingowymi, powiększając przy tym tarczę podatkową Twojej działalności.`)}
            </p>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="mt-1 bg-accent/10 p-2.5 rounded-lg h-fit text-primary">
            <Car className="w-5 h-5" />
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-foreground">{getT('financing.leasing.replacement.title', 'Auto zastępcze', 'Samochód zastępczy')}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {getT('financing.leasing.replacement.desc', `W trakcie serwisu lub naprawy pojazdu: ${carName} przysługuje Ci auto zastępcze bez dodatkowych kosztów. Assistance działa całą dobę przez 7 dni w tygodniu - w Polsce i w całej Europie.`, `Podczas zaplanowanych akcji warsztatowych lub naprawy: ${carName}, masz zagwarantowany pojazd zastępczy dbający o ciągłość Twoich działań. Ekosystem wsparcia Assistance reaguje przez 24 godziny na dobę, w niemal każdym europejskim państwie.`)}
            </p>
            {isSUV && (
              <p className="text-sm font-medium mt-2 text-foreground/90">
                {getT('financing.leasing.replacement.suv', 'Jeśli użytkujesz pojazd poza granicami lub w trudnym terenie, assistance 24/7 to szczególnie ważna ochrona.', 'Charakter SUV-a sprawia, że często pokonujemy nim setki kilometrów trudniejszych turystycznie odcinków. Profesjonalny i szybki Assistance to podstawa poczucia bezpieczeństwa podróży.')}
              </p>
            )}
            <p className="text-sm text-muted-foreground leading-relaxed mt-2">
              {getT('financing.leasing.replacement.summary', 'Dzięki temu Twoja firma zachowuje pełną mobilność operacyjną przez cały rok.', 'Niezależnie od utrudnień na placu dealerskim, w Twojej firmie interes kręci się dalej.')}
            </p>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="mt-1 bg-accent/10 p-2.5 rounded-lg h-fit text-primary">
            <Calculator className="w-5 h-5" />
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-foreground">{getT('financing.leasing.transparency.title', 'Przejrzystość kosztów', 'Transparentna wycena miesięczna')}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {getT('financing.leasing.transparency.desc', `Stała miesięczna rata leasingowa na pojazd: ${carName} jest niezmienna przez cały okres umowy - bez wahań kursu, ukrytych opłat i niespodzianek. Po zakończeniu umowy możesz wykupić pojazd za z góry ustaloną wartość rezydualną, przedłużyć leasing lub wymienić go na nowy model. Pełna kontrola nad budżetem firmowym od pierwszego do ostatniego dnia umowy.`, `W umowie leasingowej widnieje twardo ustalony harmonogram dla modelu: ${carName}. Bez nagłych wahań kursów walut i skokowych prowizji. Po uregulowaniu wszystkich zdeklarowanych rat, będziesz mógł przejąć pojazd uiszczając symboliczną kwotę wykupu końcowego, spłacić tę wartość dłużej, lub po prostu zwrócić ten wóz dealerowi.`)}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-8 p-4 bg-primary/5 rounded-xl border border-primary/20 flex flex-col sm:flex-row items-center gap-4">
        <div className="flex-1">
          <h3 className="font-semibold text-primary">{getT('financing.leasing.crosslink.title', 'Szukasz pojazdu na własność?', 'Zależy Ci na pełnej własności od początku?')}</h3>
          <p className="text-sm text-foreground/80 mt-1">
            {getT('financing.leasing.crosslink.desc', 'Jeśli wolisz, aby auto było wpisane do dowodu jako Twoja własność od pierwszego dnia i nie zależy Ci na optymalizacji VAT, sprawdź ofertę kredytu.', 'Jeśli preferujesz natychmiastowe wpisanie nazwiska do dowodu rejestracyjnego i kwestie odliczeń podatku VAT nie są Twoim priorytetem, przyjrzyj się ofercie kredytowania zakupu detalicznego.')}
          </p>
        </div>
        <Button asChild variant="outline" className="shrink-0 border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground">
          <Link to={getListingUrlPath({ ...listing, id: listing.listing_id, version: '' } as any, 'kredyt')}>
            {getT('financing.leasing.crosslink.button', 'Zobacz ten model w kredycie', 'Przejdź do oferty kredytowej na ten pojazd')}
          </Link>
        </Button>
      </div>
    </div>
  );

  const renderKredyt = () => (
    <div className="space-y-6">
      <div className="bg-muted/50 rounded-xl p-6 border border-border">
        <h2 className="font-heading text-xl font-bold mb-3">{getT('financing.kredyt.title', `Kredyt samochodowy - ${carName} ${year} Twoja własność od pierwszego dnia`, `Finansowanie Kredytem Auto - ${carName} ${year} od razu w Twoich rękach`)}</h2>
        <p className="text-muted-foreground leading-relaxed">
          <MarkdownText text={getT('financing.kredyt.lead', `Kredyt samochodowy to rozwiązanie dla tych, którym zależy na pełnej własności pojazdu. Po podpisaniu umowy pojazd: **${carName}, ${year}, ${body_type || ''}** jest wpisany na Ciebie do dowodu rejestracyjnego - możesz nim dysponować bez żadnych ograniczeń. Kredyt jest dostępny zarówno dla osób prywatnych, jak i dla firm.`, `Kredyt celowy na pojazd sprawdzi się tam, gdzie najważniejsza jest prawna własność i rejestracja wehikułu pod strzechą zameldowania. Autonomiczny start sprawia, że **${carName}, z ${year} (${body_type || ''})** ląduje w Twoim garażu bez bankowych wymogów zdawczych. Rozwiązanie honorowane dla konsumentów NIP oraz regularnych umów o pracę.`)} />
        </p>
        <p className="text-sm mt-3">
          <Link to="/kredyt" className="text-primary underline hover:no-underline">
            Jak działa kredyt samochodowy - warunki, RRSO i wniosek o finansowanie
          </Link>
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="flex gap-4">
          <div className="mt-1 bg-accent/10 p-2.5 rounded-lg h-fit text-primary">
            <User className="w-5 h-5" />
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-foreground">{getT('financing.kredyt.who.title', 'Dla kogo jest kredyt samochodowy?', 'Odbiorcy Auto Kredytu')}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {getT('financing.kredyt.who.desc', 'Kredyt samochodowy jest skierowany do osób prywatnych i przedsiębiorców, dla których kluczowe jest posiadanie pojazdu na własność od pierwszego dnia użytkowania. To idealne rozwiązanie, jeśli planujesz długoterminowe użytkowanie pojazdu lub chcesz go swobodnie modyfikować i odsprzedać w dowolnym momencie. Wymaga pozytywnej historii kredytowej i udokumentowanego dochodu.', 'Z kredytu czerpią satysfakcję głównie Klienci Detaliczni pragnący wyłączności przy zarządzaniu nabytkiem. Auto możesz nieograniczenie serwisować, customizować i modernizować, by następnie spieniężyć według własnego harmonogramu. Wymagana jest pozytywna punktacja w bazach wymiany informacji (jak BIK) i płynność wpływów na rachunku.')}
            </p>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="mt-1 bg-accent/10 p-2.5 rounded-lg h-fit text-primary">
            <Key className="w-5 h-5" />
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-foreground">{getT('financing.kredyt.ownership.title', 'Własność i swoboda użytkowania', 'Brak limitów przebiegu i absolutna własność')}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {getT('financing.kredyt.ownership.desc', `Pojazd: ${carName} jest Twój od chwili zakupu - brak limitów kilometrów, brak opłat za użytkowanie ponad normę i brak konieczności zwrotu auta po zakończeniu umowy.`, `Egzemplarz ${carName} stanowi o Twoim mieniu zaraz po wizycie w urzędzie - zapomnij o limitach kilometrowych dla flot wynajmowanych, opłatach za ponadnormatywne zużycie opon czy zwrotach z lupą w dłoni na lotnisku.`)}
            </p>
            {isSUV && (
              <p className="text-sm font-medium mt-2 text-foreground/90">
                {getT('financing.kredyt.ownership.suv', 'SUV-y często służą do intensywnej eksploatacji, jazdy w terenie lub holowania przyczep - kredyt daje pełną swobodę bez ryzyka kar za zużycie.', 'Rodzina aut tylnonapędowych lub mocno dociskanych off-roadowo (SUV-y) lubi trudne warunki. Skredytowanie modelu daje wolność porysowania nadkoli na żwirze - to w końcu Twój prywatny wóz.')}
              </p>
            )}
            {isKombi && (
              <p className="text-sm font-medium mt-2 text-foreground/90">
                {getT('financing.kredyt.ownership.kombi', 'Kombi użytkowane jako auto rodzinne lub firmowe bywa bardzo intensywnie eksploatowane - przy kredycie nie ma żadnych ograniczeń w tym zakresie.', 'Dynamiczny samochód typu kombi wożący bagaże i psy nie musi martwić się karami za eksploatacyjne usterki tapicerki. Twój kredyt zapewnia święty spokój z ewentualnymi defektami na koniec')}
              </p>
            )}
            <p className="text-sm text-muted-foreground leading-relaxed mt-2">
              {getT('financing.kredyt.ownership.summary', 'Możesz sprzedać pojazd, wynająć go lub przekazać komuś innemu w dowolnym momencie.', 'Od pierwszych dni zyskujesz wolność odsprzedaży przedmiotu dalej bez pytania funduszu o koncesje, z minimalną formalnością przeniesienia opłat w banku.')}
            </p>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="mt-1 bg-accent/10 p-2.5 rounded-lg h-fit text-primary">
            <Banknote className="w-5 h-5" />
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-foreground">{getT('financing.kredyt.deposit.title', 'Wkład własny i dostępność', 'Zero PLN na wpłatę początkową? Możliwe!')}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {getT('financing.kredyt.deposit.desc', `Kredyt na pojazd: ${carName} jest dostępny z wkładem własnym lub bez - już od 0% wartości pojazdu. Wniesienie wkładu własnego obniża miesięczną ratę i łączny koszt finansowania. Decyzja kredytowa zapada zazwyczaj w ciągu jednego dnia roboczego - szybko i bez zbędnych formalności.`, `Uruchomienie kredytowania maszyny: ${carName} sprawnie domykasz bez oszczędności startowych, od pełnego finansowania 100% ceny brutto. Naturalnie wyłożenie na stół na pierwszą opłatę wyraźnie poduszkę spłaty ratalnej, chroniąc marże oddsetkowe. Procedury odbywają się w ciągu kilkudziesięciu godzin w standardzie fast-track.`)}
            </p>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="mt-1 bg-accent/10 p-2.5 rounded-lg h-fit text-primary">
            <Calendar className="w-5 h-5" />
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-foreground">{getT('financing.kredyt.period.title', 'Elastyczny okres spłaty', 'Kalendarz spłat dyktowany na Twoich warunkach')}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {getT('financing.kredyt.period.desc', 'Sam decydujesz, jak długo chcesz spłacać kredyt - okresy kredytowania wynoszą zazwyczaj od 12 do 96 miesięcy. Krótszy okres oznacza wyższe raty, ale niższy łączny koszt odsetek; dłuższy obniża miesięczne zobowiązanie i poprawia płynność budżetu.', 'Konfigurujesz pętle kredytowe na dekadę do 96 opłat kwitów harmonogramowych. Minimalizowanie długości rat to agresywna spłata kapitału bez nadpłat, za to naciągnięcie kredytu w latach odciąży bieżące ciśnienie Twojego budżetu osobistego/firmowego.')}
            </p>
            {isHighPower && (
              <p className="text-sm font-medium mt-2 text-foreground/90">
                {getT('financing.kredyt.period.highpower', `Pojazdy o mocy powyżej 200 KM (w tym ${carName}) mogą podlegać wyższym wymaganiom banku co do wkładu własnego - warto zapytać doradcę.`, `Sportowe maszyny mające więcej momentu na tylnej oście niż zazwyczaj (tutaj: ${carName}) bywają traktowane obostrzonym cenzorem banku odnośnie wkładu własnego - warto wyrobić się z opinią u doradcy u źródła.`)}
              </p>
            )}
            <p className="text-sm text-muted-foreground leading-relaxed mt-2">
              {getT('financing.kredyt.period.summary', 'Wcześniejsza spłata jest możliwa w każdym momencie - często bez prowizji lub z minimalną opłatą.', 'Wsparcie w niespodziewanym zasileniu salda nadpłacanego. Spłata całościowa rat odbywa się u elastycznych banków niemal bezbolesnie.')}
            </p>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="mt-1 bg-accent/10 p-2.5 rounded-lg h-fit text-primary">
            <Shield className="w-5 h-5" />
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-foreground">{getT('financing.kredyt.insurance.title', 'Ubezpieczenie i ochrona kredytu', 'Kompleksowe powłoki polis ubezpieczeniowych')}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {getT('financing.kredyt.insurance.desc', `Bank może wymagać polisy AC przez cały okres kredytowania oraz cesji praw z ubezpieczenia na rzecz kredytodawcy. Ubezpieczenie GAP jest opcjonalne, ale szczególnie polecane przy nowych pojazdach - chroni przed stratą finansową w przypadku szkody całkowitej lub kradzieży pojazdu: ${carName}.`, `W obligo wchodzi ubezpieczenie powiązane mocno z cesją Autocasco wędrującą bezpiecznie pod wekslami. Do opcjonalnej wtyczki GAP zachęcamy stanowczo każdego klienta świeżych aut: dba on by strata po katastrofie na Twojej wczoraj odpalonej: ${carName} wróciła do sakiewki we wczesnych nominałach fakturowych.`)}
            </p>
            {isElectric && (
              <p className="text-sm font-medium mt-2 text-foreground/90">
                {getT('financing.kredyt.insurance.electric', `Elektryczny ${carName} ma wysoką wartość - GAP jest tu szczególnie ważny ze względu na dynamiczne zmiany wartości rynkowej aut elektrycznych.`, `Specyfika obiegowych aut bateryjnych (jak: ${carName}) wiąże się w drastyczne wachlarze dewiacji cenowych wraz z eksploatacją. GAP to tarcza fundamentalnej bazy ochrony kapitału!`)}
              </p>
            )}
            <p className="text-sm text-muted-foreground leading-relaxed mt-2">
              {getT('financing.kredyt.insurance.summary', 'Wszystkie ubezpieczenia możesz spiąć razem z kredytem w jednym miejscu.', 'Bez wycieczek na miasto - łączymy parasole chroniące z samym fundamentem na auto, prosto do rozliczenia przy kasie.')}
            </p>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="mt-1 bg-accent/10 p-2.5 rounded-lg h-fit text-primary">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-foreground">{getT('financing.kredyt.history.title', 'Historia kredytowa i zdolność', 'Szybsze budowanie scoringów w BIK')}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {getT('financing.kredyt.history.desc', `Terminowa spłata kredytu samochodowego pozytywnie wpływa na scoring w BIK i buduje Twoją wiarygodność jako kredytobiorcy. To ważne, jeśli w najbliższych latach planujesz kredyt hipoteczny lub inne większe zobowiązanie. Pojazd: ${carName} może być jednocześnie inwestycją w Twoją przyszłą zdolność kredytową.`, `Pieniądze uiszczane zgodnie z umowowymi notami, odciągają punktację raportów finansowych (BIK) wysoko. To kapitalny lewarek przed startem w stronę domów na przedmieściach – weź: ${carName} by udowodnić swoją wiarygodność analitykom hipotecznym z banków głównych!`)}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-8 p-4 bg-primary/5 rounded-xl border border-primary/20 flex flex-col sm:flex-row items-center gap-4">
        <div className="flex-1">
          <h3 className="font-semibold text-primary">{getT('financing.kredyt.crosslink.title', 'Zoptymalizuj koszty w firmie', 'Priorytet na redukcję podatku? Zobacz Leasing!')}</h3>
          <p className="text-sm text-foreground/80 mt-1">
            {getT('financing.kredyt.crosslink.desc', 'Jeśli zależy Ci jednak na optymalizacji kosztów VAT dla Twojej firmy i wpisaniu raty w 100% w koszty uzyskania przychodu, lepszym wariantem na to auto będzie leasing.', 'Biznesy działające B2B pod banderą optymalizacji faktur i odzysków VAT-u powinny z ciekawością rzucić okiem raczej na instrumenty pod nazwą tradycyjny Leasing operacyjny.')}
          </p>
        </div>
        <Button asChild variant="outline" className="shrink-0 border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground">
          <Link to={getListingUrlPath({ ...listing, id: listing.listing_id, version: '' } as any, 'leasing')}>
            {getT('financing.kredyt.crosslink.button', 'Sprawdź ten model w leasingu', 'Skalkuluj leasing na dany pojazd')}
          </Link>
        </Button>
      </div>
    </div>
  );

  const renderWynajem = () => (
    <div className="space-y-6">
      <div className="bg-muted/50 rounded-xl p-6 border border-border">
        <h2 className="font-heading text-xl font-bold mb-3">{getT('financing.wynajem.title', `Wynajem długoterminowy - ${carName} ${year} w jednej miesięcznej racie`, `Abonament i Wynajem od razu do użytku - ${carName} ${year}`)}</h2>
        <p className="text-muted-foreground leading-relaxed">
          <MarkdownText text={getT('financing.wynajem.lead', `Wynajem długoterminowy (najem długoterminowy, abonament samochodowy) to najprostszy sposób na korzystanie z nowego samochodu - bez wkładu własnego, bez martwienia się o serwis, ubezpieczenie i przeglądy. Płacisz jedną stałą ratę i po prostu jeździsz. Pojazd: **${carDetails}** czeka na Ciebie gotowy do drogi od pierwszego dnia.`, `Auto w abonamencie (najem wieloletni/długoterminowy) zaspokaja głód korzystania z fabrycznego pojazdu jak we współdzielonym modelu Spotify i Netflix. Opłacasz subskrypcję i jedziesz na wczasy ubezpieczony z wliczonym ASO na całej linii. Świeży **${carDetails}** za dotknięciem portfela gotowy jest służyć.`)} />
        </p>
        <p className="text-sm mt-3">
          <Link to="/wynajem-dlugoterminowy" className="text-primary underline hover:no-underline">
            Jak działa wynajem długoterminowy samochodu - co obejmuje rata, okresy i limity kilometrów
          </Link>
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="flex gap-4">
          <div className="mt-1 bg-accent/10 p-2.5 rounded-lg h-fit text-primary">
            <User className="w-5 h-5" />
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-foreground">{getT('financing.wynajem.who.title', 'Dla kogo jest wynajem długoterminowy?', 'Do kogo trafi Wynajem Długoterminowy?')}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {getT('financing.wynajem.who.desc', 'Wynajem długoterminowy sprawdza się dla firm zarządzających flotą, jak i dla osób prywatnych ceniących wygodę i zero formalności. To idealne rozwiązanie, jeśli chcesz zawsze jeździć nowym pojazdem bez kłopotów ze sprzedażą używanego auta i bez angażowania gotówki.', 'Elitarny sposób dotarcia do pojazdów z wyciętym ryzykiem inwestycyjnym trafia wręcz domyślnie zarówno do biur (floty logistycznej), tak samo do ludzi prywatnych z głodem unikania mechaników i biurokracji z rynkami wtórnego obiegu. Nie martw się odsprzedawcami. Płać, a potem wymień wkład.')}
            </p>
            {isVan && (
              <p className="text-sm font-medium mt-2 text-foreground/90">
                {getT('financing.wynajem.who.van', 'Dla firm potrzebujących pojazdów dostawczych wynajem długoterminowy eliminuje ryzyko przestojów i kosztów serwisowych - wszystko jest wliczone w ratę.', 'W logistyce aut użytkowych, subskrypcje wynajmu to święty spokój o zastępstwo – naprawa, kolarz, opona.. wszystko ubezpieczone jest ratą abonamentową dbając by robota dotarła punktualnie pod kurierskie zlecenia.')}
              </p>
            )}
            <p className="text-sm text-muted-foreground leading-relaxed mt-2">
              {getT('financing.wynajem.who.summary', 'Minimalne okresy wynajmu zaczynają się zazwyczaj od 12 miesięcy - z opcją przedłużenia lub wymiany na nowy model.', 'Elastyczne interwały - wsiadaj do abonamentu już na paręnaście miesięcy z ewentualną prolongatą jak na siłowni.')}
            </p>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="mt-1 bg-accent/10 p-2.5 rounded-lg h-fit text-primary">
            <ClipboardCheck className="w-5 h-5" />
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-foreground">{getT('financing.wynajem.whatsincluded.title', 'Co zawiera miesięczna rata?', 'Cenisz przewidywalność? Co pokrywa ten wpis transakcyjny')}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {getT('financing.wynajem.whatsincluded.desc', `W racie wynajmu długoterminowego pojazdu: ${carName} standardowo mieści się: użytkowanie pojazdu, pełne ubezpieczenie OC/AC/GAP, serwis i przeglądy, wymiana opon sezonowych oraz assistance 24/7. Zakres pakietu możesz dopasować do swoich potrzeb i wybranego limitu kilometrów.`, `Uregulowana subskrypcja modelu: ${carName} to natychmiastowe upłynnienie zmartwień związanych z wizytacją po ubezpieczenia i zimowe/letnie ogumienie floty. Poza OC i szkodowymi procedurami chroni Cię 24h asystent drogowy dopasowujący do podbitego pulapu przemieszczanych odległościówek rocznych kilometrów.`)}
            </p>
            {isElectric && (
              <p className="text-sm font-medium mt-2 text-foreground/90">
                {getT('financing.wynajem.whatsincluded.electric', `Wynajem elektryczny ${carName} może obejmować dodatkowo dostęp do sieci ładowania lub instalację wallboxa - zapytaj doradcę o szczegóły.`, `Baza zielonych modeli prądowych: ${carName} chlubi się innowacyjną kartą roamingu stacji elektrycznych obok ewentualnego wsparcia rynkową ładowarką naścienną bezpośrednio uziemioną u wyjścia domu.`)}
              </p>
            )}
            <p className="text-sm text-muted-foreground leading-relaxed mt-2">
              {getT('financing.wynajem.whatsincluded.summary', 'Jeden przelew miesięcznie - i nie musisz myśleć o niczym innym.', 'Wyobraź to sobie; autoryzujesz wpłatę i zapominasz kompletnie jakim ciężarem potrafią być te pojazdy z rynku.')}
            </p>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="mt-1 bg-accent/10 p-2.5 rounded-lg h-fit text-primary">
            <Wrench className="w-5 h-5" />
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-foreground">{getT('financing.wynajem.service.title', 'Serwis i przeglądy - zero dopłat', 'Rutynowa Diagnostyka - w ryczałcie abonamentowym!')}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {getT('financing.wynajem.service.desc', `Wszystkie przeglądy okresowe, wymiana płynów i filtrów oraz naprawy wynikające z normalnej eksploatacji pojazdu: ${carName} są objęte umową wynajmu - bez dodatkowych faktur. Korzystasz z autoryzowanej sieci serwisowej, co gwarantuje oryginalne części i pełną historię serwisową pojazdu.`, `Wszystkie zaplanowane wizytacje dla: ${carName} po naklejki pod silnikowym korkiem to pokryty z góry koszyk abonencki. Omiń drobną stację – certyfikowane dilerstwo zaprasza Cię pod skrzydła darmowych weryfikacji i gwarancyjnych operacji od A-Z.`)}
            </p>
            {isAuto && (
              <p className="text-sm font-medium mt-2 text-foreground/90">
                {getT('financing.wynajem.service.auto', 'Automatyczna skrzynia biegów wymaga specjalistycznych przeglądów - w wynajmie długoterminowym są one w pełni pokryte umową serwisową.', 'Sprzęgła czy paski automatu są sporych widełek wydatkiem po latach. W wynajmowaniu wchodzą one we wkład ryzyka obranego sprawnie już bazowymi podpisami i serwisanta.')}
              </p>
            )}
            <p className="text-sm text-muted-foreground leading-relaxed mt-2">
              {getT('financing.wynajem.service.summary', 'System powiadamia Cię z wyprzedzeniem o zbliżającym się terminie przeglądu - koniec z zapominaniem.', 'Powiadomienia od systemu przypominające zawczasu że musisz zrobić przerwę z kawą w oddziale na diagnostykę sezonową.')}
            </p>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="mt-1 bg-accent/10 p-2.5 rounded-lg h-fit text-primary">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-foreground">{getT('financing.wynajem.insurance.title', 'Ubezpieczenie w cenie - OC, AC i GAP', 'Komfortowa warstwa ubezpieczeń na pokładzie')}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {getT('financing.wynajem.insurance.desc', `Pełne ubezpieczenie pojazdu: ${carName} jest standardową częścią raty wynajmu - nie szukasz ubezpieczyciela, nie porównujesz ofert i nie płacisz polisy z góry. Firma wynajmująca negocjuje stawki dla całej floty, dzięki czemu korzystasz z warunków niedostępnych dla klientów indywidualnych. W razie szkody całą procedurę obsługuje wynajmujący - od pierwszego telefonu do zamknięcia sprawy.`, `Zapamiętaj — ubezpieczeniowo: ${carName} to bezproblemowy element wehikułu, bez nerwów i walki na widełki u lokalnych wycen w multiagencjach. Przejmująca potężny pakiet flotowy od hurtowych instytucji wypożyczalnia ma te same rabaty także dla Ciebie, operując likwidacją po szkodzie do szczęśliwego wręczenia pęku kluczyków zapasowych.`)}
            </p>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="mt-1 bg-accent/10 p-2.5 rounded-lg h-fit text-primary">
            <Car className="w-5 h-5" />
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-foreground">{getT('financing.wynajem.replacement.title', 'Auto zastępcze - zawsze i bez opłat', 'Pojazdy podmieniane na stłuczkę całkowicie do dyspozycji')}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {getT('financing.wynajem.replacement.desc', `Podczas serwisu, naprawy lub wypadku pojazdu: ${carName} przysługuje Ci auto zastępcze bez dodatkowych kosztów i bez biurokracji. Assistance działa 24 godziny na dobę, 7 dni w tygodniu - na terenie całej Polski i Europy.`, `Wycieczka u mechanika? Awaria: ${carName}? Namiot pomocy assistance po odholowaniu dowozi wehikuł ratunkowy (tzw. auto rezerwowe). Nic za to ekstra nie potrącą i zadziała niemal na krawędzi dalekich portów lądowych UE.`)}
            </p>
            {isSUV && (
              <p className="text-sm font-medium mt-2 text-foreground/90">
                {getT('financing.wynajem.replacement.suv', 'Jeśli regularnie wyjeżdżasz poza miasto lub za granicę, całodobowe assistance przy wynajmie SUV-a to realna ochrona, a nie tylko zapis w umowie.', 'Uciekasz podwyższonym wozem daleko na szutry prowincji? Śmiało! Odjeżdżasz na gwarancje asystentom spiętych w system dowożącym koła zapasowe pod sam kościół leśniczówki.')}
              </p>
            )}
            <p className="text-sm text-muted-foreground leading-relaxed mt-2">
              {getT('financing.wynajem.replacement.summary', 'Nigdy nie zostajesz bez pojazdu - nawet przy poważniejszej awarii lub kolizji.', 'Biznes i turystyka musi mknąć obiektywnie od ewentualnych komplikacji żeliwa pod bagnetem maski, prawda?')}
            </p>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="mt-1 bg-accent/10 p-2.5 rounded-lg h-fit text-primary">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-foreground">{getT('financing.wynajem.transparency.title', 'Stała rata - pełna przewidywalność kosztów', 'Stalowa Rata bez zaskakującej giełdy na kosztorysie')}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {getT('financing.wynajem.transparency.desc', `Rata wynajmu długoterminowego pojazdu: ${carName} jest ustalona z góry i nie zmienia się przez cały okres umowy - niezależnie od wahań cen ubezpieczeń, części i usług. Po zakończeniu umowy oddajesz auto i możesz od razu wziąć nowy model - bez straty na wartości, bez szukania kupca i bez żadnych formalności. To jedyny produkt finansowy, który daje Ci pełną i długoterminową przewidywalność kosztów mobilności.`, `Ekosystem Wynajmu stymuluje ${carName} żelaznymi barierami inflacyjnymi w tabeli excel domowych wydatków ratalnych. Opłata utrzymana bezbłędnie by chronić Cię przed zmianami rynku. Gdy finiszujecie okres testu – wydajesz wóz, podnosisz rękę z podziękowaniem i wskakujesz do odśnieżonego next-genowego modelu tej marki bez stania za giełdziarzem.`)}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-8 p-4 bg-primary/5 rounded-xl border border-primary/20 flex flex-col sm:flex-row items-center gap-4">
        <div className="flex-1">
          <h3 className="font-semibold text-primary">{getT('financing.wynajem.crosslink.title', 'Wolisz spłacać na własność?', 'Chcesz spłacić na amen dla swojego majątku?')}</h3>
          <p className="text-sm text-foreground/80 mt-1">
            {getT('financing.wynajem.crosslink.desc', 'Jeśli zamiast modelu stałej "opłaty abonamentowej" wolisz sukcesywnie spłacać wartość kapitałową tego modelu by w przyszłości przejąć go na własność, najlepszym wariantem będzie standardowy leasing.', 'Nie wierzysz za bardzo w najem i odcinasz się abonamentowych platform czując nostalgię wpłacania we własny dorobek? Poczuj ratalny puls tradycyjnego standardowego leasingu wyliczając wykup ratami po swojemu.')}
          </p>
        </div>
        <Button asChild variant="outline" className="shrink-0 border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground">
          <Link to={getListingUrlPath({ ...listing, id: listing.listing_id, version: '' } as any, 'leasing')}>
            {getT('financing.wynajem.crosslink.button', 'Poznaj leasing tego pojazdu', 'Przelicz to auto przez model leasingowania')}
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
