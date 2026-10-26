const n = value => Number.isFinite(Number(value)) ? Number(value) : 0;

export function calculateDuration(start, end, pauses = 0) {
  if (!start || !end) return null;
  const [sh, sm] = String(start).split(':').map(Number);
  const [eh, em] = String(end).split(':').map(Number);
  const total = (eh * 60 + em) - (sh * 60 + sm) - n(pauses);
  return total > 0 ? total : null;
}

export function productivity(quantity, minutes) {
  const q = n(quantity), m = n(minutes);
  return q > 0 && m > 0 ? q / (m / 60) : null;
}

export function isDuplicateActivity(candidate, rows = []) {
  return rows.some(row => candidate.rfidEventId && row.rfidEventId === candidate.rfidEventId) ||
    rows.some(row => row.date === candidate.date && row.userId === candidate.userId && row.type === candidate.type && row.start === candidate.start && row.end === candidate.end && n(row.quantity) === n(candidate.quantity));
}

export function filterActivities(rows = [], filters = {}) {
  const from = filters.dateFrom || '';
  const to = filters.dateTo || '';
  return rows.filter(row => (!from || row.date >= from) && (!to || row.date <= to) && (!filters.userId || row.userId === filters.userId) && (!filters.unit || row.unit === filters.unit) && (!filters.type || row.type === filters.type) && (!filters.product || row.product === filters.product) && (!filters.client || row.client === filters.client) && (!filters.status || row.status === filters.status));
}

export function buildMetrics(rows = []) {
  const activities = rows.length;
  const pieces = rows.reduce((sum, row) => sum + n(row.quantity), 0);
  const productiveMinutes = rows.reduce((sum, row) => sum + n(row.durationMinutes || calculateDuration(row.start, row.end, row.pauses)), 0);
  const productivityValue = productivity(pieces, productiveMinutes);
  return { activities, pieces, productiveMinutes, productivity: productivityValue == null ? 0 : productivityValue, pending: rows.filter(row => row.status === 'PENDENTE' || row.status === 'EM_ANDAMENTO').length };
}
