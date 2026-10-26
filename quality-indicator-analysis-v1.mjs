export const qualityAnalysisSections = [
  { key: 'relave', title: 'Relave e perdas', description: 'Relave confirmado, peças sem condição de uso, causas e reincidência.' },
  { key: 'sla', title: 'SLA e ocorrências', description: 'Entregas, complementos, atrasos, justificativas e exceções.' },
  { key: 'enxoval', title: 'Enxoval', description: 'Acuracidade, suficiência, itens críticos e movimentações.' },
  { key: 'auditorias', title: 'Auditorias e planos', description: 'Apontamentos, evidências, responsáveis e prazos.' },
  { key: 'rouparias', title: 'Rouparias externas', description: 'Rotinas, ocorrências, inventários e pendências por cliente.' },
  { key: 'quimicos', title: 'Químicos e dosadores', description: 'Consumo por kg, custo, calibração e desvios.' },
  { key: 'residuos', title: 'Resíduos e lixo', description: 'Kg triado, empresas coletoras, custo por kg e confirmação legal.' }
];

export function analysisLink(section) {
  return `<a class="ip176-btn secondary" href="/indicadores-performance/analises/${section.key}">Ver detalhes</a>`;
}
