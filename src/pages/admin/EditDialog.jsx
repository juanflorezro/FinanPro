import { useEffect, useState } from 'react';
import { Modal, Button, Input, Select, Textarea, FormErrors } from '../../components/ui.jsx';
import { focusFirstError } from '../../utils/validation.js';
import { useToast } from '../../components/Toast.jsx';

/**
 * Formulario de corrección de soporte. Siempre pide el motivo (queda en la bitácora).
 * fields: [{ name, label, type: 'text'|'number'|'date'|'select'|'textarea'|'money'|'decimal', options, required, hint, span }]
 * onSave(values) → promesa; si falla, muestra el error del servidor en el campo correspondiente.
 */
export function EditDialog({ open, title, intro, fields, initial, onClose, onSave, confirmLabel = 'Guardar corrección', danger }) {
  const notify = useToast();
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) { setValues({ ...initial, reason: '' }); setErrors({}); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k) => (e) => setValues((v) => ({ ...v, [k]: e.target.value }));

  async function save() {
    const found = {};
    for (const f of fields) {
      const v = values[f.name];
      if (f.required && (v === '' || v == null)) found[f.name] = 'Este campo es obligatorio';
      else if (['money', 'number', 'decimal'].includes(f.type) && v !== '' && v != null && Number.isNaN(Number(String(v).replace(',', '.')))) found[f.name] = 'Escribe un número válido';
    }
    if ((values.reason ?? '').trim().length < 5) found.reason = 'Escribe el motivo (mínimo 5 caracteres)';
    setErrors(found);
    if (Object.keys(found).length) { focusFirstError(); return; }
    setBusy(true);
    try {
      await onSave(values);
      onClose();
    } catch (err) {
      const fieldErrors = Object.fromEntries((err.details ?? []).filter((d) => d.field).map((d) => [String(d.field).replace(/^body\./, ''), d.message]));
      setErrors(Object.keys(fieldErrors).length ? fieldErrors : { reason: err.message });
      notify(err.message, 'bad');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} title={title} onClose={onClose} width={620}
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant={danger ? 'danger' : 'primary'} loading={busy} onClick={save}>{confirmLabel}</Button></>}>
      {intro && <p className="modal-lead">{intro}</p>}
      <div className="form-grid">
        <FormErrors errors={errors} />
        {fields.map((f) => {
          const common = { label: f.label, required: f.required, hint: f.hint, error: errors[f.name], value: values[f.name] ?? '', onChange: set(f.name), className: f.span ? 'span-2' : undefined };
          if (f.type === 'select') return <Select key={f.name} {...common} options={f.options} placeholder={f.placeholder} />;
          if (f.type === 'textarea') return <Textarea key={f.name} {...common} />;
          return <Input key={f.name} {...common} type={f.type === 'date' ? 'date' : 'text'} inputMode={['money', 'number'].includes(f.type) ? 'numeric' : f.type === 'decimal' ? 'decimal' : undefined} />;
        })}
        <Textarea label="Motivo de la corrección" required value={values.reason ?? ''} onChange={set('reason')} error={errors.reason} className="span-2"
          hint="Queda en la bitácora con tu nombre. Ejemplo: solicitud #15, el cliente digitó mal el celular." />
      </div>
    </Modal>
  );
}
