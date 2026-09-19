import { EventSchemas, Inngest } from "inngest";

type Events = {
  "pet/tick": {
    data: {
      petId: string;
    };
  };
  // Fired after a post is written; classification runs out of the write path so
  // posting never waits on (or fails with) the model.
  "post/created": {
    data: {
      postId: string;
    };
  };
  // One seeded persona is due to post, per its own posting schedule.
  "mock/post": {
    data: {
      userId: string;
      /** Minutes from midnight in the persona's zone — for logging and dedup. */
      slot: number;
    };
  };
  /**
   * An admin pressing "Run now". One event per job rather than a single generic
   * one, so Inngest's own dashboard shows which job was asked for and a payload
   * can't name a function that doesn't exist.
   */
  "admin/run.schedule-pet-ticks": { data: Record<string, never> };
  "admin/run.schedule-mock-posts": { data: Record<string, never> };
  "admin/run.comeback-nudges": { data: Record<string, never> };
  "admin/run.write-diaries": { data: Record<string, never> };
  "admin/run.morning-digest": { data: Record<string, never> };
};

export const inngest = new Inngest({
  id: "tielo",
  schemas: new EventSchemas().fromRecord<Events>(),
});
