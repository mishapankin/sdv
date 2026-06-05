import {
  Braces,
  Box,
  CircleDot,
  Code2,
  Component,
  Database,
  FileJson,
  FunctionSquare,
  Hash,
  ListTree,
  Network,
  Package,
  Parentheses,
  Puzzle,
  Regex,
  Shapes,
  Variable,
  type LucideIcon,
} from "lucide-react";

const iconByType: Record<string, LucideIcon> = {
  class: Box,
  const: Hash,
  constructor: Component,
  enum: ListTree,
  export: Package,
  field: CircleDot,
  function: FunctionSquare,
  impl: Puzzle,
  interface: Network,
  method: Parentheses,
  module: Package,
  property: CircleDot,
  struct: Braces,
  test: Regex,
  trait: Shapes,
  type: Database,
  variable: Variable,
  json: FileJson,
};

export function EntityIcon({
  entityType,
  className,
}: {
  entityType: string;
  className?: string;
}) {
  const Icon = iconByType[entityType.toLowerCase()] ?? Code2;
  return <Icon aria-hidden="true" className={className} />;
}
