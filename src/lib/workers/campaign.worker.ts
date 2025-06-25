// src/lib/workers/campaign.worker.ts
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  campaignContactsTables,
  campaignsTables,
  instancesTables,
} from "@/db/schema";
import { rabbitmq, redis } from "@/lib/queue/config";
import { campaignService } from "@/lib/services/campaign.service";

export class CampaignWorker {
  async start(): Promise<void> {
    console.log("🚀 Starting Campaign Worker...");

    // Consumir fila de execução de campanhas
    await rabbitmq.consumeQueue(
      "campaign.execute",
      this.executeCampaign.bind(this),
      {
        concurrency: 3,
      },
    );

    // Consumir fila de agendamento
    await rabbitmq.consumeQueue(
      "campaign.schedule",
      this.handleScheduledCampaign.bind(this),
      {
        concurrency: 5,
      },
    );

    // Consumir fila de atualização de status
    await rabbitmq.consumeQueue(
      "campaign.status.update",
      this.updateCampaignStatus.bind(this),
      {
        concurrency: 10,
      },
    );

    console.log("✅ Campaign Worker started successfully");
  }

  private async executeCampaign(data: {
    campaignId: string;
    userId: string;
    resumed?: boolean;
  }): Promise<void> {
    const { campaignId, userId, resumed = false } = data;

    try {
      console.log(`Executing campaign ${campaignId}...`);

      // Verificar se a campanha foi pausada
      const isPaused = await redis.get(`campaign:paused:${campaignId}`);
      if (isPaused) {
        console.log(`Campaign ${campaignId} is paused, skipping execution`);
        return;
      }

      // Buscar dados da campanha
      const campaign = await db.query.campaignsTables.findFirst({
        where: eq(campaignsTables.id, campaignId),
        with: {
          instance: true,
          template: true,
          campaignContacts: {
            where: resumed
              ? eq(campaignContactsTables.status, "pending")
              : and(
                  eq(campaignContactsTables.status, "pending"),
                  eq(campaignContactsTables.attempts, 0),
                ),
            with: {
              contact: true,
            },
            limit: 1000, // Processar em lotes
          },
        },
      });

      if (!campaign) {
        throw new Error("Campaign not found");
      }

      if (!campaign.instance || campaign.instance.status !== "open") {
        throw new Error("Instance not connected");
      }

      // Processar contatos em lotes
      for (const campaignContact of campaign.campaignContacts) {
        // Verificar se ainda não está pausada
        const stillPaused = await redis.get(`campaign:paused:${campaignId}`);
        if (stillPaused) {
          console.log(`Campaign ${campaignId} was paused during execution`);
          break;
        }

        // Enviar mensagem
        await this.sendMessage(campaign, campaignContact);

        // Delay entre mensagens
        if (campaign.sendDelay > 0) {
          await new Promise((resolve) =>
            setTimeout(resolve, campaign.sendDelay),
          );
        }
      }

      // Verificar se há mais contatos para processar
      const remainingContacts = await db
        .select({ count: 1 })
        .from(campaignContactsTables)
        .where(
          and(
            eq(campaignContactsTables.campaignId, campaignId),
            eq(campaignContactsTables.status, "pending"),
          ),
        )
        .limit(1);

      if (remainingContacts.length > 0) {
        // Há mais contatos, continuar processamento
        await rabbitmq.publishMessage("campaigns", "campaign.execute", {
          campaignId,
          userId,
          resumed: true,
        });
      } else {
        // Campanha concluída
        await db
          .update(campaignsTables)
          .set({
            status: "completed",
            completedAt: new Date(),
          })
          .where(eq(campaignsTables.id, campaignId));

        // Log da atividade
        await rabbitmq.publishMessage("campaigns", "activities.log", {
          userId,
          type: "campaign_completed",
          status: "success",
          title: "Campanha concluída",
          description: `Campanha '${campaign.name}' foi concluída`,
          campaignId,
        });
      }
    } catch (error) {
      console.error(`Error executing campaign ${campaignId}:`, error);

      // Marcar campanha como falhada
      await db
        .update(campaignsTables)
        .set({
          status: "failed",
          updatedAt: new Date(),
        })
        .where(eq(campaignsTables.id, campaignId));

      // Log do erro
      await rabbitmq.publishMessage("campaigns", "activities.log", {
        userId,
        type: "campaign_completed",
        status: "error",
        title: "Campanha falhou",
        description: `Erro na execução da campanha: ${error}`,
        campaignId,
      });
    }
  }

  private async sendMessage(
    campaign: any,
    campaignContact: any,
  ): Promise<void> {
    try {
      // Preparar conteúdo da mensagem
      let content = campaign.template?.content || "Mensagem sem template";

      // Substituir variáveis se houver
      if (campaignContact.variables) {
        Object.entries(campaignContact.variables).forEach(([key, value]) => {
          content = content.replace(
            new RegExp(`{{${key}}}`, "g"),
            String(value),
          );
        });
      }

      // Substituir variáveis padrão
      content = content.replace(/{{nome}}/g, campaignContact.contact.name);
      content = content.replace(
        /{{telefone}}/g,
        campaignContact.contact.phoneNumber,
      );

      // Enviar via Evolution API
      const response = await fetch(
        `${process.env.EVOLUTION_API_URL}/message/sendText/${campaign.instanceId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.EVOLUTION_API_KEY}`,
          },
          body: JSON.stringify({
            number: campaignContact.contact.phoneNumber,
            text: content,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();

      // Atualizar status do contato
      await db
        .update(campaignContactsTables)
        .set({
          status: "sent",
          sentAt: new Date(),
          attempts: campaignContactsTables.attempts + 1,
          personalizedContent: content,
        })
        .where(eq(campaignContactsTables.id, campaignContact.id));

      // Atualizar contadores da campanha
      await db
        .update(campaignsTables)
        .set({
          messagesSent: campaignsTables.messagesSent + 1,
        })
        .where(eq(campaignsTables.id, campaign.id));

      // Atualizar estatísticas da instância
      await db
        .update(instancesTables)
        .set({
          totalMessagesSent: instancesTables.totalMessagesSent + 1,
          dailyMessagesSent: instancesTables.dailyMessagesSent + 1,
          lastMessageSentAt: new Date(),
        })
        .where(eq(instancesTables.instanceId, campaign.instanceId));
    } catch (error) {
      console.error(
        `Error sending message to ${campaignContact.contact.phoneNumber}:`,
        error,
      );

      // Atualizar tentativas
      const newAttempts = (campaignContact.attempts || 0) + 1;
      const shouldRetry = newAttempts < campaign.maxRetriesPerMessage;

      await db
        .update(campaignContactsTables)
        .set({
          status: shouldRetry ? "pending" : "failed",
          attempts: newAttempts,
          errorMessage: String(error),
          failedAt: shouldRetry ? undefined : new Date(),
        })
        .where(eq(campaignContactsTables.id, campaignContact.id));

      if (!shouldRetry) {
        // Atualizar contador de falhas
        await db
          .update(campaignsTables)
          .set({
            messagesFailed: campaignsTables.messagesFailed + 1,
          })
          .where(eq(campaignsTables.id, campaign.id));
      }
    }
  }

  private async handleScheduledCampaign(data: {
    campaignId: string;
    userId: string;
    executeAt: string;
  }): Promise<void> {
    const { campaignId, userId } = data;

    try {
      await campaignService.startCampaign(userId, campaignId);
    } catch (error) {
      console.error(`Error starting scheduled campaign ${campaignId}:`, error);
    }
  }

  private async updateCampaignStatus(data: {
    campaignId: string;
    status: any;
    metadata?: any;
  }): Promise<void> {
    // Implementar lógica de atualização de status
    // Por exemplo, quando receber webhooks de delivery/read
  }
}

export const campaignWorker = new CampaignWorker();
