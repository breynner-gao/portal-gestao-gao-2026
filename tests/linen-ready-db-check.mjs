import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const { PGlite } = await import(process.env.PGLITE_MODULE);
const db = new PGlite();
const id = (n) => "00000000-0000-0000-0000-" + String(n).padStart(12, "0");
await db.exec(
  `create schema private;create schema auth;create role anon;create role authenticated;create role service_role;create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;create table organizations(id uuid primary key);create table profiles(id uuid primary key);create table fabric_suppliers(id uuid primary key,organization_id uuid);create table linen_rfid_snapshots(organization_id uuid,updated_at timestamptz);create table audit_events(actor_profile_id uuid,organization_id uuid,module text,entity text,entity_id text,action text,before_data jsonb,after_data jsonb,source text);create function fabric_user_has_permission(uuid,text) returns boolean language sql as $$select auth.uid()='${id(1)}'::uuid and $1='${id(2)}'::uuid$$;insert into profiles values('${id(1)}');insert into organizations values('${id(2)}'),('${id(3)}');insert into fabric_suppliers values('${id(4)}','${id(2)}');`,
);
await db.exec(
  await readFile(
    process.env.READY_SQL ||
      new URL(
        "../supabase/migrations/20261111103428_linen_ready_purchases.sql",
        import.meta.url,
      ),
    "utf8",
  ),
);
const call = (a, d, org = id(2)) =>
  db
    .query("select linen_ready_purchase($1,$2,$3::jsonb) r", [
      org,
      a,
      JSON.stringify(d),
    ])
    .then((x) => x.rows[0].r);
const create = {
  id: id(5),
  supplierId: id(4),
  productReference: "P",
  productName: "TEST",
  orderNumber: "TEST",
  quantity: 100,
  unitPrice: 10,
  orderedDate: "2026-11-10",
};
await assert.rejects(call("create", create), /Sem permissão/);
await db.query("select set_config('test.uid',$1,false)", [id(1)]);
await assert.rejects(call("create", create, id(3)), /Sem permissão/);
let o = await call("create", create);
await call("create", create);
assert.equal(
  (await db.query("select * from linen_ready_orders")).rows.length,
  1,
);
await assert.rejects(
  call("create", { ...create, quantity: 20 }),
  /Identificador/,
);
const receive = {
  id: o.id,
  requestId: id(6),
  quantity: 40,
  unitPrice: 11,
  invoiceNumber: "TEST",
  receivedDate: "2026-11-10",
};
await call("receive", receive);
await call("receive", receive);
assert.equal(
  (await db.query("select received_pieces from linen_ready_orders")).rows[0]
    .received_pieces,
  40,
);
await assert.rejects(
  call("receive", { ...receive, requestId: id(7), quantity: 61 }),
  /saldo/,
);
await assert.rejects(
  call("edit", { id: o.id, revision: 1, quantity: 100, unitPrice: 10 }),
  /outra pessoa/,
);
await assert.rejects(
  call("edit", { id: o.id, revision: 2, quantity: 30, unitPrice: 10 }),
  /menor/,
);
await db.query("insert into linen_rfid_snapshots values($1,$2)", [
  id(2),
  "2099-01-01T00:00:00Z",
]);
await call("confirm_rfid", {
  id: o.id,
  receiptId: id(6),
  snapshotUpdatedAt: "2099-01-01T00:00:00Z",
});
assert.equal(
  (await db.query("select rfid_confirmed from linen_ready_receipts")).rows[0]
    .rfid_confirmed,
  true,
);
await call("cancel", { id: o.id, revision: 2 });
await assert.rejects(
  call("receive", { ...receive, requestId: id(7), quantity: 10 }),
  /cancelado/,
);
await db.exec("set role authenticated");
await assert.rejects(
  db.query("update linen_ready_orders set received_pieces=0"),
  /permission denied/,
);
await db.exec("reset role");
await db.close();
console.log(
  "PASS ready purchases: auth, tenant, idempotency, partial receipt, overreceipt rejection, editing revision, cancellation, RFID confirmation, direct write rejection.",
);
