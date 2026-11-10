import type { TrackQueryContext } from './types'

export function shouldRefreshAfterLocaleChange(
  lastTrackQuery: TrackQueryContext | null,
  hasSearched: boolean,
  notFound: boolean,
) {
  return hasSearched && !notFound && lastTrackQuery !== null
}

export function completeLocaleRefresh(
  ok: boolean,
  setNotFound: (value: boolean) => void,
  scrollToResult: () => void,
) {
  if (!ok) {
    setNotFound(true)
    return
  }

  scrollToResult()
}
