import { useState } from 'react';
import { useApi } from '../../api/useApi.js';
import { api } from '../../api/client.js';
import { useAdminAuth } from '../../auth/AdminAuth.jsx';
import { useAction } from '../../components/useAction.js';
import { PageHeader, Panel, Button, Loading, ErrorNote, Empty, Modal, Input, Select, Badge } from '../../components/ui.jsx';
import { date, percent, inputDate } from '../../utils/format.js';
import { MODALITIES, COUNTRIES } from '../../utils/labels.js';
import { rules, validate, focusFirstError } from '../../utils/validation.js';

const RULES = {
  maxAnnualEffectiveRate: [rules.required('Escribe la tasa máxima'), rules.decimal({ min: 0.01, max: 1000 }, 'Escribe un porcentaje válido, ej. 29.66')],
  validFrom: [rules.required('Elige desde cuándo rige')],
};

const EMPTY = { country: 'CO', modality: 'consumo', maxAnnualEffectiveRate: '', validFrom: inputDate(new Date()), validTo: '', sourceResolution: '', notes: '' };

export default function RateCaps() {
  const { can } = useAdminAuth();
  const [country, setCountry] = useState('CO');
  const { data, error, loading, reload } = useApi('/admin/rate-caps', { country });
  const { run, busy } = useAction();
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  function open(cap) {
    setForm(cap ? { ...EMPTY, ...cap, validFrom: inputDate(cap.validFrom), validTo: inputDate(cap.validTo), sourceResolution: cap.sourceResolution ?? '', notes: cap.notes ?? '' } : { ...EMPTY, country });
    setErrors({});
    setEditing(cap?._id ?? 'new');
  }

  async function save() {
    const found = validate(form, RULES);
    if (form.validTo && form.validFrom && form.validTo < form.validFrom) found.validTo = 'Debe ser después de la fecha de inicio';
    setErrors(found);
    if (Object.keys(found).length) { focusFirstError(); return; }
    const body = {
      country: form.country, modality: form.modality,
      maxAnnualEffectiveRate: String(form.maxAnnualEffectiveRate).replace(',', '.'),
      validFrom: form.validFrom, validTo: form.validTo || null,
      ...(form.sourceResolution && { sourceResolution: form.sourceResolution }),
      ...(form.notes && { notes: form.notes }),
    };
    const isNew = editing === 'new';
    if (await run(() => api(isNew ? '/admin/rate-caps' : `/admin/rate-caps/${editing}`, { method: isNew ? 'POST' : 'PATCH', body }), 'Tasa guardada')) {
      setEditing(null);
      reload();
    }
  }

  return (
    <>
      <PageHeader
        title="Tasas legales"
        subtitle="Topes de interés por país y modalidad. Solo se aplican a las organizaciones acogidas a la ley; las de tasa libre no se revisan."
        actions={can('finanzas') && <Button onClick={() => open(null)}>Registrar tasa</Button>}
      />
      <Panel flush>
        <div className="toolbar">
          <Select aria-label="País" value={country} onChange={(e) => setCountry(e.target.value)} options={COUNTRIES} />
        </div>
        {loading ? <Loading /> : error ? <ErrorNote error={error} onRetry={reload} /> : !data?.length ? (
          <Empty title={`Sin tasas registradas para ${COUNTRIES[country]}`}>
            Carga la tasa máxima vigente cada vez que la autoridad la publique. En Colombia la certifica la Superintendencia Financiera.
          </Empty>
        ) : (
          <table className="table">
            <thead><tr><th>Modalidad</th><th className="num">Máximo efectivo anual</th><th>Vigencia</th><th>Fuente</th><th /></tr></thead>
            <tbody>
              {data.map((c) => (
                <tr key={c._id}>
                  <td>{MODALITIES[c.modality]}{c.isCurrent && <> <Badge tone="ok">Vigente</Badge></>}</td>
                  <td className="num"><strong>{percent(c.maxAnnualEffectiveRate)}</strong></td>
                  <td>{date(c.validFrom)} {c.validTo ? `al ${date(c.validTo)}` : 'en adelante'}</td>
                  <td>{c.sourceResolution ?? '—'}</td>
                  <td className="num">{can('finanzas') && <Button variant="ghost" size="sm" onClick={() => open(c)}>Editar</Button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      <Modal open={Boolean(editing)} title={editing === 'new' ? 'Registrar tasa máxima' : 'Editar tasa máxima'} onClose={() => setEditing(null)} width={600}
        footer={<><Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button><Button loading={busy} onClick={save}>Guardar tasa</Button></>}>
        <div className="form-grid">
          <Select label="País" value={form.country} onChange={set('country')} options={COUNTRIES} />
          <Select label="Modalidad" value={form.modality} onChange={set('modality')} options={MODALITIES} />
          <Input label="Tasa máxima (% efectivo anual)" required inputMode="decimal" value={form.maxAnnualEffectiveRate} onChange={set('maxAnnualEffectiveRate')} placeholder="29.66" error={errors.maxAnnualEffectiveRate} className="span-2" />
          <Input label="Vigente desde" required type="date" value={form.validFrom} onChange={set('validFrom')} error={errors.validFrom} />
          <Input label="Vigente hasta" type="date" value={form.validTo} onChange={set('validTo')} error={errors.validTo} hint="Vacío si no tiene fecha de fin" />
          <Input label="Fuente" value={form.sourceResolution} onChange={set('sourceResolution')} placeholder="Resolución de la Superfinanciera" className="span-2" />
        </div>
      </Modal>
    </>
  );
}
