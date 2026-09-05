import { expect, test } from "bun:test"
import { mkdtempSync, mkdirSync, readFileSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const root = new URL("../../", import.meta.url).pathname.replace(/\/$/, "")

test("applies managed files in an empty home and preserves local application state", () => {
  const home = mkdtempSync(join(tmpdir(), "dotfiles-managed-home-"))
  try {
    symlinkSync(root, join(home, ".dotfiles"))
    mkdirSync(join(home, ".claude"))
    const localSettings = '{"hooks":{"SessionStart":[]},"localOnly":true}'
    writeFileSync(join(home, ".claude", "settings.json"), localSettings)
    const env = {
      ...process.env,
      HOME: home,
      MISE_ENV: "",
      MISE_CONFIG_DIR: join(home, ".config", "mise"),
      MISE_IGNORED_CONFIG_PATHS: `${process.env.HOME}/.config/mise/config.toml`,
      MISE_TRUSTED_CONFIG_PATHS: root,
    }
    for (let attempt = 0; attempt < 2; attempt++) {
      const result = Bun.spawnSync(["mise", "-C", root, "bootstrap", "--only", "dotfiles,mise-shell-activate", "--yes"], {
        env,
        stdout: "pipe",
        stderr: "pipe",
      })
      if (result.exitCode !== 0) throw new Error(result.stderr.toString() + result.stdout.toString())
      expect(readlinkSync(join(home, ".aliases"))).toBe(join(home, ".dotfiles", "user", "common", ".aliases"))
      expect(readlinkSync(join(home, "AGENTS.md"))).toBe(join(home, ".dotfiles", ".agents", "AGENTS.md"))
      expect(readlinkSync(join(home, ".claude", "CLAUDE.md"))).toBe(join(home, ".dotfiles", ".agents", "AGENTS.md"))
      expect(readlinkSync(join(home, ".config", "opencode", "AGENTS.md"))).toBe(join(home, ".dotfiles", ".agents", "AGENTS.md"))
      expect(readlinkSync(join(home, ".codex", "AGENTS.md"))).toBe(join(home, ".dotfiles", "user", "common", ".codex", "AGENTS.md"))
      expect(readFileSync(join(home, ".claude", "settings.json"), "utf8")).toBe(localSettings)
      expect(readFileSync(join(home, ".zshrc"), "utf8")).toContain(".config/shell/zsh.sh")
    }
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
}, 15000)
