"use client";

import {
  AlertCircle,
  ArrowLeftRight,
  Check,
  ChevronsUpDown,
  GitBranch,
  GitCommitHorizontal,
  LoaderCircle,
  Search,
  Tag,
} from "lucide-react";
import { useId, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createRevisionCandidates,
  findRevisionCandidate,
  searchRevisionCandidates,
  type RevisionCandidate,
} from "@/lib/commit-search";
import type {
  Comparison,
  GitCommit,
  GitRefValidationResult,
} from "@/lib/sem-types";
import { cn } from "@/lib/utils";

function RefIcon({ candidate }: { candidate: RevisionCandidate }) {
  if (candidate.refs.some((ref) => ref.startsWith("v"))) {
    return <Tag className="size-3.5" />;
  }
  if (candidate.refs.length > 0) {
    return <GitBranch className="size-3.5" />;
  }
  return <GitCommitHorizontal className="size-3.5" />;
}

function RevisionRow({
  candidate,
  selected,
}: {
  candidate: RevisionCandidate;
  selected: boolean;
}) {
  const refs = candidate.refs.filter((ref) => ref !== "HEAD").slice(0, 2);

  return (
    <>
      <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border border-border/70 bg-background text-muted-foreground">
        <RefIcon candidate={candidate} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-xs font-medium">{candidate.label}</span>
          {refs.map((ref) => (
            <span key={ref} className="max-w-28 shrink-0 truncate rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              {ref}
            </span>
          ))}
        </span>
        <span className="mt-0.5 flex items-center gap-1.5 truncate text-[11px] text-muted-foreground">
          <span className="font-mono text-foreground/70">{candidate.value}</span>
          {candidate.commit ? (
            <>
              <span aria-hidden="true">·</span>
              <span className="truncate">{candidate.commit.author}</span>
              <span aria-hidden="true">·</span>
              <span className="shrink-0">{candidate.commit.relativeDate}</span>
            </>
          ) : null}
        </span>
      </span>
      <Check className={cn("mt-1 size-3.5 shrink-0 text-foreground", !selected && "invisible")} />
    </>
  );
}

function RefCombobox({
  label,
  value,
  commits,
  loading,
  loadError,
  invalid,
  onChange,
}: {
  label: string;
  value: string;
  commits: GitCommit[];
  loading: boolean;
  loadError?: string;
  invalid: boolean;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();
  const candidates = useMemo(
    () => createRevisionCandidates(commits),
    [commits],
  );
  const results = useMemo(
    () => searchRevisionCandidates(candidates, search),
    [candidates, search],
  );
  const selected = findRevisionCandidate(candidates, value);
  const customRef = search.trim();
  const hasExactResult = results.some(
    (candidate) =>
      candidate.value.toLocaleLowerCase() ===
        customRef.toLocaleLowerCase() ||
      candidate.refs.some(
        (ref) =>
          ref.toLocaleLowerCase() === customRef.toLocaleLowerCase(),
      ),
  );
  const showCustomRef = Boolean(customRef) && !hasExactResult;
  const optionCount = results.length + (showCustomRef ? 1 : 0);

  function choose(nextValue: string) {
    onChange(nextValue);
    setOpen(false);
    setSearch("");
  }

  function chooseActive() {
    if (activeIndex < results.length) {
      const candidate = results[activeIndex];
      if (candidate) choose(candidate.value);
    } else if (showCustomRef) {
      choose(customRef);
    }
  }

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <span className="text-[10px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">{label}</span>
      <Popover
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) setSearch("");
        }}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            role="combobox"
            aria-label={`${label} Git ref`}
            aria-expanded={open}
            aria-invalid={invalid}
            className="w-48 justify-between gap-2 bg-background px-2 font-normal"
          >
            <span className="min-w-0 truncate text-left">
              <span className="font-mono text-[11px] text-foreground">{value}</span>
              {selected?.commit ? (
                <span className="ml-1.5 text-[11px] text-muted-foreground">{selected.commit.subject}</span>
              ) : null}
            </span>
            {invalid ? <AlertCircle className="size-3.5 text-destructive" /> : <ChevronsUpDown className="size-3.5 text-muted-foreground" />}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[420px] overflow-hidden p-0"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            inputRef.current?.focus();
          }}
        >
          <div className="flex items-center border-b border-border px-2.5">
            <Search className="size-3.5 shrink-0 text-muted-foreground" />
            <Input
              ref={inputRef}
              role="combobox"
              aria-label={`Search ${label.toLocaleLowerCase()} Git refs`}
              aria-expanded={open}
              aria-controls={listboxId}
              aria-activedescendant={optionCount > 0 ? `${listboxId}-option-${activeIndex}` : undefined}
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setActiveIndex((index) => (optionCount ? (index + 1) % optionCount : 0));
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setActiveIndex((index) => (optionCount ? (index - 1 + optionCount) % optionCount : 0));
                } else if (event.key === "Enter" && optionCount > 0) {
                  event.preventDefault();
                  chooseActive();
                }
              }}
              placeholder="Search hash, message, branch, author…"
              className="h-9 border-0 bg-transparent px-2 text-xs shadow-none focus-visible:border-transparent focus-visible:ring-0 dark:bg-transparent"
            />
          </div>

          {loading ? (
            <div className="flex items-center gap-2 border-b border-border/70 px-3 py-2 text-[11px] text-muted-foreground">
              <LoaderCircle className="size-3 animate-spin" /> Loading repository history…
            </div>
          ) : null}
          {loadError ? (
            <div className="flex items-start gap-2 border-b border-destructive/20 bg-destructive/5 px-3 py-2 text-[11px] text-destructive">
              <AlertCircle className="mt-0.5 size-3 shrink-0" />
              <span className="line-clamp-2">{loadError}</span>
            </div>
          ) : null}

          <ScrollArea className="h-[286px]">
            <div id={listboxId} role="listbox" aria-label={`${label} Git refs`} className="p-1.5">
              {results.map((candidate, index) => (
                <button
                  key={`${candidate.kind}:${candidate.value}`}
                  id={`${listboxId}-option-${index}`}
                  type="button"
                  role="option"
                  aria-selected={candidate.value === value}
                  onMouseMove={() => setActiveIndex(index)}
                  onClick={() => choose(candidate.value)}
                  className={cn(
                    "flex w-full items-start gap-2 rounded-md px-2 py-2 text-left outline-none",
                    activeIndex === index ? "bg-accent text-accent-foreground" : "hover:bg-accent/60",
                  )}
                >
                  <RevisionRow candidate={candidate} selected={candidate.value === value} />
                </button>
              ))}

              {showCustomRef ? (
                <button
                  id={`${listboxId}-option-${results.length}`}
                  type="button"
                  role="option"
                  aria-selected={customRef === value}
                  onMouseMove={() => setActiveIndex(results.length)}
                  onClick={() => choose(customRef)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md border-t border-border/70 px-2 py-2 text-left text-xs outline-none",
                    activeIndex === results.length ? "bg-accent text-accent-foreground" : "hover:bg-accent/60",
                  )}
                >
                  <GitBranch className="size-3.5 text-muted-foreground" />
                  Use <span className="font-mono">{customRef}</span> as a Git ref
                </button>
              ) : null}

              {optionCount === 0 && !loading ? (
                <div className="px-3 py-10 text-center text-xs text-muted-foreground">No matching commits or refs.</div>
              ) : null}
            </div>
          </ScrollArea>
          <div className="border-t border-border px-3 py-1.5 text-[10px] text-muted-foreground">
            ↑↓ navigate · Enter select · arbitrary Git refs are accepted
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function ComparisonSelector({
  comparison,
  commits,
  commitsLoading,
  commitsError,
  onModeChange,
  onCompare,
}: {
  comparison: Comparison;
  commits: GitCommit[];
  commitsLoading: boolean;
  commitsError?: string;
  onModeChange: (mode: Comparison["mode"]) => void;
  onCompare: (from: string, to: string) => Promise<GitRefValidationResult>;
}) {
  const [from, setFrom] = useState(
    comparison.mode === "commits" ? comparison.from : "HEAD~1",
  );
  const [to, setTo] = useState(
    comparison.mode === "commits" ? comparison.to : "HEAD",
  );
  const [validation, setValidation] = useState<GitRefValidationResult>({
    ok: true,
  });
  const [submitting, setSubmitting] = useState(false);
  function updateFrom(value: string) {
    setFrom(value);
    setValidation({ ok: true });
  }

  function updateTo(value: string) {
    setTo(value);
    setValidation({ ok: true });
  }

  async function submitComparison() {
    const normalizedFrom = from.trim();
    const normalizedTo = to.trim();
    if (!normalizedFrom || !normalizedTo || submitting) return;

    setSubmitting(true);
    setValidation({ ok: true });
    try {
      setValidation(await onCompare(normalizedFrom, normalizedTo));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-w-0 items-center gap-2">
      <Select value={comparison.mode} onValueChange={(value) => onModeChange(value as Comparison["mode"])}>
        <SelectTrigger size="sm" aria-label="Changes to view" className="w-[138px] bg-background">
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
          className="relative flex min-w-0 items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void submitComparison();
          }}
        >
          <RefCombobox
            label="Base"
            value={from}
            commits={commits}
            loading={commitsLoading}
            loadError={commitsError}
            invalid={!validation.ok && validation.field === "from"}
            onChange={updateFrom}
          />
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label="Swap base and compare refs"
            title="Swap refs"
            onClick={() => {
              setFrom(to);
              setTo(from);
              setValidation({ ok: true });
            }}
          >
            <ArrowLeftRight />
          </Button>
          <RefCombobox
            label="Compare"
            value={to}
            commits={commits}
            loading={commitsLoading}
            loadError={commitsError}
            invalid={!validation.ok && validation.field === "to"}
            onChange={updateTo}
          />
          <Button
            type="submit"
            size="sm"
            variant="secondary"
            disabled={!from.trim() || !to.trim() || submitting}
          >
            {submitting ? <LoaderCircle className="animate-spin" /> : null}
            Compare
          </Button>

          {!validation.ok ? (
            <span
              role="alert"
              className="absolute top-[calc(100%+6px)] left-0 z-50 flex max-w-md items-center gap-1.5 rounded-md border border-destructive/30 bg-popover px-2.5 py-1.5 text-[11px] text-destructive shadow-md"
            >
              <AlertCircle className="size-3.5 shrink-0" /> {validation.error}
            </span>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}
