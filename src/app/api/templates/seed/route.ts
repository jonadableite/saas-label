// src/app/api/templates/seed/route.ts
import { NextRequest, NextResponse } from "next/server";

import { seedSystemTemplates } from "@/db/seeders/templates-seeder";
import { auth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    // Obter sessão do usuário
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    // Verificar se o usuário está autenticado
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    // Executar a função de seed
    await seedSystemTemplates(session.user.id);

    // Resposta de sucesso
    return NextResponse.json({
      message: "Templates do sistema criados com sucesso!",
    });
  } catch (error) {
    // Logar erro no servidor
    console.error("Erro ao criar templates do sistema:", error);
    // Resposta de erro
    return NextResponse.json(
      { error: "Erro ao criar templates do sistema" },
      { status: 500 },
    );
  }
}
