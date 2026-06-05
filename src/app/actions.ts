"use server";

import { readSemanticDiff } from "@/lib/sem";

export async function getSemanticDiff() {
  return readSemanticDiff();
}
