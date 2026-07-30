import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import yaml from "@rollup/plugin-yaml";

type BrandId = 'carsalon' | 'motolia';

const brandMeta: Record<BrandId, {
  title: string;
  description: string;
  author: string;
  favicon: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  ogUrl: string;
}> = {
  carsalon: {
    title: 'CarSalon - auta nowe i używane z gwarancją',
    author: 'CarSalon',
    description: 'Setki ofert od sprawdzonych dealerów. Nowe i używane samochody z gwarancją.',
    favicon: '/brands/carsalon/favicon.png',
    ogTitle: 'CarSalon - auta nowe i używane z gwarancją',
    ogDescription: 'Setki ofert od sprawdzonych dealerów.',
    ogImage: 'https://carsalon.pl/brands/carsalon/og-image.png',
    ogUrl: 'https://carsalon.pl',
  },
  motolia: {
    title: 'Motolia - leasing, kredyt i wynajem samochodów bez formalności',
    author: 'Motolia',
    description: 'Nowe i używane auta z finansowaniem dopasowanym do Twojej sytuacji: leasing, kredyt, wynajem długoterminowy. Sprawdź oferty i policz ratę online w 2 minuty.',
    favicon: '/brands/motolia/favicon.png',
    ogTitle: 'Motolia - leasing, kredyt i wynajem samochodów bez formalności',
    ogDescription: 'Nowe i używane auta z finansowaniem dopasowanym do Twojej sytuacji: leasing, kredyt, wynajem długoterminowy. Sprawdź oferty i policz ratę online w 2 minuty.',
    ogImage: 'https://motolia.pl/brands/motolia/og-image.png',
    ogUrl: 'https://motolia.pl',
  },
};

// Statyczny shell hero strony głównej Motolii — maluje się zaraz po HTML
// (CSS jest inline'owany), zanim pobierze się i wykona bundle Reacta.
// React po zamontowaniu podmienia #root na identyczny markup, więc nie ma
// przeskoku. Teksty muszą odpowiadać src/brands/motolia/config.ts
// (homePage.hero) i klasom z MotoliaHomePage.tsx / Header.tsx.
// Znaczniki home-shell: backend (render.ts) usuwa ten blok dla ścieżek innych
// niż strona główna, żeby hero nie migało na /samochody, /oferta/... itd.
const motoliaHeroShell = `<div id="root"><!--home-shell--><div class="bg-white min-h-screen text-[#1A1A1A] font-inter">` +
  `<header class="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-xl supports-[backdrop-filter]:bg-white/60"><div class="container flex min-h-[72px] py-2 lg:h-[80px] items-center justify-between gap-2"><a class="flex items-center gap-3 flex-shrink-0" href="/"><img src="/brands/motolia/logo-header.svg" alt="Motolia" width="240" height="47" class="h-14 md:h-16 w-auto max-w-[240px] object-contain" fetchpriority="high"></a></div></header>` +
  `<section class="relative overflow-hidden bg-[#FAFAF8] pt-14 pb-16 lg:pt-40 lg:pb-28"><div class="max-w-7xl mx-auto px-6 relative z-10"><div class="grid lg:grid-cols-[1.5fr_1fr] gap-16 items-center"><div class="max-w-2xl">` +
  `<div><div class="inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-semibold mb-8" style="background:#F5C51820;border-color:#F5C51860;color:#1A1A1A"><span style="color:#D4A90A">◆</span>Leasing · Kredyt · Wynajem · Pożyczka</div></div>` +
  `<div><h1 class="text-5xl lg:text-7xl font-outfit font-bold tracking-tight mb-6 leading-[1.08] text-[#1A1A1A]">Szeroki wybór aut.<br><span style="color:#D4A90A">Proste finansowanie.</span></h1></div>` +
  `<div><p class="text-xl text-gray-500 mb-10 leading-relaxed font-light">Niezależnie czy jesteś osobą prywatną czy firmą – dobierzemy finansowanie do Twojej sytuacji. Jedna rozmowa, wiele ofert.</p></div>` +
  `<div class="flex flex-col sm:flex-row gap-4 mb-12"><a href="/samochody" class="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-bold text-lg" style="background:#F5C518;color:#1A1A1A;box-shadow:0 4px 24px #F5C51860">Sprawdź dostępne auta</a><a href="#produkty" class="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-semibold text-lg border-2 border-gray-200 text-gray-700">Jak to działa?</a></div>` +
  `</div></div></div></section>` +
  `</div><!--/home-shell--></div>`;

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const devApiTarget = env.VITE_DEV_API_URL || env.VITE_API_URL || "http://127.0.0.1:3001";
  const brand = (env.VITE_BRAND as BrandId) || 'carsalon';
  const meta = brandMeta[brand] ?? brandMeta.carsalon;

  return {
    build: {
      // Manifest chunków dla backendu (render.ts): SSR wstrzykuje <link rel="modulepreload">
      // chunka trasy, żeby przeglądarka nie czekała z jego pobraniem na wykonanie index.js
      manifest: true,
    },
    server: {
      host: "::",
      port: 8080,
      proxy: {
        "/api": {
          target: devApiTarget,
          changeOrigin: true,
        },
        "/uploads": {
          target: devApiTarget,
          changeOrigin: true,
        },
      },
    },
    plugins: [
      react(),
      yaml(),
      mode === "development" && componentTagger(),
      {
        name: 'brand-html-transform',
        transformIndexHtml(html) {
          return html
            .replace(/<title>.*?<\/title>/, `<title>${meta.title}</title>`)
            .replace(/(<meta name="description" content=").*?(")/,  `$1${meta.description}$2`)
            .replace(/(<meta name="author" content=").*?(")/,        `$1${meta.author}$2`)
            .replace(/(<link rel="icon"[^>]*href=").*?(")/,         `$1${meta.favicon}$2`)
            .replace(/(<link rel="apple-touch-icon"[^>]*href=").*?(")/,`$1${meta.favicon}$2`)
            .replace(/(<meta property="og:title"[^>]*content=").*?(")/,       `$1${meta.ogTitle}$2`)
            .replace(/(<meta property="og:description"[^>]*content=").*?(")/,  `$1${meta.ogDescription}$2`)
            .replace(/(<meta property="og:image"[^>]*content=").*?(")/,        `$1${meta.ogImage}$2`)
            .replace(/(<meta property="og:url"[^>]*content=").*?(")/,          `$1${meta.ogUrl}$2`)
            .replace(/(<meta name="twitter:title"[^>]*content=").*?(")/,       `$1${meta.ogTitle}$2`)
            .replace(/(<meta name="twitter:description"[^>]*content=").*?(")/,  `$1${meta.ogDescription}$2`)
            .replace(/(<meta name="twitter:image"[^>]*content=").*?(")/,        `$1${meta.ogImage}$2`)
            .replace('<div id="root"></div>', brand === 'motolia' ? motoliaHeroShell : '<div id="root"></div>');
        },
      },
      {
        name: 'font-preload',
        enforce: 'post' as const,
        generateBundle(_options: unknown, bundle: Record<string, { type: string }>) {
          const htmlChunk = bundle['index.html'];
          if (!htmlChunk || htmlChunk.type !== 'asset') return;
          const asset = htmlChunk as unknown as { source: string | Uint8Array };

          // Fonty elementu LCP (H1: Outfit 700) i tekstu bazowego (Inter 400) —
          // preload zamiast czekania, aż przeglądarka sparsuje inline'owany CSS
          const criticalFonts = Object.keys(bundle).filter(
            (k) => /(-|\/)(outfit-latin-700|inter-latin-400)-normal-[^/]*\.woff2$/.test(k),
          );
          if (criticalFonts.length === 0) return;

          const links = criticalFonts
            .map((f) => `<link rel="preload" href="/${f}" as="font" type="font/woff2" crossorigin>`)
            .join('\n    ');
          asset.source = asset.source.toString().replace('</title>', `</title>\n    ${links}`);
        },
      },
      {
        name: 'inline-css',
        enforce: 'post',
        generateBundle(options, bundle) {
          const htmlChunk = bundle['index.html'];
          if (!htmlChunk || htmlChunk.type !== 'asset') return;

          let html = htmlChunk.source.toString();

          for (const key in bundle) {
            if (key.endsWith('.css')) {
              const cssChunk = bundle[key];
              if (cssChunk.type === 'asset') {
                const cssContent = cssChunk.source.toString();
                const linkRegex = new RegExp(`<link[^>]*href="[^"]*${key}"[^>]*>`);
                if (linkRegex.test(html)) {
                  html = html.replace(linkRegex, `<style>${cssContent}</style>`);
                  delete bundle[key]; // Do not emit the css file anymore since it's fully inlined
                }
              }
            }
          }
          htmlChunk.source = html;
        }
      },
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        "@brand-home": path.resolve(__dirname, `./src/pages/${brand === 'motolia' ? 'MotoliaHomePage' : 'CarsalonHomePage'}.tsx`),
        "@brand-contact": path.resolve(__dirname, `./src/pages/${brand === 'motolia' ? 'MotoliaContactPage' : 'CarsalonContactPage'}.tsx`),
      },
    },
  };
});
