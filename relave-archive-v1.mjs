export function mergeRelaveArchive(records, archive) {
  const operations = new Map();
  for (const record of records) {
    if (record.kind !== 'customer' && record.command) operations.set(record.command.trim(), record);
  }
  const imported = new Set();
  const historical = archive.map(([command, client, date, sorted, waste, details]) => {
    imported.add(command);
    const operation = operations.get(command);
    const [quality, expedition, receiving, reasons, qualityDates, expeditionDates, receivingDates] = details || [];
    const items = waste > 0 ? [{type:'Sem classificação no CSV', reason:'Sem classificação no CSV', weight:waste/100}] : [];
    return {
      key:operation?.key || 'arquivo:'+command, command, client, date, kind:'internal', sorted:(sorted ?? 0)/100,
      items, canWeigh:false, weighing:operation?.weighing, archived:true, auditOnly:sorted===null,
      audit:details ? {quality, expedition, receiving, reasons, qualityDates, expeditionDates, receivingDates} : null,
      conflict:waste!==null && expedition!=null && waste!==Math.round(expedition*100)
    };
  });
  return [...records.filter(record => record.kind==='customer'||!imported.has(record.command.trim())), ...historical]
    .sort((a,b)=>a.date.localeCompare(b.date)||a.command.localeCompare(b.command,'pt-BR',{numeric:true}));
}
