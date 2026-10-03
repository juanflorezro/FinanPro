import { useState } from 'react';
import { Button, SearchInput } from './ui.jsx';

const icon = <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M3 5h14M6 10h8M8.5 15h3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>;

/**
 * Barra de filtros: búsqueda siempre visible + filtros rápidos + panel "Más filtros".
 * chips: [{ label, onClear }] muestra los filtros activos con su botón para quitarlos.
 */
export function FilterBar({ search, onSearch, placeholder, quick, advanced, chips = [], onReset, sort }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="filters">
      <div className="filters-row">
        {onSearch && <SearchInput value={search} onChange={onSearch} placeholder={placeholder} />}
        {quick}
        {advanced && (
          <Button variant="secondary" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="filters-toggle">
            {icon}Más filtros{chips.length > 0 && <span className="count-badge">{chips.length}</span>}
          </Button>
        )}
        {sort}
      </div>
      {advanced && open && <div className="filters-panel">{advanced}</div>}
      {chips.length > 0 && (
        <div className="filters-chips">
          {chips.map((c) => (
            <button key={c.label} type="button" className="chip" onClick={c.onClear} aria-label={`Quitar filtro ${c.label}`}>
              {c.label}<span aria-hidden="true">×</span>
            </button>
          ))}
          <button type="button" className="link-btn small" onClick={onReset}>Limpiar todo</button>
        </div>
      )}
    </div>
  );
}
