import { Suspense } from "react";

import { SemanticDiffViewer } from "@/components/semantic-diff-viewer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <Suspense>
      <SemanticDiffViewer />
    </Suspense>
  );
}
