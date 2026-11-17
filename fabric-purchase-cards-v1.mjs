const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const meters=value=>value.toLocaleString('pt-BR',{maximumFractionDigits:3})+' m';

export function groupPurchaseCards(orders){
  const bySupplier=new Map();
  for(const order of orders){
    if(!bySupplier.has(order.supplierId)){
      bySupplier.set(order.supplierId,{id:order.supplierId,name:order.supplier,orders:[],ordered:0,received:0,pending:0});
    }
    const group=bySupplier.get(order.supplierId);
    group.orders.push(order);
    group.ordered+=order.ordered;
    group.received+=order.received;
    group.pending+=order.cancelled?0:Math.max(0,order.ordered-order.received);
  }
  return [...bySupplier.values()].sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')||a.id.localeCompare(b.id));
}

export function supplierCards(groups){
  return groups.map(group=>`<button type="button" class="fw-po-supplier" data-fw-purchase-supplier="${safe(group.id)}">
    <strong>${safe(group.name)}</strong>
    <span>${group.orders.length} ${group.orders.length===1?'pedido':'pedidos'}</span>
    <span>Pedido ${meters(group.ordered)} · Recebido ${meters(group.received)}</span>
    <span>Falta receber ${meters(group.pending)}</span>
  </button>`).join('');
}
