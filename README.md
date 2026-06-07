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
tracked, unstaged changes by default. The comparison bar can switch to staged
changes or compare two Git refs such as `HEAD~3` and `HEAD`. Recent commits are
offered as searchable suggestions, and arbitrary valid refs are accepted.

Use the refresh button to rerun the active comparison. The default command is:

```bash
sem diff --verbose --format json
```

Untracked files are excluded, matching `sem` and Git behavior.
