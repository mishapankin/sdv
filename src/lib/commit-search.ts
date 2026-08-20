import type { GitCommit } from "@/lib/sem-types";

export type RevisionCandidate = {
  value: string;
  kind: "special" | "commit";
  label: string;
  commit?: GitCommit;
  refs: string[];
};

const SPECIAL_REVISIONS: RevisionCandidate[] = [
  {
    value: "HEAD",
    kind: "special",
    label: "Current commit",
    refs: ["HEAD"],
  },
  {
    value: "HEAD~1",
    kind: "special",
    label: "Parent of current commit",
    refs: ["HEAD~1"],
  },
];

export function parseCommitDecorations(decorations: string) {
  const refs = decorations
    .split(",")
    .map((ref) => ref.trim())
    .filter(Boolean)
    .flatMap((ref) => {
      const arrow = ref.indexOf(" -> ");

      if (arrow === -1) return [ref.replace(/^tag: /, "")];
      return [
        ref.slice(0, arrow).replace(/^tag: /, ""),
        ref.slice(arrow + 4).replace(/^tag: /, ""),
      ];
    });

  return [...new Set(refs)];
}

export function createRevisionCandidates(
  commits: GitCommit[],
): RevisionCandidate[] {
  return [
    ...SPECIAL_REVISIONS,
    ...commits.map((commit) => ({
      value: commit.shortHash,
      kind: "commit" as const,
      label: commit.subject,
      commit,
      refs: parseCommitDecorations(commit.refs),
    })),
  ];
}

function getSearchScore(candidate: RevisionCandidate, query: string) {
  if (!query) return candidate.kind === "special" ? 0 : 10;

  const value = candidate.value.toLocaleLowerCase();
  const refs = candidate.refs.map((ref) => ref.toLocaleLowerCase());
  const subject = candidate.commit?.subject.toLocaleLowerCase() ?? "";
  const author = candidate.commit?.author.toLocaleLowerCase() ?? "";

  if (value === query || refs.includes(query)) return 0;
  if (value.startsWith(query) || refs.some((ref) => ref.startsWith(query))) {
    return 1;
  }
  if (subject.startsWith(query)) return 2;
  if (subject.includes(query)) return 3;
  if (author.startsWith(query)) return 4;
  if (author.includes(query)) return 5;
  if (
    candidate.commit?.hash.toLocaleLowerCase().startsWith(query) ||
    candidate.commit?.relativeDate.toLocaleLowerCase().includes(query)
  ) {
    return 6;
  }

  return Number.POSITIVE_INFINITY;
}

export function searchRevisionCandidates(
  candidates: RevisionCandidate[],
  search: string,
  limit = 40,
) {
  const query = search.trim().toLocaleLowerCase();

  return candidates
    .map((candidate, index) => ({
      candidate,
      index,
      score: getSearchScore(candidate, query),
    }))
    .filter(({ score }) => Number.isFinite(score))
    .sort((left, right) => left.score - right.score || left.index - right.index)
    .slice(0, limit)
    .map(({ candidate }) => candidate);
}

export function findRevisionCandidate(
  candidates: RevisionCandidate[],
  value: string,
) {
  const normalized = value.toLocaleLowerCase();

  return candidates.find(
    (candidate) =>
      candidate.value.toLocaleLowerCase() === normalized ||
      candidate.commit?.hash.toLocaleLowerCase() === normalized ||
      candidate.refs.some(
        (ref) => ref.toLocaleLowerCase() === normalized,
      ),
  );
}
