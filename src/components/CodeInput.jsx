import { useRef } from 'react';

/** Seis casillas para códigos de verificación. Acepta pegar el código completo. */
export function CodeInput({ value, onChange, onComplete, disabled }) {
  const refs = useRef([]);
  const digits = value.padEnd(6, ' ').slice(0, 6).split('');

  const update = (next) => {
    const clean = next.replace(/\D/g, '').slice(0, 6);
    onChange(clean);
    if (clean.length === 6) onComplete?.(clean);
  };

  return (
    <div className="code-input" role="group" aria-label="Código de 6 dígitos">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          value={d.trim()}
          disabled={disabled}
          aria-label={`Dígito ${i + 1}`}
          autoFocus={i === 0}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, '');
            if (!v) return;
            const arr = digits.map((c) => c.trim());
            arr[i] = v.slice(-1);
            update(arr.join(''));
            refs.current[i + 1]?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key !== 'Backspace') return;
            e.preventDefault();
            const arr = digits.map((c) => c.trim());
            if (arr[i]) { arr[i] = ''; onChange(arr.join('')); } else refs.current[i - 1]?.focus();
          }}
          onPaste={(e) => {
            const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
            if (!pasted) return;
            e.preventDefault();
            update(pasted);
            refs.current[Math.min(pasted.length, 5)]?.focus();
          }}
        />
      ))}
    </div>
  );
}
