import { auth } from "@clerk/nextjs/server";
import { Dashboard } from "@/components/dashboard";
import { LandingPage } from "@/components/landing-page";

export default async function Home() {
  const { userId } = await auth();

  if (!userId) {
    return <LandingPage />;
  }

  return <Dashboard />;
}
