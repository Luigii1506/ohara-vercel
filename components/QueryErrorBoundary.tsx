"use client";

import React, { Component, ReactNode } from "react";
import { QueryErrorResetBoundary } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * 🛡️ Error Boundary para TanStack Query
 *
 * Captura errores de queries y muestra UI de fallback
 * Permite retry con reset de error boundary
 */
class QueryErrorBoundaryInner extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Query Error Boundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError && this.state.error) {
      const { fallback } = this.props;

      const reset = () => {
        this.setState({ hasError: false, error: null });
      };

      if (fallback) {
        return fallback(this.state.error, reset);
      }

      // Default fallback UI
      return <DefaultErrorFallback error={this.state.error} reset={reset} />;
    }

    return this.props.children;
  }
}

/**
 * Default Error Fallback Component
 */
const DefaultErrorFallback = ({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) => {
  const isNetworkError = error.message.includes("fetch") ||
                         error.message.includes("Network");
  const isServerError = error.message.includes("500") ||
                        error.message.includes("503");

  return (
    <div className="flex items-center justify-center min-h-[400px] p-6">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
        <div className="flex justify-center mb-4">
          <AlertTriangle className="h-16 w-16 text-orange-500" />
        </div>

        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {isNetworkError
            ? "Error de Conexión"
            : isServerError
            ? "Error del Servidor"
            : "Algo salió mal"}
        </h2>

        <p className="text-gray-600 mb-6">
          {isNetworkError
            ? "No pudimos conectar con el servidor. Verifica tu conexión a internet."
            : isServerError
            ? "El servidor está experimentando problemas. Intenta de nuevo en unos momentos."
            : error.message || "Ocurrió un error inesperado al cargar los datos."}
        </p>

        <div className="space-y-3">
          <Button
            onClick={reset}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Intentar de Nuevo
          </Button>

          <Button
            onClick={() => window.location.reload()}
            variant="outline"
            className="w-full"
          >
            Recargar Página
          </Button>
        </div>

        {/* Error details (solo en dev) */}
        {process.env.NODE_ENV === "development" && (
          <details className="mt-4 text-left">
            <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
              Detalles técnicos
            </summary>
            <pre className="mt-2 p-3 bg-gray-100 rounded text-xs overflow-auto">
              {error.stack}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
};

/**
 * 🎯 Wrapper que combina QueryErrorResetBoundary + Error Boundary
 *
 * Uso:
 * ```tsx
 * <QueryErrorBoundary>
 *   <YourComponent />
 * </QueryErrorBoundary>
 * ```
 */
export const QueryErrorBoundary = ({ children, fallback }: Props) => {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <QueryErrorBoundaryInner
          fallback={(error, innerReset) => {
            // Combinar reset de React Error Boundary + TanStack Query
            const combinedReset = () => {
              reset(); // Reset TanStack Query
              innerReset(); // Reset React Error Boundary
            };

            return fallback
              ? fallback(error, combinedReset)
              : <DefaultErrorFallback error={error} reset={combinedReset} />;
          }}
        >
          {children}
        </QueryErrorBoundaryInner>
      )}
    </QueryErrorResetBoundary>
  );
};

/**
 * 🎨 Custom Error Fallback para casos específicos
 */
export const CardListErrorFallback = ({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) => {
  return (
    <div className="flex items-center justify-center min-h-[300px]">
      <div className="text-center">
        <AlertTriangle className="h-12 w-12 text-orange-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">
          No se pudieron cargar las cartas
        </h3>
        <p className="text-gray-600 mb-4 max-w-md">
          {error.message || "Error al cargar la lista de cartas"}
        </p>
        <Button onClick={reset} size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Reintentar
        </Button>
      </div>
    </div>
  );
};

export default QueryErrorBoundary;
