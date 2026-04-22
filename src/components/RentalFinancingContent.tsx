import React from 'react';
import { useTranslation } from 'react-i18next';
import { User, ClipboardCheck, Wrench, ShieldCheck, Car, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useBrand } from '@/contexts/BrandContext';

export interface RentalFinancingContentProps {
  vehicle: {
    make: string;
    model: string;
    productionYear: number;
    bodyType?: string | null;
    fuelType?: string | null;
    transmission?: string | null;
  };
}

export const RentalFinancingContent: React.FC<RentalFinancingContentProps> = ({ vehicle }) => {
  const { t } = useTranslation();
  const { config } = useBrand();
  const isCarsalon = config.id === 'carsalon';

  const getT = (key: string, defaultMotolia: string, defaultCarsalon: string) => {
    return isCarsalon ? t(`cs.${key}`, defaultCarsalon) : t(key, defaultMotolia);
  };

  const { make, model, productionYear: year, bodyType, fuelType, transmission } = vehicle;

  const carDetailsParts = [make, model, year, bodyType, fuelType].filter(Boolean);
  const carDetails = carDetailsParts.join(', ');
  const carName = `${make} ${model}`;
  
  const isElectric = fuelType?.toLowerCase() === 'elektryczny';
  const isSUV = bodyType?.toLowerCase() === 'suv';
  const isVan = bodyType?.toLowerCase() === 'van' || bodyType?.toLowerCase() === 'minivan';
  const isAuto = transmission?.toLowerCase() === 'automatyczna';

  const renderTextWithHtml = (text: string) => {
    const htmlText = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    return <span dangerouslySetInnerHTML={{ __html: htmlText }} />;
  };

  return (
    <div className="space-y-6 mt-8">
      <div className="bg-muted/50 rounded-xl p-6 border border-border">
        <h2 className="font-heading text-xl font-bold mb-3">{getT('rental.title', `Wynajem długoterminowy w ${config.name} - ${carName} ${year}`, `Abonament Carsalon na ${carName} ${year}`)}</h2>
        <p className="text-muted-foreground leading-relaxed">
          {renderTextWithHtml(getT('rental.lead', `Wynajem długoterminowy (najem długoterminowy, abonament samochodowy) to najprostszy sposób na korzystanie z nowego samochodu. Zespół Motolia zadba o serwis, ubezpieczenie i przeglądy - Ty płacisz jedną stałą ratę i po prostu jeździsz. Model: **${carDetails}** czeka u nas gotowy do drogi.`, `Auto w abonamencie (wynajem wieloletni) zaspokaja naturalną chęć korzystania z nowiutkiego pojazdu bez brania go na własność. Carsalon udostępnia Ci fabryczny **${carDetails}** - wystarczy opłacić stałą subskrypcję i ruszać w drogę ze spokojną głową i pełnym pakietem serwisowym.`))}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="flex gap-4">
          <div className="mt-1 bg-accent/10 p-2.5 rounded-lg h-fit text-accent">
            <User className="w-5 h-5" />
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-foreground">{getT('rental.who.title', 'Dla kogo jest wynajem od Motolia?', 'Kto najwięcej zyska z eksperckim wsparciem Carsalonu?')}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {getT('rental.who.desc', 'Nasz wynajem sprawdza się zarówno we flotach firmowych, jak i dla osób prywatnych ceniących wygodę. Wybierając wynajem z Motolia, zyskujesz pełne wsparcie ekspertów i gwarancję najwyższej jakości obsługi - bez kłopotów związanych z odsprzedażą używanego pojazdu na wolnym rynku.', 'Długoterminowy abonament samochodowy od Carsalon to nowoczesny sposób na jazdę pachnącym nowością autem. Wycinamy do zera ryzyko spadku wartości na rynku. Ciesz się sprawnym pojazdem na przejrzystych warunkach Carsalon i zapomnij o mechanikach i ogłoszeniach sprzedaży.')}
            </p>
            {isVan && (
              <p className="text-sm font-medium mt-2 text-foreground/90">
                {getT('rental.who.van', 'Jeżeli Twoja firma potrzebuje niezawodnych aut dostawczych, umowa z Motolia wyeliminuje przestoje, bo wszystkie ryzyka bieżące wpisane są po stronie wynajmującego.', 'W sektorze logistycznym nie ma miejsca na błędy i spóźnienia. W pakiecie od Carsalon auta użytkowe to Twój kapitał punktualności bez stresu o niespodziewane awarie obciążające firmę.')}
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-4">
          <div className="mt-1 bg-accent/10 p-2.5 rounded-lg h-fit text-accent">
            <ClipboardCheck className="w-5 h-5" />
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-foreground">{getT('rental.whatsincluded.title', 'Co pokrywa Twoja rata?', 'W jakim stopniu abonament chroni Twoje oszczędności?')}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {getT('rental.whatsincluded.desc', `W naszej standardowej racie dla: ${carName} Motolia ujął wszystko: wynajem, pakiety ubezpieczeń OC/AC/GAP, profesjonalny serwis, serwis oponiarski i niezawodne assistance. Masz możliwość sprecyzowania interwałów kilometrów wraz z naszym doradcą.`, `Podpisana w Carsalon umowa wynajmu na wariant: ${carName} uziemia wszelkie koszty dodatkowe. Poza polisami ratunkowymi (AC+OC), Carsalon oferuje całodobowy Assistance dopasowujący do pulapu deklarowanych kilometrów z wliczonym zestawem opon zimowych/letnich.`)}
            </p>
            {isElectric && (
              <p className="text-sm font-medium mt-2 text-foreground/90">
                {getT('rental.whatsincluded.electric', `Wybierając model prądowy: ${carName}, doradcy Motolia chętnie omówią ewentualne plany montażu inteligentnych systemów ładujących Wallbox.`, `Pojazd na prąd: ${carName} może posiadać ukrytą zaletę innowacyjnej karty roamingu, byś ładując wehikuł mógł zintegrować tę operację bezpośrednio z doradztwem Carsalonu.`)}
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-4">
          <div className="mt-1 bg-accent/10 p-2.5 rounded-lg h-fit text-accent">
            <Wrench className="w-5 h-5" />
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-foreground">{getT('rental.service.title', 'Zero zmartwień związanych z serwisem', 'Rutynowa wymiana olejów na koszt Carsalonu')}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {getT('rental.service.desc', `Okresowe wizyty i usterki we flocie Motolia pokryte są kompleksowym funduszem serwisowym dla całego cyklu użytkowania ${carName}. Wykwalifikowane sieci diagnostyczne dbają o Twoje bezpieczeństwo, autoryzując oryginalne filtry.`, `Wszystkie usterki wynikające ze standardowego przebiegu pracy osprzętu dla maszyny ${carName} pozostają po naszej stronie. Carsalon pokrywa pełen bilans rocznej wymiany usterek, używając atestowanych baz dilerskich autoryzowanych mechaników.`)}
            </p>
            {isAuto && (
              <p className="text-sm font-medium mt-2 text-foreground/90">
                {getT('rental.service.auto', 'Zespoły automatycznej skrzyni biegów objęte są pełną, kompleksową umową profilaktycznego diagnozowania sieci Motolia.', 'Automaty są w pełni pod ochroną Carsalon - nie ponosisz wydatków po upływie interwałów tysięcy przerwanych kilometrów gwarancyjnych.')}
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-4">
          <div className="mt-1 bg-accent/10 p-2.5 rounded-lg h-fit text-accent">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-foreground">{getT('rental.insurance.title', 'Kompleksowe ubezpieczenie zyskiem z Motolia', 'Tarcze ubezpieczeniowe dedykowane klientom Carsalon')}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {getT('rental.insurance.desc', `Decydując się na finansowanie poprzez sieć rynkową Motolia na auto: ${carName}, unikasz dzwonienia po zakładach ubezpieczeniowych u agentów pośrednich. Gwarantujemy spójne ubezpieczenie oraz bierzemy na celownik wszystkie komplikacje powypadkowe, oddając Ci wolną od zmartwień maszynę.`, `W Carsalon model: ${carName} zakontraktowany jest wraz z gigantyczną tarczą ubezpieczeń na preferencyjnych flotowo zniżkach. Po ewentualnej kolizji z Twojej czy nie-Twojej winy, Carsalon uruchamia sztab operacyjny, zamykając temat sprawną rekompensatą od dewelopera do odbiorcy.`)}
            </p>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="mt-1 bg-accent/10 p-2.5 rounded-lg h-fit text-accent">
            <Car className="w-5 h-5" />
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-foreground">{getT('rental.replacement.title', 'Zastępcza gotowość - bez fakturowania', 'Twój zapas ubezpieczony od rynkowych trudów')}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {getT('rental.replacement.desc', `Każda wizytacja modelu: ${carName} wymuszająca dłuższy postój u specjalistów pociąga za sobą bezpłatnie auto tymczasowe pod auspicjami umowy najmu. Usługa dostawy wsparcia jest globalną deklaracją Motolia względem swoich nabywców.`, `Abonamentowe procedury dla: ${carName} od Carsalon uwzględniają wehikuł zapasowy po to, żebyś z dymem pod silnikiem nie musiał się tłumaczyć szefom od przerwanych zleceń. Otrzymujesz na poczekaniu drugi samochód we wskazanym przez operatora zespole rezerwowym Carsalon.`)}
            </p>
            {isSUV && (
              <p className="text-sm font-medium mt-2 text-foreground/90">
                {getT('rental.replacement.suv', 'Posiadając silnego SUV-a z chwastem terenowych skłonności, ucieczka w dzikie ustronia bez obaw jest możliwa dzięki globalnym programom dla kierowców marki Motolia.', 'Duże, wygodne SUV-y bywają ofiarą rryzykowniejszych podróży krajoznawczych po europejskiej mapie. Ochronny Assistance od Carsalonu zawsze dojeżdża z lawetą, dając bezpieczne podwozie na powrót do domu.')}
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-4">
          <div className="mt-1 bg-accent/10 p-2.5 rounded-lg h-fit text-accent">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-foreground">{getT('rental.transparency.title', 'Długoterminowa prognoza rachunków', 'Stabilizacja abonamentowa na twardych liczbach')}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {getT('rental.transparency.desc', `Comiesięczna operacja fakturująca na pojazd: ${carName} z Motolia pozostaje żelaznie niezmienną stawką pomimo ekonomicznych turbulencji lat gwarancyjnych. To najcenniejszy finansowo układ dający całkowitą wiedzę na temat domowej płynności w nadchodzących 24 lub 48 miesiącach.`, `W modelu udostępniania na wehikuł: ${carName} nie dopatrzysz się małego druczku - raty ujęte w ofercie od Carsalon uwzględniają wszelkie niepokojące zmiany czynników gospodarczych polskiego handlu, tworząc spokojny fundament amortyzacyjny Twojego kalendarza wydatków.`)}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-8 p-4 bg-primary/5 rounded-xl border border-primary/20 flex flex-col sm:flex-row items-center gap-4">
        <div className="flex-1">
          <h3 className="font-semibold text-primary">{getT('rental.crosslink.title', 'Należysz do zwolenników ratalnej odsprzedaży?', 'Optymalizujesz na poczet stałego wykupu?')}</h3>
          <p className="text-sm text-foreground/80 mt-1">
            {getT('rental.crosslink.desc', 'Jeśli najem nie wydaje się Twoją domeną, ponieważ preferujesz dorobek majątku trwałego przez spłacany regularnie instrument finansowy z odliczanym VAT-em - zapoznaj się z propozycją leasingową naszej sieci.', 'Dla wielu podmiotów i przedsiębiorstw obciążanie kwot wykupu operacyjnego może być cenniejszą drogą pozyskania auta na zawsze. Zachęcamy zapoznania się ze standardami klasycznego leasingu w Carsalon.')}
          </p>
        </div>
        <Button asChild variant="outline" className="shrink-0 border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground">
          <Link to={`/leasing?SearchText=${encodeURIComponent(make + ' ' + model)}`}>
            {getT('rental.crosslink.button', 'Zobacz ten model w leasingu', 'Odkryj oferty leasingu dla tego wózka')}
          </Link>
        </Button>
      </div>
    </div>
  );
};
