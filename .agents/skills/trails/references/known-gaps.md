# Known gaps

Workarounds for Entire CLI 0.12.3 and the Entire MCP as of 2026-10-29. Delete an entry once the product fixes it.

## Change title

`entire trail update` edits only the project trail. Set a change's title through the API:

```sh
entire api --to cell -X PATCH -f "title=<title>" /api/v1/trails/<host>/<owner>/<repo>/<number>
```

The `/api/v1` prefix is required.

## Ready for review

There is no CLI command. Use a typed boolean with `-F`; the API silently ignores the string that `-f` sends.

```sh
entire api --to cell -X PATCH -F ready_for_review=true /api/v1/trails/<host>/<owner>/<repo>/<number>
```

Read `ready_for_review` back with a GET on the same path.

## Change body

The change body is an editor document with no write API; the server rejects updates with "Repo trail body updates are not supported". Put the description on the project trail with `entire trail update --body` instead.

## Readiness signals disagree

`entire trail merge --dry-run` reports "findings passed" while non-blocking findings are still open, but `merge_change` refuses any open finding. Judge readiness by `list_findings`.

## Trail status after merge

A project trail stays `open` after its change merges. Read each change's status.

## Partial Gates

In Entire's own repositories, the "Partial Gates" check is the staging (partial.to) gate. Ignore it; judge readiness by CI and "Entire Gates".
