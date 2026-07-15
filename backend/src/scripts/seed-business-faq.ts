import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 7 pytań z docs/B2B_CONTENT_DLA_FIRM.md, sekcja 10 (kontekst FAQ `business`, strona /dla-firm).
// EN/DE to na razie kopie PL (placeholder) — do przetłumaczenia w kolejnym kroku wg wytycznych.
const ENTRIES: { questionPl: string; answerPl: string; sortOrder: number }[] = [
  {
    questionPl: 'Czy nowa firma dostanie leasing?',
    answerPl:
      'Tak. Finansujemy auta dla firm od pierwszego dnia działalności — nie wymagamy 12 miesięcy stażu. Sprawdzamy oferty u wielu instytucji, więc szansa na pozytywną decyzję jest wyższa niż u jednego finansującego.',
    sortOrder: 0,
  },
  {
    questionPl: 'Czym różni się leasing od najmu długoterminowego dla firmy?',
    answerPl:
      'W leasingu operacyjnym finansujesz auto i możesz je wykupić po umowie; rata zwykle nie zawiera serwisu. W najmie długoterminowym płacisz jedną stałą ratę all-in (serwis, ubezpieczenie, opony, assistance), nie ma wykupu, a limit kilometrów ustala się z góry. Doradca policzy oba warianty dla Twojej firmy.',
    sortOrder: 1,
  },
  {
    questionPl: 'Czy mogę odliczyć VAT od raty auta firmowego?',
    answerPl:
      'Zależnie od sposobu użytkowania auta odliczysz 50% lub 100% VAT od raty i kosztów eksploatacji. Ostateczne rozliczenie zależy od formy opodatkowania firmy — to informacja ogólna, nie porada podatkowa.',
    sortOrder: 2,
  },
  {
    questionPl: 'Jak wygląda oferta, gdy potrzebuję kilku aut?',
    answerPl:
      'Obsługujemy kilka wniosków naraz i negocjujemy rabaty wieloautowe pod konkretne zamówienie. Wszystkie auta prowadzi jeden opiekun, także przy kolejnych zamówieniach w przyszłości.',
    sortOrder: 3,
  },
  {
    questionPl: 'Co jeśli dostanę odmowę finansowania?',
    answerPl:
      'Odmowa u jednej instytucji nie kończy tematu. Porównujemy oferty wielu finansujących i ponawiamy wniosek u kolejnego partnera, żeby zwiększyć szansę na pozytywną decyzję.',
    sortOrder: 4,
  },
  {
    questionPl: 'Czy obsługujecie zarówno spółki, jak i JDG?',
    answerPl:
      'Tak. Finansujemy auta dla jednoosobowych działalności gospodarczych i spółek — od jednego auta po dwadzieścia, w leasingu i najmie długoterminowym.',
    sortOrder: 5,
  },
  {
    questionPl: 'Jak liczą się limity kosztów 2026 przy wyborze auta?',
    answerPl:
      'Od 2026 limit zaliczenia auta do kosztów zależy od emisji CO2: 100 tys. zł dla aut spalinowych, 150 tys. zł dla hybryd plug-in i 225 tys. zł dla elektryków. Im wyższy limit, tym większa część raty trafia w koszty firmy. To informacja ogólna, nie porada podatkowa.',
    sortOrder: 6,
  },
];

async function main() {
  for (const entry of ENTRIES) {
    const existing = await prisma.faqEntry.findFirst({
      where: { page: 'business', questionPl: entry.questionPl },
    });
    if (existing) {
      console.log(`⏭  Pomijam (już istnieje): ${entry.questionPl}`);
      continue;
    }
    await prisma.faqEntry.create({
      data: {
        page: 'business',
        pageContext: 'all',
        sortOrder: entry.sortOrder,
        questionPl: entry.questionPl,
        answerPl: entry.answerPl,
        questionEn: entry.questionPl,
        answerEn: entry.answerPl,
        questionDe: entry.questionPl,
        answerDe: entry.answerPl,
        isPublished: true,
      },
    });
    console.log(`✅ Dodano: ${entry.questionPl}`);
  }
}

main()
  .catch((e) => {
    console.error('❌ Błąd seedowania FAQ dla firm:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
