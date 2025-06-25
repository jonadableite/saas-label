// src/app/api/contact-groups/route.ts
import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { contactService } from "@/lib/services/contact.service";

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Usar o contactService para buscar grupos
    const result = await contactService.getContactGroups(session.user.id);

    return NextResponse.json({
      success: true,
      groups: result.groups || [],
      total: result.total || 0,
    });

  } catch (error) {
    console.error("Error fetching contact groups:", error);
    return NextResponse.json({
      success: true,
      groups: [],
      total: 0,
    });
  }
}
