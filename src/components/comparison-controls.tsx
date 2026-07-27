"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Comparison, GitCommit } from "@/lib/sem-types";

function CommitSuggestions({
  id,
  commits,
}: {
  id: string;
  commits: GitCommit[];
}) {
  return (
    <datalist id={id}>
      {commits.map((commit) => (
        <option
          key={commit.hash}
          value={commit.shortHash}
          label={`${commit.subject} · ${commit.relativeDate}${commit.refs ? ` · ${commit.refs}` : ""}`}
        />
      ))}
    </datalist>
  );
}

export function ComparisonSelector({
  comparison,
  commits,
  onModeChange,
  onCompare,
}: {
  comparison: Comparison;
  commits: GitCommit[];
  onModeChange: (mode: Comparison["mode"]) => void;
  onCompare: (from: string, to: string) => void;
}) {
  const [from, setFrom] = useState(
    comparison.mode === "commits" ? comparison.from : "HEAD~1",
  );
  const [to, setTo] = useState(
    comparison.mode === "commits" ? comparison.to : "HEAD",
  );

  return (
    <div className="flex min-w-0 items-center gap-2">
      <Select
        value={comparison.mode}
        onValueChange={(value) =>
          onModeChange(value as Comparison["mode"])
        }
      >
        <SelectTrigger
          size="sm"
          aria-label="Changes to view"
          className="w-[150px] bg-background"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="start">
          <SelectItem value="changed">Changed</SelectItem>
          <SelectItem value="staged">Staged</SelectItem>
          <SelectItem value="commits">Compare refs</SelectItem>
        </SelectContent>
      </Select>

      {comparison.mode === "commits" ? (
        <form
          className="flex min-w-0 items-center gap-1.5"
          onSubmit={(event) => {
            event.preventDefault();
            if (from.trim() && to.trim()) {
              onCompare(from.trim(), to.trim());
            }
          }}
        >
          <Input
            list="sdv-from-commits"
            aria-label="Base commit"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            placeholder="Base ref"
            className="h-7 w-32 font-mono text-xs"
          />
          <span className="text-xs text-muted-foreground">...</span>
          <Input
            list="sdv-to-commits"
            aria-label="Head commit"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            placeholder="Head ref"
            className="h-7 w-32 font-mono text-xs"
          />
          <CommitSuggestions id="sdv-from-commits" commits={commits} />
          <CommitSuggestions id="sdv-to-commits" commits={commits} />
          <Button
            type="submit"
            size="sm"
            variant="secondary"
            disabled={!from.trim() || !to.trim()}
          >
            Compare
          </Button>
        </form>
      ) : null}
    </div>
  );
}
