import { startTransition } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "@brand-fonts";
import { applyBrandTokens } from "./contexts/BrandContext";
import { startInpReporting } from "./lib/inpReporter";

// Tokeny marki przed pierwszym renderem — bez mrugnięcia krojem i kolorem.
applyBrandTokens();

// Pierwszy render jako transition: React dzieli go na kawałki (~5 ms) zamiast jednego
// długiego zadania (na stronie głównej ~220–270 ms na mobile) — mniej TBT i szybsza
// reakcja na wczesne kliknięcia. SSR shell zostaje widoczny do commitu, jak dotąd.
const root = createRoot(document.getElementById("root")!);
startTransition(() => {
  root.render(<App />);
});
startInpReporting();
