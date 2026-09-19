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
};

export const inngest = new Inngest({
  id: "tielo",
  schemas: new EventSchemas().fromRecord<Events>(),
});
