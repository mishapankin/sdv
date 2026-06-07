<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# SDV Project

SDV is a local-only semantic diff viewer. It is intentionally a thin browser UI
over the `sem` CLI and should not grow unrelated source-control features.

## Product Contract

- The final entry point is the `sdv` binary, run from the Git repository to
  inspect.
- It inspects the Git repository in the directory where `sdv` is launched.
- It starts a local web server on `localhost:1555` and prints
  `Running on localhost:1555`.
- It does not need to open a browser automatically.
- The default comparison is unstaged tracked changes: `sem diff --verbose
  --format json`.
- The MVP supports unstaged changes, staged changes, and comparisons between
  two user-provided Git refs.
- Refresh reruns `sem`; do not maintain a separate diff model or cache.
- The sidebar is grouped by file. Each file lists its changed semantic entities
  with a Lucide icon for entity type and a label/icon for change type such as
  added, modified, deleted, moved, renamed, or reordered.
- Untracked files follow `sem` behavior and are excluded.
- macOS and Linux are the supported platforms for the MVP.
- Assume the `sem` binary is available through `PATH`. If it is missing, print
  a clear error to stdout and exit without starting the web server.
- Treat `sem` JSON as the source of truth. Keep any transformation limited to
  validation and view-model grouping.

## Tech Stack

- Next.js 16 App Router (`next@16.2.7`)
- React 19 (`react@19.2.4`, `react-dom@19.2.4`)
- TypeScript 5
- Tailwind CSS 4
- shadcn/ui using the existing `radix-nova` configuration
- `lucide-react` for all interface icons
- TanStack Query (`@tanstack/react-query`) for client-side server state,
  refresh, and comparison changes
- `@pierre/diffs` for split or unified code diffs with Shiki syntax
  highlighting
- Zod for validating Server Function inputs and `sem` JSON at the process
  boundary
- pnpm as the package manager

Do not introduce another component library, icon library, state manager, API
layer, database, authentication system, or Git abstraction.

## Next.js And Data Flow

- Read the relevant guide in `node_modules/next/dist/docs/` before changing
  Next.js code.
- Put callable server operations in dedicated files with a top-level
  `"use server"` directive.
- Execute `sem` only on the server. Never expose arbitrary command or path
  execution to the browser.
- Use `child_process.execFile` (or an equivalent argument-array API), never a
  shell command string.
- Validate comparison inputs and constrain them to the supported modes before
  building `sem` arguments.
- Return only serializable, UI-required data from Server Functions.
- Use a single TanStack Query query for the active semantic diff. A refresh is
  query invalidation/refetch.
- Prefer derived state and avoid scattered `useState` calls.
- Keep Server Components as the default and add Client Components only around
  interactive controls and query-driven views.

## UI Direction

- Build a dense, desktop-first developer tool rather than a marketing page.
- Use a restrained neutral palette with clear green/red change colors, compact
  typography, subtle borders, and a code-first visual hierarchy.
- Use shadcn components where they improve keyboard behavior or accessibility,
  especially buttons, selects, tooltips, resizable panels, scroll areas, and
  dialogs/popovers.
- The main layout is a file/entity sidebar and a large semantic entity diff
  pane. Preserve useful space for code; avoid decorative UI and excessive
  cards.
- Provide clear empty, loading, refresh, missing-`sem`, invalid-repository, and
  command-failure states.

## Verification

- Run `pnpm build`.
- Run lint and focused tests for argument construction, JSON validation,
  file/entity grouping, and process errors.
- Verify the UI against real `sem 0.7.x` verbose JSON, including added,
  modified, deleted, moved, and renamed entities where fixtures permit.
