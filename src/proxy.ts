import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { DESKTOP_TOKEN_HEADER } from "../runtime/constants.mjs";

export function proxy(request: NextRequest) {
  const expectedToken = process.env.SDV_ACCESS_TOKEN;

  if (
    expectedToken &&
    request.headers.get(DESKTOP_TOKEN_HEADER) !== expectedToken
  ) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  return NextResponse.next();
}
