// src/app/api/contacts/route.ts
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

    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get("limit")) || 50;
    const offset = Number(searchParams.get("offset")) || 0;

    // Usar o contactService existente
    const result = await contactService.getContacts(session.user.id, {
      limit,
      offset,
    });

    return NextResponse.json({
      success: true,
      contacts: result.contacts || [],
      total: result.total || 0,
    });

  } catch (error) {
    console.error("Error fetching contacts:", error);
    return NextResponse.json({
      success: true,
      contacts: [],
      total: 0,
    });
  }
}
