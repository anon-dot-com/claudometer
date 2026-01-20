import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { userId } = await auth();
    const { orgId } = await params;

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const client = await clerkClient();

    // Verify the organization exists
    try {
      await client.organizations.getOrganization({ organizationId: orgId });
    } catch {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    // Check if user is already a member
    try {
      const memberships = await client.organizations.getOrganizationMembershipList({
        organizationId: orgId,
      });

      const existingMembership = memberships.data.find(
        (m) => m.publicUserData?.userId === userId
      );

      if (existingMembership) {
        return NextResponse.json(
          { error: "Already a member", alreadyMember: true },
          { status: 400 }
        );
      }
    } catch {
      // Continue if we can't check memberships
    }

    // Add user to the organization
    await client.organizations.createOrganizationMembership({
      organizationId: orgId,
      userId: userId,
      role: "org:member",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error joining organization:", error);
    return NextResponse.json(
      { error: "Failed to join organization" },
      { status: 500 }
    );
  }
}
