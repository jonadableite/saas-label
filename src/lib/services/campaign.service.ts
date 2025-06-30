// src/lib/services/campaign.service.ts
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import {
  Campaign,
  campaignContactsTables,
  campaignsTables,
  CampaignStatus,
  contactGroupMembersTables,
  CreateCampaignInput,
  CreateCampaignSchema,
  instancesTables,
  templatesTables,
  UpdateCampaignInput,
} from "@/db/schema";
import { rabbitmq, redis } from "@/lib/queue/config"; // Importar rabbitmq

export class CampaignService {
  // Método para logar atividades - agora publica na fila
  private async logActivity(
    userId: string,
    activity: {
      type: string; // Usar activityTypeEnum.Enum
      status: string; // Usar activityStatusEnum.Enum
      title: string;
      description: string;
      campaignId?: string;
      instanceId?: string;
      contactId?: string;
      templateId?: string;
      groupId?: string;
      messageId?: string;
      metadata?: any;
    },
  ): Promise<void> {
    // Publica a atividade na fila para ser processada pelo ActivityWorker
    try {
      await rabbitmq.publishMessage("activities", "activities.log", {
        userId,
        ...activity,
        createdAt: new Date(), // Adiciona timestamp para o worker
      });
      console.log("Activity enqueued:", activity.type);
    } catch (error) {
      console.error("Failed to enqueue activity:", error); // Fallback: log directly if queueing fails
      // TODO: Implementar fallback para salvar no DB se a fila falhar
      // await db.insert(...).values(...)
    }
  }

  async createCampaign(
    userId: string,
    data: CreateCampaignInput,
  ): Promise<Campaign> {
    try {
      // Valida os dados de entrada usando o schema Zod
      // Assumimos que CreateCampaignSchema inclui validação para targetGroups e targetContactIds
      const validatedData = CreateCampaignSchema.parse(data); // Verifica se um template foi fornecido e se ele existe para o usuário

      if (validatedData.templateId) {
        const template = await db.query.templatesTables.findFirst({
          where: and(
            eq(templatesTables.id, validatedData.templateId),
            eq(templatesTables.userId, userId),
          ),
        });
        if (!template) {
          throw new Error("Template não encontrado");
        } // TODO: Validar se as requiredVariables do template estão disponíveis (globalmente na campanha ou por contato)
      } else {
        // Se não tem template, a campanha não tem conteúdo para enviar
        throw new Error("Template é obrigatório para criar uma campanha");
      } // Coletar IDs de contatos únicos de grupos alvo e contatos individuais

      const allContactIds = new Set<string>(); // Adicionar contatos diretos (se fornecidos)

      const targetContactIds = validatedData.targetContactIds; // Usar diretamente do validatedData
      if (targetContactIds?.length) {
        targetContactIds.forEach((id: string) => allContactIds.add(id));
      } // Adicionar contatos dos grupos alvo (se fornecidos)

      if (validatedData.targetGroups?.length) {
        const groupContacts = await db.query.contactGroupMembersTables.findMany(
          {
            where: inArray(
              contactGroupMembersTables.groupId,
              validatedData.targetGroups,
            ),
            columns: {
              contactId: true,
            },
          },
        );
        groupContacts.forEach((member) => allContactIds.add(member.contactId));
      } // Excluir contatos de grupos de exclusão (se fornecidos)

      if (validatedData.excludeGroups?.length) {
        const excludeContacts =
          await db.query.contactGroupMembersTables.findMany({
            where: inArray(
              contactGroupMembersTables.groupId,
              validatedData.excludeGroups,
            ),
            columns: {
              contactId: true,
            },
          });
        excludeContacts.forEach((member) =>
          allContactIds.delete(member.contactId),
        );
      }

      const finalContactIds = Array.from(allContactIds);
      console.log(
        `Calculated finalContactIds count: ${finalContactIds.length}`,
      ); // Log para verificar a contagem
      // Determinar status inicial

      const campaignStatus: CampaignStatus =
        validatedData.enableScheduling && validatedData.scheduleAt
          ? "scheduled"
          : "draft"; // Começa como draft, startCampaign vai mudar para running
      // Criar a campanha no banco de dados

      console.log("Criando campanha no banco...");
      const [campaign] = await db
        .insert(campaignsTables)
        .values({
          userId,
          instanceId: validatedData.instanceId || null,
          name: validatedData.name,
          description: validatedData.description || null,
          templateId: validatedData.templateId || null,
          status: campaignStatus,
          scheduleAt: validatedData.scheduleAt || null,
          sendDelay: validatedData.sendDelay,
          maxRetriesPerMessage: validatedData.maxRetriesPerMessage,
          sendOnlyBusinessHours: validatedData.sendOnlyBusinessHours,
          businessHoursStart: validatedData.businessHoursStart,
          businessHoursEnd: validatedData.businessHoursEnd,
          targetGroups: validatedData.targetGroups || [], // <-- SALVANDO OS IDs DOS GRUPOS AQUI
          targetContacts: validatedData.targetContactIds || [], // <-- SALVANDO OS IDs DOS CONTATOS INDIVIDUAIS AQUI
          totalContacts: finalContactIds.length, // <-- SALVANDO O TOTAL CALCULADO AQUI
          messagesSent: 0,
          messagesDelivered: 0,
          messagesRead: 0,
          messagesFailed: 0,
          messagesQueued: 0, // Inicializa contadores
        })
        .returning();

      console.log("Campanha criada:", campaign.id); // Adicionar contatos à campanha na tabela campaignContactsTables
      // Esta tabela é a fonte primária de dados para o worker de execução

      if (finalContactIds.length > 0) {
        console.log(
          "Adicionando contatos à campanha na tabela campaignContactsTables...",
        );
        const campaignContactsToInsert = finalContactIds.map((contactId) => ({
          campaignId: campaign.id,
          contactId: contactId,
          status: "pending" as const, // Status inicial é pending
          attempts: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        })); // Inserção em lotes para performance

        const batchSize = 1000;
        for (let i = 0; i < campaignContactsToInsert.length; i += batchSize) {
          const batch = campaignContactsToInsert.slice(i, i + batchSize);
          await db
            .insert(campaignContactsTables)
            .values(batch)
            .onConflictDoNothing(); // Evita duplicatas se houver retries
        }

        console.log(
          `${finalContactIds.length} contatos adicionados à tabela campaignContactsTables`,
        );
      } else {
        console.warn(
          "Nenhum contato encontrado para esta campanha após aplicar filtros.",
        );
      } // Log da atividade de criação

      await this.logActivity(userId, {
        type: "campaign_created",
        status: "success",
        title: "Nova campanha criada",
        description: `Campanha '${campaign.name}' foi criada com ${finalContactIds.length} contatos`,
        campaignId: campaign.id,
      }); // Lógica de início/agendamento

      if (campaign.status === "scheduled") {
        console.log("Campanha agendada para:", campaign.scheduleAt); // O agendador (worker separado) será responsável por chamar startCampaign no horário correto
      } else {
        // Status é "draft", iniciar imediatamente
        console.log("Iniciando campanha imediatamente..."); // startCampaign agora enfilera a execução para o worker 'campaign.execute'
        await this.startCampaign(userId, campaign.id);
      }

      console.log("Processo de criação da campanha concluído:", campaign.id);
      return campaign;
    } catch (error) {
      console.error("Erro ao criar campanha:", error);

      if (error instanceof z.ZodError) {
        throw new Error(
          `Dados inválidos: ${error.errors.map((e) => e.message).join(", ")}`,
        );
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
        template: true, // Buscar template completo
        campaignContacts: {
          with: {
            contact: true,
          },
          limit: 10, // Limitar para visualização na listagem ou detalhe
          orderBy: asc(campaignContactsTables.createdAt),
        },
      },
    });

    return campaign || null;
  } // Método para iniciar a campanha - AGORA ENFILERA A EXECUÇÃO

  async startCampaign(userId: string, campaignId: string): Promise<void> {
    try {
      console.log(
        `Attempting to start campaign: ${campaignId} for user ${userId}`,
      );

      const campaign = await this.getCampaignById(userId, campaignId);
      if (!campaign) {
        console.error(`Campaign ${campaignId} not found for user ${userId}`);
        throw new Error("Campanha não encontrada");
      } // Permitir iniciar/retomar de rascunho, agendada ou pausada

      if (!["draft", "scheduled", "paused"].includes(campaign.status)) {
        console.warn(
          `Attempted to start campaign ${campaignId} with status ${campaign.status}. Skipping.`,
        );
        return; // Não lança erro, apenas ignora se o status não permite início
      } // Verificar se a instância está configurada e conectada

      if (!campaign.instanceId) {
        const errorMessage = `Instância não configurada para a campanha ${campaignId}`;
        console.error(errorMessage); // Atualizar status da campanha para falhou
        await db
          .update(campaignsTables)
          .set({
            status: "failed",
            updatedAt: new Date(),
          })
          .where(eq(campaignsTables.id, campaignId)); // Log da atividade de falha
        await this.logActivity(userId, {
          type: "campaign_failed",
          status: "error",
          title: "Campanha falhou ao iniciar",
          description: `${errorMessage}. Campanha '${campaign.name}' marcada como falha.`,
          campaignId: campaign.id,
        });
        throw new Error(errorMessage);
      }

      const instance = await db.query.instancesTables.findFirst({
        where: eq(instancesTables.instanceId, campaign.instanceId),
      }); // A instância precisa estar 'open' para enviar mensagens

      if (!instance || instance.status !== "open") {
        const errorMessage = `Instância ${campaign.instanceId} não está conectada (status: ${instance?.status || "disconnected"})`;
        console.error(errorMessage); // Atualizar status da campanha para pausada com motivo
        await db
          .update(campaignsTables)
          .set({
            status: "paused", // Pausa a campanha se a instância não estiver pronta
            pausedAt: new Date(), // Se houver uma coluna para motivo da pausa, salve a mensagem aqui
            updatedAt: new Date(),
          })
          .where(eq(campaignsTables.id, campaignId));

        await this.logActivity(userId, {
          type: "campaign_paused", // Log como pausada devido a erro na instância
          status: "warning",
          title: "Campanha pausada (Instância desconectada)",
          description: `Campanha '${campaign.name}' pausada porque a instância ${campaign.instanceId} não está conectada.`,
          campaignId: campaign.id,
          instanceId: campaign.instanceId,
        });

        throw new Error(errorMessage); // Lança o erro para o chamador
      } // Atualizar status da campanha para running

      await db
        .update(campaignsTables)
        .set({
          status: "running",
          startedAt: campaign.startedAt || new Date(), // Define startedAt apenas na primeira vez que vai para running
          pausedAt: null, // Limpa pausedAt se estiver retomando
          // Limpa cancelledAt se estiver retomando de um estado que permitia cancelamento
          cancelledAt: null,
          updatedAt: new Date(),
        })
        .where(eq(campaignsTables.id, campaignId));

      await this.logActivity(userId, {
        type: "campaign_started",
        status: "success",
        title: `Campanha ${campaign.status === "paused" ? "retomada" : "iniciada"}`,
        description: `Campanha '${campaign.name}' foi ${campaign.status === "paused" ? "retomada" : "iniciada"}.`,
        campaignId: campaign.id,
        instanceId: campaign.instanceId,
      });

      console.log("Campanha status updated to running:", campaignId); // *** IMPORTANTE: Enfileirar a execução da campanha para o worker ***
      // O worker 'executeCampaign' buscará os contatos com status 'pending' ou 'retrying'

      await rabbitmq.publishMessage("campaigns", "campaign.execute", {
        campaignId: campaign.id,
        userId: campaign.userId,
      });

      console.log(
        `Campaign execution message enqueued for campaign ${campaignId}.`,
      );
    } catch (error) {
      console.error(`Erro ao iniciar campanha ${campaignId}:`, error); // Se o erro ocorreu ANTES de mudar o status para running, o status original permanece.
      // Se ocorreu DEPOIS, o status já foi atualizado para running.
      // Podemos adicionar lógica para marcar como falha aqui se necessário,
      // mas re-lançar o erro para o chamador lidar é uma abordagem comum.
      throw error;
    }
  } // Método para agendar a campanha - AGORA APENAS ATUALIZA O STATUS NO DB

  async scheduleCampaign(campaignId: string): Promise<void> {
    try {
      const campaign = await db.query.campaignsTables.findFirst({
        where: eq(campaignsTables.id, campaignId),
      });

      if (!campaign || !campaign.scheduleAt) {
        throw new Error("Campanha ou agendamento não encontrado");
      } // Atualizar status da campanha para 'scheduled'

      await db
        .update(campaignsTables)
        .set({
          status: "scheduled",
          updatedAt: new Date(),
        })
        .where(eq(campaignsTables.id, campaignId));

      console.log(
        `Campanha ${campaignId} marcada como agendada para ${campaign.scheduleAt}`,
      ); // O agendador (worker separado) irá iniciar esta campanha no horário correto chamando startCampaign.
    } catch (error) {
      console.error(`Erro ao agendar campanha ${campaignId}:`, error);
      throw error;
    }
  } // Método para pausar a campanha

  async pauseCampaign(userId: string, campaignId: string): Promise<void> {
    try {
      const [campaign] = await db
        .update(campaignsTables)
        .set({
          status: "paused",
          pausedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(campaignsTables.id, campaignId),
            eq(campaignsTables.userId, userId),
            eq(campaignsTables.status, "running"), // Só pausa se estiver rodando
          ),
        )
        .returning();

      if (!campaign) {
        // Campanha não encontrada ou não estava no status 'running'
        console.warn(
          `Attempted to pause campaign ${campaignId} but it was not found or not running.`,
        );
        throw new Error("Campanha não encontrada ou não está em execução");
      } // O worker verifica o status 'paused' via Redis ou DB antes de processar
      // Sinalizar no Redis para o worker parar imediatamente (opcional, dependendo da implementação do worker)

      await redis.set(
        `campaign:paused:${campaignId}`,
        "true",
        "EX",
        60 * 60 * 24,
      ); // Expira em 24h

      await this.logActivity(userId, {
        type: "campaign_paused",
        status: "info",
        title: "Campanha pausada",
        description: `Campanha '${campaign.name}' foi pausada.`,
        campaignId: campaign.id ?? undefined,
        instanceId: campaign.instanceId ?? undefined,
      });

      console.log("Campanha pausada:", campaignId);
    } catch (error) {
      console.error(`Erro ao pausar campanha ${campaignId}:`, error);
      throw error;
    }
  } // Método para retomar a campanha

  async resumeCampaign(userId: string, campaignId: string): Promise<void> {
    try {
      const campaign = await db.query.campaignsTables.findFirst({
        where: and(
          eq(campaignsTables.id, campaignId),
          eq(campaignsTables.userId, userId),
          eq(campaignsTables.status, "paused"), // Só retoma se estiver pausada
        ),
      });

      if (!campaign) {
        console.warn(
          `Attempted to resume campaign ${campaignId} but it was not found or not paused.`,
        );
        throw new Error("Campanha não encontrada ou não está pausada");
      } // Limpa a flag de pausa no Redis (opcional, dependendo da implementação do worker)

      await redis.del(`campaign:paused:${campaignId}`); // Chama startCampaign, que vai mudar o status para running e enfileirar a execução

      await this.startCampaign(userId, campaign.id); // Log da atividade é feito dentro de startCampaign

      console.log("Campanha retomada:", campaignId);
    } catch (error) {
      console.error(`Erro ao retomar campanha ${campaignId}:`, error);
      throw error;
    }
  }

  async updateCampaign(
    userId: string,
    campaignId: string,
    data: UpdateCampaignInput,
  ): Promise<Campaign> {
    try {
      // TODO: Adicionar validação usando UpdateCampaignSchema.parse(data) se o schema existir
      const validatedData = data;

      const [campaign] = await db
        .update(campaignsTables)
        .set({
          ...validatedData,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(campaignsTables.id, campaignId),
            eq(campaignsTables.userId, userId),
          ),
        )
        .returning();

      if (!campaign) {
        throw new Error("Campanha não encontrada");
      } // TODO: Adicionar lógica para re-agendar se scheduleAt for atualizado
      // TODO: Adicionar lógica para pausar/cancelar se o status for atualizado (e.g., se mudar para 'cancelled' ou 'paused')

      return campaign;
    } catch (error) {
      console.error("Erro ao atualizar campanha:", error);

      if (error instanceof z.ZodError) {
        throw new Error(
          `Dados inválidos: ${error.errors.map((e) => e.message).join(", ")}`,
        );
      }

      throw error;
    }
  }

  async deleteCampaign(
    userId: string,
    campaignId: string,
  ): Promise<{ success: boolean }> {
    try {
      // Implementando soft delete e marcando como cancelada
      const [campaign] = await db
        .update(campaignsTables)
        .set({
          status: "cancelled", // Mudar status para cancelada
          cancelledAt: new Date(),
          deletedAt: new Date(), // Soft delete
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(campaignsTables.id, campaignId),
            eq(campaignsTables.userId, userId),
          ),
        )
        .returning();

      if (!campaign) {
        throw new Error("Campanha não encontrada");
      } // Opcional: Sinalizar no Redis para o worker parar imediatamente (usar a mesma flag de pausa)

      await redis.set(
        `campaign:paused:${campaignId}`,
        "true",
        "EX",
        60 * 60 * 24,
      ); // O worker também deve verificar o status 'cancelled' no DB
      await this.logActivity(userId, {
        type: "campaign_cancelled",
        status: "info",
        title: "Campanha cancelada",
        description: `Campanha '${campaign.name}' foi cancelada.`,
        campaignId: campaign.id,
      });

      return { success: true };
    } catch (error) {
      console.error("Erro ao deletar/cancelar campanha:", error);
      throw error;
    }
  } // TODO: Adicionar método para obter contatos de uma campanha específica
  // async getCampaignContacts(campaignId: string, filters: { status?: MessageStatus, limit?: number, offset?: number }) { ... }
}

export const campaignService = new CampaignService();
