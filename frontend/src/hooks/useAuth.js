import { useSyncExternalStore } from 'react'
import { useServices } from '../state/services.jsx'

const NO_SESSION = Object.freeze({ signedIn: false, historyLinked: false })
const noSubscribe = () => () => {}
const noSnapshot = () => NO_SESSION

/**
 * Estado de conta (RF31, RF32, RF34). Com "accountsMode=off" não há conta: "available" é falso.
 */
export function useAuth() {
  const { auth } = useServices()
  const session = useSyncExternalStore(auth ? auth.subscribe : noSubscribe, auth ? auth.getSnapshot : noSnapshot)
  return {
    available: auth !== null,
    /** "demo" enquanto não existir a API de contas (Etapa 4). */
    mode: auth?.mode ?? null,
    signedIn: session.signedIn,
    historyLinked: session.historyLinked,
    signIn: auth?.signIn,
    signUp: auth?.signUp,
    signOut: auth?.signOut,
    requestRecovery: auth?.requestRecovery,
    linkHistory: auth?.linkHistory,
    deleteAccount: auth?.deleteAccount,
  }
}
