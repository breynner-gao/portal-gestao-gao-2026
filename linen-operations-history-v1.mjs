export const timeZone = 'America/Sao_Paulo';
const dateFormat = new Intl.DateTimeFormat('sv-SE', {
  timeZone, year:'numeric', month:'2-digit', day:'2-digit',
  hour:'2-digit', minute:'2-digit', second:'2-digit'
});
export const localTimestamp = value => dateFormat.format(new Date(value));
export const directionLabel = direction => direction === 'supply' ? 'Depósito → Mercado' : 'Mercado → Depósito';

export function filterTransferHistory(events, {product='',direction='',start='',end='',responsible=''} = {}) {
  if (start && end && start > end) throw Error('A data inicial deve ser anterior ou igual à final.');
  return events.filter(event => {
    const date = localTimestamp(event.occurred_at).slice(0,10);
    return (!product || event.request.product_key === product)
      && (!direction || event.request.direction === direction)
      && (!start || date >= start) && (!end || date <= end)
      && (!responsible || event.responsible_id === responsible);
  }).sort((a,b) => Date.parse(b.occurred_at) - Date.parse(a.occurred_at) || b.id.localeCompare(a.id));
}

function excelDate(value) {
  return Date.parse(localTimestamp(value).replace(' ','T') + 'Z') / 86400000 + 25569;
}

export function transferWorkbook(xlsx, events, filters, labels, now = new Date()) {
  if (!events.length) throw Error('Nenhum registro encontrado para exportar.');
  const workbook = xlsx.utils.book_new();
  const history = xlsx.utils.aoa_to_sheet([
    ['Data e hora','Produto','Código','Sentido','Quantidade movimentada','Responsável','Saldo restante','Referência da movimentação','Resultado'],
    ...events.map(event => [
      {t:'n',v:excelDate(event.occurred_at),z:'dd/mm/yyyy hh:mm:ss'}, event.request.product_name,
      event.request.product_code || '', directionLabel(event.request.direction), event.quantity,
      event.responsible, event.remaining, event.id, Number(event.quantity) === 0 ? 'Não movimentado' : 'Movimentado'
    ])
  ]);
  history['!cols'] = [22,34,14,24,22,28,17,38,21].map(wch=>({wch}));
  history['!autofilter'] = {ref:history['!ref']};
  xlsx.utils.book_append_sheet(workbook,history,'Movimentações');
  const applied = xlsx.utils.aoa_to_sheet([
    ['Filtro','Valor'],['Produto',labels.product || 'Todos'],
    ['Sentido',filters.direction ? directionLabel(filters.direction) : 'Todos'],
    ['Início',filters.start || 'Sem limite'],['Fim',filters.end || 'Sem limite'],
    ['Responsável',labels.responsible || 'Todos'],['Fuso horário',timeZone],
    ['Exportado em',{t:'n',v:excelDate(now),z:'dd/mm/yyyy hh:mm:ss'}],['Total exportado',events.length]
  ]);
  applied['!cols']=[{wch:24},{wch:42}];
  xlsx.utils.book_append_sheet(workbook,applied,'Filtros');
  return workbook;
}
