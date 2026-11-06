import type { ReactNode } from "react";
import { Redirect } from "wouter";
import { Loader2 } from "lucide-react";
import { authClient } from "../lib/auth";

export function Protected({ children }: { children: ReactNode }) {
  const { data, isPending } = authClient.useSession();
  if (isPending)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-5 animate-spin text-brand" />
      </div>
    );
  if (!data) return <Redirect to="/login" />;
  return <>{children}</>;
}
