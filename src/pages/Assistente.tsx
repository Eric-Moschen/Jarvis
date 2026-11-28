import { Link } from 'react-router-dom'
import JarvisChat from '../components/JarvisChat'
import { useJarvis } from '../lib/JarvisContext'

export function Assistente() {
  const { iaConfigurada } = useJarvis()
  return (
    <div className="-m-4 flex h-[calc(100dvh-3.5rem-4.5rem)] flex-col lg:-m-8 lg:h-[calc(100dvh-3.5rem)]">
      {iaConfigurada === false && (
        <div className="border-b border-line bg-surface px-4 py-2 text-xs text-soft lg:px-8">
          A IA está desligada: entendo comandos diretos (cadastrar conta, abrir telas, relatórios, alertas). Para conversar livremente,{' '}
          <Link to="/admin" className="text-primary hover:underline">
            ligue a IA
          </Link>
          .
        </div>
      )}
      <div className="min-h-0 flex-1">
        <JarvisChat />
      </div>
    </div>
  )
}
