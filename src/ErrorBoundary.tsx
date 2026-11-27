import { Component, type ReactNode } from 'react'

/** Mostra o erro em vez de uma tela branca quando algo quebra na renderização. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error) {
    // Avisa o editor da 1dollar (só existe dentro do preview) para oferecer a correção.
    ;(window as { __1dollarReportError?: (message: string) => void }).__1dollarReportError?.(error.stack ?? error.message)
  }

  render() {
    if (!this.state.error) return this.props.children
    // Idioma de quem vê o site (o projeto pode ser em qualquer língua).
    const lang = (navigator.language || 'en').slice(0, 2)
    const text = lang === 'pt'
      ? ['Algo quebrou nesta página', 'Peça para a 1dollar corrigir este erro no chat.']
      : lang === 'es'
        ? ['Algo falló en esta página', 'Pide a 1dollar que corrija este error en el chat.']
        : ['Something broke on this page', 'Ask 1dollar to fix this error in the chat.']
    return (
      <div style={{ fontFamily: 'system-ui', padding: 32, color: '#991b1b', background: '#fef2f2', minHeight: '100vh' }}>
        <h2 style={{ margin: 0 }}>{text[0]}</h2>
        <pre style={{ whiteSpace: 'pre-wrap', marginTop: 12 }}>{String(this.state.error.message)}</pre>
        <p style={{ color: '#7f1d1d' }}>{text[1]}</p>
      </div>
    )
  }
}
