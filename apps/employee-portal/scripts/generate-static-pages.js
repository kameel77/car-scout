import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, '../dist');
const templatePath = path.join(distDir, 'index.html');

if (!fs.existsSync(templatePath)) {
  console.error(`[generate-static-pages] dist/index.html not found at ${templatePath}`);
  process.exit(1);
}

const templateHtml = fs.readFileSync(templatePath, 'utf-8');

const pages = [
  {
    fileName: 'index.html',
    title: 'Benefivo - dobre rzeczy jadą z Tobą | Samochód jako benefit',
    description: 'Najem i leasing aut na warunkach dla pracowników. Poznaj program motoryzacyjny dla Twojej firmy. Powered by Motolia.',
    canonical: '__PORTAL_ORIGIN__/',
    ogTitle: 'Benefivo - Dobre rzeczy jadą z Tobą',
    ogDescription: 'Najem i leasing aut na warunkach dla pracowników. Poznaj program motoryzacyjny dla Twojej firmy. Powered by Motolia.',
    ogUrl: '__PORTAL_ORIGIN__/',
    ogImage: '__PORTAL_ORIGIN__/static/og-benefivo.png'
  },
  {
    fileName: 'dla-firm.html',
    title: 'Benefivo dla Firm - Program samochodowy dla pracowników | Powered by Motolia',
    description: 'Dołącz najem i leasing aut do benefitów Twojej firmy. Zero kosztów wdrożenia, preferencyjne warunki i kompleksowa obsługa Motolii.',
    canonical: '__PORTAL_ORIGIN__/dla-firm',
    ogTitle: 'Benefivo dla Firm - Samochód jako benefit pracowniczy',
    ogDescription: 'Dołącz najem i leasing aut do benefitów Twojej firmy. Zero kosztów wdrożenia, preferencyjne warunki i kompleksowa obsługa Motolii.',
    ogUrl: '__PORTAL_ORIGIN__/dla-firm',
    ogImage: '__PORTAL_ORIGIN__/static/og-benefivo.png'
  },
  {
    fileName: 'regulamin.html',
    title: 'Regulamin programu Benefivo | Warunki korzystania z platformy',
    description: 'Zasady korzystania z programu benefitów motoryzacyjnych Benefivo operowanego przez Motolia Sp. z o.o.',
    canonical: '__PORTAL_ORIGIN__/regulamin',
    ogTitle: 'Regulamin programu Benefivo',
    ogDescription: 'Zasady korzystania z programu benefitów motoryzacyjnych Benefivo operowanego przez Motolia Sp. z o.o.',
    ogUrl: '__PORTAL_ORIGIN__/regulamin',
    ogImage: '__PORTAL_ORIGIN__/static/og-benefivo.png'
  },
  {
    fileName: 'prywatnosc.html',
    title: 'Polityka prywatności i ochrona danych RODO | Benefivo by Motolia',
    description: 'Informacje o przetwarzaniu danych osobowych (RODO), prawach użytkowników i operatorze programu Benefivo.',
    canonical: '__PORTAL_ORIGIN__/prywatnosc',
    ogTitle: 'Polityka prywatności - Benefivo',
    ogDescription: 'Informacje o przetwarzaniu danych osobowych (RODO), prawach użytkowników i operatorze programu Benefivo.',
    ogUrl: '__PORTAL_ORIGIN__/prywatnosc',
    ogImage: '__PORTAL_ORIGIN__/static/og-benefivo.png'
  }
];

function injectMeta(html, page) {
  let updated = html;

  // Replace Title
  updated = updated.replace(/<title>.*?<\/title>/is, `<title>${page.title}</title>`);

  // Replace Description
  if (updated.includes('<meta name="description"')) {
    updated = updated.replace(/<meta name="description" content=".*?"\s*\/?>/is, `<meta name="description" content="${page.description}" />`);
  } else {
    updated = updated.replace('</head>', `  <meta name="description" content="${page.description}" />\n  </head>`);
  }

  // Canonical
  if (updated.includes('<link rel="canonical"')) {
    updated = updated.replace(/<link rel="canonical" href=".*?"\s*\/?>/is, `<link rel="canonical" href="${page.canonical}" />`);
  } else {
    updated = updated.replace('</head>', `  <link rel="canonical" href="${page.canonical}" />\n  </head>`);
  }

  // OpenGraph tags
  const ogTags = `
    <!-- Open Graph / Social Media Meta Tags -->
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Benefivo" />
    <meta property="og:title" content="${page.ogTitle}" />
    <meta property="og:description" content="${page.ogDescription}" />
    <meta property="og:url" content="${page.ogUrl}" />
    <meta property="og:image" content="${page.ogImage}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${page.ogTitle}" />
    <meta name="twitter:description" content="${page.ogDescription}" />
    <meta name="twitter:image" content="${page.ogImage}" />
  `;

  // Remove existing OG tags if any to avoid duplication
  updated = updated.replace(/<!-- Open Graph.*?-->[\s\S]*?<meta name="twitter:image".*?\/>/is, '');
  updated = updated.replace('</head>', `${ogTags}\n  </head>`);

  return updated;
}

for (const page of pages) {
  const targetPath = path.join(distDir, page.fileName);
  const resultHtml = injectMeta(templateHtml, page);
  fs.writeFileSync(targetPath, resultHtml, 'utf-8');
  console.log(`[generate-static-pages] Generated ${page.fileName} (canonical: ${page.canonical})`);
}

console.log('[generate-static-pages] Completed successfully.');
