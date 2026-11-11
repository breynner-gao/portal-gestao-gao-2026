import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const { PGlite } = await import(process.env.PGLITE_MODULE);
const db = new PGlite();
const id = n => "00000000-0000-0000-0000-" + String(n).padStart(12, "0");
await db.exec(`
create schema private;
create schema auth;
create role anon;
create role authenticated;
create role service_role;
create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
create table organizations(id uuid primary key);
create table fabric_catalog(id uuid, organization_id uuid, primary key(id,organization_id));
create table fabric_lots(id uuid primary key, organization_id uuid, fabric_id uuid, quality_status text, balance numeric);
create table fabric_production_orders(id uuid, organization_id uuid, status text);
create table fabric_production_order_items(id uuid, organization_id uuid, order_id uuid, fabric_id uuid, product_name text);
create table fabric_faction_tracking(id uuid, organization_id uuid, product_name text);
create table test_movements(id text primary key, lot_id uuid, meters numeric);
create function fabric_user_has_permission(uuid,text) returns boolean language sql as $$select auth.uid()='${id(1)}'::uuid and $1='${id(2)}'::uuid$$;
create function fabric_same_standard(uuid,uuid,uuid) returns boolean language sql as $$select $2=$3$$;
create function fabric_post_stock_movement(uuid,uuid,text,numeric,uuid,text,text) returns jsonb language plpgsql as $$
begin
 if $3 <> 'AJUSTE_SAIDA' or $5 is not null then raise exception 'Tipo inesperado'; end if;
 update public.fabric_lots set balance=balance-$4 where id=$2 and organization_id=$1 and balance >= $4;
 if not found then raise exception 'Saldo insuficiente'; end if;
 insert into public.test_movements values($6,$2,$4);
 return '{}'::jsonb;
end $$;
insert into organizations values('${id(2)}'),('${id(3)}');
insert into fabric_catalog values('${id(4)}','${id(2)}');
insert into fabric_lots values('${id(5)}','${id(2)}','${id(4)}','APROVADO',80),('${id(6)}','${id(2)}','${id(4)}','APROVADO',30);
insert into fabric_faction_tracking values('${id(7)}','${id(2)}','Calça');
`);
await db.exec(await readFile(process.env.ENFESTO_SQL || new URL("../supabase/migrations/20261111132848_fabric_cut_enfestos.sql", import.meta.url), "utf8"));
const save = (action, data, org = id(2)) =>
  db.query("select public.fabric_save_enfesto($1,$2,$3::jsonb)", [org, action, JSON.stringify(data)]);
const cut = {
  id: id(8), fabric_id: id(4), cut_on: "2026-11-11", consumed_m: "50.125",
  outputs: [
    { product_name: "Calça", size: "P", pieces: 20, source_type: "programacao", source_id: id(7) },
    { product_name: "Camisa", size: "G", pieces: 30 },
  ],
};
const amounts = async () => (await db.query("select balance::float8 from fabric_lots order by id")).rows.map(r => r.balance);
await assert.rejects(save("create", cut), /Sem permissão/);
await db.query("select set_config('test.uid',$1,false)", [id(1)]);
await assert.rejects(save("create", cut, id(3)), /Sem permissão/);
await save("create", cut);
await save("create", cut);
assert.deepEqual(await amounts(), [80, 30]);
const recorded = (await db.query("select * from fabric_cut_enfestos")).rows;
assert.equal(recorded.length, 1);
assert.equal(recorded[0].stock_posted_at, null);
assert.equal(recorded[0].outputs.length, 2);
await assert.rejects(save("create", { ...cut, id: id(9), outputs: [{ ...cut.outputs[0], pieces: 1.5 }] }), /inteira positiva/);
const stock = (a, b) => ({ id: cut.id, allocations: [{ lot_id: id(5), meters: a }, { lot_id: id(6), meters: b }] });
await assert.rejects(save("post_stock", stock("20", "30")), /igual ao total/);
await assert.rejects(save("post_stock", stock("10", "40.125")), /Saldo insuficiente/);
assert.deepEqual(await amounts(), [80, 30]);
await save("post_stock", stock("30.125", "20"));
await save("post_stock", stock("30.125", "20"));
assert.deepEqual(await amounts(), [49.875, 10]);
await assert.rejects(save("post_stock", stock("31.125", "19")), /já foi registrada/);
await save("create", { ...cut, id: id(9), consumed_m: "5", allocations: [{ lot_id: id(6), meters: "5" }] });
assert.deepEqual(await amounts(), [49.875, 5]);
assert.equal((await db.query("select count(*)::int as count from test_movements")).rows[0].count, 3);
await db.exec("set role authenticated");
await assert.rejects(db.query("update fabric_cut_enfestos set consumed_m = 1"), /permission denied/);
await db.close();
console.log("PASS enfesto: total por corte, tamanhos, origem pendente, baixa única e atômica, acesso por organização.");
