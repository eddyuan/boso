/**
 * One-time backfill: `posts.imageUrl`/`imageThumbUrl` moved to the new
 * `post_media` table (see packages/db/src/schema.ts and src/lib/post-media.ts).
 * This carries over the images that existed under the old columns — captured
 * here since the columns are gone by the time this runs.
 *
 * Run once, right after `pnpm db:push` applies the new schema:
 *   tsx scripts/backfill-post-media.mts
 */
import "./lib/load-env.mjs";
import { db, postMedia } from "@bsocial/db";

const EXISTING: { id: string; imageUrl: string; imageThumbUrl: string }[] = [
  { id: "2a5a1c67-e3cc-47b9-b950-ee244adc94b7", imageUrl: "https://bravo-wallet-897722662542-ca-central-1-an.s3.ca-central-1.amazonaws.com/posts/57728b0a-7a1d-43d0-85d0-a41423dd6015.webp", imageThumbUrl: "https://bravo-wallet-897722662542-ca-central-1-an.s3.ca-central-1.amazonaws.com/posts/57728b0a-7a1d-43d0-85d0-a41423dd6015-thumb.webp" },
  { id: "803c5a44-beba-456d-90d2-e27c1a4a524f", imageUrl: "https://bravo-wallet-897722662542-ca-central-1-an.s3.ca-central-1.amazonaws.com/posts/f81b7e72-f109-45ce-a956-298e5be98259.webp", imageThumbUrl: "https://bravo-wallet-897722662542-ca-central-1-an.s3.ca-central-1.amazonaws.com/posts/f81b7e72-f109-45ce-a956-298e5be98259-thumb.webp" },
  { id: "e01416b6-89b9-4258-9afd-97230b70ddce", imageUrl: "https://bravo-wallet-897722662542-ca-central-1-an.s3.ca-central-1.amazonaws.com/posts/7de5f955-c64e-4d90-bc90-6ecacc7b00e7.webp", imageThumbUrl: "https://bravo-wallet-897722662542-ca-central-1-an.s3.ca-central-1.amazonaws.com/posts/7de5f955-c64e-4d90-bc90-6ecacc7b00e7-thumb.webp" },
  { id: "8001f16b-13e4-4c55-9ebf-51f3ecd72377", imageUrl: "https://bravo-wallet-897722662542-ca-central-1-an.s3.ca-central-1.amazonaws.com/posts/097492ff-8cc4-4bc0-ad8a-a5c000c3766c.webp", imageThumbUrl: "https://bravo-wallet-897722662542-ca-central-1-an.s3.ca-central-1.amazonaws.com/posts/097492ff-8cc4-4bc0-ad8a-a5c000c3766c-thumb.webp" },
  { id: "e0d48894-beff-46fb-a3a2-6e34d6e5db7b", imageUrl: "https://bravo-wallet-897722662542-ca-central-1-an.s3.ca-central-1.amazonaws.com/posts/632fedca-753e-4f68-919c-8a167d8c68f0.webp", imageThumbUrl: "https://bravo-wallet-897722662542-ca-central-1-an.s3.ca-central-1.amazonaws.com/posts/632fedca-753e-4f68-919c-8a167d8c68f0-thumb.webp" },
  { id: "91b55e15-abda-41ec-8bee-34c8cc7848e4", imageUrl: "https://bravo-wallet-897722662542-ca-central-1-an.s3.ca-central-1.amazonaws.com/posts/5d7560d6-286d-4507-9177-e7bcd03607b9.webp", imageThumbUrl: "https://bravo-wallet-897722662542-ca-central-1-an.s3.ca-central-1.amazonaws.com/posts/5d7560d6-286d-4507-9177-e7bcd03607b9-thumb.webp" },
  { id: "68ba6885-fac6-47a8-8613-6f8d6c87dc11", imageUrl: "https://bravo-wallet-897722662542-ca-central-1-an.s3.ca-central-1.amazonaws.com/posts/ea9fdc7c-7db8-45d2-978d-a72fed92c1a2.webp", imageThumbUrl: "https://bravo-wallet-897722662542-ca-central-1-an.s3.ca-central-1.amazonaws.com/posts/ea9fdc7c-7db8-45d2-978d-a72fed92c1a2-thumb.webp" },
  { id: "65e2d2b4-23a2-4d37-9c5e-93864b628675", imageUrl: "https://bravo-wallet-897722662542-ca-central-1-an.s3.ca-central-1.amazonaws.com/posts/a6e3fa9b-1859-4382-9b8b-02b228903600.webp", imageThumbUrl: "https://bravo-wallet-897722662542-ca-central-1-an.s3.ca-central-1.amazonaws.com/posts/a6e3fa9b-1859-4382-9b8b-02b228903600-thumb.webp" },
  { id: "24249a1b-8496-49ff-b7aa-e8a4a7f4da8c", imageUrl: "http://localhost:3000/uploads/posts/6373c799-23bd-4d07-bd7c-bb9df7b415b1.webp", imageThumbUrl: "http://localhost:3000/uploads/posts/6373c799-23bd-4d07-bd7c-bb9df7b415b1-thumb.webp" },
];

let written = 0;
for (const row of EXISTING) {
  await db.insert(postMedia).values({
    postId: row.id,
    kind: "image",
    url: row.imageUrl,
    thumbUrl: row.imageThumbUrl,
    position: 0,
  });
  written++;
}

console.log(`backfilled ${written} post_media rows`);
process.exit(0);
