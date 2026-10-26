(() => {
  'use strict';

  const ROUTE = '/quimicos/historico';
  const META = 'R$ 0,120/kg';
  let lastReference = '';

  function referenceFromTable(root) {
    const rows = [...root.querySelectorAll('tbody tr')];
    const weeks = rows.map((row) => {
      const text = row.textContent || '';
      const match = text.match(/Semana\s+(\d+)/i);
      return match ? Number(match[1]) : null;
    }).filter(Number.isFinite).sort((a, b) => b - a);
    return weeks.length > 1 ? weeks[1] : weeks[0] || null;
  }

  function update() {
    if (location.pathname !== ROUTE) return;
    const legacy = document.querySelector('#chem-v73-period');
    const native = [...document.querySelectorAll('section.data-panel')]
      .find((el) => /Histórico semanal/i.test(el.textContent || ''));
    const root = legacy || native;
    if (!root) return;

    const reference = referenceFromTable(root);
    const card = [...root.querySelectorAll('.k')].find((el) => /Custo médio CRM/i.test(el.textContent || ''));
    if (card && reference) {
      const small = [...card.querySelectorAll('small')].at(-1);
      if (small) small.textContent = `Meta: ${META} • Semana de referência: ${reference}`;
    }

    if (!legacy && reference && reference !== lastReference) {
      let note = root.querySelector('[data-chemical-reference]');
      if (!note) {
        note = document.createElement('p');
        note.dataset.chemicalReference = '1';
        note.style.cssText = 'margin:10px 0 0;color:#52708b;font-size:13px;font-weight:700;';
        root.querySelector('.section-heading')?.after(note);
      }
      note.textContent = `Meta aprovada: ${META} • Semana de referência: ${reference}`;
      lastReference = String(reference);
    }
  }

  new MutationObserver(update).observe(document.documentElement, { childList: true, subtree: true });
  addEventListener('popstate', () => setTimeout(update, 80));
  setInterval(update, 700);
  update();
})();
