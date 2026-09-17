import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

const CHUNK_RELOAD_COOLDOWN_MS = 60_000;
const CHUNK_RELOAD_KEY_PREFIX = "chunk-reload:";

export function isChunkLoadError(error: Error): boolean {
  const message = error?.message ?? "";
  return message.includes("Failed to fetch dynamically imported module") ||
    message.includes("Importing a module script failed") ||
    message.includes("Unable to preload CSS");
}

export function claimChunkReload(
  storage: Pick<Storage, "getItem" | "setItem">,
  url: string,
  now = Date.now()
): boolean {
  const key = `${CHUNK_RELOAD_KEY_PREFIX}${url}`;
  try {
    const lastReload = Number(storage.getItem(key));
    if (Number.isFinite(lastReload) && lastReload > 0 && now - lastReload < CHUNK_RELOAD_COOLDOWN_MS) {
      return false;
    }
    storage.setItem(key, String(now));
    return true;
  } catch {
    // Without persistent storage an automatic reload could loop forever.
    return false;
  }
}

export class ChunkErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    
    if (isChunkLoadError(error) && claimChunkReload(window.sessionStorage, window.location.href)) {
      // If a chunk fails to load, the deployment probably changed the file hashes.
      // Reload once to fetch the new HTML, but never enter a refresh loop when
      // an edge or SSR cache keeps serving an obsolete asset reference.
      console.log("Chunk load error detected. Reloading page...");
      window.location.reload();
    }
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 text-center p-4">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Wystąpił nieoczekiwany błąd aplikacji</h1>
          <p className="text-gray-600 mb-6">Trwa ładowanie nowej wersji systemu lub wystąpił problem z połączeniem.</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-6 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
          >
            Odśwież stronę
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
