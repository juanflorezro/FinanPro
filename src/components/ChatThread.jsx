import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Button } from './ui.jsx';

const time = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/**
 * Conversación tipo chat. side: 'user' (app de la empresa) o 'admin' (panel).
 * - El mensaje aparece al instante mientras se envía.
 * - Baja al último mensaje solo si ya estabas abajo (no te mueve si estás leyendo arriba).
 * - Solo se desplaza la lista, nunca la página completa.
 */
export function ChatThread({ messages, side, onSend, disabled, placeholder = 'Escribe un mensaje', allowInternal }) {
  const [text, setText] = useState('');
  const [internal, setInternal] = useState(false);
  const [pending, setPending] = useState([]); // mensajes enviándose
  const [error, setError] = useState('');
  const listRef = useRef(null);
  const stick = useRef(true);
  const first = useRef(true);

  const all = [...messages, ...pending];

  // Quita de "pendientes" los que ya llegaron del servidor
  useEffect(() => {
    if (!pending.length) return;
    setPending((p) => p.filter((m) => !messages.some((x) => x.body === m.body && x.authorType === m.authorType && new Date(x.createdAt) >= new Date(m.createdAt) - 60_000)));
  }, [messages]); // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    if (first.current || stick.current) el.scrollTop = el.scrollHeight;
    first.current = false;
  }, [all.length]);

  const onScroll = () => {
    const el = listRef.current;
    stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  async function send(e) {
    e?.preventDefault();
    const body = text.trim();
    if (!body || disabled) return;
    const temp = { _id: `tmp-${Date.now()}`, authorType: side, body, internal, createdAt: new Date().toISOString(), sending: true };
    setPending((p) => [...p, temp]);
    setText('');
    setInternal(false);
    setError('');
    stick.current = true;
    try {
      await onSend(body, temp.internal);
    } catch (err) {
      setPending((p) => p.filter((m) => m._id !== temp._id));
      setText(body);
      setError(err.message ?? 'No se pudo enviar. Intenta de nuevo.');
    }
  }

  return (
    <div className="chat">
      <ol className="chat-list" ref={listRef} onScroll={onScroll} aria-live="polite">
        {all.length === 0 && <li className="chat-empty">Todavía no hay mensajes. Escribe el primero.</li>}
        {all.map((m) => {
          if (m.authorType === 'system') return <li key={m._id} className="chat-system">{m.body}<span>{time.format(new Date(m.createdAt))}</span></li>;
          const mine = m.authorType === side;
          return (
            <li key={m._id} className={`chat-msg ${mine ? 'mine' : 'theirs'} ${m.internal ? 'internal' : ''} ${m.sending ? 'sending' : ''}`}>
              <div className="chat-bubble">
                {!mine && <strong className="chat-author">{m.authorType === 'admin' && side === 'user' ? `${m.authorName}, soporte FinanPro` : m.authorName}</strong>}
                {m.internal && <strong className="chat-author">Nota interna, el cliente no la ve</strong>}
                <p>{m.body}</p>
                <span className="chat-time">{m.sending ? 'Enviando…' : time.format(new Date(m.createdAt))}</span>
              </div>
            </li>
          );
        })}
      </ol>
      <form className="chat-compose" onSubmit={send}>
        {error && <p className="field-error" role="alert">{error}</p>}
        <textarea
          className="input" rows={2} value={text} disabled={disabled} maxLength={5000}
          placeholder={disabled ? 'Esta conversación está cerrada' : placeholder}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && !window.matchMedia('(max-width: 768px)').matches) { e.preventDefault(); send(); }
          }}
          aria-label="Mensaje"
        />
        <div className="chat-actions">
          {allowInternal && <label className="check small"><input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} /> Nota interna</label>}
          <span className="muted small chat-tip">Enter para enviar, Shift + Enter para nueva línea</span>
          <Button type="submit" disabled={disabled || !text.trim()}>Enviar</Button>
        </div>
      </form>
    </div>
  );
}
