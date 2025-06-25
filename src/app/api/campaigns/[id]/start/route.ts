// src/app/api/campaigns/[id]/start/route.ts
import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { campaignService } from "@/lib/services/campaign.service";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await campaignService.startCampaign(session.user.id, params.id);

    return NextResponse.json({ message: "Campaign started successfully" });
  } catch (error) {
    console.error("Error starting campaign:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 400 },
    );
  }
}
