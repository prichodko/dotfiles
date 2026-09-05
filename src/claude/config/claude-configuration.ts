import { Context, Effect, Layer } from "effect"
import { makeManagedConfiguration, type ManagedConfigurationFailure } from "../../configuration/managed-file.ts"
import { isConfigurationTable, type ConfigurationDocument } from "../../configuration/managed-values.ts"
import { DOTFILES_ROOT } from "../../dotfiles/repository/live-dotfiles-repository.ts"

export const parseClaudeConfiguration = (source: string): ConfigurationDocument => {
  const parsed: unknown = JSON.parse(source)
  if (!isConfigurationTable(parsed)) throw new TypeError("The Claude configuration must be a JSON object.")
  return parsed
}

export class ClaudeConfiguration extends Context.Service<
  ClaudeConfiguration,
  {
    readonly applyBase: Effect.Effect<"created" | "updated" | "unchanged", ManagedConfigurationFailure>
    readonly validateBase: Effect.Effect<void, ManagedConfigurationFailure>
    readonly validateApplied: Effect.Effect<void, ManagedConfigurationFailure>
  }
>()("claude/config/ClaudeConfiguration") {}

export const makeClaudeConfigurationLayer = (paths: { readonly baseConfigPath: string; readonly liveConfigPath: string }) =>
  Layer.effect(
    ClaudeConfiguration,
    makeManagedConfiguration({
      ...paths,
      parse: parseClaudeConfiguration,
      render: (document) => JSON.stringify(document, null, 2) + "\n",
    }),
  )

export const LiveClaudeConfigurationLayer = makeClaudeConfigurationLayer({
  baseConfigPath: `${DOTFILES_ROOT}/user/common/.claude/base.json`,
  liveConfigPath: `${process.env.CLAUDE_CONFIG_DIR ?? `${process.env.HOME}/.claude`}/settings.json`,
})
