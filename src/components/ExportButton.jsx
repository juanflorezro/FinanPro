import { useState } from 'react';
import { appDownload } from '../api/appClient.js';
import { useAppAuth } from '../app/AppAuth.jsx';
import { useToast } from './Toast.jsx';
import { Button } from './ui.jsx';

const icon = <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M10 3v9m0 0l-3.5-3.5M10 12l3.5-3.5M4 14v2.5h12V14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;

/** Botón "Exportar a Excel". path: /exports/loans.xlsx, query: filtros actuales. */
export function ExportButton({ path, query, label = 'Exportar Excel', variant = 'secondary', size }) {
  const { can } = useAppAuth();
  const notify = useToast();
  const [busy, setBusy] = useState(false);
  if (!can('export.create')) return null;
  return (
    <Button variant={variant} size={size} loading={busy} onClick={async () => {
      setBusy(true);
      try { await appDownload(path, query); notify('Archivo descargado'); } catch (e) { notify(e.message, 'bad'); } finally { setBusy(false); }
    }}>{!busy && icon}{label}</Button>
  );
}
