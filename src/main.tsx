import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "@brand-fonts";
import { applyBrandTokens } from "./contexts/BrandContext";

// Tokeny marki przed pierwszym renderem — bez mrugnięcia krojem i kolorem.
applyBrandTokens();

createRoot(document.getElementById("root")!).render(<App />);
