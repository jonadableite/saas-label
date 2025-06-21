// src/app/(protected)/whatsapp/actions.ts
"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { db } from "@/db";
import { CreateInstanceSchema, instancesTables } from "@/db/schema";
import { auth } from "@/lib/auth";

const EVOLUTION_API_BASE_URL = process.env.EVOLUTION_API_BASE_URL;
const GLOBAL_API_KEY = process.env.GLOBAL_API_KEY;

console.log("Variáveis de ambiente carregadas:", {
  EVOLUTION_API_BASE_URL,
  GLOBAL_API_KEY,
});

if (!EVOLUTION_API_BASE_URL || !GLOBAL_API_KEY) {
  console.error(
    "EVOLUTION_API_BASE_URL e GLOBAL_API_KEY deve ser definido em variáveis ​​de ambiente.",
  );
}

export async function createInstance(
  values: z.infer<typeof CreateInstanceSchema>,
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/authentication");
  }

  const userId = session.user.id;

  const validatedFields = CreateInstanceSchema.safeParse(values);

  if (!validatedFields.success) {
    return { error: "Nome da instância inválido." };
  }

  const { instanceName } = validatedFields.data;

  const existingInstance = await db.query.instancesTables.findFirst({
    where:
      eq(instancesTables.userId, userId) &&
      eq(instancesTables.instanceName, instanceName),
  });

  if (existingInstance) {
    return { error: "Você já possui uma instância com este nome." };
  }

  try {
    const apiResponse = await fetch(
      `${EVOLUTION_API_BASE_URL}/instance/create`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: GLOBAL_API_KEY!,
        },
        body: JSON.stringify({
          instanceName: instanceName,
          qrcode: true,
          integration: "WHATSAPP-BAILEYS",
          settings: {
            groupsIgnore: true,
          },
        }),
      },
    );

    if (!apiResponse.ok) {
      const errorData = await apiResponse.json();
      console.error("Erro ao criar instância na Evolution API:", errorData);
      return {
        error: errorData.message || "Erro ao criar instância na Evolution API.",
      };
    }

    const instanceData = await apiResponse.json();

    // Salvar os dados da instância no banco de dados do usuário
    await db.insert(instancesTables).values({
      instanceId: instanceData.instance.instanceId,
      userId: userId,
      instanceName: instanceData.instance.instanceName,
      number: instanceData.instance.number || null,
      integration: instanceData.instance.integration || "WHATSAPP-BAILEYS",
      status: instanceData.instance.status || "connecting",
      ownerJid: instanceData.instance.ownerJid || null,
      profileName: instanceData.instance.profileName || null,
      profilePicUrl: instanceData.instance.profilePicUrl || null,
      qrcode: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Revalidar o cache da página para mostrar a nova instância
    // Esta revalidação é necessária apenas após a CRIAÇÃO de uma nova instância
    revalidatePath("/whatsapp");

    return { success: "Instância criada com sucesso!" };
  } catch (error) {
    console.error("Erro inesperado ao criar instância:", error);
    return { error: "Ocorreu um erro inesperado ao criar a instância." };
  }
}

// Função para buscar o status de conexão de uma instância na Evolution API
export async function getInstanceStatus(instanceName: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/authentication");
  }

  const userId = session.user.id;

  // Verificar se a instância pertence ao usuário logado
  const instance = await db.query.instancesTables.findFirst({
    where:
      eq(instancesTables.userId, userId) &&
      eq(instancesTables.instanceName, instanceName),
  });

  if (!instance) {
    return { error: "Instância não encontrada." };
  }

  try {
    // Chamar a API da Evolution para obter o status
    const apiResponse = await fetch(
      `${EVOLUTION_API_BASE_URL}/instance/connectionState/${instanceName}`,
      {
        method: "GET",
        headers: {
          apikey: GLOBAL_API_KEY!,
        },
      },
    );

    if (!apiResponse.ok) {
      const errorData = await apiResponse.json();
      console.error("Erro ao buscar status da instância:", errorData);
      // Atualizar o status no banco para refletir o erro ou estado desconhecido
      await db
        .update(instancesTables)
        .set({ status: "unknown", updatedAt: new Date() })
        .where(eq(instancesTables.instanceId, instance.instanceId)); // Usa o instanceId salvo
      // REMOVIDO: revalidatePath("/whatsapp"); // Remover esta linha
      return {
        error: errorData.message || "Erro ao buscar status da instância.",
      };
    }

    const statusData = await apiResponse.json();

    // Atualizar o status no banco de dados
    await db
      .update(instancesTables)
      .set({ status: statusData.state, updatedAt: new Date() })
      .where(eq(instancesTables.instanceId, instance.instanceId)); // Usa o instanceId salvo

    // REMOVIDO: revalidatePath("/whatsapp"); // Remover esta linha

    return { success: true, status: statusData.state };
  } catch (error) {
    console.error("Erro inesperado ao buscar status da instância:", error);
    // Atualizar o status no banco para refletir o erro ou estado desconhecido
    await db
      .update(instancesTables)
      .set({ status: "unknown", updatedAt: new Date() })
      .where(eq(instancesTables.instanceId, instance.instanceId)); // Usa o instanceId salvo
    // REMOVIDO: revalidatePath("/whatsapp"); // Remover esta linha
    return { error: "Ocorreu um erro inesperado ao buscar o status." };
  }
}
