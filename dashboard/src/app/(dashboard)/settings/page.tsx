import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { SettingsPage } from "@/components/settings-page";

export default async function Settings() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  return <SettingsPage />;
}
