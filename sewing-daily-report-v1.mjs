import { reportCss } from './relave-daily-report-v1.mjs?v=8';

const number = new Intl.NumberFormat('pt-BR');
const percent = new Intl.NumberFormat('pt-BR', {style: 'percent', maximumFractionDigits: 1});
const html = value => String(value ?? '').replace(/[&<>"']/g, c => (
  {'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]
));
const summary = () => ({entries: 0, pieces: 0, points: 0, missing: 0});

function add(group, quantity, points) {
  group.entries++;
  group.pieces += quantity ?? 0;
  group.points += points;
  if (quantity === null) group.missing++;
}

export function sewingDailyData(rows, date, score, personKey) {
  const totals = summary(), people = new Map();
  for (const row of rows) {
    if (row.service_date !== date) continue;
    const key = personKey(row);
    const activity = row.label || row.activity;
    const amount = Number(row.quantity);
    const quantity = row.quantity != null && row.quantity !== '' && Number.isFinite(amount) && amount >= 0 ? amount : null;
    const points = score(row).reduce((sum, [, value]) => sum + value, 0);
    if (!people.has(key)) people.set(key, {...summary(), name: row.responsible, activities: new Map()});
    const person = people.get(key);
    if (!person.activities.has(activity)) person.activities.set(activity, {...summary(), name: activity});
    add(person.activities.get(activity), quantity, points);
    add(person, quantity, points);
    add(totals, quantity, points);
  }
  const ordered = [...people.values()].sort((a, b) =>
    b.points - a.points || b.pieces - a.pieces || a.name.localeCompare(b.name, 'pt-BR')
  );
  return {totals, people: ordered};
}

const css = `
  .sewing-report h2{font-size:17px;margin:18px 0 7px}
  .sewing-report .note{margin:8px 0}
  .sewing-report table td:not(:first-child),.sewing-report table th:not(:first-child){text-align:right}
  .sewing-report .activity td:nth-child(2),.sewing-report .activity th:nth-child(2){text-align:left}
  .sewing-report tfoot{background:#eaf2f6;font-weight:700;display:table-row-group}
  @page{size:A4 landscape;margin:11mm}
  .sewing-report{max-width:1120px}
  .sew-professional-section{margin-top:20px}
  .sew-professional-section h3{margin:0 0 7px;font-size:16px;break-after:avoid}
  .sew-chart-legend{display:flex;flex-wrap:wrap;gap:8px 18px;color:#265c84}
  .sew-professional-section .sew-chart-legend span:nth-child(2){color:#117d6c!important}
  .sew-professional-section .sew-chart-legend span:nth-child(3){color:#9b4d0f!important}
  .sew-chart{background:#18232f;border:1px solid #40566e;border-radius:12px;color:#eef4ff;margin:10px 0;padding:12px;break-inside:avoid}
  .sew-chart h4{margin:0 0 8px;color:#eef4ff;font-size:13px}
  .sew-chart-scroll{overflow-x:auto}
  .sew-column-chart{position:relative;display:grid;grid-template-columns:repeat(var(--periods),minmax(0,1fr));--plot-height:105px}
  .sew-professional-period{display:grid;grid-template-rows:var(--plot-height) auto auto;gap:3px;text-align:center;align-self:stretch;font-size:10px}
  .sew-professional-period strong{padding:2px 2px 0;overflow-wrap:anywhere}
  .sew-column-plot{display:flex;align-items:flex-end;justify-content:center;border-bottom:1px solid #40566e}
  .sew-column{display:block;width:68%;max-width:54px;border-radius:4px 4px 0 0;background:#5bacec}
  .sew-trend{position:absolute;top:0;left:0;width:100%;height:var(--plot-height);max-height:none;pointer-events:none}
  .sew-projected{color:#ffc078}
  @media print{.sewing-report{max-width:none}.sew-chart-scroll{overflow:visible}.sew-column-chart{--plot-height:85px}}
  @media screen and (max-width:740px){.sew-column-chart{min-width:calc(var(--periods) * 47px)}}
  .sewing-report .table-wrap{overflow-x:auto}
  @media print{.sewing-report .table-wrap{overflow:visible}}
  @media screen and (max-width:520px){.sewing-report{margin:0 auto;padding:12px}.sewing-report .cards{gap:5px}.sewing-report .cards div{padding:7px}}
`;

function table(headings, rows, footer = [], className = '') {
  const row = (values, tag) => '<tr>' + values.map(value => '<' + tag + '>' + html(value) + '</' + tag + '>').join('') + '</tr>';
  return `<div class="table-wrap"><table class="${className}"><thead>${row(headings, 'th')}</thead>
    <tbody>${rows.map(values => row(values, 'td')).join('')}</tbody>
    ${footer.length ? '<tfoot>' + row(footer, 'td') + '</tfoot>' : ''}</table></div>`;
}

const pieces = group => group.entries === group.missing ? '—' : number.format(group.pieces);
const metrics = group => [number.format(group.entries), pieces(group), number.format(group.points)];

export function renderSewingDailyReport({totals, people}, date, logo, charts) {
  const dateLabel = date.split('-').reverse().join('/');
  const safeLogo = /^data:image\/(?:webp|png);base64,[A-Za-z0-9+/=]+$/.test(logo || '')
    ? `<img src="${logo}" alt="GAO Lavanderia">` : '<strong>GAO Lavanderia</strong>';
  const cards = [
    ['Peças lançadas', totals.entries ? pieces(totals) : '0'],
    ['Pontos da equipe', number.format(totals.points)],
    ['Profissionais com lançamento', number.format(people.length)]
  ];
  const participation = person => totals.points > 0 ? percent.format(person.points / totals.points) : '—';
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>GAO · Relatório diário da Costura · ${html(dateLabel)}</title><style>${reportCss}${css}</style></head>
    <body><div class="print"></div><main class="sewing-report">
    <header><div class="brand">${safeLogo}<span>PRODUÇÃO · COSTURA</span></div><h1>Relatório diário da Costura</h1><p>Data do serviço ${html(dateLabel)}</p></header>
    <div class="cards">${cards.map(([title, value]) => `<div><strong>${title}</strong><b>${value}</b></div>`).join('')}</div>
    ${charts || ''}
    ${people.length ? `
      <h2>Produção por profissional</h2>
      ${table(['Profissional','Lançamentos','Peças','Pontos','Participação nos pontos'],
        people.map(person => [person.name, ...metrics(person), participation(person)]),
        ['Total da equipe', ...metrics(totals), totals.points > 0 ? percent.format(1) : '—'])}
      <h2>Atividades por profissional</h2>
      ${table(['Profissional','Atividade','Lançamentos','Peças','Pontos'],
        people.flatMap(person => [...person.activities.values()].sort((a,b) => a.name.localeCompare(b.name, 'pt-BR'))
          .map(activity => [person.name, activity.name, ...metrics(activity)])), [], 'activity')}
      <p class="note">As peças são somadas por lançamento. Uma mesma peça pode passar por mais de uma atividade. Os pontos seguem as regras do Painel da Costura.</p>
      ${totals.missing ? `<p class="note">Lançamentos sem quantidade informada: ${number.format(totals.missing)}. O traço indica ausência de quantidade.</p>` : ''}
    ` : '<p class="note">Nenhum lançamento para a data selecionada.</p>'}
    </main></body></html>`;
}
