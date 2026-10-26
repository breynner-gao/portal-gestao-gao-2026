export function classifySla({ planned, delivered, actualNeed, kind = 'PROGRAMADA' } = {}) {
  if (delivered == null || actualNeed == null) return { status: 'NÃO APURADO', considered: false };
  const p = Number(planned);
  const d = Number(delivered);
  const n = Number(actualNeed);
  if (!Number.isFinite(d) || !Number.isFinite(n)) return { status: 'NÃO APURADO', considered: false };
  const required = kind === 'COMPLEMENTO' ? n : Math.max(p, n);
  return { status: d >= required ? 'CONFORME' : 'NÃO CONFORME', considered: true, required };
}
