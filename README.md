# Semantic Diff Viewer

A local browser UI for entity-level diffs produced by
[`sem`](https://github.com/ataraxy-labs/sem).

## Requirements

- macOS or Linux
- Node.js 20+
- `sem` available in `PATH`
- A Git repository

## Run

Build and link the local binary once:

```bash
pnpm install
pnpm build
pnpm link --global
```

Then run SDV from any Git repository:

```bash
sdv
```

The server starts at `http://localhost:1555` and displays semantic entities from
tracked, unstaged changes. Use the refresh button to rerun:

```bash
sem diff --verbose --format json
```

Untracked files are excluded, matching `sem` and Git behavior.
