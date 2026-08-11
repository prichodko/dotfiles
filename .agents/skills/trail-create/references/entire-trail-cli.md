# Entire trail CLI API

## Contents

- [Source and conventions](#source-and-conventions)
- [Command map](#command-map)
- [Core commands](#core-commands)
- [Comment commands](#comment-commands)
- [Finding commands](#finding-commands)

## Source and conventions

Captured from:

```text
Entire CLI 0.9.1-nightly.202608040658.9fe3e6f22.0.20260804090145-e2f10cb17bca
```

Use the singular namespace `entire trail`. `entire trails` is invalid.

Run `entire agent-help trail --json` from an Entire-enabled repository to get the current machine-readable API. Run `entire agent-help trail <command> --json` for one command. Live output takes precedence over this reference when the installed version differs.

Unless noted otherwise:

- `<trail>` accepts a trail number, ID, or branch.
- Omitting a selector uses the current branch.
- `--branch` cannot be combined with a positional trail selector where stated.
- `--repo <forge/owner/repo-or-clone-url>` targets another repository and defaults to the origin remote.
- `strings` flags are repeatable.
- Every command supports `-h, --help`.

## Command map

```text
entire trail
├── approvals
├── approve
├── checkout
├── comment
│   ├── add
│   ├── delete
│   ├── edit
│   ├── list
│   ├── reply
│   ├── resolve
│   ├── show
│   └── unresolve
├── create
├── delete
├── finding
│   ├── add
│   ├── apply
│   ├── dismiss
│   ├── list
│   ├── reopen
│   ├── resolve
│   ├── show
│   └── update
├── list
├── request-changes
├── resume
├── show
├── update
└── watch
```

Top-level usage:

```text
entire trail [flags]
entire trail [command]
```

Top-level flag:

| Flag | Type | Purpose |
| --- | --- | --- |
| `--repo` | string | Target repository. Defaults to the origin remote. |

## Core commands

### `approvals`

List approval decisions.

```text
entire trail approvals [<trail>] [flags]
```

| Flag | Type | Purpose |
| --- | --- | --- |
| `--branch` | string | Select by branch. Do not combine with `<trail>`. |
| `--json` | bool | Output JSON. |

### `approve`

Approve an open trail that has a linked branch.

```text
entire trail approve [<trail>] [flags]
```

| Flag | Type | Purpose |
| --- | --- | --- |
| `--branch` | string | Select by branch. Do not combine with `<trail>`. |
| `-m, --message` | string | Add an optional approval comment. |

### `checkout`

Check out a trail branch. Fetch a remote-only branch when required.

```text
entire trail checkout [<trail>] [flags]
```

| Flag | Type | Purpose |
| --- | --- | --- |
| `-f, --force` | bool | Skip the prompt before fetching a remote-only branch. |
| `--trail` | string | Select by number, ID, or branch instead of the positional selector. |
| `--worktree` | bool | Create a worktree under `.entire/worktrees` instead of switching this checkout. |

For non-interactive `--worktree` use, stdout contains only the path:

```sh
cd "$(entire trail checkout <trail> --worktree)"
```

### `create`

Create a trail for the current branch, a new branch, or no branch.

```text
entire trail create [flags]
```

| Flag | Type | Purpose |
| --- | --- | --- |
| `--add-assignee` | strings | Assign one or more users by login. |
| `--base` | string | Set the base branch. Defaults to the detected default branch. |
| `--body` | string | Set the trail body. |
| `--branch` | string | Set the trail branch. Defaults to the current branch. |
| `--checkout` | bool | Check out the branch after creation. |
| `--no-branch` | bool | Create a branchless trail. |
| `--priority` | string | Set `urgent`, `high`, `medium`, `low`, or `none`. |
| `--status` | string | Set the initial status. Defaults to `open`. |
| `--title` | string | Set the trail title. |
| `--type` | string | Set `bug`, `feature`, or `task`. |

### `delete`

Permanently delete a trail. Confirmation is required unless `--force` is set.

```text
entire trail delete [<number>] [flags]
```

| Flag | Type | Purpose |
| --- | --- | --- |
| `--branch` | string | Select the trail by branch. Defaults to the current branch. |
| `-f, --force` | bool | Skip confirmation. |

### `list`

List recent trails.

```text
entire trail list [flags]
```

| Flag | Type | Default | Purpose |
| --- | --- | --- | --- |
| `--author` | string | any | Filter by author login. Use `me` for the current `gh` user. |
| `--json` | bool | false | Output JSON. |
| `-n, --limit` | int | `10` | Limit the result count. |
| `--status` | string | `open` | Filter by comma-separated `draft`, `open`, `merged`, or `closed`. Use `any` for all. |

### `request-changes`

Request changes on an open trail that has a linked branch.

```text
entire trail request-changes [<trail>] [flags]
```

| Flag | Type | Purpose |
| --- | --- | --- |
| `--branch` | string | Select by branch. Do not combine with `<trail>`. |
| `-m, --message` | string | Required reason for the request. |

### `resume`

Restore or resume an agent session for a trail.

```text
entire trail resume [<trail>] [flags]
```

| Flag | Type | Purpose |
| --- | --- | --- |
| `--branch` | string | Assert the expected trail branch. |
| `--checkpoint` | string | Resume one checkpoint. |
| `-f, --force` | bool | Skip prompts and overwrite existing session logs from checkpoints. |
| `--json` | bool | Output resume context as JSON. |
| `--no-resume` | bool | Show context without restoring or resuming a session. |
| `--repo` | string | Assert the expected GitHub `owner/name`. This command gives `--repo` assertion semantics. |
| `--session` | string | Resume one known local session. |
| `--trail` | string | Select by number, ID, or branch instead of the positional selector. |

Interactive use can restore sessions and start the agent. Non-interactive use prints resume commands. Repository or branch assertion failures stop before checkout.

### `show`

Show trail details.

```text
entire trail show [<trail>] [flags]
```

| Flag | Type | Purpose |
| --- | --- | --- |
| `--branch` | string | Select by branch. Do not combine with `<trail>`. |

### `update`

Update metadata for the current branch trail or the branch passed with `--branch`.

```text
entire trail update [flags]
```

| Flag | Type | Purpose |
| --- | --- | --- |
| `--add-assignee` | strings | Add assignees by login. |
| `--add-label` | strings | Add labels. |
| `--add-reviewer` | strings | Request reviewers by login. |
| `--body` | string | Replace the body. |
| `--branch` | string | Select by branch. Defaults to the current branch. |
| `--priority` | string | Set `urgent`, `high`, `medium`, `low`, or `none`. |
| `--remove-assignee` | strings | Remove assignees by login. |
| `--remove-label` | strings | Remove labels. |
| `--remove-reviewer` | strings | Remove requested reviewers by login. |
| `--status` | string | Set the status. |
| `--title` | string | Replace the title. |
| `--type` | string | Set `bug`, `feature`, or `task`. |

### `watch`

Stream trail events with SSE. The command reconnects after server caps and transient errors unless `--once` is set.

```text
entire trail watch [<trail>] [flags]
```

| Flag | Type | Purpose |
| --- | --- | --- |
| `--branch` | string | Select by branch. Do not combine with `<trail>`. |
| `--json` | bool | Print one JSON event per line. |
| `--once` | bool | Use one SSE connection and then exit. |
| `--show-pings` | bool | Print keepalive pings. |

The stream uses `GET /api/v1/trails/<id>/events` with `Accept: text/event-stream`. Event types include `ready`, domain event types, `reconnect`, `forbidden`, and `error`.

## Comment commands

Comments are discussion threads. Code-review findings use `entire trail finding` instead.

```text
entire trail comment [flags]
entire trail comment [command]
```

Inherited flags:

| Flag | Type | Purpose |
| --- | --- | --- |
| `--branch` | string | Select by branch. Do not combine with `--trail`. |
| `--trail` | string | Select by number, ID, or branch. |
| `--repo` | string | Target repository. Defaults to the origin remote. |

### `comment add`

```text
entire trail comment add [flags]
```

| Flag | Type | Purpose |
| --- | --- | --- |
| `-m, --body` | string | Required message body. |
| `--json` | bool | Output JSON. |
| `--title` | string | Set an optional thread title. |

### `comment delete`

```text
entire trail comment delete <thread-id> <message-id> [flags]
```

| Flag | Type | Purpose |
| --- | --- | --- |
| `-f, --force` | bool | Skip confirmation. |

### `comment edit`

```text
entire trail comment edit <thread-id> <message-id> [flags]
```

| Flag | Type | Purpose |
| --- | --- | --- |
| `-m, --body` | string | Required replacement message body. |

### `comment list`

```text
entire trail comment list [flags]
```

| Flag | Type | Purpose |
| --- | --- | --- |
| `--all` | bool | Include code-review threads managed through findings. |
| `--json` | bool | Output JSON. |

### `comment reply`

```text
entire trail comment reply <thread-id> [flags]
```

| Flag | Type | Purpose |
| --- | --- | --- |
| `-m, --body` | string | Required reply body. |

### `comment resolve`

```text
entire trail comment resolve <thread-id> [flags]
```

### `comment show`

```text
entire trail comment show <thread-id> [flags]
```

| Flag | Type | Purpose |
| --- | --- | --- |
| `--json` | bool | Output JSON. |

### `comment unresolve`

```text
entire trail comment unresolve <thread-id> [flags]
```

## Finding commands

Running the group command without a subcommand shows the finding dashboard.

```text
entire trail finding [<trail>] [flags]
entire trail finding [command]
```

Dashboard and `finding list` filters:

| Flag | Type | Default | Purpose |
| --- | --- | --- | --- |
| `--freshness` | string | `current` | Filter by `current`, `stale`, or `any`. |
| `--include-dismissed` | bool | false | Include dismissed findings. |
| `--json` | bool | false | Output JSON. |
| `-n, --limit` | int | `100` | Limit the result count. |
| `--offset` | int | `0` | Set the pagination offset. |
| `--severity` | string | any | Filter by comma-separated `high`, `medium`, or `low`. |
| `--status` | string | `open` | Filter by `open`, `resolved`, or `dismissed`. Use `any` for all. |

Inherited flags:

| Flag | Type | Purpose |
| --- | --- | --- |
| `--branch` | string | Select by branch. Do not combine with a trail selector. |
| `--trail` | string | Select by number, ID, or branch. |
| `--repo` | string | Target repository. Defaults to the origin remote. |

### `finding add`

```text
entire trail finding add [<trail>] [flags]
```

| Flag | Type | Default | Purpose |
| --- | --- | --- | --- |
| `-m, --body` | string | empty | Set the finding body. |
| `--client-id` | string | empty | Set an idempotency key. |
| `--confidence` | float | `-1` | Set confidence from `0.0` to `1.0`. |
| `--end-line` | int | `0` | Set the end line. |
| `--file` | string | empty | Set the file path. |
| `--instruction` | string | empty | Attach a manual suggested-change instruction. |
| `--json` | bool | false | Output JSON. |
| `--line` | int | `0` | Set a single line. |
| `--patch` | string | empty | Attach a unified-diff suggestion. |
| `--patch-file` | string | empty | Read a unified diff from a file. Use `-` for stdin. |
| `--severity` | string | empty | Set `high`, `medium`, or `low`. |
| `--start-line` | int | `0` | Set the start line. |

### `finding apply`

Apply a finding's unified diff to the current worktree.

```text
entire trail finding apply [<trail>] <finding-id> [flags]
```

| Flag | Type | Purpose |
| --- | --- | --- |
| `--check` | bool | Check the patch without changing files. |
| `--resolve` | bool | Resolve the finding after a successful apply. |

### `finding dismiss`

```text
entire trail finding dismiss [<trail>] <finding-id> [flags]
```

| Flag | Type | Purpose |
| --- | --- | --- |
| `-m, --message` | string | Record a status reason. |

### `finding list`

```text
entire trail finding list [<trail>] [flags]
```

Use the dashboard filter flags listed above.

### `finding reopen`

```text
entire trail finding reopen [<trail>] <finding-id> [flags]
```

| Flag | Type | Purpose |
| --- | --- | --- |
| `-m, --message` | string | Record a status reason. |

### `finding resolve`

```text
entire trail finding resolve [<trail>] <finding-id> [flags]
```

| Flag | Type | Purpose |
| --- | --- | --- |
| `-m, --message` | string | Record a status reason. |

### `finding show`

```text
entire trail finding show [<trail>] <finding-id> [flags]
```

### `finding update`

```text
entire trail finding update [<trail>] <finding-id> [flags]
```

| Flag | Type | Default | Purpose |
| --- | --- | --- | --- |
| `-m, --body` | string | unchanged | Replace the finding body. |
| `--confidence` | float | `-1` | Set confidence from `0.0` to `1.0`. |
| `--json` | bool | false | Output JSON. |
| `--severity` | string | unchanged | Set `high`, `medium`, or `low`. |
