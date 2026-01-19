"use client";

import { OrganizationProfile } from "@clerk/nextjs";

export function SettingsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h2 className="text-2xl font-bold text-white mb-2">Settings</h2>
      <p className="text-zinc-400 mb-8">
        Invite team members and manage your organization.
      </p>

      <div className="bg-zinc-900 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4">
          Team Management
        </h3>

        <OrganizationProfile
          appearance={{
            elements: {
              rootBox: "w-full",
              card: "bg-transparent shadow-none",
              navbar: "hidden",
              pageScrollBox: "p-0",
              profileSection__organizationProfile: "hidden",
              profileSection__organizationDanger: "hidden",
            },
            variables: {
              colorBackground: "#18181b",
              colorInputBackground: "#27272a",
              colorText: "#ffffff",
              colorTextSecondary: "#a1a1aa",
              colorPrimary: "#a855f7",
            },
          }}
        />
      </div>
    </div>
  );
}
