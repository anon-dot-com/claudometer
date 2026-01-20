import { clerkClient } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;

    const client = await clerkClient();
    const org = await client.organizations.getOrganization({
      organizationId: orgId,
    });

    return NextResponse.json({
      id: org.id,
      name: org.name,
      imageUrl: org.imageUrl,
      membersCount: org.membersCount,
    });
  } catch (error) {
    console.error("Error fetching organization:", error);
    return NextResponse.json(
      { error: "Organization not found" },
      { status: 404 }
    );
  }
}
