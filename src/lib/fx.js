// Hämtar växelkurs till SEK vid skanning.
// Använder Frankfurter (gratis, ingen API-nyckel). Täcker ~30 stora valutor.

const BASE = 'https://api.frankfurter.dev/v1/latest';

export async function getRateToSEK(fromCurrency) {
  if (!fromCurrency) return null;
  const code = fromCurrency.toUpperCase();
  if (code === 'SEK') return 1;

  try {
    const res = await fetch(`${BASE}?base=${encodeURIComponent(code)}&symbols=SEK`);
    if (!res.ok) return null;
    const json = await res.json();
    const rate = json?.rates?.SEK;
    return typeof rate === 'number' ? rate : null;
  } catch {
    return null;
  }
}

export function formatSEK(n) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '–';
  const v = Math.round(Number(n));
  return `${v.toLocaleString('sv-SE')} kr`;
}

export function formatMoney(n, currency) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '–';
  const num = Number(n);
  const cur = (currency || 'SEK').toUpperCase();
  try {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: cur,
      maximumFractionDigits: 2,
    }).format(num);
  } catch {
    return `${num.toFixed(2)} ${cur}`;
  }
}
