import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { X, Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "../../lib/utils";
import { initials } from "../../lib/format";

/* ---------- Layout ---------- */

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[22px] font-semibold leading-tight text-foreground">{title}</h1>
        {subtitle && <p className="mt-1 text-[13.5px] text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-lg border border-border bg-card", className)} {...rest}>
      {children}
    </div>
  );
}

export function PanelHeader({ title, subtitle, right, className }: { title: string; subtitle?: string; right?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start justify-between gap-3 px-5 pt-4 pb-3", className)}>
      <div className="min-w-0">
        <h3 className="text-[14px] font-medium text-foreground">{title}</h3>
        {subtitle && <p className="mt-0.5 text-[12.5px] text-muted-foreground">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

/* ---------- Controls ---------- */

type BtnVariant = "primary" | "secondary" | "ghost" | "danger";
export function Button({
  variant = "secondary",
  size = "md",
  loading,
  className,
  children,
  disabled,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: "sm" | "md"; loading?: boolean }) {
  return (
    <button
      disabled={disabled || loading}
      className={cn(
        "inline-flex select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-55",
        size === "sm" ? "h-7 px-2.5 text-[12.5px]" : "h-8.5 px-3.5 text-[13px]",
        variant === "primary" && "bg-brand text-white hover:bg-brand-strong",
        variant === "secondary" && "border border-border bg-card text-foreground hover:border-border-strong hover:bg-muted",
        variant === "ghost" && "text-muted-foreground hover:bg-muted hover:text-foreground",
        variant === "danger" && "border border-border bg-card text-danger hover:bg-danger-soft",
        className,
      )}
      {...rest}
    >
      {loading && <Loader2 className="size-3.5 animate-spin" />}
      {children}
    </button>
  );
}

const fieldBase =
  "w-full rounded-md border border-border bg-card px-3 text-[13.5px] text-foreground outline-none transition-colors placeholder:text-subtle hover:border-border-strong focus:border-brand focus:ring-3 focus:ring-brand/15";

export function Input({ className, ...rest }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldBase, "h-9", className)} {...rest} />;
}
export function Textarea({ className, ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(fieldBase, "min-h-20 py-2", className)} {...rest} />;
}
export function Select({ className, children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        fieldBase,
        "h-9 cursor-pointer appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%236b726d%22 stroke-width=%222%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[right_10px_center] bg-no-repeat pr-8",
        className,
      )}
      {...rest}
    >
      {children}
    </select>
  );
}

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-[12.5px] font-medium text-muted-foreground">{label}</span>
      {children}
      {hint && <span className="text-[12px] text-subtle">{hint}</span>}
    </label>
  );
}

/** Controle segmentado (tabs compactas) */
export function Segmented<T extends string>({ value, options, onChange, className }: { value: T; options: readonly { value: T; label: ReactNode }[]; onChange: (v: T) => void; className?: string }) {
  return (
    <div className={cn("inline-flex rounded-md border border-border bg-muted p-0.5", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "inline-flex h-7 items-center gap-1.5 rounded-[5px] px-2.5 text-[12.5px] font-medium transition-colors",
            value === o.value ? "bg-card text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.06)]" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Tabs<T extends string>({ value, options, onChange }: { value: T; options: readonly { value: T; label: string; count?: number }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-5 border-b border-border">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "-mb-px flex items-center gap-1.5 border-b-2 pb-2.5 text-[13.5px] font-medium transition-colors",
            value === o.value ? "border-forest text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
          {o.count !== undefined && <span className="tnum rounded bg-muted px-1.5 text-[11.5px] text-muted-foreground">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

/* ---------- Data display ---------- */

export type Tone = "neutral" | "brand" | "forest" | "amber" | "danger";
const toneDot: Record<Tone, string> = {
  neutral: "bg-subtle",
  brand: "bg-brand",
  forest: "bg-forest",
  amber: "bg-amber",
  danger: "bg-danger",
};
const toneBadge: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground",
  brand: "bg-brand-soft text-brand-strong",
  forest: "bg-forest/8 text-forest",
  amber: "bg-amber-soft text-amber",
  danger: "bg-danger-soft text-danger",
};

export function Dot({ tone = "neutral", className }: { tone?: Tone; className?: string }) {
  return <span className={cn("inline-block size-1.5 shrink-0 rounded-full", toneDot[tone], className)} />;
}

export function Badge({ tone = "neutral", dot, children, className }: { tone?: Tone; dot?: boolean; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex h-5.5 items-center gap-1.5 whitespace-nowrap rounded-[5px] px-1.5 text-[11.5px] font-medium", toneBadge[tone], className)}>
      {dot && <Dot tone={tone} />}
      {children}
    </span>
  );
}

export function Avatar({ name, color = "#1F3A2E", size = 24 }: { name: string; color?: string; size?: number }) {
  return (
    <span
      title={name}
      className="inline-flex shrink-0 items-center justify-center rounded-full font-medium text-white"
      style={{ width: size, height: size, background: color, fontSize: size * 0.4 }}
    >
      {initials(name)}
    </span>
  );
}

export function Progress({ value, tone = "brand", className }: { value: number; tone?: Tone; className?: string }) {
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div className={cn("h-full rounded-full transition-[width] duration-700", toneDot[tone])} style={{ width: `${Math.max(0, Math.min(100, value * 100))}%` }} />
    </div>
  );
}

/** Faixa contínua de KPIs com divisórias */
export function KpiStrip({ items, cols = 4 }: { items: { label: string; value: ReactNode; hint?: ReactNode; delta?: number | null; progress?: number }[]; cols?: 2 | 3 | 4 }) {
  const colCls = cols === 4 ? "lg:grid-cols-4" : cols === 3 ? "lg:grid-cols-3" : "lg:grid-cols-2";
  return (
    <Panel className={cn("grid grid-cols-2 overflow-hidden", colCls)}>
      {items.map((k, i) => (
        <div
          key={k.label}
          className="rise relative border-border px-5 py-4 [&:not(:nth-child(2n))]:border-r lg:[&:not(:nth-child(2n))]:border-r-0 lg:[&:not(:last-child)]:border-r [&:nth-child(n+3)]:border-t lg:[&:nth-child(n+3)]:border-t-0 lg:[&:nth-child(n+5)]:border-t"
          style={{ animationDelay: `${i * 40}ms` }}
        >
          <div className="text-[12.5px] text-muted-foreground">{k.label}</div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="tnum font-display text-[24px] font-medium leading-none tracking-[-0.02em] text-foreground">{k.value}</span>
            {k.delta !== undefined && k.delta !== null && Number.isFinite(k.delta) && (
              <span className={cn("tnum text-[12px] font-medium", k.delta >= 0 ? "text-brand-strong" : "text-danger")}>
                {k.delta >= 0 ? "↑" : "↓"} {Math.abs(Math.round(k.delta * 100))}%
              </span>
            )}
          </div>
          {k.progress !== undefined && <Progress value={k.progress} tone={k.progress >= 1 ? "brand" : k.progress >= 0.7 ? "forest" : "amber"} className="mt-3" />}
          {k.hint && <div className="mt-2 text-[12px] text-subtle">{k.hint}</div>}
        </div>
      ))}
    </Panel>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} />;
}

export function PageSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-28 w-full" />
      <div className="grid gap-5 lg:grid-cols-2">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
    </div>
  );
}

export function Empty({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
      {icon && <div className="mb-3 text-subtle">{icon}</div>}
      <div className="text-[13.5px] font-medium text-foreground">{title}</div>
      {children && <div className="mt-1 max-w-sm text-[12.5px] text-muted-foreground">{children}</div>}
    </div>
  );
}

/* ---------- Table ---------- */

export function Table({ head, children, className }: { head: ReactNode[]; children: ReactNode; className?: string }) {
  return (
    <div className={cn("scrollbar-thin overflow-x-auto", className)}>
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-border">
            {head.map((h, i) => (
              <th key={i} className="whitespace-nowrap px-5 py-2.5 text-left text-[11.5px] font-medium uppercase tracking-[0.04em] text-subtle">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&>tr]:border-b [&>tr]:border-border [&>tr:last-child]:border-0 [&>tr>td]:px-5 [&>tr>td]:py-2.5 [&>tr:hover]:bg-muted/50">{children}</tbody>
      </table>
    </div>
  );
}

/* ---------- Modal ---------- */

export function Modal({ open, onClose, title, subtitle, children, footer, width = 560 }: { open: boolean; onClose: () => void; title: string; subtitle?: string; children: ReactNode; footer?: ReactNode; width?: number }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-forest/25 px-4 py-[8vh] backdrop-blur-[2px] animate-in fade-in duration-150">
      <button type="button" aria-label="Fechar" tabIndex={-1} className="fixed inset-0 cursor-default" onClick={onClose} />
      <div
        className="relative w-full rounded-xl border border-border bg-card shadow-[0_24px_60px_-20px_rgba(20,40,30,0.35)] animate-in zoom-in-[0.98] slide-in-from-bottom-2 duration-200"
        style={{ maxWidth: width }}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <h2 className="text-[15px] font-medium">{title}</h2>
            {subtitle && <p className="mt-0.5 text-[12.5px] text-muted-foreground">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-border bg-muted/40 px-5 py-3 rounded-b-xl">{footer}</div>}
      </div>
    </div>
  );
}

/* ---------- Toast ---------- */

const ToastCtx = createContext<(msg: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<{ id: number; msg: string }[]>([]);
  const push = useCallback((msg: string) => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x, { id, msg }]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 3200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed right-5 bottom-5 z-[60] flex flex-col gap-2">
        {items.map((t) => (
          <div key={t.id} className="flex items-center gap-2 rounded-lg bg-forest px-3.5 py-2.5 text-[13px] text-white shadow-lg animate-in slide-in-from-bottom-2 fade-in">
            <CheckCircle2 className="size-4 text-brand" />
            {t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
