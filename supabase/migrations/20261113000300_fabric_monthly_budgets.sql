create table public.fabric_monthly_budgets (
 organization_id uuid not null references public.organizations(id),
 month date not null check (extract(day from month)=1),
 ceiling_brl numeric(14,2) not null check (ceiling_brl>=0),
 updated_at timestamptz not null default now(),
 primary key (organization_id,month)
);
alter table public.fabric_monthly_budgets enable row level security;
revoke all on public.fabric_monthly_budgets from public,anon,authenticated;
grant select,insert,update on public.fabric_monthly_budgets to authenticated;
create policy fabric_budget_read on public.fabric_monthly_budgets for select to authenticated
 using (public.fabric_user_has_permission(organization_id,'textiles.inventory.view') or public.fabric_user_has_permission(organization_id,'textiles.inventory.manage'));
create policy fabric_budget_insert on public.fabric_monthly_budgets for insert to authenticated
 with check (public.fabric_user_has_permission(organization_id,'textiles.inventory.manage'));
create policy fabric_budget_update on public.fabric_monthly_budgets for update to authenticated
 using (public.fabric_user_has_permission(organization_id,'textiles.inventory.manage'))
 with check (public.fabric_user_has_permission(organization_id,'textiles.inventory.manage'));
