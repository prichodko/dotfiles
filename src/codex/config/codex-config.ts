import {
  isConfigurationTable,
  mergeManagedValues,
  findManagedValueDrift,
  type ConfigurationDocument,
} from "../../configuration/managed-values.ts"

export type CodexConfigDocument = ConfigurationDocument
export const mergeCodexConfig = mergeManagedValues
export const findCodexConfigDrift = findManagedValueDrift

export const parseCodexConfig = (source: string): CodexConfigDocument => {
  const parsed = Bun.TOML.parse(source)
  if (!isConfigurationTable(parsed)) throw new TypeError("The Codex configuration must be a TOML table.")
  return parsed
}

export const renderCodexConfig = (document: CodexConfigDocument): string => {
  const rendered = Bun.TOML.stringify(document)
  if (rendered === undefined) throw new TypeError("The Codex configuration could not be serialized.")
  return rendered
}
