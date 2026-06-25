# Semantic Diff Viewer

A local browser UI for entity-level diffs produced by
[`sem`](https://github.com/ataraxy-labs/sem).

## Requirements

- macOS or Linux
- Node.js 22.12+
- `sem` available in `PATH`
- A Git repository, or a folder containing Git repositories

## Run

Build and link the local binary once:

```bash
pnpm install
pnpm build
pnpm link --global .
```

Then run SDV from any Git repository:

```bash
sdv
```

You can also run SDV from a folder containing multiple Git repositories. By
default, SDV searches recursively without a depth limit and stops descending
once it finds a repository. The repository list shows changed repositories
first, including the number of changed tracked files. Select a repository to
open the same semantic diff viewer for that repo, and use Refresh all to update
the repository list.

The server starts at `http://127.0.0.1:1555`, opens it in the default browser,
and displays semantic entities from
tracked, unstaged changes by default. The comparison bar can switch to staged
changes or compare two Git refs such as `HEAD~3` and `HEAD`. Recent commits are
offered as searchable suggestions, and arbitrary valid refs are accepted.

Use the refresh button to rerun the active comparison. The default command is:

```bash
sem diff --verbose --format json
```

Untracked files are excluded, matching `sem` and Git behavior.

## CLI options

```text
-p, --port <number>  Server port (default: 1555)
--host <host>        Server host (default: 127.0.0.1)
--search-depth <n>   Repository search depth; 0 only checks cwd, 1 checks direct children (default: unlimited)
--no-open            Do not open the browser automatically
-V, --version        Print the SDV version
-h, --help           Show help
```
