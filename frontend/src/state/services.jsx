import { createContext, useContext } from 'react'

const ServicesContext = createContext(/** @type {import('../services/index.js').Services | null} */ (null))

/**
 * Entrega os serviços (API, armazenamento, gateways) a toda a árvore de componentes.
 * Os testes passam serviços com versões falsas.
 * @param {{ services: import('../services/index.js').Services, children: import('react').ReactNode }} props
 */
export function ServicesProvider({ services, children }) {
  return <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>
}

/** @returns {import('../services/index.js').Services} */
export function useServices() {
  const services = useContext(ServicesContext)
  if (!services) throw new Error('ServicesProvider ausente: envolva a aplicação com <ServicesProvider>.')
  return services
}
