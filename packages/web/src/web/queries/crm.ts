import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "../lib/api";
import type * as s from "../../api/database/schema";

export type Manager = typeof s.managers.$inferSelect;
export type Product = typeof s.products.$inferSelect;
export type Agency = typeof s.agencies.$inferSelect;
export type Activity = typeof s.activities.$inferSelect;
export type Opportunity = typeof s.opportunities.$inferSelect;
export type Goal = typeof s.goals.$inferSelect;

const stale = { staleTime: 30_000 };

export const useMe = () => useQuery(orpc.me.queryOptions({ ...stale, retry: false }));
export const useManagers = () => useQuery(orpc.managers.list.queryOptions(stale));
export const useProducts = () => useQuery(orpc.products.list.queryOptions(stale));
export const useAgencies = () => useQuery(orpc.agencies.list.queryOptions(stale));
export const useActivities = () => useQuery(orpc.activities.list.queryOptions(stale));
export const useOpportunities = () => useQuery(orpc.opportunities.list.queryOptions(stale));
export const useGoals = () => useQuery(orpc.goals.list.queryOptions(stale));

/** Tudo que os painéis precisam, com flag de carregamento única */
export function useCrmData() {
  const managers = useManagers();
  const products = useProducts();
  const agencies = useAgencies();
  const activities = useActivities();
  const opportunities = useOpportunities();
  const goals = useGoals();
  const all = [managers, products, agencies, activities, opportunities, goals];
  return {
    isLoading: all.some((q) => q.isLoading),
    managers: managers.data ?? [],
    products: products.data ?? [],
    agencies: agencies.data ?? [],
    activities: activities.data ?? [],
    opportunities: opportunities.data ?? [],
    goals: goals.data ?? [],
  };
}

function useInvalidate(key: readonly unknown[]) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: key });
    // atividades e negociações podem avançar a etapa da imobiliária no servidor
    qc.invalidateQueries({ queryKey: orpc.agencies.key() });
  };
}

export function useCreateActivity() {
  const inv = useInvalidate(orpc.activities.key());
  return useMutation(orpc.activities.create.mutationOptions({ onSuccess: inv }));
}
export function useUpdateActivity() {
  const qc = useQueryClient();
  const key = orpc.activities.list.queryOptions().queryKey;
  return useMutation(
    orpc.activities.update.mutationOptions({
      onMutate: async (input) => {
        await qc.cancelQueries({ queryKey: key });
        const prev = qc.getQueryData<Activity[]>(key);
        qc.setQueryData<Activity[]>(key, (old) => old?.map((a) => (a.id === input.id ? { ...a, ...input } as Activity : a)));
        return { prev };
      },
      onError: (_e, _i, ctx) => qc.setQueryData(key, ctx?.prev),
      onSettled: () => { qc.invalidateQueries({ queryKey: orpc.activities.key() }); qc.invalidateQueries({ queryKey: orpc.agencies.key() }); },
    }),
  );
}
export function useRemoveActivity() {
  const inv = useInvalidate(orpc.activities.key());
  return useMutation(orpc.activities.remove.mutationOptions({ onSuccess: inv }));
}

export function useCreateOpportunity() {
  const inv = useInvalidate(orpc.opportunities.key());
  return useMutation(orpc.opportunities.create.mutationOptions({ onSuccess: inv }));
}
export function useUpdateOpportunity() {
  const qc = useQueryClient();
  const key = orpc.opportunities.list.queryOptions().queryKey;
  return useMutation(
    orpc.opportunities.update.mutationOptions({
      onMutate: async (input) => {
        await qc.cancelQueries({ queryKey: key });
        const prev = qc.getQueryData<Opportunity[]>(key);
        qc.setQueryData<Opportunity[]>(key, (old) => old?.map((o) => (o.id === input.id ? { ...o, ...input } as Opportunity : o)));
        return { prev };
      },
      onError: (_e, _i, ctx) => qc.setQueryData(key, ctx?.prev),
      onSettled: () => { qc.invalidateQueries({ queryKey: orpc.opportunities.key() }); qc.invalidateQueries({ queryKey: orpc.agencies.key() }); },
    }),
  );
}
export function useRemoveOpportunity() {
  const inv = useInvalidate(orpc.opportunities.key());
  return useMutation(orpc.opportunities.remove.mutationOptions({ onSuccess: inv }));
}

export function useCreateAgency() {
  const inv = useInvalidate(orpc.agencies.key());
  return useMutation(orpc.agencies.create.mutationOptions({ onSuccess: inv }));
}
export function useUpdateAgency() {
  const qc = useQueryClient();
  const key = orpc.agencies.list.queryOptions().queryKey;
  return useMutation(
    orpc.agencies.update.mutationOptions({
      onMutate: async (input) => {
        await qc.cancelQueries({ queryKey: key });
        const prev = qc.getQueryData<Agency[]>(key);
        qc.setQueryData<Agency[]>(key, (old) => old?.map((a) => (a.id === input.id ? { ...a, ...input } as Agency : a)));
        return { prev };
      },
      onError: (_e, _i, ctx) => qc.setQueryData(key, ctx?.prev),
      onSettled: () => qc.invalidateQueries({ queryKey: orpc.agencies.key() }),
    }),
  );
}

export function useSetGoal() {
  const inv = useInvalidate(orpc.goals.key());
  return useMutation(orpc.goals.set.mutationOptions({ onSuccess: inv }));
}
export function useCreateManager() {
  const inv = useInvalidate(orpc.managers.key());
  return useMutation(orpc.managers.create.mutationOptions({ onSuccess: inv }));
}
export function useUpdateManager() {
  const inv = useInvalidate(orpc.managers.key());
  return useMutation(orpc.managers.update.mutationOptions({ onSuccess: inv }));
}
export function useCreateProduct() {
  const inv = useInvalidate(orpc.products.key());
  return useMutation(orpc.products.create.mutationOptions({ onSuccess: inv }));
}
export function useUpdateProduct() {
  const inv = useInvalidate(orpc.products.key());
  return useMutation(orpc.products.update.mutationOptions({ onSuccess: inv }));
}

// ---------- Perfis de acesso ----------
export type Me = NonNullable<ReturnType<typeof useMe>["data"]>;
export type UserRow = Awaited<ReturnType<typeof import("../lib/api").client.users.list>>[number];

/** Permissões do usuário logado, para mostrar/esconder ações na tela */
export function usePerms() {
  const me = useMe();
  const role = me.data?.role;
  return {
    role,
    isAdmin: role === "admin",
    isManager: role === "gerente",
    seesAll: role === "admin" || role === "aprovador",
    canEdit: role === "admin" || role === "gerente",
  };
}
export const useUsers = (enabled = true) => useQuery(orpc.users.list.queryOptions({ ...stale, enabled }));
export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation(orpc.users.create.mutationOptions({ onSuccess: () => { qc.invalidateQueries({ queryKey: orpc.users.key() }); qc.invalidateQueries({ queryKey: orpc.managers.key() }); } }));
}
export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation(orpc.users.update.mutationOptions({ onSuccess: () => { qc.invalidateQueries({ queryKey: orpc.users.key() }); qc.invalidateQueries({ queryKey: orpc.managers.key() }); } }));
}

// ---------- Saídas da carteira ----------
export type AgencyExit = Awaited<ReturnType<typeof import("../lib/api").client.exits.list>>[number];
export const useExits = () => useQuery(orpc.exits.list.queryOptions(stale));
function useExitInvalidate() {
  const qc = useQueryClient();
  return () => {
    for (const k of [orpc.exits.key(), orpc.agencies.key(), orpc.activities.key()]) qc.invalidateQueries({ queryKey: k });
  };
}
export function useRequestExit() {
  const inv = useExitInvalidate();
  return useMutation(orpc.exits.request.mutationOptions({ onSuccess: inv }));
}
export function useDecideExit() {
  const inv = useExitInvalidate();
  return useMutation(orpc.exits.decide.mutationOptions({ onSuccess: inv }));
}
export function useInactivateAgency() {
  const inv = useExitInvalidate();
  return useMutation(orpc.exits.inactivate.mutationOptions({ onSuccess: inv }));
}
export function useReactivateAgency() {
  const inv = useExitInvalidate();
  return useMutation(orpc.exits.reactivate.mutationOptions({ onSuccess: inv }));
}
export const useResetPassword = () => useMutation(orpc.users.resetPassword.mutationOptions());
