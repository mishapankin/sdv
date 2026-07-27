import { FileCode2 } from "lucide-react";

import {
  FILE_ICON_DATA,
  type FileIconName,
} from "@/components/file-icon-data.generated";
import { getFileIconName } from "@/lib/file-icon";
import { cn } from "@/lib/utils";

export function FileTypeIcon({
  filePath,
  className,
}: {
  filePath: string;
  className?: string;
}) {
  const iconName = getFileIconName(filePath);

  if (!iconName) {
    return (
      <FileCode2
        aria-hidden="true"
        className={cn("text-muted-foreground", className)}
      />
    );
  }

  const icon = FILE_ICON_DATA[iconName as FileIconName];

  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox={`0 0 ${icon.width} ${icon.height}`}
      dangerouslySetInnerHTML={{ __html: icon.body }}
    />
  );
}
