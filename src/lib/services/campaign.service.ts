// src/lib/services/campaign.service.ts
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import {
  type Campaign,
  campaignContactsTables,
  campaignsTables,
  type CampaignStatus,
  contactGroupMembersTables,
  contactGroupsTables,
  contactsTables,
  instancesTables,
  templatesTables
} from "@/db/schema";

// Schema para criação de campanha
export const CreateCampaignSchema = z.object({
  name: z.string().min(1, "Nome da campanha é obrigatório"),
  description: z.string().optional(),
  instanceId: z.string().min(1, "Instância é obrigatória"),
  templateId: z.string().optional(),
  messageContent: z.string().min(1, "Conteúdo da mensagem é obrigatório"),

  // Agendamento
  enableScheduling: z.boolean().default(false),
  scheduleAt: z.date().optional().nullable(), // Tornado opcional e nullable

  // Configurações avançadas
  sendDelay: z.number().min(1000).default(2000),
  maxRetriesPerMessage: z.number().min(1).max(5).default(3),
  sendOnlyBusinessHours: z.boolean().default(false),
  businessHoursStart: z.string().default("09:00"),
  businessHoursEnd: z.string().default("18:00"),

  // Público alvo
  contactIds: z.array(z.string()).default([]),
  groupIds: z.array(z.string()).default([]),
})
.refine((data) => {
  // Validação mais flexível: só exige scheduleAt se enableScheduling for true
  if (data.enableScheduling && !data.scheduleAt) {
    return false;
  }
  return true;
}, {
  message: "Data de agendamento é obrigatória quando agendamento está habilitado",
  path: ["scheduleAt"],
})
.refine((data) => {
  return data.contactIds.length > 0 || data.groupIds.length > 0;
}, {
  message: "Selecione pelo menos um contato ou grupo",
  path: ["contactIds"],
});

// Schema para atualização - definido manualmente sem usar .partial()
export const UpdateCampaignSchema = z.object({
  name: z.string().min(1, "Nome da campanha é obrigatório").optional(),
  description: z.string().optional(),
  instanceId: z.string().min(1, "Instância é obrigatória").optional(),
  templateId: z.string().optional(),
  messageContent: z.string().min(1, "Conteúdo da mensagem é obrigatório").optional(),
  enableScheduling: z.boolean().optional(),
  scheduleAt: z.date().optional().nullable(), // Também tornado opcional e nullable
  sendDelay: z.number().min(1000).optional(),
  maxRetriesPerMessage: z.number().min(1).max(5).optional(),
  sendOnlyBusinessHours: z.boolean().optional(),
  businessHoursStart: z.string().optional(),
  businessHoursEnd: z.string().optional(),
});

export type CreateCampaignInput = z.infer<typeof CreateCampaignSchema>;
export type UpdateCampaignInput = z.infer<typeof UpdateCampaignSchema>;

export class CampaignService {
  async createCampaign(
    userId: string,
    data: CreateCampaignInput,
  ): Promise<Campaign> {
    try {
      console.log("Iniciando criação de campanha:", { userId, data });

      const validatedData = CreateCampaignSchema.parse(data);
      console.log("Dados validados:", validatedData);

      // Verificar se a instância existe e está ativa
      if (validatedData.instanceId) {
        console.log("Verificando instância:", validatedData.instanceId);

        const instance = await db.query.instancesTables.findFirst({
          where: and(
            eq(instancesTables.instanceId, validatedData.instanceId),
            eq(instancesTables.userId, userId),
          ),
        });

        if (!instance) {
          throw new Error("Instância não encontrada");
        }

        if (instance.status !== "open") {
          throw new Error("Instância não está conectada");
        }

        console.log("Instância válida:", instance.instanceName);
      }

      // Verificar template se fornecido
      if (validatedData.templateId) {
        console.log("Verificando template:", validatedData.templateId);

        const template = await db.query.templatesTables.findFirst({
          where: and(
            eq(templatesTables.id, validatedData.templateId),
            eq(templatesTables.userId, userId),
          ),
        });

        if (!template) {
          throw new Error("Template não encontrado");
        }

        console.log("Template válido:", template.name);
      }

      // Coletar todos os contatos (individuais + grupos)
      let allContactIds: string[] = [...(validatedData.contactIds || [])];

      // Se houver grupos selecionados, buscar contatos dos grupos
      if (validatedData.groupIds && validatedData.groupIds.length > 0) {
        console.log("Buscando contatos dos grupos:", validatedData.groupIds);

        const groupContacts = await db
          .select({
            contactId: contactGroupMembersTables.contactId
          })
          .from(contactGroupMembersTables)
          .innerJoin(contactsTables, eq(contactsTables.id, contactGroupMembersTables.contactId))
          .innerJoin(contactGroupsTables, eq(contactGroupsTables.id, contactGroupMembersTables.groupId))
          .where(and(
            inArray(contactGroupMembersTables.groupId, validatedData.groupIds),
            eq(contactGroupMembersTables.isActive, true),
            eq(contactsTables.userId, userId),
            eq(contactsTables.isActive, true)
          ));

        const groupContactIds = groupContacts.map(gc => gc.contactId);
        allContactIds = [...allContactIds, ...groupContactIds];

        console.log("Contatos encontrados nos grupos:", groupContactIds.length);
      }

      // Remover duplicatas
      allContactIds = [...new Set(allContactIds)];
      console.log("Total de contatos únicos:", allContactIds.length);

      if (allContactIds.length === 0) {
        throw new Error("Nenhum contato encontrado para a campanha");
      }

      // Determinar status da campanha baseado no agendamento
      let campaignStatus: CampaignStatus = "draft";
      if (validatedData.enableScheduling && validatedData.scheduleAt) {
        campaignStatus = "scheduled";
      } else if (!validatedData.enableScheduling) {
        campaignStatus = "draft"; // Será iniciada imediatamente após criação
      }

      // Criar a campanha
      console.log("Criando campanha no banco...");
      const [campaign] = await db
        .insert(campaignsTables)
        .values({
          userId,
          instanceId: validatedData.instanceId,
          name: validatedData.name,
          description: validatedData.description || null,
          templateId: validatedData.templateId || null,
          messageContent: validatedData.messageContent,
          status: campaignStatus,
          scheduleAt: validatedData.scheduleAt || null,
          sendDelay: validatedData.sendDelay,
          maxRetriesPerMessage: validatedData.maxRetriesPerMessage,
          sendOnlyBusinessHours: validatedData.sendOnlyBusinessHours,
          businessHoursStart: validatedData.businessHoursStart,
          businessHoursEnd: validatedData.businessHoursEnd,
          totalContacts: allContactIds.length,
          sentCount: 0,
          deliveredCount: 0,
          readCount: 0,
          errorCount: 0,
        })
        .returning();

      console.log("Campanha criada:", campaign.id);

      // Adicionar contatos à campanha
      if (allContactIds.length > 0) {
        console.log("Adicionando contatos à campanha...");
        await this.addContactsToCampaign(campaign.id, {
          contactIds: allContactIds,
          groupIds: [],
        });
        console.log(`${allContactIds.length} contatos adicionados à campanha`);
      }

      // Log da atividade
      await this.logActivity(userId, {
        type: "campaign_created",
        status: "success",
        title: "Nova campanha criada",
        description: `Campanha '${campaign.name}' foi criada com ${allContactIds.length} contatos`,
        campaignId: campaign.id,
      });

      // Lógica de início/agendamento
      if (validatedData.enableScheduling && validatedData.scheduleAt) {
        console.log("Agendando campanha para:", validatedData.scheduleAt);
        await this.scheduleCampaign(campaign.id);
      } else if (!validatedData.enableScheduling) {
        console.log("Iniciando campanha imediatamente...");
        await this.startCampaign(userId, campaign.id);
      }

      console.log("Campanha criada com sucesso:", campaign.id);
      return campaign;

    } catch (error) {
      console.error("Erro ao criar campanha:", error);

      if (error instanceof z.ZodError) {
        throw new Error(`Dados inválidos: ${error.errors.map(e => e.message).join(", ")}`);
      }

      throw error;
    }
  }

  async getCampaigns(
    userId: string,
    filters: {
      status?: CampaignStatus;
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<{ campaigns: Campaign[]; total: number }> {
    const { status, limit = 20, offset = 0 } = filters;

    const whereConditions = [eq(campaignsTables.userId, userId)];

    if (status) {
      whereConditions.push(eq(campaignsTables.status, status));
    }

    const [campaigns, totalResult] = await Promise.all([
      db.query.campaignsTables.findMany({
        where: and(...whereConditions),
        limit,
        offset,
        orderBy: desc(campaignsTables.createdAt),
        with: {
          instance: {
            columns: {
              instanceName: true,
              status: true,
            },
          },
          template: {
            columns: {
              name: true,
              type: true,
            },
          },
        },
      }),
      db
        .select({ count: sql<number>`count(*)` })
        .from(campaignsTables)
        .where(and(...whereConditions))
        .then((result) => result[0]?.count || 0),
    ]);

    return { campaigns, total: totalResult };
  }

  async getCampaignById(
    userId: string,
    campaignId: string,
  ): Promise<Campaign | null> {
    const campaign = await db.query.campaignsTables.findFirst({
      where: and(
        eq(campaignsTables.id, campaignId),
        eq(campaignsTables.userId, userId),
      ),
      with: {
        instance: true,
        template: true,
        campaignContacts: {
          with: {
            contact: true,
          },
          limit: 10,
        },
      },
    });

    return campaign || null;
  }

  async addContactsToCampaign(
    campaignId: string,
    data: {
      contactIds?: string[];
      groupIds?: string[];
    },
  ): Promise<void> {
    const contactIds = new Set<string>();

    // Adicionar contatos diretos
    if (data.contactIds?.length) {
      data.contactIds.forEach((id) => contactIds.add(id));
    }

    // Criar registros de campanha-contato
    const campaignContacts = Array.from(contactIds).map((contactId) => ({
      campaignId,
      contactId,
      status: "pending" as const,
    }));

    if (campaignContacts.length > 0) {
      await db
        .insert(campaignContactsTables)
        .values(campaignContacts)
        .onConflictDoNothing();

      console.log(`${campaignContacts.length} registros de campanha-contato criados`);
    }
  }

  async startCampaign(userId: string, campaignId: string): Promise<void> {
    try {
      console.log("Iniciando campanha:", campaignId);

      const campaign = await this.getCampaignById(userId, campaignId);
      if (!campaign) {
        throw new Error("Campanha não encontrada");
      }

      if (!["draft", "scheduled", "paused"].includes(campaign.status)) {
        throw new Error("Campanha não pode ser iniciada no status atual");
      }

      if (!campaign.instanceId) {
        throw new Error("Instância não configurada para a campanha");
      }

      // Verificar se a instância está conectada
      const instance = await db.query.instancesTables.findFirst({
        where: eq(instancesTables.instanceId, campaign.instanceId),
      });

      if (!instance || instance.status !== "open") {
        throw new Error("Instância não está conectada");
      }

      // Atualizar status da campanha
      await db
        .update(campaignsTables)
        .set({
          status: "running",
          startedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(campaignsTables.id, campaignId));

      // Log da atividade
      await this.logActivity(userId, {
        type: "campaign_started",
        status: "success",
        title: "Campanha iniciada",
        description: `Campanha '${campaign.name}' foi iniciada`,
        campaignId: campaign.id,
        instanceId: campaign.instanceId,
      });

      console.log("Campanha iniciada com sucesso:", campaignId);

    } catch (error) {
      console.error("Erro ao iniciar campanha:", error);
      throw error;
    }
  }

  async scheduleCampaign(campaignId: string): Promise<void> {
    const campaign = await db.query.campaignsTables.findFirst({
      where: eq(campaignsTables.id, campaignId),
    });

    if (!campaign || !campaign.scheduleAt) {
      throw new Error("Campanha ou agendamento não encontrado");
    }

    const delay = campaign.scheduleAt.getTime() - Date.now();

    if (delay <= 0) {
      // Executar imediatamente se a data já passou
      await this.startCampaign(campaign.userId, campaignId);
    } else {
      // Por enquanto, apenas log - implementar com queue depois
      console.log(`Campanha ${campaignId} agendada para ${campaign.scheduleAt}`);
    }
  }

  async updateCampaign(
    userId: string,
    campaignId: string,
    data: UpdateCampaignInput
  ): Promise<Campaign> {
    try {
      const validatedData = UpdateCampaignSchema.parse(data);

      const [campaign] = await db
        .update(campaignsTables)
        .set({
          ...validatedData,
          updatedAt: new Date(),
        })
        .where(and(
          eq(campaignsTables.id, campaignId),
          eq(campaignsTables.userId, userId)
        ))
        .returning();

      if (!campaign) {
        throw new Error("Campanha não encontrada");
      }

      return campaign;
    } catch (error) {
      console.error("Erro ao atualizar campanha:", error);

      if (error instanceof z.ZodError) {
        throw new Error(`Dados inválidos: ${error.errors.map(e => e.message).join(", ")}`);
      }

      throw error;
    }
  }

  async deleteCampaign(userId: string, campaignId: string): Promise<{ success: boolean }> {
    try {
      const [campaign] = await db
        .update(campaignsTables)
        .set({
          status: "cancelled",
          updatedAt: new Date(),
        })
        .where(and(
          eq(campaignsTables.id, campaignId),
          eq(campaignsTables.userId, userId)
        ))
        .returning();

      if (!campaign) {
        throw new Error("Campanha não encontrada");
      }

      return { success: true };
    } catch (error) {
      console.error("Erro ao deletar campanha:", error);
      throw error;
    }
  }

  private async logActivity(
    userId: string,
    activity: {
      type: string;
      status: string;
      title: string;
      description: string;
      campaignId?: string;
      instanceId?: string;
      metadata?: any;
    },
  ): Promise<void> {
    // Por enquanto apenas log no console
    console.log("Activity logged:", { userId, ...activity });
  }
}

export const campaignService = new CampaignService();
