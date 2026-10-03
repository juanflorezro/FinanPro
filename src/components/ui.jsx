import { useEffect, useId, useRef } from 'react';

export function Button({ variant = 'primary', size, loading, children, className = '', ...props }) {
  return (
    <button
      type="button"
      className={`btn btn-${variant}${size ? ` btn-${size}` : ''} ${className}`}
      disabled={loading || props.disabled}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <span className="spinner" aria-hidden="true" />}
      {children}
    </button>
  );
}

export function Field({ label, hint, error, required, children, className = '' }) {
  const id = useId();
  const child = typeof children === 'function' ? children(id, `${id}-msg`) : children;
  return (
    <div className={`field ${error ? 'has-error' : ''} ${className}`}>
      {label && (
        <label htmlFor={id}>
          {label}
          {required && <span className="req" aria-hidden="true"> *</span>}
        </label>
      )}
      {child}
      {error
        ? <p className="field-error" id={`${id}-msg`} role="alert">{error}</p>
        : hint && <p className="field-hint" id={`${id}-msg`}>{hint}</p>}
    </div>
  );
}

const a11y = (id, msgId, error, hint, required) => ({
  id,
  'aria-invalid': error ? true : undefined,
  'aria-describedby': error || hint ? msgId : undefined,
  'aria-required': required || undefined,
});

// "required" solo marca el campo con * (la validación la hace cada formulario con utils/validation.js)
export const Input = ({ label, hint, error, required, className, ...props }) => (
  <Field label={label} hint={hint} error={error} required={required} className={className}>
    {(id, msgId) => <input className="input" {...props} {...a11y(id, msgId, error, hint, required)} />}
  </Field>
);

export const Select = ({ label, hint, error, required, options, placeholder, className, ...props }) => (
  <Field label={label} hint={hint} error={error} required={required} className={className}>
    {(id, msgId) => (
      <select className="input" {...props} {...a11y(id, msgId, error, hint)}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {Object.entries(options).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
      </select>
    )}
  </Field>
);

export const Textarea = ({ label, hint, error, required, className, ...props }) => (
  <Field label={label} hint={hint} error={error} required={required} className={className}>
    {(id, msgId) => <textarea className="input" rows={3} {...props} {...a11y(id, msgId, error, hint, required)} />}
  </Field>
);

/** Resumen arriba del formulario cuando hay errores. */
export function FormErrors({ errors }) {
  const n = Object.keys(errors ?? {}).length;
  if (!n) return null;
  return <div className="form-summary" role="alert">{n === 1 ? 'Revisa el campo marcado.' : `Revisa los ${n} campos marcados.`}</div>;
}

export function Badge({ tone = 'neutral', children }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

/** Badge a partir de un mapa de etiquetas: { estado: [texto, tono] } */
export function StatusBadge({ map, value }) {
  const [text, tone] = map[value] ?? [value ?? '—', 'neutral'];
  return <Badge tone={tone}>{text}</Badge>;
}

export function Modal({ open, title, onClose, children, footer, width = 520 }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog ref={ref} className="modal" style={{ '--modal-w': `${width}px` }} onClose={onClose} onCancel={onClose}>
      {open && (
        <>
          <header className="modal-head">
            <h2>{title}</h2>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar">
              <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
            </button>
          </header>
          <div className="modal-body">{children}</div>
          {footer && <footer className="modal-foot">{footer}</footer>}
        </>
      )}
    </dialog>
  );
}

export function Panel({ title, actions, children, className = '', flush }) {
  return (
    <section className={`panel ${flush ? 'panel-flush' : ''} ${className}`}>
      {(title || actions) && (
        <header className="panel-head">
          {title && <h2>{title}</h2>}
          {actions && <div className="panel-actions">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function PageHeader({ title, subtitle, actions, back }) {
  return (
    <header className="page-head">
      <div>
        {back}
        <h1>{title}</h1>
        {subtitle && <p className="page-sub">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

export function Empty({ title, children, action }) {
  return (
    <div className="empty">
      <p className="empty-title">{title}</p>
      {children && <p className="empty-text">{children}</p>}
      {action}
    </div>
  );
}

export function Loading({ label = 'Cargando' }) {
  return <div className="loading" role="status"><span className="spinner" aria-hidden="true" />{label}</div>;
}

export function ErrorNote({ error, onRetry }) {
  if (!error) return null;
  return (
    <div className="error-note" role="alert">
      <span>{error.message}</span>
      {onRetry && <Button variant="ghost" size="sm" onClick={onRetry}>Reintentar</Button>}
    </div>
  );
}

export function Pagination({ page, limit, total, onPage, onLimit }) {
  const pages = Math.max(1, Math.ceil((total ?? 0) / limit));
  if (!total) return null;
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  return (
    <nav className="pagination" aria-label="Paginación">
      <span className="pagination-info">{from}–{to} de {total.toLocaleString('es-CO')}</span>
      {onLimit && (
        <select className="input pagination-size" value={limit} onChange={(e) => onLimit(Number(e.target.value))} aria-label="Registros por página">
          {[10, 20, 50, 100].map((n) => <option key={n} value={n}>{n} por página</option>)}
        </select>
      )}
      {pages > 1 && (
        <span className="pagination-btns">
          <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => onPage(1)} aria-label="Primera página">«</Button>
          <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>Anterior</Button>
          <span className="pagination-page">Página {page} de {pages}</span>
          <Button variant="ghost" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>Siguiente</Button>
          <Button variant="ghost" size="sm" disabled={page >= pages} onClick={() => onPage(pages)} aria-label="Última página">»</Button>
        </span>
      )}
    </nav>
  );
}

export function DefList({ items }) {
  return (
    <dl className="deflist">
      {items.filter(Boolean).map(([term, value]) => (
        <div key={term}><dt>{term}</dt><dd>{value ?? '—'}</dd></div>
      ))}
    </dl>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Buscar' }) {
  return (
    <div className="search">
      <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><circle cx="9" cy="9" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M13.2 13.2L17 17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
      <input className="input" type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
    </div>
  );
}
