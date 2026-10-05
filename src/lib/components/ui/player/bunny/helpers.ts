export async function closeIterator (iterator?: AsyncIterator<unknown>) {
  try {
    await iterator?.return?.()
  } catch {}
}
