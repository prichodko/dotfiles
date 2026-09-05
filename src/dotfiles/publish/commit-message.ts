export const comparePathsByByte = (left: string, right: string): number => {
  const leftBytes = new TextEncoder().encode(left)
  const rightBytes = new TextEncoder().encode(right)
  const sharedLength = Math.min(leftBytes.length, rightBytes.length)
  for (let index = 0; index < sharedLength; index += 1) {
    const difference = (leftBytes[index] ?? 0) - (rightBytes[index] ?? 0)
    if (difference !== 0) return difference
  }
  return leftBytes.length - rightBytes.length
}

export const sortPaths = (paths: ReadonlyArray<string>): ReadonlyArray<string> => [...paths].sort(comparePathsByByte)

export const buildCommitMessage = (inputPaths: ReadonlyArray<string>): { readonly subject: string; readonly body?: string } => {
  const paths = sortPaths(inputPaths)
  const subject = `sync: ${paths.join(", ")}`
  if (subject.length <= 72) return { subject }
  return { subject: `sync: ${paths.length} tracked paths`, body: paths.join("\n") }
}
