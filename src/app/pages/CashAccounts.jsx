import { useState } from 'react';
import { useAppApi } from '../../api/useAppApi.js';
import { appApi } from '../../api/appClient.js';
import { useAppAuth } from '../AppAuth.jsx';
import { useAppAction } from '../useAppAction.js';
import { PageHeader, Panel, Button, Loading, ErrorNote, Empty, Modal, Input, Select } from '../../components/ui.jsx';

const TYPES = { efectivo: 'Efectivo', banco: 'Cuenta bancaria', billetera_digital: 'Billetera digital (Nequi, Daviplata)' };

export default function CashAccounts() {
  const { can, org } = useAppAuth();
  const { data, error, loading, reload } = useAppApi('/cash-accounts');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'efectivo', bankName: '', accountMask: '' });
  const { run, busy } = useAppAction();
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <>
      <PageHeader title="Cajas" subtitle="Dónde entra la plata: efectivo, cuentas de banco o billeteras. Cada pago se registra en una caja."
        actions={can('cash.create') && org.status === 'activa' && <Button onClick={() => setOpen(true)}>Crear caja</Button>} />
      <Panel flush>
        {loading ? <Loading /> : error ? <ErrorNote error={error} onRetry={reload} /> : data.length === 0 ? (
          <Empty title="No tienes cajas" action={can('cash.create') && <Button variant="secondary" onClick={() => setOpen(true)}>Crear la primera</Button>}>Necesitas al menos una para registrar pagos.</Empty>
        ) : (
          <table className="table">
            <thead><tr><th>Nombre</th><th>Tipo</th><th>Cuenta</th></tr></thead>
            <tbody>{data.map((c) => <tr key={c._id}><td><strong>{c.name}</strong></td><td>{TYPES[c.type]}</td><td>{c.bankName ? `${c.bankName}${c.accountMask ? ` terminada en ${c.accountMask}` : ''}` : '—'}</td></tr>)}</tbody>
          </table>
        )}
      </Panel>
      <Modal open={open} title="Crear caja" onClose={() => setOpen(false)}
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button loading={busy} disabled={form.name.trim().length < 2} onClick={async () => {
            const body = { name: form.name.trim(), type: form.type, ...(form.bankName && { bankName: form.bankName }), ...(form.accountMask && { accountMask: form.accountMask }) };
            const r = await run(() => appApi('/cash-accounts', { method: 'POST', body }), 'Caja creada');
            if (r.ok) { setOpen(false); setForm({ name: '', type: 'efectivo', bankName: '', accountMask: '' }); reload(); }
          }}>Crear caja</Button></>}>
        <div className="form-grid">
          <Input label="Nombre" value={form.name} onChange={set('name')} placeholder="Caja principal" className="span-2" />
          <Select label="Tipo" value={form.type} onChange={set('type')} options={TYPES} className="span-2" />
          {form.type !== 'efectivo' && <>
            <Input label="Banco o billetera" value={form.bankName} onChange={set('bankName')} />
            <Input label="Últimos 4 dígitos" inputMode="numeric" maxLength={4} value={form.accountMask} onChange={set('accountMask')} />
          </>}
        </div>
      </Modal>
    </>
  );
}
