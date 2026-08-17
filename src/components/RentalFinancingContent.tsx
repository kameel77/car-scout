import React from 'react';
import { useTranslation } from 'react-i18next';
import { User, ClipboardCheck, Wrench, ShieldCheck, Car, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useBrand } from '@/contexts/BrandContext';
import { MarkdownText } from '@/components/MarkdownText';

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

  return (
    <div className="space-y-6 mt-8">
      <div className="bg-muted/50 rounded-xl p-6 border border-border">
        <h2 className="font-heading text-xl font-bold mb-3">{getT('rental.title', `Wynajem długoterminowy w ${config.name} - ${carName} ${year}`, `Abonament Carsalon na ${carName} ${year}`)}</h2>
        <p className="text-muted-foreground leading-relaxed">
          <MarkdownText text={getT('rental.lead', `Wynajem długoterminowy (najem długoterminowy, abonament samochodowy) to najprostszy sposób na korzystanie z nowego samochodu. Zespół Motolia zadba o serwis, ubezpieczenie i przeglądy - Ty płacisz jedną stałą ratę i po prostu jeździsz. Model: **${carDetails}** czeka u nas gotowy do drogi.`, `Auto w abonamencie (wynajem wieloletni) zaspokaja naturalną chęć korzystania z nowiutkiego pojazdu bez brania go na własność. Carsalon udostępnia Ci fabryczny **${carDetails}** - wystarczy opłacić stałą subskrypcję i ruszać w drogę ze spokojną głową i pełnym pakietem serwisowym.`)} />
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
            <h3 className="font-semibold text-foreground">{getT('rental.who.title', 'Dla kogo jest wynajem długoterminowy?', 'Kto najwięcej zyska z eksperckim wsparciem Carsalonu?')}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {getT('rental.who.desc', 'Wynajem długoterminowy jest dostępny zarówno dla firm, jak i dla osób prywatnych - bez wymogu prowadzenia działalności gospodarczej i zwykle z prostszymi formalnościami niż przy kredycie czy leasingu. Sprawdza się, gdy chcesz regularnie wymieniać auto na nowszy model i nie zajmować się odsprzedażą używanego pojazdu.', 'Długoterminowy abonament samochodowy od Carsalon to nowoczesny sposób na jazdę pachnącym nowością autem. Wycinamy do zera ryzyko spadku wartości na rynku. Ciesz się sprawnym pojazdem na przejrzystych warunkach Carsalon i zapomnij o mechanikach i ogłoszeniach sprzedaży.')}
            </p>
            {isVan && (
              <p className="text-sm font-medium mt-2 text-foreground/90">
                {getT('rental.who.van', 'Dla firm z autami dostawczymi wynajem długoterminowy eliminuje ryzyko przestojów - serwis, ubezpieczenie i auto zastępcze są po stronie wynajmującego, a rata jest kosztem operacyjnym.', 'W sektorze logistycznym nie ma miejsca na błędy i spóźnienia. W pakiecie od Carsalon auta użytkowe to Twój kapitał punktualności bez stresu o niespodziewane awarie obciążające firmę.')}
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-4">
          <div className="mt-1 bg-accent/10 p-2.5 rounded-lg h-fit text-primary">
            <ClipboardCheck className="w-5 h-5" />
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-foreground">{getT('rental.whatsincluded.title', 'Co obejmuje rata najmu?', 'W jakim stopniu abonament chroni Twoje oszczędności?')}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {getT('rental.whatsincluded.desc', `Rata najmu długoterminowego pojazdu: ${carName} obejmuje ubezpieczenie komunikacyjne (OC, AC, NNW i Assistance), pełną obsługę serwisową, auto zastępcze na czas naprawy oraz opcjonalnie pakiet opon sezonowych. Okres umowy i roczny limit kilometrów dopasujesz do swoich potrzeb z doradcą Motolia.`, `Podpisana w Carsalon umowa wynajmu na wariant: ${carName} uziemia wszelkie koszty dodatkowe. Poza polisami ratunkowymi (AC+OC), Carsalon oferuje całodobowy Assistance dopasowujący do pulapu deklarowanych kilometrów z wliczonym zestawem opon zimowych/letnich.`)}
            </p>
            {isElectric && (
              <p className="text-sm font-medium mt-2 text-foreground/90">
                {getT('rental.whatsincluded.electric', `Przy modelu elektrycznym: ${carName} zapytaj doradcę o rozszerzenie umowy o instalację wallboxa lub dostęp do sieci ładowania.`, `Pojazd na prąd: ${carName} może posiadać ukrytą zaletę innowacyjnej karty roamingu, byś ładując wehikuł mógł zintegrować tę operację bezpośrednio z doradztwem Carsalonu.`)}
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-4">
          <div className="mt-1 bg-accent/10 p-2.5 rounded-lg h-fit text-primary">
            <Wrench className="w-5 h-5" />
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-foreground">{getT('rental.service.title', 'Serwis i przeglądy wliczone w ratę', 'Rutynowa wymiana olejów na koszt Carsalonu')}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {getT('rental.service.desc', `Przeglądy okresowe, diagnostyka i naprawy wynikające z normalnej eksploatacji pojazdu: ${carName} są pokryte umową najmu - bez dodatkowych faktur. Serwisowanie odbywa się w autoryzowanej sieci, z oryginalnymi częściami i pełną historią serwisową pojazdu.`, `Wszystkie usterki wynikające ze standardowego przebiegu pracy osprzętu dla maszyny ${carName} pozostają po naszej stronie. Carsalon pokrywa pełen bilans rocznej wymiany usterek, używając atestowanych baz dilerskich autoryzowanych mechaników.`)}
            </p>
            {isAuto && (
              <p className="text-sm font-medium mt-2 text-foreground/90">
                {getT('rental.service.auto', 'Przeglądy automatycznej skrzyni biegów również mieszczą się w pakiecie serwisowym - to koszt, który przy własnym aucie potrafi zaskoczyć.', 'Automaty są w pełni pod ochroną Carsalon - nie ponosisz wydatków po upływie interwałów tysięcy przerwanych kilometrów gwarancyjnych.')}
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-4">
          <div className="mt-1 bg-accent/10 p-2.5 rounded-lg h-fit text-primary">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-foreground">{getT('rental.insurance.title', 'Ubezpieczenie w racie - OC, AC, NNW i Assistance', 'Tarcze ubezpieczeniowe dedykowane klientom Carsalon')}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {getT('rental.insurance.desc', `Pakiet ubezpieczeniowy pojazdu: ${carName} jest wliczony w ratę - nie kupujesz i nie odnawiasz polis samodzielnie przez cały okres umowy. Stawki są negocjowane dla całej floty, a likwidację szkody prowadzi wynajmujący. Różnicę wartości auta przy szkodzie całkowitej lub kradzieży może dodatkowo zabezpieczyć ubezpieczenie GAP.`, `W Carsalon model: ${carName} zakontraktowany jest wraz z gigantyczną tarczą ubezpieczeń na preferencyjnych flotowo zniżkach. Po ewentualnej kolizji z Twojej czy nie-Twojej winy, Carsalon uruchamia sztab operacyjny, zamykając temat sprawną rekompensatą od dewelopera do odbiorcy.`)}
            </p>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="mt-1 bg-accent/10 p-2.5 rounded-lg h-fit text-primary">
            <Car className="w-5 h-5" />
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-foreground">{getT('rental.replacement.title', 'Auto zastępcze na czas naprawy', 'Twój zapas ubezpieczony od rynkowych trudów')}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {getT('rental.replacement.desc', `Gdy pojazd: ${carName} trafia do serwisu, otrzymujesz auto zastępcze bez dodatkowych kosztów - nie zostajesz bez samochodu na czas naprawy. Assistance działa całą dobę, 7 dni w tygodniu, w Polsce i w Europie.`, `Abonamentowe procedury dla: ${carName} od Carsalon uwzględniają wehikuł zapasowy po to, żebyś z dymem pod silnikiem nie musiał się tłumaczyć szefom od przerwanych zleceń. Otrzymujesz na poczekaniu drugi samochód we wskazanym przez operatora zespole rezerwowym Carsalon.`)}
            </p>
            {isSUV && (
              <p className="text-sm font-medium mt-2 text-foreground/90">
                {getT('rental.replacement.suv', 'Jeśli SUV-em regularnie wyjeżdżasz w dłuższe trasy lub za granicę, całodobowe assistance z autem zastępczym realnie chroni ciągłość podróży.', 'Duże, wygodne SUV-y bywają ofiarą rryzykowniejszych podróży krajoznawczych po europejskiej mapie. Ochronny Assistance od Carsalonu zawsze dojeżdża z lawetą, dając bezpieczne podwozie na powrót do domu.')}
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-4">
          <div className="mt-1 bg-accent/10 p-2.5 rounded-lg h-fit text-primary">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-foreground">{getT('rental.transparency.title', 'Stała rata przez cały okres umowy', 'Stabilizacja abonamentowa na twardych liczbach')}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {getT('rental.transparency.desc', `Rata najmu pojazdu: ${carName} jest ustalona z góry i nie zmienia się przez cały okres umowy - zwykle od 12 do 60 miesięcy. Jej wysokość zależy od wartości pojazdu, rocznego limitu kilometrów (najczęściej 10-40 tys. km), długości umowy i ewentualnej wpłaty wstępnej. Po zakończeniu umowy zwracasz auto i możesz od razu wymienić je na nowszy model.`, `W modelu udostępniania na wehikuł: ${carName} nie dopatrzysz się małego druczku - raty ujęte w ofercie od Carsalon uwzględniają wszelkie niepokojące zmiany czynników gospodarczych polskiego handlu, tworząc spokojny fundament amortyzacyjny Twojego kalendarza wydatków.`)}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-8 p-4 bg-primary/5 rounded-xl border border-primary/20 flex flex-col sm:flex-row items-center gap-4">
        <div className="flex-1">
          <h3 className="font-semibold text-primary">{getT('rental.crosslink.title', 'Wolisz opcję wykupu auta na własność?', 'Optymalizujesz na poczet stałego wykupu?')}</h3>
          <p className="text-sm text-foreground/80 mt-1">
            {getT('rental.crosslink.desc', 'Wynajem długoterminowy nie przewiduje wykupu - po zakończeniu umowy auto wraca do wynajmującego. Jeśli chcesz docelowo przejąć pojazd na własność, a rata ma być kosztem firmowym, sprawdź leasing.', 'Dla wielu podmiotów i przedsiębiorstw obciążanie kwot wykupu operacyjnego może być cenniejszą drogą pozyskania auta na zawsze. Zachęcamy zapoznania się ze standardami klasycznego leasingu w Carsalon.')}
          </p>
        </div>
        <div className="flex flex-col items-center gap-2 shrink-0 w-full sm:w-auto">
          <Button asChild variant="outline" className="w-full sm:w-auto border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground">
            <Link to={`/leasing?SearchText=${encodeURIComponent(make + ' ' + model)}`}>
              {getT('rental.crosslink.button', 'Zobacz ten model w leasingu', 'Odkryj oferty leasingu dla tego wózka')}
            </Link>
          </Button>
          <Link 
            to={`/nowe?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`}
            className="text-xs text-muted-foreground hover:text-primary underline transition-colors"
          >
            {getT('rental.crosslink.newCars', `Zobacz nowe samochody ${make} ${model}`, `Zobacz nowe modele ${make} ${model}`)}
          </Link>
        </div>
      </div>
    </div>
  );
};
