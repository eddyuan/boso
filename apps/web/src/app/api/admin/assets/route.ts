import { NextResponse } from "next/server";
import { z } from "zod";
import { OWNED_PREFIXES, inventory } from "@/lib/assets";
import { deleteObject } from "@/lib/storage";
import { requireSession } from "@/lib/session";

/** What storage holds, against what the database references. */
export async function GET() {
  const { response } = await requireSession({ requireAdmin: true });
  if (response) return response;

  try {
    return NextResponse.json(await inventory());
  } catch (error) {
    // Almost always storage not being configured, or credentials without
    // ListBucket. Worth naming, because an empty inventory and an unreadable
    // bucket look identical otherwise — and one of them must not offer deletion.
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "list_failed", reason: message }, { status: 502 });
  }
}

const deleteSchema = z.object({ keys: z.array(z.string().min(1).max(512)).min(1).max(200) });

/**
 * Deletes unreferenced objects.
 *
 * The inventory is recomputed here rather than trusting the keys the client sent.
 * A page left open while a post is written would otherwise offer to delete an
 * object that has since been referenced — and deleting live media is exactly the
 * mistake this tool must not be able to make.
 */
export async function DELETE(req: Request) {
  const { response } = await requireSession({ requireAdmin: true });
  if (response) return response;

  const parsed = deleteSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const current = await inventory();
  if (current.truncated) {
    return NextResponse.json(
      { error: "listing_truncated", reason: "Too many objects to be sure what is unreferenced; refusing to delete." },
      { status: 409 },
    );
  }

  // Belt and braces: the bucket is shared with another product, so a key outside
  // our own prefixes is refused here regardless of what the orphan list says.
  const deletable = new Set(
    current.orphans.filter((o) => OWNED_PREFIXES.some((p) => o.key.startsWith(p))).map((o) => o.key),
  );
  const refused = parsed.data.keys.filter((k) => !deletable.has(k));
  const allowed = parsed.data.keys.filter((k) => deletable.has(k));

  let deleted = 0;
  for (const key of allowed) if (await deleteObject(key)) deleted += 1;

  return NextResponse.json({ deleted, refused, inventory: await inventory() });
}
