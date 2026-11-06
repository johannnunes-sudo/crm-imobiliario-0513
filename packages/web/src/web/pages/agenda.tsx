import { useMemo, useState } from "react";
import { Link } from "wouter";
import { CalendarPlus, Check, ChevronLeft, ChevronRight, Clock, Trash2, X } from "lucide-react";
import { useCrm } from "../hooks/use-crm";
import { useRemoveActivity, useUpdateActivity, type Activity } from "../queries/crm";
import { fmtDate, isoDate, MONTHS_FULL, parseISO } from "../lib/format";
import { GlobalFilters } from "../components/filters";
import { AttentionPanel } from "../components/blocks";
import { ActivityDialog } from "../components/forms";
import { NextStepDialog } from "../components/next-step";
import { TeamAgenda } from "../components/team-agenda";
import { usePerms } from "../queries/crm";
import { Badge, Button, Empty, Modal, PageHeader, PageSkeleton, Panel, PanelHeader, Segmented, Table, Tabs, useToast } from "../components/ui/kit";
import { cn } from "../lib/utils";

const WEEK = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const statusTone = { Planejada: "amber", Concluída: "brand", Cancelada: "neutral" } as const;

export default function Agenda() {
  const c = useCrm();
  const [mode, setMode] = useState<"mes" | "semana" | "lista">("mes");
  const [cursor, setCursor] = useState(() => new Date());
  const [newDate, setNewDate] = useState<string | null>(null);
  const [sel, setSel] = useState<Activity | null>(null);
  const [doneAct, setDoneAct] = useState<Activity | null>(null);
  const perms = usePerms();
  const [view, setView] = useState<"minha" | "equipe">("minha");
  const update = useUpdateActivity();
  const remove = useRemoveActivity();
  const toast = useToast();
  const todayIso = isoDate(new Date());

  const days = useMemo(() => {
    if (mode === "semana") {
      const s = new Date(cursor);
      s.setDate(cursor.getDate() - cursor.getDay());
      return Array.from({ length: 7 }, (_, i) => new Date(s.getFullYear(), s.getMonth(), s.getDate() + i));
    }
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = new Date(first);
    start.setDate(1 - first.getDay());
    return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }, [cursor, mode]);

  const byDay = useMemo(() => {
    const m = new Map<string, Activity[]>();
    for (const a of c.scoped.activities) {
      if (a.status === "Cancelada") continue;
      (m.get(a.date) ?? m.set(a.date, []).get(a.date)!).push(a);
    }
    for (const l of m.values()) l.sort((x, y) => (x.status === y.status ? (x.time ?? "").localeCompare(y.time ?? "") : x.status === "Planejada" ? -1 : 1));
    return m;
  }, [c.scoped.activities]);

  if (c.isLoading) return <PageSkeleton />;

  const planned = c.scoped.activities.filter((a) => a.status === "Planejada").sort((a, b) => a.date.localeCompare(b.date));
  const upcoming = planned.filter((a) => a.date >= todayIso);
  const overdue = planned.filter((a) => a.date < todayIso);
  const shift = (n: number) =>
    setCursor((d) => (mode === "semana" ? new Date(d.getFullYear(), d.getMonth(), d.getDate() + n * 7) : new Date(d.getFullYear(), d.getMonth() + n, 1)));

  const monthActs = c.scoped.activities.filter((a) => a.date.slice(0, 7) === isoDate(cursor).slice(0, 7));

  return (
    <>
      <PageHeader
        title="Agenda comercial"
        subtitle="Planejamento e conclusão de atividades · planejadas não contam nos indicadores"
        actions={
          <>
            <GlobalFilters showPeriod={false} />
            <Button variant="primary" onClick={() => setNewDate(todayIso)}>
              <CalendarPlus className="size-4" /> Agendar
            </Button>
          </>
        }
      />

      <div className="mb-5">
        <Tabs
          value={view}
          onChange={setView}
          options={[
            { value: "minha", label: perms.seesAll ? "Agenda" : "Minha agenda" },
            { value: "equipe", label: perms.seesAll ? "Agenda da equipe" : "Meu desempenho" },
          ]}
        />
      </div>

      {view === "equipe" ? <TeamAgenda onOpen={setSel} /> : (
      <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
        <Panel className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
            <div className="flex items-center gap-2">
              <button onClick={() => shift(-1)} className="rounded-md p-1.5 hover:bg-muted"><ChevronLeft className="size-4" /></button>
              <button onClick={() => shift(1)} className="rounded-md p-1.5 hover:bg-muted"><ChevronRight className="size-4" /></button>
              <h3 className="text-[15px] font-medium">{MONTHS_FULL[cursor.getMonth()]} {cursor.getFullYear()}</h3>
              <Button size="sm" variant="ghost" onClick={() => setCursor(new Date())}>Hoje</Button>
            </div>
            <Segmented value={mode} onChange={setMode} options={[{ value: "mes", label: "Mês" }, { value: "semana", label: "Semana" }, { value: "lista", label: "Lista" }]} />
          </div>

          {mode === "lista" ? (
            monthActs.length === 0 ? <Empty title="Nada neste mês" /> : (
              <Table head={["Data", "Atividade", "Imobiliária", "Gerente", "Situação"]}>
                {monthActs.sort((a, b) => a.date.localeCompare(b.date)).map((a) => (
                  <tr key={a.id} className="cursor-pointer" onClick={() => setSel(a)}>
                    <td className="tnum whitespace-nowrap text-muted-foreground">{fmtDate(a.date)} {a.time}</td>
                    <td className="font-medium">{a.type}</td>
                    <td className="text-muted-foreground">{c.agencyName(a.agencyId)}</td>
                    <td className="text-muted-foreground">{c.manager(a.managerId)?.name.split(" ")[0]}</td>
                    <td><Badge tone={statusTone[a.status as keyof typeof statusTone]} dot>{a.status}</Badge></td>
                  </tr>
                ))}
              </Table>
            )
          ) : (
            <>
              <div className="grid grid-cols-7 border-b border-border">
                {WEEK.map((w) => <div key={w} className="px-2.5 py-2 text-[11.5px] font-medium uppercase tracking-[0.04em] text-subtle">{w}</div>)}
              </div>
              <div className="grid grid-cols-7">
                {days.map((d, i) => {
                  const iso = isoDate(d);
                  const items = byDay.get(iso) ?? [];
                  const inMonth = d.getMonth() === cursor.getMonth() || mode === "semana";
                  const limit = mode === "semana" ? 12 : 3;
                  return (
                    <div
                      key={iso}
                      className={cn(
                        "group relative border-border p-1.5 transition-colors hover:bg-muted/50",
                        mode === "semana" ? "min-h-[420px]" : "min-h-[112px]",
                        (i + 1) % 7 !== 0 && "border-r",
                        i < days.length - 7 && "border-b",
                        !inMonth && "bg-[#fafaf8]",
                      )}
                    >
                      <button aria-label={`Nova atividade em ${d.getDate()}`} onClick={() => setNewDate(iso)} className="absolute inset-0 cursor-pointer" />
                      <div className="pointer-events-none relative mb-1 flex items-center justify-between px-1">
                        <span
                          className={cn(
                            "tnum inline-flex size-6 items-center justify-center rounded-full text-[12.5px]",
                            iso === todayIso ? "bg-forest font-medium text-white" : inMonth ? "text-foreground" : "text-subtle",
                          )}
                        >
                          {d.getDate()}
                        </span>
                        <CalendarPlus className="size-3.5 text-subtle opacity-0 group-hover:opacity-100" />
                      </div>
                      <div className="relative space-y-1">
                        {items.slice(0, limit).map((a) => (
                          <button
                            key={a.id}
                            onClick={() => setSel(a)}
                            className={cn(
                              "block w-full truncate rounded-[4px] border-l-2 px-1.5 py-[3px] text-left text-[11.5px] leading-tight",
                              a.status === "Planejada" ? "border-amber bg-amber-soft text-[#7a5410]" : "border-brand bg-brand-soft text-forest",
                            )}
                          >
                            {a.time && <span className="tnum mr-1 opacity-70">{a.time}</span>}
                            {a.type}
                            {mode === "semana" && <div className="truncate opacity-70">{c.agencyName(a.agencyId)}</div>}
                          </button>
                        ))}
                        {items.length > limit && <div className="px-1.5 text-[11px] text-muted-foreground">+{items.length - limit} mais</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </Panel>

        <div className="space-y-5">
          <Panel>
            <PanelHeader title="Próximas atividades" right={<Badge tone="amber">{upcoming.length}</Badge>} />
            {upcoming.length === 0 ? <Empty title="Nada planejado" /> : (
              <div className="px-2 pb-2">
                {upcoming.slice(0, 6).map((a) => (
                  <button key={a.id} aria-label={a.type} onClick={() => setSel(a)} className="flex w-full items-start gap-3 rounded-md px-3 py-2 text-left hover:bg-muted/70">
                    <div className="w-10 shrink-0 text-center">
                      <div className="text-[10.5px] uppercase text-subtle">{WEEK[parseISO(a.date).getDay()]}</div>
                      <div className="tnum font-display text-[16px] font-medium leading-tight">{parseISO(a.date).getDate()}</div>
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-medium">{a.type}</div>
                      <div className="truncate text-[12px] text-muted-foreground">{c.agencyName(a.agencyId)}{a.time ? ` · ${a.time}` : ""}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {overdue.length > 0 && (
              <div className="border-t border-border px-5 py-3 text-[12.5px] text-danger">{overdue.length} planejada(s) com data vencida — conclua ou cancele.</div>
            )}
          </Panel>
          <AttentionPanel agencies={c.scoped.agencies} lastMap={c.lastMap} managers={c.managers} limit={4} />
        </div>
      </div>
      )}

      <NextStepDialog done={doneAct} agencyName={doneAct?.agencyId ? c.agencyName(doneAct.agencyId) : undefined} onClose={() => setDoneAct(null)} />

      <ActivityDialog open={!!newDate} onClose={() => setNewDate(null)} preset={{ date: newDate ?? todayIso, status: newDate && newDate < todayIso ? "Concluída" : "Planejada" }} />

      <Modal
        open={!!sel}
        onClose={() => setSel(null)}
        title={sel?.type ?? ""}
        subtitle={sel ? `${fmtDate(sel.date)}${sel.time ? ` às ${sel.time}` : ""}` : ""}
        width={480}
        footer={
          sel && (
            <>
              <Button variant="danger" className="mr-auto" loading={remove.isPending} onClick={async () => { await remove.mutateAsync({ id: sel.id }); toast("Atividade excluída"); setSel(null); }}>
                <Trash2 className="size-3.5" />
              </Button>
              {sel.status === "Planejada" && (
                <>
                  <Button onClick={() => { update.mutate({ id: sel.id, status: "Cancelada" }); toast("Atividade cancelada"); setSel(null); }}><X className="size-3.5" /> Cancelar</Button>
                  <Button variant="primary" onClick={() => { update.mutate({ id: sel.id, status: "Concluída" }); toast("Concluída · contabilizada nos indicadores"); setDoneAct(sel); setSel(null); }}><Check className="size-3.5" /> Marcar concluída</Button>
                </>
              )}
              {sel.status !== "Planejada" && <Button onClick={() => setSel(null)}>Fechar</Button>}
            </>
          )
        }
      >
        {sel && (
          <div className="space-y-3 text-[13.5px]">
            <div className="flex items-center gap-2"><Badge tone={statusTone[sel.status as keyof typeof statusTone]} dot>{sel.status}</Badge>{sel.time && <span className="inline-flex items-center gap-1 text-muted-foreground"><Clock className="size-3.5" />{sel.time}</span>}</div>
            <dl className="grid grid-cols-2 gap-3">
              <div><dt className="text-[12px] text-muted-foreground">Imobiliária</dt><dd>{sel.agencyId ? <Link to={`/imobiliarias/${sel.agencyId}`} className="font-medium hover:text-brand-strong">{c.agencyName(sel.agencyId)}</Link> : "—"}</dd></div>
              <div><dt className="text-[12px] text-muted-foreground">Gerente</dt><dd>{c.manager(sel.managerId)?.name ?? "—"}</dd></div>
              <div><dt className="text-[12px] text-muted-foreground">Empreendimento</dt><dd>{c.productName(sel.productId)}</dd></div>
              {sel.participants > 1 && <div><dt className="text-[12px] text-muted-foreground">Participantes</dt><dd>{sel.participants}</dd></div>}
            </dl>
            {sel.notes && <p className="rounded-md bg-muted px-3 py-2 text-muted-foreground">{sel.notes}</p>}
          </div>
        )}
      </Modal>
    </>
  );
}
