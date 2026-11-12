const dayMs = 86400000;
const formatNumber = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const kg = value => formatNumber.format(value) + ' kg';
const percent = value => value == null ? '—' : formatNumber.format(value) + '%';
const dateKey = time => new Date(time).toISOString().slice(0, 10);
const displayDate = date => date.split('-').reverse().join('/');
const weight = row => (row.items || []).reduce((sum, item) => sum + item.weight, 0);
const internal = row => row.kind !== 'customer';
const html = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
}[char]));

function summary(rows) {
  const confirmed = rows.filter(row => Array.isArray(row.items));
  const sorted = confirmed.reduce((sum, row) => sum + row.sorted, 0);
  const waste = confirmed.reduce((sum, row) => sum + weight(row), 0);
  return { sorted, waste, rate: sorted ? 100 * waste / sorted : null, pending: rows.length - confirmed.length };
}

function monday(time) {
  return time - ((new Date(time).getUTCDay() + 6) % 7) * dayMs;
}

function weekLabel(start) {
  const year = new Date(start + 3 * dayMs).getUTCFullYear();
  return 'S' + String(1 + Math.round((start - monday(Date.UTC(year, 0, 4))) / (7 * dayMs))).padStart(2, '0');
}

export function dailyReportData(records, date) {
  const time = Date.parse(date + 'T00:00:00Z');
  if (!Number.isFinite(time) || dateKey(time) !== date) throw Error('Selecione uma data válida.');
  const [year, month] = date.split('-').map(Number);
  const weekStart = monday(time), monthStart = Date.UTC(year, month - 1, 1), monthEnd = Date.UTC(year, month, 1);
  const end = time + dayMs;
  const available = records.filter(row => row.date <= date);
  const daily = available.filter(row => row.date === date);
  function bucket(start, stop, label) {
    const from = dateKey(start), to = dateKey(stop);
    const rows = available.filter(row => row.date >= from && row.date < to);
    return { label, future: start >= end, partial: start < end && stop > end, values: [
      summary(rows.filter(internal)).rate, summary(rows.filter(row => !internal(row))).rate
    ] };
  }
  const weekdays = ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'].map((name, i) => {
    const start = weekStart + i * dayMs;
    return bucket(start, start + dayMs, name + ' ' + dateKey(start).slice(-2));
  });
  const weeks = [];
  for (let start = monday(monthStart); start < monthEnd; start += 7 * dayMs) {
    weeks.push(bucket(Math.max(start, monthStart), Math.min(start + 7 * dayMs, monthEnd), weekLabel(start)));
  }
  const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'].map((label, i) =>
    bucket(Date.UTC(year, i, 1), Date.UTC(year, i + 1, 1), label));
  return { date, iso: weekLabel(weekStart), daily, weekdays, weeks, months };
}

function regression(points) {
  if (points.length < 2) return null;
  const x = points.reduce((sum, p) => sum + p[0], 0) / points.length;
  const y = points.reduce((sum, p) => sum + p[1], 0) / points.length;
  const slope = points.reduce((sum, p) => sum + (p[0] - x) * (p[1] - y), 0) /
    points.reduce((sum, p) => sum + (p[0] - x) ** 2, 0);
  return i => Math.min(100, Math.max(0, y + slope * (i - x)));
}

function chart(buckets, projection = false) {
  const series = [0, 1].map(j => {
    const observed = buckets.flatMap((b, i) => b.values[j] == null ? [] : [[i,b.values[j]]]);
    const closed = observed.filter(([i]) => !buckets[i].partial);
    const fit = regression(closed);
    let derived = [];
    if (fit && projection && buckets.some(b => b.future)) {
      derived = [observed.at(-1), ...buckets.flatMap((b,i) => b.future ? [[i, fit(i)]] : [])];
    } else if (fit && !projection) {
      const start = closed[0][0], end = closed.at(-1)[0];
      derived = Array.from({length: end-start+1}, (_,i) => [i+start,fit(i+start)]);
    }
    return {observed, derived};
  });
  const max = Math.max(4, Math.ceil(Math.max(...series.flatMap(s => [...s.observed,...s.derived].map(p=>p[1])), 0)/4)*4);
  const x = i => 47 + (i+.5)*510/buckets.length;
  const y = v => 123 - v*108/max;
  const grid = Array.from({length:5}, (_, i) => {
    const v = max*i/4;
    return `<line x1="47" x2="557" y1="${y(v)}" y2="${y(v)}" stroke="#dbe5ed"/><text x="39" y="${y(v)+3}" text-anchor="end">${v}%</text>`;
  }).join('');
  const marks = series.map(({observed,derived}, j) => {
    const color = ['#2269a4','#087e73'][j];
    const path = (points,dash='') => `<polyline fill="none" stroke="${color}" stroke-width="2" ${dash} points="${points.map(([i,v])=>x(i)+','+y(v)).join(' ')}"/>`;
    const dot = ([i,v],open) => `<circle cx="${x(i)}" cy="${y(v)}" r="3" stroke="${color}" fill="${open?'white':color}"/>`;
    const actual = observed.map((point, i) => (i && observed[i-1][0] === point[0]-1 ? path([observed[i-1],point]) : '') + dot(point,buckets[point[0]].partial)).join('');
    return actual + path(derived,'stroke-dasharray="5 4"') + (projection ? derived.slice(1).map(p=>dot(p,true)).join('') : '');
  }).join('');
  return `<svg viewBox="0 0 570 149" role="img" aria-label="Evolução percentual do relave">${grid}
    <line x1="47" x2="557" y1="${y(2.5)}" y2="${y(2.5)}" stroke="#99611a" stroke-dasharray="2 3"/>
    ${marks}${buckets.map((b,i)=>`<text x="${x(i)}" y="140" text-anchor="middle">${html(b.label)}${b.partial?'*':''}</text>`).join('')}</svg>`;
}

function table(headings, rows) {
  if (!rows.length) return '<p class="note">Sem registros no dia.</p>';
  return `<table><thead><tr>${headings.map(h=>`<th>${html(h)}</th>`).join('')}</tr></thead><tbody>
    ${rows.map(row=>`<tr>${row.map(cell=>`<td>${html(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

export function renderDailyReport(records, date, logo) {
  const data = dailyReportData(records, date);
  const gao = data.daily.filter(internal), clients = data.daily.filter(row => !internal(row));
  const g = summary(gao), c = summary(clients);
  const checks = gao.filter(row => row.canWeigh && row.command && weight(row)>0).map(row => {
    const check = row.weighing;
    const delta = check ? (Math.round(check.received*100) - Math.round(weight(row)*100))/100 : null;
    return {row,check,delta,status:delta===null?'Aguardando pesagem':delta===0?'Conferida':check.resolved?'Tratada':'Em tratativa'};
  });
  const divergences = checks.filter(x=>x.delta!==null && x.delta!==0);
  const stamp = `Fechamento de ${displayDate(date)} · Semana ISO ${data.iso.slice(1)}`;
  const safeLogo = /^data:image\/(?:webp|png);base64,[A-Za-z0-9+/=]+$/.test(logo||'') ? `<img src="${logo}" alt="GAO Lavanderia">` : '<strong>GAO Lavanderia</strong>';
  const head = title => `<header><div class="brand">${safeLogo}<span>GESTÃO DA QUALIDADE</span></div><h1>${title}</h1><p>${stamp}</p></header>`;
  const card = (name, value, base, note) => `<div><strong>${name}</strong><b>${value}</b><span>${base}</span><small>${note}</small></div>`;
  const reasons = new Map();
  gao.forEach(row=>(row.items||[]).forEach(item=>reasons.set(item.reason,(reasons.get(item.reason)||0)+item.weight)));
  const css = `
    @page{size:A4;margin:11mm}*{box-sizing:border-box}body{margin:0;background:#edf2f6;color:#102d45;font:12px Arial,sans-serif}main{max-width:760px;margin:18px auto;padding:24px;background:#fff}
    header{background:#102d45;color:#fff;border-radius:9px;padding:16px 20px;margin-bottom:13px;break-inside:avoid}.brand{display:flex;align-items:center;gap:14px;color:#a1dfe7;letter-spacing:.06em;font-size:11px}.brand img{background:#fff;border-radius:5px;padding:5px;width:110px}h1{font-size:25px;margin:11px 0 5px}h2{font-size:16px;margin:14px 0 5px}p{margin:4px 0}.note,small{color:#526b80;font-size:10.5px}
    .cards{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}.cards div{background:#eef5f9;border-radius:7px;padding:9px;break-inside:avoid}.cards b,.cards span,.cards small{display:block;margin-top:4px}.cards b{font-size:19px;color:#0e6272}
    table{width:100%;border-collapse:collapse;font-size:11px}th,td{text-align:left;padding:6px;overflow-wrap:anywhere;border-bottom:1px solid #dbe5ed}th{background:#e2edf4}tr,article{break-inside:avoid}thead{display:table-header-group}h2{break-after:avoid}section.trends{break-before:page}svg{width:100%;display:block;max-height:45mm}svg text{font:9px Arial,sans-serif;fill:#526b80}.legend{display:flex;gap:14px;flex-wrap:wrap;font-size:11px}.legend i{display:inline-block;width:16px;border-top:2px solid;margin-right:4px;vertical-align:middle}
    .print{position:sticky;top:0;padding:10px;background:#e2edf4;text-align:center}.print button{background:#2269a4;color:#fff;border:0;border-radius:6px;padding:9px 16px;cursor:pointer}
    @media print{body{background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}main{margin:0;padding:0;max-width:none}.print{display:none}}
  `;
  return `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>GAO • Relatório diário de relave • ${date}</title><style>${css}</style>
  <div class="print"><button type="button" id="save-pdf">Imprimir / salvar PDF</button></div><main>
  ${head('Relatório diário de relave')}
  <div class="cards">
  ${card('Relave interno GAO',percent(g.rate),kg(g.waste)+' / '+kg(g.sorted)+' triados',g.rate===null?'Sem base conferida':g.rate<=2.5?'Dentro da meta de 2,50%':'Acima da meta de 2,50%')}
  ${card('Ocorrência do cliente',percent(c.rate),kg(c.waste)+' / '+kg(c.sorted)+' triados',clients.filter(row=>Array.isArray(row.items)).length+' comanda(s) conferida(s)')}
  ${card('Conferência de peso',divergences.length+' divergência(s)',checks.filter(x=>x.delta===null).length+' aguardando pesagem',divergences.filter(x=>!x.check.resolved).length+' em tratativa')}</div>
  <p class="note">${g.pending+c.pending} comanda(s) aguardando conferência do relave.</p>
  <h2>Conferência de peso na área suja</h2>
  <p class="note">Pesos líquidos. Diferença = área suja menos expedição. Situação atual das comandas do dia.</p>
  ${table(['Comanda','Expedição','Área suja','Diferença','Situação'],checks.map(({row,check,delta,status})=>[row.command,kg(weight(row)),check?kg(check.received):'—',delta===null?'—':(delta>0?'+':'')+kg(delta),status]))}
  <h2>Tratativas da Qualidade</h2>
  ${table(['Comanda','Diferença','Responsável','Causa e ação','Prazo','Situação'],divergences.map(({row,check,delta,status})=>[row.command,percent(100*delta/weight(row)),check.owner||'—',check.action||'Em apuração',check.dueDate?displayDate(check.dueDate):'—',status]))}
  <h2>Motivos do relave interno na expedição</h2>
  ${table(['Motivo','Peso','Participação'],[...reasons].sort((a,b)=>b[1]-a[1]).map(([reason,v])=>[reason,kg(v),percent(g.waste?100*v/g.waste:null)]))}
  <h2>Ocorrências do cliente</h2>
  ${table(['Comanda','Cliente','Motivo','Triado','Relave'],clients.map(row=>[row.command,row.client,[...new Set((row.items||[]).map(i=>i.reason))].join(', ')||'—',kg(row.sorted),row.items?kg(weight(row)):'—']))}
  <p class="note">Percentuais calculados como kg de relave sobre kg triados nas comandas conferidas de cada tipo.</p>
  <section class="trends">${head('Evolução do relave')}
  <div class="legend"><span><i style="color:#2269a4"></i>Interno GAO</span><span><i style="color:#087e73"></i>Ocorrência do cliente</span><span><i style="border-top-style:dotted;color:#99611a"></i>Meta interna 2,50%</span></div>
  <article><h2>Dias da semana ${data.iso}</h2><p class="note">Projeção tracejada até domingo quando há pelo menos dois dias com dados.</p>${chart(data.weekdays,true)}</article>
  <article><h2>Semanas do mês</h2><p class="note">Semanas ISO recortadas no mês. Tendências usam apenas períodos encerrados com dados.</p>${chart(data.weeks)}</article>
  <article><h2>Meses do ano</h2><p class="note">Tendência tracejada para cada tipo de relave.</p>${chart(data.months)}</article>
  <p class="note">* Período parcial. Dias ou períodos sem base ficam sem ponto no gráfico.</p></section>
  </main></html>`;
}
