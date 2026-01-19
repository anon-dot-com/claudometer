"use client";

import { OrganizationSwitcher, UserButton, useOrganization, useUser } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavHeader() {
  const { user } = useUser();
  const { organization } = useOrganization();
  const pathname = usePathname();

  const isMyUsage = pathname === "/" || pathname === "/my-usage";
  const isTeam = pathname === "/team";
  const isSettings = pathname === "/settings";

  return (
    <header className="border-b border-zinc-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-xl font-semibold text-white">Claudometer</h1>
            <OrganizationSwitcher
              appearance={{
                elements: {
                  rootBox: "flex items-center",
                  organizationSwitcherTrigger:
                    "px-3 py-1.5 rounded-md bg-zinc-800 text-zinc-300 text-sm hover:bg-zinc-700 transition-colors",
                },
              }}
              afterCreateOrganizationUrl="/"
              afterSelectOrganizationUrl="/"
            />
            <nav className="flex gap-1 bg-zinc-900 rounded-lg p-1">
              <Link
                href="/"
                className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
                  isMyUsage
                    ? "bg-purple-600 text-white"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                My Usage
              </Link>
              <Link
                href="/team"
                className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
                  isTeam
                    ? "bg-purple-600 text-white"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                Team
              </Link>
              <Link
                href="/settings"
                className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
                  isSettings
                    ? "bg-purple-600 text-white"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                Settings
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-zinc-400 hidden sm:block">
              {user?.emailAddresses[0]?.emailAddress}
            </span>
            <UserButton afterSignOutUrl="/sign-in" />
          </div>
        </div>
      </div>
    </header>
  );
}
