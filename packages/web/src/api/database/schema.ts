import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export * from "./auth-schema";

/** Gerentes comerciais */
export const managers = sqliteTable("managers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email"),
  color: text("color").notNull().default("#5FAE3A"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
});

/** Empreendimentos / produtos */
export const products = sqliteTable("products", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  neighborhood: text("neighborhood"),
  status: text("status").notNull().default("Em obras"), // Lançamento | Em obras | Pronto
  delivery: text("delivery"),
  totalUnits: integer("total_units").notNull().default(0),
  soldUnits: integer("sold_units").notNull().default(0),
  avgPrice: real("avg_price").notNull().default(0),
  avgArea: real("avg_area").notNull().default(0),
});

/** Imobiliárias parceiras */
export const agencies = sqliteTable("agencies", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  managerId: integer("manager_id").references(() => managers.id),
  stage: text("stage").notNull().default("Captação"),
  brokers: integer("brokers").notNull().default(0),
  city: text("city"),
  contactName: text("contact_name"),
  phone: text("phone"),
  email: text("email"),
  creci: text("creci"),
  notes: text("notes"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

/** Atividades comerciais (planejadas ou concluídas) */
export const activities = sqliteTable("activities", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  type: text("type").notNull(),
  date: text("date").notNull(), // YYYY-MM-DD
  time: text("time"),
  status: text("status").notNull().default("Concluída"), // Planejada | Concluída | Cancelada
  agencyId: integer("agency_id").references(() => agencies.id),
  managerId: integer("manager_id").references(() => managers.id),
  productId: integer("product_id").references(() => products.id),
  personName: text("person_name"),
  participants: integer("participants").notNull().default(1),
  channel: text("channel"),
  notes: text("notes"),
  nextAction: text("next_action"),
  nextDate: text("next_date"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

/** Oportunidades (negociações, propostas, vendas) */
export const opportunities = sqliteTable("opportunities", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  client: text("client").notNull(),
  agencyId: integer("agency_id").references(() => agencies.id),
  brokerName: text("broker_name"),
  productId: integer("product_id").references(() => products.id),
  managerId: integer("manager_id").references(() => managers.id),
  unit: text("unit"),
  stage: text("stage").notNull().default("Em negociação"),
  temperature: text("temperature").notNull().default("Morno"),
  value: real("value").notNull().default(0), // valor efetivo: contrato (venda) ou proposta
  tableValue: real("table_value"), // valor de tabela da unidade
  proposalValue: real("proposal_value"), // valor da proposta
  contractValue: real("contract_value"), // valor de contrato (venda)
  discount: real("discount").notNull().default(0),
  declineReason: text("decline_reason"),
  date: text("date").notNull(), // YYYY-MM-DD
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

/** Metas mensais por indicador (managerId null = meta da equipe) */
export const goals = sqliteTable("goals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  managerId: integer("manager_id").references(() => managers.id),
  metric: text("metric").notNull(),
  target: integer("target").notNull(),
});

/**
 * Perfil de acesso de cada usuário.
 * role: admin (vê e edita tudo) | gerente (só a própria carteira) | aprovador (vê tudo, aprova vendas) | pendente (sem acesso)
 * managerId: gerente comercial ao qual o usuário está ligado (obrigatório para "gerente").
 */
export const profiles = sqliteTable("profiles", {
  userId: text("user_id").primaryKey(),
  role: text("role").notNull().default("pendente"),
  managerId: integer("manager_id").references(() => managers.id),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
});
