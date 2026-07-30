export type SemanticSidebarFileKind = "text" | "image" | "binary";

export function shouldShowSemanticSidebar({
  semanticAvailable,
  semanticChangeCount,
  fileKind,
}: {
  semanticAvailable: boolean;
  semanticChangeCount: number;
  fileKind?: SemanticSidebarFileKind;
}) {
  if (semanticAvailable) {
    return semanticChangeCount > 0;
  }

  return fileKind === "text";
}
