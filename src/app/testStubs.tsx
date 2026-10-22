/**
 * Stand-ins for the screens other parts of the app own, for the shell's routing tests: each shows
 * its name as the page heading and the address it was rendered at. Use with `vi.mock`.
 */
import { useLocation } from './router'

/** While set, every stub screen throws it when rendering (clear it to let them render again). */
export const crash: { next: Error | null } = { next: null }

export function stub(name: string) {
  function Stub() {
    const { path, search } = useLocation()
    if (crash.next) throw crash.next
    return (
      <main>
        <h1 tabIndex={-1}>{name}</h1>
        <p>{`at ${path}${search}`}</p>
      </main>
    )
  }
  Stub.displayName = name
  return Stub
}
