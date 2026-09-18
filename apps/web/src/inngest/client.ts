import { EventSchemas, Inngest } from "inngest";

type Events = {
  "pet/tick": {
    data: {
      petId: string;
    };
  };
};

export const inngest = new Inngest({
  id: "tielo",
  schemas: new EventSchemas().fromRecord<Events>(),
});
