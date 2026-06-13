import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
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
    
    // Check if it's a dynamic import chunk loading error
    const isChunkError = 
      error?.message?.includes("Failed to fetch dynamically imported module") || 
      error?.message?.includes("Importing a module script failed");
      
    if (isChunkError) {
      // If a chunk fails to load, the deployment probably changed the file hashes.
      // Reloading the page will fetch the new index.html with new hashes.
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
