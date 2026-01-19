import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { GetStartedPage } from "@/components/get-started-page";

export default async function GetStarted() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  return <GetStartedPage />;
}
