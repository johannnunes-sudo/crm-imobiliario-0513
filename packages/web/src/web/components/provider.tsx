import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FiltersProvider } from "./filters";
import { ToastProvider } from "./ui/kit";

const queryClient = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false } } });

export function Provider({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <FiltersProvider>
        <ToastProvider>{children}</ToastProvider>
      </FiltersProvider>
    </QueryClientProvider>
  );
}
