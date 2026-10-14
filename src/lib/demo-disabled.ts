// The optional service build does not ship any public simulation content.
export const mediaUrl = (_id?: string): string | undefined => undefined
export const subscribe = () => () => {}
export async function request<T>(): Promise<T> {
  throw new Error('Simulation is disabled in this build')
}
