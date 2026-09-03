# Playwright CLI

Use the snapshot and reference loop for interactive browser control.

## Basic loop

```bash
playwright-cli open https://example.com
playwright-cli snapshot
playwright-cli click e3
playwright-cli fill e5 "value"
playwright-cli snapshot
playwright-cli close
```

Each action can change page state. Use references from the newest snapshot.

## Page inspection

```bash
playwright-cli snapshot --depth=4
playwright-cli snapshot e34
playwright-cli snapshot --boxes
playwright-cli find "Sign in"
playwright-cli find --regex "/sign (in|up)/i"
playwright-cli eval "document.title"
playwright-cli console
playwright-cli requests
playwright-cli request 5
```

Use `--boxes` only when geometry matters. Use `find` or a shallow snapshot before capturing a large page.

## Navigation and interaction

```bash
playwright-cli goto https://example.com/page
playwright-cli go-back
playwright-cli reload
playwright-cli click e3
playwright-cli fill e5 "value" --submit
playwright-cli press Enter
playwright-cli select e9 "option-value"
playwright-cli check e12
playwright-cli upload ./document.pdf
```

## Viewports and artifacts

```bash
playwright-cli resize 1440 900
playwright-cli screenshot --filename=desktop.png
playwright-cli resize 390 844
playwright-cli screenshot --filename=mobile.png
playwright-cli pdf --filename=page.pdf
```

## Isolated sessions

Use a named session when multiple browsers or workflows are active.

```bash
playwright-cli -s=review open https://example.com
playwright-cli -s=review snapshot
playwright-cli -s=review close
```

Read [session-management.md](session-management.md) before attaching to another browser, using a persistent profile, or running concurrent sessions.

## Raw output

Use `--raw` when another command must consume the result.

```bash
playwright-cli --raw eval "JSON.stringify(location.href)"
playwright-cli --raw snapshot > page.yml
playwright-cli list --json
```

## Advanced operations

Read the applicable reference before using request mocking, custom code, storage changes, traces, recordings, or test generation. Do not use broad `close-all`, `kill-all`, or data deletion commands unless every target belongs to the current task.
