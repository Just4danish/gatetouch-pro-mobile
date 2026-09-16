/** R3F is not used on native. Kept so leftover web helpers fail loudly instead of loading fiber. */
export function getFiber(): never {
  throw new Error('react-three-fiber is not loaded in this app')
}
