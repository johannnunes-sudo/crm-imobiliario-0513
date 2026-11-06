import { z } from "zod";
import { asc, desc, eq } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { authed } from "../middleware/auth";
import { db } from "../database";
import * as s from "../database/schema";

const id = z.object({ id: z.number() });
const optNum = z.number().nullable().optional();
const optStr = z.string().nullable().optional();

// ---------- Gerentes ----------
export const managers = {
  list: authed.handler(() => db.select().from(s.managers).orderBy(asc(s.managers.name))),
  create: authed
    .input(z.object({ name: z.string().min(1), email: optStr, color: z.string().optional() }))
    .handler(async ({ input }) => (await db.insert(s.managers).values(input).returning())[0]),
  update: authed
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
  list: authed.handler(() => db.select().from(s.products).orderBy(asc(s.products.name))),
  create: authed.input(productInput).handler(async ({ input }) => (await db.insert(s.products).values(input).returning())[0]),
  update: authed
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
  active: z.boolean().optional(),
});
export const agencies = {
  list: authed.handler(() => db.select().from(s.agencies).orderBy(asc(s.agencies.name))),
  get: authed.input(id).handler(async ({ input }) => {
    const [row] = await db.select().from(s.agencies).where(eq(s.agencies.id, input.id));
    if (!row) throw new ORPCError("NOT_FOUND", { message: "Imobiliária não encontrada" });
    return row;
  }),
  create: authed.input(agencyInput).handler(async ({ input }) => (await db.insert(s.agencies).values(input).returning())[0]),
  update: authed
    .input(id.merge(agencyInput.partial()))
    .handler(async ({ input: { id, ...rest } }) => (await db.update(s.agencies).set(rest).where(eq(s.agencies.id, id)).returning())[0]),
};

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
  participants: z.number().optional(),
  channel: optStr,
  notes: optStr,
  nextAction: optStr,
  nextDate: optStr,
});
export const activities = {
  list: authed.handler(() => db.select().from(s.activities).orderBy(desc(s.activities.date), desc(s.activities.id))),
  create: authed.input(activityInput).handler(async ({ input }) => {
    const [row] = await db.insert(s.activities).values(input).returning();
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
      });
    }
    return row;
  }),
  update: authed
    .input(id.merge(activityInput.partial()))
    .handler(async ({ input: { id, ...rest } }) => (await db.update(s.activities).set(rest).where(eq(s.activities.id, id)).returning())[0]),
  remove: authed.input(id).handler(async ({ input }) => {
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
  date: z.string(),
});
export const opportunities = {
  list: authed.handler(() => db.select().from(s.opportunities).orderBy(desc(s.opportunities.date))),
  create: authed.input(oppInput).handler(async ({ input }) => (await db.insert(s.opportunities).values(input).returning())[0]),
  update: authed
    .input(id.merge(oppInput.partial()))
    .handler(async ({ input: { id, ...rest } }) => (await db.update(s.opportunities).set(rest).where(eq(s.opportunities.id, id)).returning())[0]),
  remove: authed.input(id).handler(async ({ input }) => {
    await db.delete(s.opportunities).where(eq(s.opportunities.id, input.id));
    return { ok: true };
  }),
};

// ---------- Metas ----------
export const goals = {
  list: authed.handler(() => db.select().from(s.goals)),
  set: authed
    .input(z.object({ managerId: z.number().nullable(), metric: z.string(), target: z.number().min(0) }))
    .handler(async ({ input }) => {
      const all = await db.select().from(s.goals);
      const found = all.find((g) => g.metric === input.metric && (g.managerId ?? null) === input.managerId);
      if (found) return (await db.update(s.goals).set({ target: input.target }).where(eq(s.goals.id, found.id)).returning())[0];
      return (await db.insert(s.goals).values(input).returning())[0];
    }),
};

export const me = authed.handler(({ context }) => context.user);

/** Feature export: todas as rotas do CRM */
export const crm = { me, managers, products, agencies, activities, opportunities, goals };
