import { createAuthClient } from "better-auth/react";
import { usernameClient } from "better-auth/client/plugins";

// Browser-side client for the web app (same origin as the API).
export const authClient = createAuthClient({
  plugins: [usernameClient()],
});
