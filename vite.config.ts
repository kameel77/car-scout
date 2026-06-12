import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

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
    title: 'Motolia - leasing, kredyt i wynajem samochodów',
    author: 'Motolia',
    description: 'Szeroki wybór aut. Proste finansowanie. Leasing, kredyt i wynajem długoterminowy.',
    favicon: '/brands/motolia/favicon.png',
    ogTitle: 'Motolia - szeroki wybór aut, proste finansowanie',
    ogDescription: 'Leasing, kredyt, wynajem długoterminowy — dopasujemy finansowanie do Twojej sytuacji.',
    ogImage: 'https://motolia.pl/brands/motolia/og-image.png',
    ogUrl: 'https://motolia.pl',
  },
};

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const devApiTarget = env.VITE_DEV_API_URL || env.VITE_API_URL || "http://127.0.0.1:3001";
  const brand = (env.VITE_BRAND as BrandId) || 'carsalon';
  const meta = brandMeta[brand] ?? brandMeta.carsalon;

  return {
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
            .replace(/(<meta name="twitter:image"[^>]*content=").*?(")/,        `$1${meta.ogImage}$2`);
        },
      },
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
