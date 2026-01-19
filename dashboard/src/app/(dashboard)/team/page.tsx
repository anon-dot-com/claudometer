import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { TeamDashboard } from "@/components/team-dashboard";

export default async function TeamPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  return <TeamDashboard />;
}
