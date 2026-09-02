type StoredState = Record<string, unknown>

function isStoredState(value: unknown): value is StoredState {
  return typeof value === 'object' && value !== null
}

export function mergePersistedState<State extends object>(
  persistedState: unknown,
  currentState: State,
  legacyFields: readonly string[],
): State {
  if (isStoredState(persistedState)) {
    return { ...currentState, ...persistedState }
  }

  if (typeof window === 'undefined') return currentState

  try {
    const legacyState = JSON.parse(window.localStorage.getItem('homecoming-hub-wallet') ?? '{}').state
    if (!isStoredState(legacyState)) return currentState

    return {
      ...currentState,
      ...Object.fromEntries(
        legacyFields
          .filter((field) => Object.hasOwn(legacyState, field))
          .map((field) => [field, legacyState[field]]),
      ),
    }
  } catch {
    return currentState
  }
}
