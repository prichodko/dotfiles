import { isDeepStrictEqual } from "node:util"

export type ConfigurationDocument = Readonly<Record<string, unknown>>

export const isConfigurationTable = (value: unknown): value is Record<string, unknown> =>
  value !== null &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)

export const mergeManagedValues = (base: ConfigurationDocument, local: ConfigurationDocument): ConfigurationDocument => {
  const merged: Record<string, unknown> = { ...local }
  for (const [key, baseValue] of Object.entries(base)) {
    const localValue = local[key]
    merged[key] =
      isConfigurationTable(baseValue) && isConfigurationTable(localValue) ? mergeManagedValues(baseValue, localValue) : baseValue
  }
  return merged
}

const collectDriftPaths = (base: ConfigurationDocument, local: ConfigurationDocument, parentPath: string): ReadonlyArray<string> =>
  Object.entries(base).flatMap(([key, baseValue]) => {
    const path = parentPath === "" ? key : `${parentPath}.${key}`
    const localValue = local[key]
    if (isConfigurationTable(baseValue) && isConfigurationTable(localValue)) {
      return collectDriftPaths(baseValue, localValue, path)
    }
    return isDeepStrictEqual(baseValue, localValue) ? [] : [path]
  })

export const findManagedValueDrift = (base: ConfigurationDocument, local: ConfigurationDocument): ReadonlyArray<string> =>
  collectDriftPaths(base, local, "")
