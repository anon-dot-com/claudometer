import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { GlobalDashboard } from "@/components/global-dashboard";

export default async function GlobalPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  return <GlobalDashboard />;
}
