import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { HomeContent } from "./home-content";

export default async function Home() {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  return <HomeContent user={session.user} isAdmin={!!session.user.isAdmin} />;
}
