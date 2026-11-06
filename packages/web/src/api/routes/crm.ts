import { z } from "zod";
import { and, asc, desc, eq, gte, isNull, or } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { authed } from "../middleware/auth";
import { businessDaysBetween, todayIso } from "../../shared/dates";
import { auth } from "../auth";
import { ACTIVITY_BY_STAGE, AGENCY_STAGES, BROKER_REQUIRED_ACTIVITY, BROKER_REQUIRED_OPP_STAGES, DECLINE_REASONS, EXIT_REASONS, ROLES, type AgencyStage, type Role } from "../../shared/constants";
import { db } from "../database";
import * as s from "../database/schema";

const id = z.object({ id: z.number() });
const optNum = z.number().nullable().optional();
const optStr = z.string().nullable().optional();

// ---------- Perfis de acesso ----------
type Access = { role: Role; managerId: number | null };

/** E-mails que viram administradores automaticamente (separados por vírgula). */
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "").split(",").map((e: string) => e.trim().toLowerCase()).filter(Boolean);

/** Busca (ou cria) o perfil do usuário logado. Sem nenhum admin cadastrado, o primeiro usuário vira admin. */
async function loadProfile(user: { id: string; email: string }) {
  const [found] = await db.select().from(s.profiles).where(eq(s.profiles.userId, user.id));
  if (found) return found;
  const admins = await db.select().from(s.profiles).where(eq(s.profiles.role, "admin"));
  const role: Role = ADMIN_EMAILS.includes(user.email.toLowerCase()) || (admins.length === 0 && ADMIN_EMAILS.length === 0) ? "admin" : "pendente";
  return (await db.insert(s.profiles).values({ userId: user.id, role }).returning())[0];
}

/** Procedimento com perfil carregado; bloqueia usuários pendentes ou desativados. */
const access = authed.use(async ({ context, next }) => {
  const p = await loadProfile(context.user);
  if (!p.active) throw new ORPCError("FORBIDDEN", { message: "Usuário desativado. Fale com um administrador." });
  if (p.role === "pendente") throw new ORPCError("FORBIDDEN", { message: "Acesso aguardando liberação de um administrador." });
  return next({ context: { access: { role: p.role as Role, managerId: p.managerId } as Access } });
});
const adminOnly = access.use(({ context, next }) => {
  if (context.access.role !== "admin") throw new ORPCError("FORBIDDEN", { message: "Apenas administradores." });
  return next();
});

const seesAll = (a: Access) => a.role === "admin" || a.role === "aprovador";
/** Filtro por carteira: gerente vê só o que é dele. */
const own = (a: Access, col: any) => (seesAll(a) ? undefined : eq(col, a.managerId ?? -1));
/** Garante que o registro pertence ao gerente logado. */
function assertOwner(a: Access, managerId: number | null | undefined) {
  if (seesAll(a)) return;
  if (managerId == null || managerId !== a.managerId) throw new ORPCError("FORBIDDEN", { message: "Este registro é da carteira de outro gerente." });
}
function denyApprover(a: Access) {
  if (a.role === "aprovador") throw new ORPCError("FORBIDDEN", { message: "Seu perfil não permite esta alteração." });
}
/** Para gerente, o responsável é sempre ele mesmo. */
const forceManager = <T extends { managerId?: number | null }>(a: Access, input: T): T => (seesAll(a) ? input : { ...input, managerId: a.managerId });

/** Nome normalizado para detectar imobiliária duplicada */
const norm = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\b(imobiliaria|imoveis|imob|ltda|me|eireli)\b/g, "").replace(/[^a-z0-9]/g, "");
async function assertNoDuplicate(name: string, ignoreId?: number) {
  const key = norm(name);
  if (!key) return;
  const all = await db.select({ id: s.agencies.id, name: s.agencies.name, managerId: s.agencies.managerId }).from(s.agencies);
  const dup = all.find((r) => r.id !== ignoreId && norm(r.name) === key);
  if (dup) {
    const [m] = dup.managerId ? await db.select().from(s.managers).where(eq(s.managers.id, dup.managerId)) : [];
    throw new ORPCError("CONFLICT", { message: `"${dup.name}" já está cadastrada${m ? ` na carteira de ${m.name}` : ""}.` });
  }
}

// ---------- Gerentes ----------
export const managers = {
  list: access.handler(({ context: { access: a } }) =>
    db.select().from(s.managers).where(own(a, s.managers.id)).orderBy(asc(s.managers.name)),
  ),
  create: adminOnly
    .input(z.object({ name: z.string().min(1), email: optStr, color: z.string().optional() }))
    .handler(async ({ input }) => (await db.insert(s.managers).values(input).returning())[0]),
  update: adminOnly
    .input(id.extend({ name: z.string().optional(), email: optStr, color: z.string().optional(), active: z.boolean().optional() }))
    .handler(async ({ input: { id, ...rest } }) => (await db.update(s.managers).set(rest).where(eq(s.managers.id, id)).returning())[0]),
};

// ---------- Empreendimentos ----------
const productInput = z.object({
  name: z.string().min(1),
  neighborhood: optStr,
  status: z.string().optional(),
  delivery: optStr,
  totalUnits: z.number().optional(),
  soldUnits: z.number().optional(),
  avgPrice: z.number().optional(),
  avgArea: z.number().optional(),
});
export const products = {
  list: access.handler(() => db.select().from(s.products).orderBy(asc(s.products.name))),
  create: adminOnly.input(productInput).handler(async ({ input }) => (await db.insert(s.products).values(input).returning())[0]),
  update: adminOnly
    .input(id.merge(productInput.partial()))
    .handler(async ({ input: { id, ...rest } }) => (await db.update(s.products).set(rest).where(eq(s.products.id, id)).returning())[0]),
};

// ---------- Imobiliárias ----------
const agencyInput = z.object({
  name: z.string().min(1),
  managerId: optNum,
  stage: z.string().optional(),
  brokers: z.number().optional(),
  city: optStr,
  contactName: optStr,
  phone: optStr,
  email: optStr,
  creci: optStr,
  notes: optStr,
  focus: optStr,
  standards: z.array(z.string()).nullable().optional(),
  focusCities: z.array(z.string()).nullable().optional(),
  active: z.boolean().optional(),
});
async function getAgency(agencyId: number) {
  const [row] = await db.select().from(s.agencies).where(eq(s.agencies.id, agencyId));
  if (!row) throw new ORPCError("NOT_FOUND", { message: "Imobiliária não encontrada" });
  return row;
}
export const agencies = {
  list: access.handler(({ context: { access: a } }) =>
    db.select().from(s.agencies).where(own(a, s.agencies.managerId)).orderBy(asc(s.agencies.name)),
  ),
  get: access.input(id).handler(async ({ input, context: { access: a } }) => {
    const row = await getAgency(input.id);
    assertOwner(a, row.managerId);
    return row;
  }),
  create: access.input(agencyInput).handler(async ({ input, context: { access: a } }) => {
    denyApprover(a);
    await assertNoDuplicate(input.name);
    return (await db.insert(s.agencies).values(forceManager(a, input)).returning())[0];
  }),
  update: access.input(id.merge(agencyInput.partial())).handler(async ({ input: { id, ...rest }, context: { access: a } }) => {
    denyApprover(a);
    const row = await getAgency(id);
    assertOwner(a, row.managerId);
    if (a.role !== "admin" && rest.managerId !== undefined && rest.managerId !== row.managerId)
      throw new ORPCError("FORBIDDEN", { message: "Só administradores transferem imobiliárias entre gerentes." });
    if (rest.name) await assertNoDuplicate(rest.name, id);
    if (a.role !== "admin" && rest.active !== undefined && rest.active !== row.active)
      throw new ORPCError("FORBIDDEN", { message: "Para tirar a imobiliária da carteira, use \"Solicitar saída da carteira\"." });
    return (await db.update(s.agencies).set(rest).where(eq(s.agencies.id, id)).returning())[0];
  }),
};

// ---------- Avanço automático da carteira ----------
/** Etapa da carteira correspondente a cada tipo de atividade (envio de material e eventos não mexem na etapa) */
const STAGE_BY_ACTIVITY = Object.fromEntries(Object.entries(ACTIVITY_BY_STAGE).map(([stage, type]) => [type, stage])) as Record<string, AgencyStage>;
const stageIdx = (s: string) => AGENCY_STAGES.indexOf(s as AgencyStage);

/**
 * Regra da carteira:
 * - no dia a dia o card só avança (atividade de etapa à frente move a imobiliária; igual/anterior não mexe);
 * - quando o ciclo fecha (imobiliária em Proposta/Venda sem nenhuma negociação em aberto — venda concluída
 *   ou cliente declinou), a próxima atividade concluída define a nova etapa, mesmo que seja para trás.
 */
async function advanceAgency(agencyId: number | null | undefined, target: AgencyStage | undefined, allowRestart = false) {
  if (!agencyId || !target) return;
  const [ag] = await db.select({ stage: s.agencies.stage }).from(s.agencies).where(eq(s.agencies.id, agencyId));
  if (!ag || ag.stage === target) return;
  let move = stageIdx(target) > stageIdx(ag.stage);
  if (!move && allowRestart && (ag.stage === "Proposta" || ag.stage === "Venda")) {
    const opps = await db.select({ stage: s.opportunities.stage }).from(s.opportunities).where(eq(s.opportunities.agencyId, agencyId));
    const open = opps.some((o) => o.stage !== "Venda" && o.stage !== "Declinou");
    move = !open; // ciclo fechado: a rota recomeça
  }
  if (move) await db.update(s.agencies).set({ stage: target }).where(eq(s.agencies.id, agencyId));
}
const advanceByActivity = (a: { agencyId?: number | null; type?: string | null; status?: string | null }) =>
  a.status === "Concluída" && a.type ? advanceAgency(a.agencyId, STAGE_BY_ACTIVITY[a.type], true) : undefined;
const advanceByOpportunity = (o: { agencyId?: number | null; stage?: string | null }) =>
  advanceAgency(o.agencyId, o.stage === "Venda" ? "Venda" : o.stage === "Proposta" || o.stage === "Aguardando assinatura" ? "Proposta" : undefined);

// ---------- Atividades ----------
const activityInput = z.object({
  type: z.string(),
  date: z.string(),
  time: optStr,
  status: z.string().optional(),
  agencyId: optNum,
  managerId: optNum,
  productId: optNum,
  personName: optStr,
  brokerName: optStr,
  participants: z.number().optional(),
  channel: optStr,
  notes: optStr,
  nextAction: optStr,
  nextDate: optStr,
  origin: z.enum(["acao", "lembrete"]).optional(),
});
async function getActivity(activityId: number) {
  const [row] = await db.select().from(s.activities).where(eq(s.activities.id, activityId));
  if (!row) throw new ORPCError("NOT_FOUND", { message: "Atividade não encontrada" });
  return row;
}
export const activities = {
  list: access.handler(({ context: { access: a } }) =>
    db.select().from(s.activities).where(own(a, s.activities.managerId)).orderBy(desc(s.activities.date), desc(s.activities.id)),
  ),
  create: access.input(activityInput).handler(async ({ input: raw, context: { access: a } }) => {
    denyApprover(a);
    const input = forceManager(a, raw);
    if (input.agencyId) assertOwner(a, (await getAgency(input.agencyId)).managerId);
    if (BROKER_REQUIRED_ACTIVITY.has(input.type) && !input.brokerName?.trim())
      throw new ORPCError("BAD_REQUEST", { message: "Informe o corretor do atendimento ao cliente." });
    // antecedência fixada no cadastro (regra: >= 3 dias úteis = planejada)
    const [row] = await db.insert(s.activities).values({ ...input, leadDays: businessDaysBetween(todayIso(), input.date) }).returning();
    await advanceByActivity({ ...input, status: input.status ?? "Concluída" });
    // Próxima ação vira uma atividade planejada na agenda
    if (input.nextAction && input.nextDate) {
      await db.insert(s.activities).values({
        type: input.type,
        date: input.nextDate,
        status: "Planejada",
        agencyId: input.agencyId,
        managerId: input.managerId,
        productId: input.productId,
        notes: input.nextAction,
        origin: "lembrete",
        leadDays: businessDaysBetween(todayIso(), input.nextDate),
      });
    }
    return row;
  }),
  update: access.input(id.merge(activityInput.partial())).handler(async ({ input: { id, ...rest }, context: { access: a } }) => {
    denyApprover(a);
    assertOwner(a, (await getActivity(id)).managerId);
    const data = { ...(seesAll(a) ? rest : { ...rest, managerId: undefined }), origin: undefined };
    const [row] = await db.update(s.activities).set(data).where(eq(s.activities.id, id)).returning();
    await advanceByActivity(row);
    return row;
  }),
  remove: access.input(id).handler(async ({ input, context: { access: a } }) => {
    denyApprover(a);
    assertOwner(a, (await getActivity(input.id)).managerId);
    await db.delete(s.activities).where(eq(s.activities.id, input.id));
    return { ok: true };
  }),
};

// ---------- Oportunidades ----------
const oppInput = z.object({
  client: z.string().min(1),
  agencyId: optNum,
  brokerName: optStr,
  productId: optNum,
  managerId: optNum,
  unit: optStr,
  stage: z.string().optional(),
  temperature: z.string().optional(),
  value: z.number().optional(),
  tableValue: optNum,
  proposalValue: optNum,
  contractValue: optNum,
  discount: z.number().optional(),
  declineReason: optStr,
  declineNote: optStr,
  date: z.string(),
});
async function getOpportunity(oppId: number) {
  const [row] = await db.select().from(s.opportunities).where(eq(s.opportunities.id, oppId));
  if (!row) throw new ORPCError("NOT_FOUND", { message: "Oportunidade não encontrada" });
  return row;
}
/** Regra: negociação declinada precisa de motivo da lista (e detalhe quando "Outro"). */
function assertDeclineReason(o: { stage?: string | null; declineReason?: string | null; declineNote?: string | null }) {
  if (o.stage !== "Declinou") return;
  if (!o.declineReason || !(DECLINE_REASONS as readonly string[]).includes(o.declineReason))
    throw new ORPCError("BAD_REQUEST", { message: "Selecione o motivo de não compra para declinar a negociação." });
  if (o.declineReason === "Outro" && !o.declineNote?.trim())
    throw new ORPCError("BAD_REQUEST", { message: "Descreva o motivo quando escolher \"Outro\"." });
}
/** Regra: proposta, aguardando assinatura e venda exigem o corretor */
function assertBroker(o: { stage?: string | null; brokerName?: string | null }) {
  if (o.stage && BROKER_REQUIRED_OPP_STAGES.has(o.stage) && !o.brokerName?.trim())
    throw new ORPCError("BAD_REQUEST", { message: "Informe o corretor: é obrigatório em proposta e venda." });
}
export const opportunities = {
  list: access.handler(({ context: { access: a } }) =>
    db.select().from(s.opportunities).where(own(a, s.opportunities.managerId)).orderBy(desc(s.opportunities.date)),
  ),
  create: access.input(oppInput).handler(async ({ input: raw, context: { access: a } }) => {
    denyApprover(a);
    const input = forceManager(a, raw);
    if (input.agencyId) assertOwner(a, (await getAgency(input.agencyId)).managerId);
    assertDeclineReason(input);
    assertBroker(input);
    const [row] = await db.insert(s.opportunities).values(input).returning();
    await advanceByOpportunity(row);
    return row;
  }),
  // aprovador pode atualizar negociações (aprovação de vendas)
  update: access.input(id.merge(oppInput.partial())).handler(async ({ input: { id, ...rest }, context: { access: a } }) => {
    const cur = await getOpportunity(id);
    assertOwner(a, cur.managerId);
    // valida ao entrar em "Declinou" ou ao trocar o motivo (registros antigos com texto livre continuam editáveis)
    const entering = rest.stage === "Declinou" && cur.stage !== "Declinou";
    const changingReason = rest.declineReason !== undefined && rest.declineReason !== cur.declineReason;
    if (entering || changingReason) assertDeclineReason({ ...cur, ...rest });
    // corretor obrigatório ao entrar em proposta/assinatura/venda (ou ao apagar o corretor)
    if ((rest.stage && rest.stage !== cur.stage) || rest.brokerName !== undefined) assertBroker({ ...cur, ...rest });
    const data = seesAll(a) ? rest : { ...rest, managerId: undefined };
    const [row] = await db.update(s.opportunities).set(data).where(eq(s.opportunities.id, id)).returning();
    await advanceByOpportunity(row);
    return row;
  }),
  remove: access.input(id).handler(async ({ input, context: { access: a } }) => {
    denyApprover(a);
    assertOwner(a, (await getOpportunity(input.id)).managerId);
    await db.delete(s.opportunities).where(eq(s.opportunities.id, input.id));
    return { ok: true };
  }),
};

// ---------- Metas ----------
export const goals = {
  list: access.handler(({ context: { access: a } }) =>
    db.select().from(s.goals).where(seesAll(a) ? undefined : or(isNull(s.goals.managerId), eq(s.goals.managerId, a.managerId ?? -1))),
  ),
  set: adminOnly
    .input(z.object({ managerId: z.number().nullable(), metric: z.string(), target: z.number().min(0) }))
    .handler(async ({ input }) => {
      const all = await db.select().from(s.goals);
      const found = all.find((g) => g.metric === input.metric && (g.managerId ?? null) === input.managerId);
      if (found) return (await db.update(s.goals).set({ target: input.target }).where(eq(s.goals.id, found.id)).returning())[0];
      return (await db.insert(s.goals).values(input).returning())[0];
    }),
};

// ---------- Saídas da carteira ----------
const exitReason = z.object({ reason: z.enum(EXIT_REASONS), note: optStr });
function assertExitNote(r: { reason: string; note?: string | null }) {
  if (r.reason === "Outro" && !r.note?.trim()) throw new ORPCError("BAD_REQUEST", { message: "Descreva o motivo quando escolher \"Outro\"." });
}
/** Inativa: some do kanban/metas e cancela lembretes e atividades futuras planejadas */
async function inactivateAgency(agencyId: number) {
  await db.update(s.agencies).set({ active: false }).where(eq(s.agencies.id, agencyId));
  await db
    .update(s.activities)
    .set({ status: "Cancelada" })
    .where(and(eq(s.activities.agencyId, agencyId), eq(s.activities.status, "Planejada"), gte(s.activities.date, todayIso())));
}
async function getExit(exitId: number) {
  const [row] = await db.select().from(s.agencyExits).where(eq(s.agencyExits.id, exitId));
  if (!row) throw new ORPCError("NOT_FOUND", { message: "Solicitação não encontrada" });
  return row;
}
export const exits = {
  list: access.handler(({ context: { access: a } }) =>
    db.select().from(s.agencyExits).where(own(a, s.agencyExits.managerId)).orderBy(desc(s.agencyExits.createdAt)),
  ),
  /** Gerente (ou ADM) pede a saída; a imobiliária continua na carteira até a decisão */
  request: access.input(exitReason.extend({ agencyId: z.number() })).handler(async ({ input, context }) => {
    const a = context.access;
    denyApprover(a);
    assertExitNote(input);
    const ag = await getAgency(input.agencyId);
    assertOwner(a, ag.managerId);
    if (!ag.active) throw new ORPCError("BAD_REQUEST", { message: "A imobiliária já está inativa." });
    const pend = await db.select().from(s.agencyExits).where(and(eq(s.agencyExits.agencyId, ag.id), eq(s.agencyExits.status, "pendente")));
    if (pend.length) throw new ORPCError("CONFLICT", { message: "Já existe uma solicitação de saída pendente para esta imobiliária." });
    return (await db.insert(s.agencyExits).values({ agencyId: ag.id, managerId: ag.managerId, requestedBy: context.user.name, reason: input.reason, note: input.note }).returning())[0];
  }),
  /** ADM decide: inativar, transferir (outra gerente ou sem gerente = roleta) ou recusar */
  decide: adminOnly
    .input(z.object({ id: z.number(), decision: z.enum(["inativar", "transferir", "recusar"]), toManagerId: optNum, note: optStr }))
    .handler(async ({ input, context }) => {
      const ex = await getExit(input.id);
      if (ex.status !== "pendente") throw new ORPCError("BAD_REQUEST", { message: "Esta solicitação já foi decidida." });
      if (input.decision === "recusar" && !input.note?.trim()) throw new ORPCError("BAD_REQUEST", { message: "Informe o motivo da recusa para a gerente." });
      if (input.decision === "inativar") await inactivateAgency(ex.agencyId);
      if (input.decision === "transferir") await db.update(s.agencies).set({ managerId: input.toManagerId ?? null }).where(eq(s.agencies.id, ex.agencyId));
      const status = input.decision === "inativar" ? "inativada" : input.decision === "transferir" ? "transferida" : "recusada";
      return (
        await db
          .update(s.agencyExits)
          .set({ status, decidedBy: context.user.name, decisionNote: input.note, toManagerId: input.decision === "transferir" ? (input.toManagerId ?? null) : null, decidedAt: new Date() })
          .where(eq(s.agencyExits.id, input.id))
          .returning()
      )[0];
    }),
  /** ADM inativa direto (fica registrado) */
  inactivate: adminOnly.input(exitReason.extend({ agencyId: z.number() })).handler(async ({ input, context }) => {
    assertExitNote(input);
    const ag = await getAgency(input.agencyId);
    await inactivateAgency(ag.id);
    // pedidos pendentes desta imobiliária ficam resolvidos pela inativação
    await db.update(s.agencyExits).set({ status: "inativada", decidedBy: context.user.name, decidedAt: new Date() }).where(and(eq(s.agencyExits.agencyId, ag.id), eq(s.agencyExits.status, "pendente")));
    return (await db.insert(s.agencyExits).values({ agencyId: ag.id, managerId: ag.managerId, requestedBy: context.user.name, reason: input.reason, note: input.note, status: "inativada", decidedBy: context.user.name, decidedAt: new Date() }).returning())[0];
  }),
  reactivate: adminOnly.input(z.object({ agencyId: z.number(), note: optStr })).handler(async ({ input, context }) => {
    const ag = await getAgency(input.agencyId);
    await db.update(s.agencies).set({ active: true }).where(eq(s.agencies.id, ag.id));
    return (await db.insert(s.agencyExits).values({ agencyId: ag.id, managerId: ag.managerId, requestedBy: context.user.name, note: input.note, status: "reativada", decidedBy: context.user.name, decidedAt: new Date() }).returning())[0];
  }),
};

// ---------- Usuários (somente admin) ----------
const roleEnum = z.enum(ROLES);
async function ensureManagerFor(role: Role, managerId: number | null | undefined, name: string, email: string) {
  if (role !== "gerente" || managerId) return managerId ?? null;
  // gerente sem carteira vinculada: cria o gerente comercial com o mesmo nome
  const [existing] = await db.select().from(s.managers).where(eq(s.managers.email, email));
  if (existing) return existing.id;
  return (await db.insert(s.managers).values({ name, email }).returning())[0].id;
}
export const users = {
  list: adminOnly.handler(async () => {
    const rows = await db
      .select({ id: s.user.id, name: s.user.name, email: s.user.email, createdAt: s.user.createdAt, role: s.profiles.role, managerId: s.profiles.managerId, active: s.profiles.active })
      .from(s.user)
      .leftJoin(s.profiles, eq(s.profiles.userId, s.user.id))
      .orderBy(asc(s.user.name));
    return rows.map((r) => ({ ...r, role: (r.role ?? "pendente") as Role, active: r.active ?? true }));
  }),
  create: adminOnly
    .input(z.object({ name: z.string().min(1), email: z.string().email(), password: z.string().min(8), role: roleEnum, managerId: optNum }))
    .handler(async ({ input }) => {
      const email = input.email.trim().toLowerCase();
      const [exists] = await db.select().from(s.user).where(eq(s.user.email, email));
      if (exists) throw new ORPCError("CONFLICT", { message: "Já existe um usuário com este e-mail." });
      const res = await auth.api.signUpEmail({ body: { name: input.name.trim(), email, password: input.password } });
      const managerId = await ensureManagerFor(input.role, input.managerId, input.name.trim(), email);
      await db.insert(s.profiles).values({ userId: res.user.id, role: input.role, managerId }).onConflictDoUpdate({ target: s.profiles.userId, set: { role: input.role, managerId } });
      return { id: res.user.id };
    }),
  /** ADM define uma nova senha provisória (não há envio de e-mail) e encerra as sessões abertas do usuário */
  resetPassword: adminOnly.input(z.object({ userId: z.string(), password: z.string().min(8) })).handler(async ({ input }) => {
    const ctx = await auth.$context;
    const [u] = await db.select().from(s.user).where(eq(s.user.id, input.userId));
    if (!u) throw new ORPCError("NOT_FOUND", { message: "Usuário não encontrado" });
    await ctx.internalAdapter.updatePassword(input.userId, await ctx.password.hash(input.password));
    await db.delete(s.session).where(eq(s.session.userId, input.userId));
    return { ok: true };
  }),
  update: adminOnly
    .input(z.object({ userId: z.string(), role: roleEnum.optional(), managerId: optNum, active: z.boolean().optional() }))
    .handler(async ({ input, context }) => {
      if (input.userId === context.user.id && ((input.role && input.role !== "admin") || input.active === false))
        throw new ORPCError("FORBIDDEN", { message: "Você não pode remover o próprio acesso de administrador." });
      const [u] = await db.select().from(s.user).where(eq(s.user.id, input.userId));
      if (!u) throw new ORPCError("NOT_FOUND", { message: "Usuário não encontrado" });
      const [cur] = await db.select().from(s.profiles).where(eq(s.profiles.userId, input.userId));
      const role = input.role ?? (cur?.role as Role) ?? "pendente";
      const managerId = await ensureManagerFor(role, input.managerId !== undefined ? input.managerId : cur?.managerId, u.name, u.email);
      const values = { role, managerId, active: input.active ?? cur?.active ?? true };
      await db.insert(s.profiles).values({ userId: input.userId, ...values }).onConflictDoUpdate({ target: s.profiles.userId, set: values });
      return { ok: true };
    }),
};

/** Usuário logado + perfil. Pendentes/desativados recebem o perfil sem erro, para a tela de aviso. */
export const me = authed.handler(async ({ context }) => {
  const p = await loadProfile(context.user);
  return { ...context.user, role: p.role as Role, managerId: p.managerId, active: p.active };
});

/** Feature export: todas as rotas do CRM */
export const crm = { me, managers, products, agencies, activities, opportunities, goals, users, exits };
