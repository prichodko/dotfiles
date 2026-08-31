import { isDeepStrictEqual } from "node:util"

export type CodexConfigDocument = Readonly<Record<string, unknown>>

const isTomlTable = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)

export const parseCodexConfig = (source: string): CodexConfigDocument => {
  const parsed = Bun.TOML.parse(source)
  if (!isTomlTable(parsed)) throw new TypeError("The Codex configuration must be a TOML table.")
  return parsed
}

export const mergeCodexConfig = (
  base: CodexConfigDocument,
  local: CodexConfigDocument
): CodexConfigDocument => {
  const merged: Record<string, unknown> = { ...local }
  for (const [key, baseValue] of Object.entries(base)) {
    const localValue = local[key]
    merged[key] = isTomlTable(baseValue) && isTomlTable(localValue)
      ? mergeCodexConfig(baseValue, localValue)
      : baseValue
  }
  return merged
}

const collectDriftPaths = (
  base: CodexConfigDocument,
  local: CodexConfigDocument,
  parentPath: string
): ReadonlyArray<string> => Object.entries(base).flatMap(([key, baseValue]) => {
  const path = parentPath === "" ? key : `${parentPath}.${key}`
  const localValue = local[key]
  if (isTomlTable(baseValue) && isTomlTable(localValue)) {
    return collectDriftPaths(baseValue, localValue, path)
  }
  return isDeepStrictEqual(baseValue, localValue) ? [] : [path]
})

export const findCodexConfigDrift = (
  base: CodexConfigDocument,
  local: CodexConfigDocument
): ReadonlyArray<string> => collectDriftPaths(base, local, "")

export const renderCodexConfig = (document: CodexConfigDocument): string => {
  const rendered = Bun.TOML.stringify(document)
  if (rendered === undefined) throw new TypeError("The Codex configuration could not be serialized.")
  return rendered
}
