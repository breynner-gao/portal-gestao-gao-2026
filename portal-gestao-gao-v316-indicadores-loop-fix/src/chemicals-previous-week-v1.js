(() => {
  'use strict';

  const ROUTE = '/quimicos/historico';
  let applied = false;
  let lastPath = location.pathname;

  function inputValue(input, value) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (!setter) return;
    setter.call(input, String(value));
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function applyPreviousWeek() {
    if (location.pathname !== ROUTE || applied) return;
    const panel = [...document.querySelectorAll('section.data-panel')]
      .find((el) => /Histórico semanal/i.test(el.textContent || ''));
    if (!panel) return;

    const year = panel.querySelector('input[aria-label="Filtrar ano"]');
    const start = panel.querySelector('input[aria-label="Semana inicial"]');
    const end = panel.querySelector('input[aria-label="Semana final"]');
    const rows = [...panel.querySelectorAll('tbody tr')]
      .map((row) => {
        const text = row.querySelector('td strong')?.textContent || '';
        const match = text.match(/Semana\s+(\d+)/i);
        const yearText = row.querySelector('td small')?.textContent || '';
        return match ? { week: Number(match[1]), year: Number(yearText) } : null;
      })
      .filter((row) => row && Number.isFinite(row.week) && Number.isFinite(row.year))
      .sort((a, b) => b.year - a.year || b.week - a.week);

    if (!year || !start || !end || rows.length < 2) return;
    if (year.value || start.value || end.value) return;

    const previous = rows[1];
    inputValue(year, previous.year);
    inputValue(start, previous.week);
    inputValue(end, previous.week);
    applied = true;
  }

  function resetOnRouteChange() {
    if (location.pathname !== lastPath) {
      lastPath = location.pathname;
      applied = false;
    }
    applyPreviousWeek();
  }

  new MutationObserver(resetOnRouteChange).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
  addEventListener('popstate', () => {
    applied = false;
    setTimeout(resetOnRouteChange, 80);
  });
  setInterval(resetOnRouteChange, 500);
  resetOnRouteChange();
})();
