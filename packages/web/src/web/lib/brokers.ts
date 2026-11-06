import type { Activity, Opportunity } from "../queries/crm";

/** Chave para agrupar grafias do mesmo corretor ("Marcos Silva", "marcos  silva", "Márcos Silva") */
export const brokerKey = (n: string) => n.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/** Corretor citado numa atividade: campo próprio ou, nas atividades com corretor, o nome da pessoa */
export const brokerOfActivity = (a: Activity) =>
  a.brokerName?.trim() || (a.type !== "Atendimento ao cliente" && a.personName?.trim() ? a.personName.trim() : null);

/** Nome tudo em minúsculas vira "Nome Sobrenome" */
export const prettyName = (n: string) => (n === n.toLowerCase() ? n.replace(/(^|\s)\p{L}/gu, (m) => m.toUpperCase()) : n);

export type BrokerRow = { key: string; name: string; agencyIds: Set<number>; activities: number; proposals: number; sales: number; vgv: number; last: string };

/** Lista de corretores derivada de negociações e atividades (sem cadastro próprio ainda) */
export function brokerList(opps: Opportunity[], acts: Activity[], agencyId?: number | null): BrokerRow[] {
  const map = new Map<string, BrokerRow & { spellings: Map<string, number> }>();
  const touch = (raw: string | null | undefined, agency: number | null, date: string) => {
    const name = raw?.trim();
    if (!name) return null;
    if (agencyId && agency !== agencyId) return null;
    const key = brokerKey(name);
    let r = map.get(key);
    if (!r) map.set(key, (r = { key, name, agencyIds: new Set(), activities: 0, proposals: 0, sales: 0, vgv: 0, last: date, spellings: new Map() }));
    r.spellings.set(name, (r.spellings.get(name) ?? 0) + 1);
    if (agency) r.agencyIds.add(agency);
    if (date > r.last) r.last = date;
    return r;
  };
  for (const a of acts) {
    const r = touch(brokerOfActivity(a), a.agencyId, a.date);
    if (r && a.status === "Concluída") r.activities++;
  }
  for (const o of opps) {
    const r = touch(o.brokerName, o.agencyId, o.date);
    if (!r) continue;
    if (o.stage !== "Em negociação") r.proposals++;
    if (o.stage === "Venda") { r.sales++; r.vgv += o.contractValue ?? o.value; }
  }
  // exibe a grafia mais usada, preferindo a que tem maiúsculas ("Marcos Silva" em vez de "marcos silva")
  return [...map.values()]
    .map(({ spellings, ...r }) => ({ ...r, name: prettyName([...spellings].sort((a, b) => Number(b[0] !== b[0].toLowerCase()) - Number(a[0] !== a[0].toLowerCase()) || b[1] - a[1])[0][0]) }))
    .sort((a, b) => b.sales - a.sales || b.proposals - a.proposals || b.activities - a.activities || a.name.localeCompare(b.name));
}
