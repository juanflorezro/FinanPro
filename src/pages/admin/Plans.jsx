import { useState } from 'react';
import { useApi } from '../../api/useApi.js';
import { api } from '../../api/client.js';
import { useAdminAuth } from '../../auth/AdminAuth.jsx';
import { useAction } from '../../components/useAction.js';
import { PageHeader, Panel, Button, Loading, ErrorNote, Empty, Modal, Input, Select, Textarea, Badge } from '../../components/ui.jsx';
import { money, toCents, fromCents, number } from '../../utils/format.js';
import { CYCLES } from '../../utils/labels.js';

const EMPTY = { code: '', name: '', description: '', price: '', currency: 'COP', billingCycle: 'mensual', maxUsers: '0', maxBorrowers: '0', maxActiveLoans: '0', features: '', isActive: true };
const limit = (n, noun) => (Number(n) ? `${number(n)} ${noun}` : `${noun[0].toUpperCase()}${noun.slice(1)} ilimitados`);

export default function Plans() {
  const { can } = useAdminAuth();
  const { data, error, loading, reload } = useApi('/admin/plans');
  const { run, busy } = useAction();
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  function open(plan) {
    setForm(plan ? {
      ...EMPTY, ...plan,
      price: fromCents(plan.price),
      maxUsers: String(plan.limits?.maxUsers ?? 0),
      maxBorrowers: String(plan.limits?.maxBorrowers ?? 0),
      maxActiveLoans: String(plan.limits?.maxActiveLoans ?? 0),
      features: (plan.features ?? []).join('\n'),
    } : EMPTY);
    setEditing(plan?._id ?? 'new');
  }

  async function save() {
    const body = {
      code: form.code, name: form.name, description: form.description || undefined,
      price: toCents(form.price), currency: form.currency, billingCycle: form.billingCycle,
      limits: { maxUsers: Number(form.maxUsers), maxBorrowers: Number(form.maxBorrowers), maxActiveLoans: Number(form.maxActiveLoans) },
      features: form.features.split('\n').map((f) => f.trim()).filter(Boolean),
      isActive: form.isActive,
    };
    const isNew = editing === 'new';
    const ok = await run(() => api(isNew ? '/admin/plans' : `/admin/plans/${editing}`, { method: isNew ? 'POST' : 'PATCH', body }), isNew ? 'Plan creado' : 'Plan actualizado');
    if (ok) { setEditing(null); reload(); }
  }

  return (
    <>
      <PageHeader title="Planes" subtitle="Lo que cobras a cada empresa y hasta dónde puede crecer con ese precio."
        actions={can('finanzas') && <Button onClick={() => open(null)}>Crear plan</Button>} />

      {loading ? <Loading /> : error ? <ErrorNote error={error} onRetry={reload} /> : data.length === 0 ? (
        <Panel><Empty title="Aún no tienes planes" action={can('finanzas') && <Button variant="secondary" onClick={() => open(null)}>Crear el primero</Button>}>Necesitas al menos uno para habilitar clientes.</Empty></Panel>
      ) : (
        <div className="plans">
          {data.map((p) => (
            <article key={p._id} className={`plan ${p.isActive ? '' : 'plan-off'}`}>
              <header>
                <h2>{p.name}</h2>
                {!p.isActive && <Badge tone="neutral">Inactivo</Badge>}
              </header>
              <p className="plan-price">{money(p.price, p.currency)}<span>/{CYCLES[p.billingCycle].toLowerCase()}</span></p>
              {p.description && <p className="muted">{p.description}</p>}
              <ul className="plan-limits">
                <li>{limit(p.limits?.maxUsers, 'usuarios')}</li>
                <li>{limit(p.limits?.maxBorrowers, 'deudores')}</li>
                <li>{limit(p.limits?.maxActiveLoans, 'préstamos activos')}</li>
                {p.features?.map((f) => <li key={f}>{f}</li>)}
              </ul>
              <footer>
                <span className="muted small">Código {p.code}</span>
                {can('finanzas') && <Button variant="ghost" size="sm" onClick={() => open(p)}>Editar</Button>}
              </footer>
            </article>
          ))}
        </div>
      )}

      <Modal open={Boolean(editing)} title={editing === 'new' ? 'Crear plan' : 'Editar plan'} onClose={() => setEditing(null)} width={620}
        footer={<><Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button><Button loading={busy} disabled={!form.code || !form.name || form.price === ''} onClick={save}>{editing === 'new' ? 'Crear plan' : 'Guardar cambios'}</Button></>}>
        <div className="form-grid">
          <Input label="Nombre" value={form.name} onChange={set('name')} placeholder="Básico" />
          <Input label="Código" value={form.code} onChange={set('code')} placeholder="BASICO" hint="Corto y sin espacios" />
          <Input label="Precio" inputMode="numeric" value={form.price} onChange={set('price')} placeholder="150000" />
          <Select label="Se cobra" value={form.billingCycle} onChange={set('billingCycle')} options={CYCLES} />
          <Input label="Usuarios" type="number" min="0" value={form.maxUsers} onChange={set('maxUsers')} hint="0 = sin límite" />
          <Input label="Deudores" type="number" min="0" value={form.maxBorrowers} onChange={set('maxBorrowers')} hint="0 = sin límite" />
          <Input label="Préstamos activos" type="number" min="0" value={form.maxActiveLoans} onChange={set('maxActiveLoans')} hint="0 = sin límite" />
          <Select label="Moneda" value={form.currency} onChange={set('currency')} options={{ COP: 'Peso colombiano', USD: 'Dólar', MXN: 'Peso mexicano', PEN: 'Sol', EUR: 'Euro' }} />
          <Textarea label="Descripción" value={form.description} onChange={set('description')} className="span-2" />
          <Textarea label="Qué incluye" value={form.features} onChange={set('features')} hint="Una línea por beneficio" className="span-2" />
          <label className="check span-2"><input type="checkbox" checked={form.isActive} onChange={set('isActive')} /> Disponible para asignar a clientes nuevos</label>
        </div>
      </Modal>
    </>
  );
}
