import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { getAccountOverview } from "@/lib/sign-in-methods";

// Contact status and linked sign-in methods for the account settings screen.
export async function GET() {
  const { session, response } = await requireSession({ allowUnverifiedContact: true });
  if (response) return response;

  const overview = await getAccountOverview(session.user.id);
  if (!overview) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(overview);
}
