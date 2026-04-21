import { NextResponse } from "next/server";
import { isMockMode } from "@/lib/mock";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ mock: isMockMode() });
}
