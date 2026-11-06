import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutGrid, KanbanSquare, Building2, CalendarDays, PlusCircle, Gauge, Home, BarChart3, Settings, LogOut, Menu, X, Sun, Plus,
} from "lucide-react";
import { cn } from "../lib/utils";
import { signOut } from "../lib/auth";
import { useMe } from "../queries/crm";
import { ROLE_LABEL } from "../../shared/constants";
import { Avatar } from "./ui/kit";

const NAV: { group: string; items: { to: string; label: string; icon: typeof Home; match?: string }[] }[] = [
  {
    group: "Visão geral",
    items: [
      { to: "/hoje", label: "Hoje", icon: Sun },
      { to: "/", label: "Consolidado", icon: LayoutGrid },
      { to: "/gestor", label: "Gestor comercial", icon: Gauge },
    ],
  },
  {
    group: "Comercial",
    items: [
      { to: "/pipeline", label: "Pipeline", icon: KanbanSquare },
      { to: "/carteira", label: "Carteira", icon: Building2, match: "/imobiliarias" },
      { to: "/agenda", label: "Agenda", icon: CalendarDays },
      { to: "/registro", label: "Registro rápido", icon: PlusCircle },
    ],
  },
  {
    group: "Produtos & análise",
    items: [
      { to: "/empreendimentos", label: "Empreendimentos", icon: Home },
      { to: "/relatorios", label: "Relatórios", icon: BarChart3 },
    ],
  },
];

function NavLink({ to, label, icon: Icon, match, onClick, collapsed }: { to: string; label: string; icon: typeof Home; match?: string; onClick?: () => void; collapsed?: boolean }) {
  const [loc] = useLocation();
  const active = to === "/" ? loc === "/" : loc.startsWith(to) || (match && loc.startsWith(match));
  return (
    <Link
      to={to}
      onClick={onClick}
      title={collapsed ? label : undefined}
      aria-label={collapsed ? label : undefined}
      className={cn(
        "group flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13.5px] transition-colors",
        collapsed && "justify-center px-0",
        active ? "bg-card font-medium text-foreground shadow-[0_0_0_1px_var(--border)]" : "text-muted-foreground hover:bg-black/[0.035] hover:text-foreground",
      )}
    >
      <Icon className={cn("size-4 shrink-0", active ? "text-brand" : "text-subtle group-hover:text-muted-foreground")} strokeWidth={1.9} />
      {!collapsed && label}
    </Link>
  );
}

function Sidebar({ onNavigate, collapsed = false, onToggle }: { onNavigate?: () => void; collapsed?: boolean; onToggle?: () => void }) {
  const me = useMe();
  return (
    <div className="flex h-full flex-col">
      <div className={cn("flex items-center gap-2.5 pt-4 pb-5", collapsed ? "flex-col px-2" : "px-3")}>
        {onToggle && (
          <button
            type="button"
            onClick={onToggle}
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
            title={collapsed ? "Expandir menu" : "Recolher menu"}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-black/[0.05] hover:text-foreground"
          >
            <Menu className="size-[18px]" />
          </button>
        )}
        <img src="/images/logo.png" alt="" className="size-8" />
        {!collapsed && (
          <div className="leading-tight">
            <div className="font-display text-[13.5px] font-semibold tracking-[0.01em] text-forest">Porto Florêncio</div>
            <div className="text-[11.5px] text-muted-foreground">CRM Comercial</div>
          </div>
        )}
      </div>
      <nav className={cn("flex-1 space-y-5 overflow-y-auto", collapsed ? "px-2" : "px-3")}>
        {NAV.map((g) => (
          <div key={g.group}>
            {collapsed ? (
              <div className="mx-2 mb-1.5 border-t border-border" />
            ) : (
              <div className="mb-1.5 px-2.5 text-[11px] font-medium uppercase tracking-[0.06em] text-subtle">{g.group}</div>
            )}
            <div className="space-y-0.5">
              {g.items.map((i) => (
                <NavLink key={i.to} {...i} onClick={onNavigate} collapsed={collapsed} />
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className={cn("space-y-0.5 border-t border-border py-3", collapsed ? "px-2" : "px-3")}>
        <NavLink to="/configuracoes" label="Configurações" icon={Settings} onClick={onNavigate} collapsed={collapsed} />
        {collapsed ? (
          <div className="flex flex-col items-center gap-1.5 py-2">
            <Avatar name={me.data?.name ?? "U"} color="#1F3A2E" size={26} />
            <button onClick={signOut} title="Sair" aria-label="Sair" className="rounded p-1 text-subtle hover:bg-muted hover:text-foreground">
              <LogOut className="size-3.5" />
            </button>
          </div>
        ) : (
        <div className="flex items-center gap-2.5 rounded-md px-2.5 py-2">
          <Avatar name={me.data?.name ?? "U"} color="#1F3A2E" size={26} />
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-[13px] font-medium">{me.data?.name ?? "—"}</div>
            <div className="truncate text-[11.5px] text-muted-foreground">{me.data ? ROLE_LABEL[me.data.role] : ""}</div>
          </div>
          <button onClick={signOut} title="Sair" className="rounded p-1 text-subtle hover:bg-muted hover:text-foreground">
            <LogOut className="size-3.5" />
          </button>
        </div>
        )}
      </div>
    </div>
  );
}

export function AppLayout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("pf_nav_collapsed") === "1");
  const toggle = () =>
    setCollapsed((v) => {
      localStorage.setItem("pf_nav_collapsed", v ? "0" : "1");
      return !v;
    });
  const [loc, nav] = useLocation();
  const me = useMe();
  // No celular, a gerente abre direto na tela "Hoje"
  useEffect(() => {
    if (me.data?.role === "gerente" && loc === "/" && window.innerWidth < 1024 && !sessionStorage.getItem("pf_home_seen")) {
      sessionStorage.setItem("pf_home_seen", "1");
      nav("/hoje");
    }
  }, [me.data?.role]); // eslint-disable-line
  return (
    <div className="min-h-screen pb-[72px] lg:pb-0">
      <aside className={cn("fixed inset-y-0 left-0 z-30 hidden border-r border-border bg-[#f2f2ee] transition-[width] duration-200 lg:block", collapsed ? "w-[64px]" : "w-[240px]")}>
        <Sidebar collapsed={collapsed} onToggle={toggle} />
      </aside>
      {/* mobile */}
      <div className="sticky top-0 z-30 flex h-12 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur lg:hidden">
        <div className="flex items-center gap-2">
          <img src="/images/logo.png" alt="" className="size-6" />
          <span className="font-display text-[13px] font-semibold text-forest">Porto Florêncio</span>
        </div>
        <button onClick={() => setOpen(true)} aria-label="Abrir menu" className="rounded-md p-1.5 hover:bg-muted">
          <Menu className="size-5" />
        </button>
      </div>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button aria-label="Fechar menu" className="absolute inset-0 bg-forest/25" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[260px] border-r border-border bg-[#f2f2ee] animate-in slide-in-from-left">
            <button onClick={() => setOpen(false)} className="absolute top-4 right-3 rounded p-1 hover:bg-muted">
              <X className="size-4" />
            </button>
            <Sidebar onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}
      <main className={cn("transition-[padding] duration-200", collapsed ? "lg:pl-[64px]" : "lg:pl-[240px]")}>
        <div key={loc} className="rise mx-auto max-w-[1440px] px-4 py-5 sm:px-5 sm:py-7 lg:px-9">
          {children}
        </div>
      </main>
      <BottomNav loc={loc} />
    </div>
  );
}

/** Menu inferior no celular: Hoje, Carteira, Registrar (destaque), Pipeline, Agenda */
function BottomNav({ loc }: { loc: string }) {
  const items = [
    { to: "/hoje", label: "Hoje", icon: Sun },
    { to: "/carteira", label: "Carteira", icon: Building2, match: "/imobiliarias" },
    { to: "/registro", label: "Registrar", icon: Plus, main: true },
    { to: "/pipeline", label: "Pipeline", icon: KanbanSquare },
    { to: "/agenda", label: "Agenda", icon: CalendarDays },
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex items-end justify-around border-t border-border bg-card/95 px-1 pt-1.5 pb-[max(8px,env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
      {items.map(({ to, label, icon: Icon, match, main }) => {
        const active = loc.startsWith(to) || (match && loc.startsWith(match));
        return main ? (
          <Link key={to} to={to} aria-label={label} className="-mt-5 flex flex-col items-center gap-1 text-[10.5px] font-medium text-forest">
            <span className="flex size-12 items-center justify-center rounded-full bg-brand text-white shadow-[0_6px_16px_-4px_rgba(95,174,58,0.6)]"><Icon className="size-6" strokeWidth={2.4} /></span>
            {label}
          </Link>
        ) : (
          <Link key={to} to={to} className={cn("flex min-w-[60px] flex-col items-center gap-1 py-1 text-[10.5px]", active ? "font-semibold text-brand-strong" : "text-muted-foreground")}>
            <Icon className="size-5" strokeWidth={active ? 2.2 : 1.8} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
