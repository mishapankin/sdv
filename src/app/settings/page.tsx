import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  CircleHelp,
  ExternalLink,
  X,
} from "lucide-react";

import { ThemeSwitcher } from "@/components/theme-toggle";
import { StorageSettings } from "@/components/storage-settings";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { WindowControlsSetting } from "@/components/window-controls-setting";
import {
  readDependencyStatuses,
  type DependencyName,
} from "@/lib/diagnostics";

export const metadata: Metadata = {
  title: "Settings — SDV",
};
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const dependencyDetails: Record<
  DependencyName,
  { description: string; href?: string }
> = {
  git: {
    description: "Required for repository status and file diffs.",
  },
  sem: {
    description: "Adds semantic entities to diffs.",
    href: "https://github.com/ataraxy-labs/sem",
  },
  inspect: {
    description: "Adds risk and impact details to semantic entities.",
    href: "https://github.com/Ataraxy-Labs/inspect",
  },
};

export default async function SettingsPage() {
  const dependencies = await readDependencyStatuses();

  return (
    <main className="min-h-[calc(100dvh-var(--desktop-titlebar-height))] bg-background">
      <header className="h-14 border-b bg-card">
        <div className="mx-auto flex h-full max-w-3xl items-center gap-3 px-5">
          <Button variant="ghost" size="icon-sm" asChild>
            <Link href="/" aria-label="Back to diff viewer">
              <ArrowLeft />
            </Link>
          </Button>
          <div className="text-sm font-medium">Settings</div>
        </div>
      </header>

      <TooltipProvider>
        <div className="mx-auto max-w-3xl px-5 py-10">
          <section aria-labelledby="appearance-heading">
            <div className="flex items-center gap-1.5">
              <h1 id="appearance-heading" className="text-base font-semibold">
                Appearance
              </h1>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                    aria-label="About appearance settings"
                  >
                    <CircleHelp className="size-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={6}>
                  Choose how SDV looks on this device.
                </TooltipContent>
              </Tooltip>
            </div>

            <div className="mt-5 border-y">
              <div className="flex min-h-16 items-center justify-between gap-4 py-3">
                <span className="text-xs font-medium">Theme</span>
                <ThemeSwitcher />
              </div>
              <WindowControlsSetting />
            </div>
          </section>

          <section aria-labelledby="diagnostics-heading" className="mt-12">
            <div className="flex items-center gap-1.5">
              <h2 id="diagnostics-heading" className="text-base font-semibold">
                Diagnostics
              </h2>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                    aria-label="About diagnostics settings"
                  >
                    <CircleHelp className="size-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={6}>
                  Tools available to the SDV server through its PATH.
                </TooltipContent>
              </Tooltip>
            </div>

            <div className="mt-5 border-y">
              {dependencies.map((dependency) => {
                const details = dependencyDetails[dependency.name];

                return (
                  <div
                    key={dependency.name}
                    className="flex min-h-16 items-center gap-4 border-b py-3 last:border-b-0"
                  >
                    <div
                      className={
                        dependency.available
                          ? "flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-600/10 text-emerald-700 dark:text-emerald-400"
                          : "flex size-5 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive"
                      }
                      aria-hidden="true"
                    >
                      {dependency.available ? (
                        <Check className="size-3.5" />
                      ) : (
                        <X className="size-3.5" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <code className="font-mono text-xs font-semibold">
                          {dependency.name}
                        </code>
                        <span className="text-[11px] text-muted-foreground">
                          {dependency.available ? "Available" : "Not found"}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {details.description}
                      </p>
                    </div>

                    {dependency.version ? (
                      <code
                        className="hidden max-w-52 truncate text-[11px] text-muted-foreground sm:block"
                        title={dependency.version}
                      >
                        {dependency.version}
                      </code>
                    ) : null}

                    {details.href ? (
                      <Button variant="ghost" size="sm" asChild>
                        <a
                          href={details.href}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Open ${dependency.name} on GitHub`}
                        >
                          GitHub
                          <ExternalLink />
                        </a>
                      </Button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>

          <StorageSettings />
        </div>
      </TooltipProvider>
    </main>
  );
}
