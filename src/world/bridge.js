/**
 * The single seam between the application and the world: `window.IHWorld`.
 *
 * The app calls these (all optional-chained on its side, so the world is pure
 * progressive enhancement):
 *   IHWorld.setAnalyser(node)  — hand over the live AnalyserNode (energy source)
 *   IHWorld.setZone(id)        — "core" | "theory" | "practice" | "coach" | "studio"
 *   IHWorld.pulse(amount)      — interaction activity (note plays, clicks)
 */
export function installBridge(world, energy) {
  const api = {
    setAnalyser: (node) => energy.setAnalyser(node),
    setZone: (id) => world.setZone(id),
    setInstrument: (id) => world.setInstrument(id),
    pulse: (amount = 1) => energy.bump(amount),
    stop: () => world.stop(),
    resume: () => world.resume()
  };
  window.IHWorld = api;
  return api;
}
