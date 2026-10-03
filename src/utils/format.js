const moneyFmt = new Map();

/** Centavos → "$ 1.234.567" */
export function money(cents, currency = 'COP') {
  if (cents == null) return '—';
  if (!moneyFmt.has(currency)) {
    moneyFmt.set(currency, new Intl.NumberFormat('es-CO', { style: 'currency', currency, maximumFractionDigits: currency === 'COP' ? 0 : 2 }));
  }
  return moneyFmt.get(currency).format(cents / 100);
}

export const toCents = (pesos) => Math.round(Number(String(pesos).replace(/[^\d.-]/g, '') || 0) * 100);
export const fromCents = (cents) => (cents == null ? '' : String(cents / 100));

const dateFmt = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

const shortFmt = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short' });

/** Fecha corta; muestra el año solo si no es el actual. */
export const date = (d) => {
  if (!d) return '—';
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return '—';
  return (x.getFullYear() === new Date().getFullYear() ? shortFmt : dateFmt).format(x);
};
export const dateTime = (d) => (d && !Number.isNaN(new Date(d).getTime()) ? dateTimeFmt.format(new Date(d)) : '—');
export const inputDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');

export function daysFromNow(d) {
  if (!d) return null;
  return Math.ceil((new Date(d) - Date.now()) / 86_400_000);
}

export function relativeDays(d) {
  const n = daysFromNow(d);
  if (n == null) return '';
  if (n === 0) return 'hoy';
  if (n === 1) return 'mañana';
  if (n === -1) return 'ayer';
  return n > 0 ? `en ${n} días` : `hace ${-n} días`;
}

export const percent = (v, digits = 2) => (v == null ? '—' : `${Number(v).toLocaleString('es-CO', { maximumFractionDigits: digits })} %`);
export const number = (v) => (v == null ? '—' : Number(v).toLocaleString('es-CO'));
