// Reglas de validación de formularios. Cada regla devuelve un mensaje o null.
const digits = (v) => String(v ?? '').replace(/\D/g, '');
const blank = (v) => v == null || String(v).trim() === '';

export const rules = {
  required: (msg = 'Este campo es obligatorio') => (v) => (blank(v) ? msg : null),
  minLen: (n, msg) => (v) => (!blank(v) && String(v).trim().length < n ? msg ?? `Mínimo ${n} caracteres` : null),
  email: (msg = 'Escribe un correo válido, por ejemplo nombre@correo.com') => (v) =>
    (!blank(v) && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v).trim()) ? msg : null),
  phone: (msg = 'Escribe un teléfono de 7 a 15 números') => (v) =>
    (!blank(v) && !/^\d{7,15}$/.test(digits(v)) ? msg : null),
  document: (msg = 'Solo números, letras o guiones, de 4 a 20 caracteres') => (v) =>
    (!blank(v) && !/^[0-9A-Za-z-]{4,20}$/.test(String(v).trim()) ? msg : null),
  money: (msg = 'Escribe un valor mayor a 0, sin puntos ni comas') => (v) =>
    (!blank(v) && !(Number(String(v).replace(/[^\d.]/g, '')) > 0 && /^[\d.,\s$]+$/.test(String(v))) ? msg : null),
  decimal: ({ min = 0, max = Infinity } = {}, msg) => (v) => {
    if (blank(v)) return null;
    const n = Number(String(v).replace(',', '.'));
    return Number.isNaN(n) || n < min || n > max ? msg ?? `Escribe un número entre ${min} y ${max}` : null;
  },
  integer: ({ min = 0, max = Infinity } = {}, msg) => (v) => {
    if (blank(v)) return null;
    const n = Number(v);
    return !Number.isInteger(n) || n < min || n > max ? msg ?? `Escribe un número entero entre ${min} y ${max}` : null;
  },
  digitsLen: (n, msg) => (v) => (!blank(v) && digits(v).length !== n ? msg ?? `Deben ser ${n} números` : null),
};

/** validate(values, { campo: [regla, regla] }) → { campo: 'mensaje' } solo con los que fallan */
export function validate(values, schema) {
  const errors = {};
  for (const [field, list] of Object.entries(schema)) {
    for (const rule of list) {
      const msg = rule(values[field], values);
      if (msg) { errors[field] = msg; break; }
    }
  }
  return errors;
}

/** Convierte los detalles de error del backend en { campo: mensaje }. */
export function serverFieldErrors(error) {
  const out = {};
  for (const d of error?.details ?? []) {
    if (!d?.field) continue;
    const key = String(d.field).replace(/^(body|query|params)\./, '').split('.')[0];
    out[key] = d.message;
  }
  if (error?.code === 'DUPLICATE' && error.details) {
    for (const k of Object.keys(error.details)) out[k === 'docNumber' || k === 'docType' ? 'docNumber' : k] = 'Ya existe un registro con este dato';
  }
  return out;
}

/** Lleva el foco al primer campo con error. */
export function focusFirstError() {
  requestAnimationFrame(() => document.querySelector('[aria-invalid="true"]')?.focus());
}
