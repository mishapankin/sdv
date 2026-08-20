import { describe, expect, it } from "vitest";

import {
  createRevisionCandidates,
  findRevisionCandidate,
  parseCommitDecorations,
  searchRevisionCandidates,
} from "@/lib/commit-search";
import type { GitCommit } from "@/lib/sem-types";

const commits: GitCommit[] = [
  {
    hash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    shortHash: "aaaaaaa",
    subject: "Fix commit picker focus",
    author: "Ada Lovelace",
    authoredAt: "2026-08-20T12:00:00Z",
    relativeDate: "yesterday",
    refs: "HEAD -> main, origin/main, tag: v1.0.0",
  },
  {
    hash: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    shortHash: "bbbbbbb",
    subject: "Add repository refresh",
    author: "Grace Hopper",
    authoredAt: "2026-08-19T12:00:00Z",
    relativeDate: "2 days ago",
    refs: "feature/refresh",
  },
];

describe("commit search", () => {
  it("normalizes Git decorations into searchable refs", () => {
    expect(parseCommitDecorations(commits[0].refs)).toEqual([
      "HEAD",
      "main",
      "origin/main",
      "v1.0.0",
    ]);
  });

  it("ranks exact refs ahead of subject and author matches", () => {
    const candidates = createRevisionCandidates(commits);

    expect(searchRevisionCandidates(candidates, "main")[0]?.value).toBe(
      "aaaaaaa",
    );
    expect(searchRevisionCandidates(candidates, "repository")[0]?.value).toBe(
      "bbbbbbb",
    );
    expect(searchRevisionCandidates(candidates, "Grace")[0]?.value).toBe(
      "bbbbbbb",
    );
  });

  it("finds the selected commit by a branch name", () => {
    const candidates = createRevisionCandidates(commits);

    expect(findRevisionCandidate(candidates, "origin/main")?.label).toBe(
      "Fix commit picker focus",
    );
  });
});
