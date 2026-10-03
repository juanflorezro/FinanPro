import { Component } from 'react';

/**
 * Si una pantalla falla, muestra el error en vez de dejar la página en blanco.
 * Se reinicia sola al cambiar de ruta (prop resetKey).
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Error en la pantalla:', error, info?.componentStack);
  }

  componentDidUpdate(prev) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="crash" role="alert">
        <p className="crash-title">Esta pantalla tuvo un problema</p>
        <p className="muted">Puedes volver a intentarlo. Si se repite, escríbenos desde Soporte y copia este mensaje:</p>
        <pre>{String(this.state.error?.message ?? this.state.error)}</pre>
        <div className="row-actions">
          <button type="button" className="btn btn-primary" onClick={() => this.setState({ error: null })}>Reintentar</button>
          <button type="button" className="btn btn-secondary" onClick={() => window.location.assign('/')}>Ir al inicio</button>
        </div>
      </div>
    );
  }
}
