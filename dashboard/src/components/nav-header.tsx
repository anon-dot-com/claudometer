"use client";

import { OrganizationSwitcher, UserButton, useOrganization, useUser } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import Link from "next/link";
import { usePathname } from "next/navigation";

const clerkDarkAppearance = {
  baseTheme: dark,
  elements: {
    rootBox: "flex items-center",
    organizationSwitcherTrigger:
      "px-3 py-1.5 rounded-md bg-zinc-800 text-zinc-300 text-sm hover:bg-zinc-700 transition-colors",
    organizationSwitcherPopoverCard: "bg-zinc-900 border border-zinc-800",
    organizationSwitcherPopoverActionButton: "text-zinc-300 hover:bg-zinc-800",
    organizationSwitcherPopoverActionButtonText: "text-zinc-300",
    organizationSwitcherPopoverFooter: "border-zinc-800",
    organizationPreviewMainIdentifier: "text-white",
    organizationPreviewSecondaryIdentifier: "text-zinc-400",
    userPreviewMainIdentifier: "text-white",
    userPreviewSecondaryIdentifier: "text-zinc-400",
    userButtonPopoverCard: "bg-zinc-900 border border-zinc-800",
    userButtonPopoverActionButton: "text-zinc-300 hover:bg-zinc-800",
    userButtonPopoverActionButtonText: "text-zinc-300",
    userButtonPopoverActionButtonIcon: "text-zinc-400",
    userButtonPopoverFooter: "border-zinc-800",
    modalContent: "bg-zinc-900 border-zinc-800",
    modalCloseButton: "text-zinc-400 hover:text-white",
    formFieldLabel: "text-zinc-300",
    formFieldInput: "bg-zinc-800 border-zinc-700 text-white",
    formButtonPrimary: "bg-purple-600 hover:bg-purple-700 text-white",
    card: "bg-zinc-900 border-zinc-800",
    headerTitle: "text-white",
    headerSubtitle: "text-zinc-400",
    socialButtonsBlockButton: "bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700",
    socialButtonsBlockButtonText: "text-white",
    dividerLine: "bg-zinc-700",
    dividerText: "text-zinc-500",
    footerActionLink: "text-purple-400 hover:text-purple-300",
    footerActionText: "text-zinc-400",
    identityPreviewText: "text-zinc-300",
    identityPreviewEditButton: "text-purple-400",
    alternativeMethodsBlockButton: "text-zinc-300 hover:bg-zinc-800 border-zinc-700",
    navbar: "bg-zinc-900 border-zinc-800",
    navbarButton: "text-zinc-300 hover:bg-zinc-800",
    pageScrollBox: "bg-zinc-900",
    page: "bg-zinc-900",
    profileSectionTitle: "text-white",
    profileSectionTitleText: "text-white",
    profileSectionContent: "text-zinc-300",
    profileSectionPrimaryButton: "bg-purple-600 hover:bg-purple-700 text-white",
    accordionTriggerButton: "text-zinc-300 hover:bg-zinc-800",
    accordionContent: "bg-zinc-900",
    breadcrumbs: "text-zinc-400",
    breadcrumbsItem: "text-zinc-400",
    breadcrumbsItemDivider: "text-zinc-600",
    menuButton: "text-zinc-300 hover:bg-zinc-800",
    menuList: "bg-zinc-900 border-zinc-800",
    menuItem: "text-zinc-300 hover:bg-zinc-800",
    selectButton: "bg-zinc-800 border-zinc-700 text-white",
    selectOptionsContainer: "bg-zinc-800 border-zinc-700",
    selectOption: "text-white hover:bg-zinc-700",
    tagInputContainer: "bg-zinc-800 border-zinc-700",
    tagPillContainer: "bg-zinc-700 text-white",
    formFieldErrorText: "text-red-400",
    formFieldSuccessText: "text-green-400",
    badge: "bg-purple-600 text-white",
    tableHead: "text-zinc-400 border-zinc-800",
    tableCell: "text-zinc-300 border-zinc-800",
  },
  variables: {
    colorPrimary: "#9333ea",
    colorBackground: "#18181b",
    colorText: "#ffffff",
    colorTextSecondary: "#a1a1aa",
    colorInputBackground: "#27272a",
    colorInputText: "#ffffff",
  },
};

export function NavHeader() {
  const { user } = useUser();
  const { organization } = useOrganization();
  const pathname = usePathname();

  const isMyUsage = pathname === "/dashboard";
  const isTeam = pathname === "/team";
  const isSettings = pathname === "/settings";

  return (
    <header className="border-b border-zinc-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-xl font-semibold text-white">Claudometer</h1>
            <OrganizationSwitcher
              appearance={clerkDarkAppearance}
              afterCreateOrganizationUrl="/dashboard"
              afterSelectOrganizationUrl="/dashboard"
            />
            <nav className="flex gap-1 bg-zinc-900 rounded-lg p-1">
              <Link
                href="/dashboard"
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
            <UserButton
              afterSignOutUrl="/"
              appearance={clerkDarkAppearance}
            />
          </div>
        </div>
      </div>
    </header>
  );
}
