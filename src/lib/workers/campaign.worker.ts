// src/lib/workers/campaign.worker.ts
import { and, asc, eq, lte, or, sql } from "drizzle-orm";
import fetch from 'node-fetch'; // Usar node-fetch para chamadas HTTP no worker

import { db } from "@/db";
import {
  Campaign, // Importar tipos
  CampaignContact, // Importar tipos
  campaignContactsTables,
  campaignsTables,
  instancesTables,
  Template, // Importar tipos
  templatesTables, // Importar templatesTables
} from "@/db/schema";
import { MessageStatus } from "@/db/schema"; // Importar MessageStatus enum type
import { rabbitmq, redis } from "@/lib/queue/config";
import { campaignService } from "@/lib/services/campaign.service"; // Importar campaignService

// Definir tipos para os dados das filas
interface ExecuteCampaignPayload {
  campaignId: string;
  userId: string;
}

interface UpdateStatusPayload {
  campaignContactId?: string; // ID do nosso registro campaign_contacts
  messageId?: string; // ID da mensagem na API Evolution
  newStatus: MessageStatus; // Status final (delivered, read, failed)
  webhookPayload?: any; // Payload completo do webhook
  error?: string; // Mensagem de erro, se aplicável
}

interface LogActivityPayload {
  userId: string;
  type: string; // Usar activityTypeEnum.Enum
  status: string; // Usar activityStatusEnum.Enum
  title: string;
  description: string;
  campaignId?: string;
  instanceId?: string;
  contactId?: string;
  templateId?: string;
  groupId?: string;
  messageId?: string; // ID do nosso registro campaign_contacts
  metadata?: any;
  createdAt: Date;
}

export class CampaignWorker {
  async start(): Promise<void> {
    console.log("🚀 Starting Campaign Worker..."); // Inicializar filas (já feito em index.ts, mas pode garantir aqui tbm)
    // await initializeQueues();
    // Consumir fila de execução de campanhas

    await rabbitmq.consumeQueue(
      "campaign.execute",
      (data: ExecuteCampaignPayload) => this.executeCampaign(data), // Usar arrow function para manter o 'this'
      {
        concurrency: 3, // Processar 3 campanhas simultaneamente
        prefetch: 1, // Buscar 1 mensagem por vez para este consumidor
      },
    ); // Remover consumidor de campaign.schedule, a lógica agora está no agendador interno
    // await rabbitmq.consumeQueue("campaign.schedule", this.handleScheduledCampaign.bind(this), { concurrency: 5 });
    // Consumir fila de atualização de status (via webhooks)

    await rabbitmq.consumeQueue(
      "campaign.status.update",
      (data: UpdateStatusPayload) => this.updateCampaignStatus(data),
      {
        concurrency: 10, // Pode ter mais concorrência para atualizações rápidas
      },
    ); // Consumir fila de log de atividades

    await rabbitmq.consumeQueue(
      "activities.log",
      (data: LogActivityPayload) => this.logActivity(data),
      {
        concurrency: 5,
      },
    ); // Iniciar o agendador interno para campanhas agendadas

    this.startScheduler();

    console.log("✅ Campaign Worker and Scheduler started successfully");
  } // Agendador interno para iniciar campanhas agendadas

  private startScheduler(): void {
    // Verifica campanhas agendadas a cada 30 segundos
    setInterval(async () => {
      try {
        // console.log("Running scheduled campaign check..."); // Evitar log excessivo

        // Buscar campanhas agendadas cuja hora já chegou ou passou
        const scheduledCampaigns = await db.query.campaignsTables.findMany({
          where: and(
            eq(campaignsTables.status, "scheduled"),
            lte(campaignsTables.scheduleAt, new Date()),
          ),
          limit: 10, // Processar um lote por vez para não sobrecarregar
        });

        for (const campaign of scheduledCampaigns) {
          console.log(
            `Found scheduled campaign ${campaign.id} ready to start.`,
          );
          try {
            // Chamar o service para iniciar a campanha (isso vai atualizar status e enfileirar)
            await campaignService.startCampaign(campaign.userId, campaign.id);
          } catch (startError) {
            console.error(
              `Error starting scheduled campaign ${campaign.id}:`,
              startError,
            ); // O service já loga a falha ao iniciar
            // Opcional: Marcar campanha como failed no DB se o startCampaign falhar
          }
        }
      } catch (error) {
        console.error("Error in scheduled campaign check:", error);
      }
    }, 30 * 1000); // Executa a cada 30 segundos
  } // Consumidor da fila campaign.execute

  private async executeCampaign(data: ExecuteCampaignPayload): Promise<void> {
    const { campaignId, userId } = data;
    console.log(`Executing campaign ${campaignId}...`);

    try {
      // Verificar status atual da campanha no DB
      const campaign = await db.query.campaignsTables.findFirst({
        where: eq(campaignsTables.id, campaignId),
        with: {
          instance: true,
          template: true, // Buscar template completo
        },
      });

      if (!campaign) {
        console.warn(`Campaign ${campaignId} not found during execution.`);
        return; // Campanha não existe mais
      } // Verificar se a campanha deve continuar rodando

      if (campaign.status !== "running") {
        console.log(
          `Campaign ${campaignId} is not in 'running' status (${campaign.status}), skipping execution batch.`,
        ); // Se o status mudou (pausada, cancelada, concluída, falhou), parar o processamento
        // O worker verifica o status no início de cada lote.
        return;
      } // Verificar se a instância ainda está conectada

      if (!campaign.instance || campaign.instance.status !== "open") {
        console.warn(
          `Instance ${campaign.instanceId} for campaign ${campaignId} is not connected (${campaign.instance?.status || "disconnected"}). Pausing campaign.`,
        ); // Pausar a campanha via service (que também loga)
        await campaignService.pauseCampaign(userId, campaignId);
        return; // Parar processamento deste lote
      } // Buscar contatos PENDENTES ou PRONTOS PARA RETRY em lotes

      const campaignContacts = await db.query.campaignContactsTables.findMany({
        where: and(
          eq(campaignContactsTables.campaignId, campaignId),
          or(
            eq(campaignContactsTables.status, "pending"), // Incluir contatos falhados que ainda têm tentativas e já passou o nextAttemptAt
            and(
              eq(campaignContactsTables.status, "failed"), // Ou 'retrying' se usar esse status
              lte(campaignContactsTables.nextAttemptAt, new Date()),
              sql`${campaignContactsTables.attempts} < ${campaign.maxRetriesPerMessage}`, // Garantir que não excedeu o max
            ),
          ),
        ),
        with: {
          contact: true, // Buscar dados do contato
        },
        limit: 500, // Tamanho do lote (ajustar conforme necessidade e limites da API)
        orderBy: asc(
          campaignContactsTables.nextAttemptAt ||
            campaignContactsTables.createdAt,
        ), // Prioriza retries agendados
      });

      if (campaignContacts.length === 0) {
        console.log(
          `No more pending or retrying contacts for campaign ${campaignId}. Checking for completion.`,
        ); // Não há mais contatos neste lote. Verificar se a campanha terminou.
        const remainingContacts = await db
          .select({ count: sql<number>`count(*)` })
          .from(campaignContactsTables)
          .where(
            and(
              eq(campaignContactsTables.campaignId, campaignId),
              or(
                eq(campaignContactsTables.status, "pending"),
                and(
                  eq(campaignContactsTables.status, "failed"), // Ou 'retrying'
                  sql`${campaignContactsTables.attempts} < ${campaign.maxRetriesPerMessage}`,
                ),
              ),
            ),
          )
          .then((res) => res[0]?.count || 0);

        if (remainingContacts === 0) {
          // Campanha concluída
          console.log(`Campaign ${campaignId} completed.`);
          await db
            .update(campaignsTables)
            .set({
              status: "completed",
              completedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(campaignsTables.id, campaignId)); // Log da atividade

          await rabbitmq.publishMessage("activities", "activities.log", {
            userId,
            type: "campaign_completed",
            status: "success",
            title: "Campanha concluída",
            description: `Campanha '${campaign.name}' foi concluída.`,
            campaignId,
            createdAt: new Date(),
          });
        } else {
          console.log(
            `Campaign ${campaignId}: ${remainingContacts} contacts remaining. Enqueuing next batch check.`,
          ); // Ainda há contatos pendentes/retrying, enfileirar para verificar o próximo lote
          await rabbitmq.publishMessage("campaigns", "campaign.execute", {
            campaignId,
            userId,
          });
        }

        return; // Termina o processamento deste lote
      } // Processar contatos no lote

      console.log(
        `Processing batch of ${campaignContacts.length} contacts for campaign ${campaignId}`,
      );
      for (const campaignContact of campaignContacts) {
        // Verificar se a campanha foi pausada ou cancelada durante o processamento do lote
        const currentCampaignStatus = await db.query.campaignsTables.findFirst({
          where: eq(campaignsTables.id, campaignId),
          columns: { status: true },
        });
        if (
          !currentCampaignStatus ||
          !["running"].includes(currentCampaignStatus.status)
        ) {
          console.log(
            `Campaign ${campaignId} status changed to ${currentCampaignStatus?.status || "unknown"}, stopping batch processing.`,
          ); // Se o status não é mais 'running', parar de processar o lote atual
          break;
        } // Enviar mensagem

        await this.sendMessage(campaign, campaignContact, campaign.template); // Delay entre mensagens

        if (campaign.sendDelay > 0) {
          await new Promise((resolve) =>
            setTimeout(resolve, campaign.sendDelay),
          );
        }
      } // Após processar o lote, enfileirar para verificar se há mais contatos
      // Isso garante que o worker continue processando os próximos lotes até que todos sejam enviados

      const remainingContactsAfterBatch = await db
        .select({ count: sql<number>`count(*)` })
        .from(campaignContactsTables)
        .where(
          and(
            eq(campaignContactsTables.campaignId, campaignId),
            or(
              eq(campaignContactsTables.status, "pending"),
              and(
                eq(campaignContactsTables.status, "failed"), // Ou 'retrying'
                lte(campaignContactsTables.nextAttemptAt, new Date()),
                sql`${campaignContactsTables.attempts} < ${campaign.maxRetriesPerMessage}`,
              ),
            ),
          ),
        )
        .then((res) => res[0]?.count || 0);

      if (remainingContactsAfterBatch > 0) {
        console.log(
          `Campaign ${campaignId}: ${remainingContactsAfterBatch} contacts still pending/retrying. Enqueuing next batch.`,
        );
        await rabbitmq.publishMessage("campaigns", "campaign.execute", {
          campaignId,
          userId,
        });
      } else {
        // Se não há mais contatos pendentes após este lote, a campanha pode ter terminado
        // A verificação de conclusão é feita no início do próximo processamento,
        // mas para garantir, podemos fazer uma verificação final aqui ou confiar no próximo ciclo.
        console.log(
          `Campaign ${campaignId}: Batch processed. No immediate pending contacts found. Next check will confirm completion.`,
        );
      }
    } catch (error) {
      console.error(
        `Error during campaign execution for ${campaignId}:`,
        error,
      ); // Se um erro crítico ocorrer durante a execução do lote (ex: DB offline, RabbitMQ offline)
      // A campanha pode falhar, mas é melhor que o erro seja tratado por um supervisor do worker.
      // Erros individuais de envio são tratados em sendMessage.
    }
  } // Método para enviar a mensagem para a API da Evolution

  private async sendMessage(
    campaign: Campaign & { instance: any; template: Template | null }, // Tipagem mais específica
    campaignContact: CampaignContact & { contact: any }, // Tipagem mais específica
    template: Template, // Template já buscado
  ): Promise<void> {
    if (!template) {
      console.error(
        `No template found for campaign contact ${campaignContact.id}`,
      ); // Marcar como falha se não houver template
      await db
        .update(campaignContactsTables)
        .set({
          status: "failed",
          errorMessage: "Template not found for campaign contact",
          failedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(campaignContactsTables.id, campaignContact.id)); // Atualizar contador de falhas da campanha

      await db
        .update(campaignsTables)
        .set({
          messagesFailed: sql`${campaignsTables.messagesFailed} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(campaignsTables.id, campaign.id));
      return;
    }

    try {
      const apiUrl = process.env.EVOLUTION_API_URL;
      const apiKey = process.env.EVOLUTION_API_KEY;
      const instanceId = campaign.instanceId;
      const recipientNumber = campaignContact.contact.phoneNumber;

      if (!apiUrl || !apiKey || !instanceId || !recipientNumber) {
        throw new Error(
          "Missing API URL, API Key, Instance ID, or Recipient Number",
        );
      }

      let endpoint = "";
      let requestBody: any = {
        number: recipientNumber, // Adicionar options padrão se necessário, como quoted, mentioned, etc.
        // delay: campaign.sendDelay, // O delay está sendo feito no loop do worker, não precisa na API
      }; // Personalizar conteúdo e corpo da requisição baseado no tipo do template

      switch (template.type) {
        case "text":
          endpoint = `/message/sendText/${instanceId}`;
          let textContent = template.content || "Mensagem sem conteúdo"; // Substituir variáveis padrão e personalizadas
          textContent = textContent.replace(
            /{{nome}}/g,
            campaignContact.contact.name ||
              campaignContact.contact.firstName ||
              "Cliente",
          );
          textContent = textContent.replace(
            /{{telefone}}/g,
      cons    campaignContact.contact.phoneNumber || "",
          );
          if (campaignContact.variables) {
            Object.entries(campaignContact.variables).forEach(
              ([key, value]) => {
                textContent = textContent.replace(
                  new RegExp(`{{${key}}}`, "g"),
                  String(value),
                );
              },
            );
          }
          requestBody.text = textContent;
          requestBody.linkPreview = false; // Opcional: controlar link preview
          campaignContact.personalizedContent = textContent; // Armazenar conteúdo enviado
          break;

        case "image":
        case "document":
        case "video":
        case "audio": // Assumindo que sendMedia serve para todos exceto narrated audio/sticker
          endpoint = `/message/sendMedia/${instanceId}`;
          if (!template.mediaUrl)
            throw new Error(
              `Media URL missing for template type ${template.type}`,
            );
          requestBody.mediaUrl = template.mediaUrl;
          requestBody.caption = template.content; // Usar content como legenda/descrição
          requestBody.fileName = template.fileName; // Nome do arquivo para documentos
          // TODO: Personalizar caption/fileName se necessário usando variables
          campaignContact.personalizedContent = template.content; // Armazenar legenda/descrição
          campaignContact.mediaUrl = template.mediaUrl; // Armazenar URL da mídia
          break;

        case "sticker":
          endpoint = `/message/sendSticker/${instanceId}`;
          if (!template.mediaUrl) throw new Error("Sticker URL missing");
          requestBody.sticker = template.mediaUrl; // URL ou base64 do sticker
          campaignContact.mediaUrl = template.mediaUrl; // Armazenar URL do sticker
          break;

        case "list":
          endpoint = `/message/sendList/${instanceId}`;
          if (!template.listSections || template.listSections.length === 0)
            throw new Error("List sections missing");
          if (!template.buttons || template.buttons.length === 0)
            throw new Error("List button missing");

          requestBody.title = template.name; // Usar nome do template como título da lista
          requestBody.description = template.content; // Usar content como descrição da lista
          requestBody.buttonText = template.buttons[0].displayText; // Texto do botão principal da lista
          requestBody.footerText = template.footerText;
          requestBody.sections = template.listSections; // TODO: Personalizar título, descrição, footer, seções usando variables

          campaignContact.personalizedContent = JSON.stringify({
            title: requestBody.title,
            description: requestBody.description,
            footer: requestBody.footerText,
            sections: requestBody.sections,
          });
          break;

        case "button":
          endpoint = `/message/sendButtons/${instanceId}`;
          if (!template.buttons || template.buttons.length === 0)
            throw new Error("Buttons missing");

          requestBody.title = template.name; // Usar nome do template como título do botão
          requestBody.description = template.content; // Usar content como descrição do botão
          requestBody.footer = template.footerText;
          requestBody.buttons = template.buttons; // TODO: Personalizar título, descrição, footer, botões usando variables

          campaignContact.personalizedContent = JSON.stringify({
            title: requestBody.title,
            description: requestBody.description,
            footer: requestBody.footer,
            buttons: requestBody.buttons,
          });
          break; // TODO: Implementar outros tipos (location, contact)

        default:
          throw new Error(`Unsupported template type: ${template.type}`);
      }

      if (!endpoint) {
        throw new Error(
          `No API endpoint configured for template type: ${template.type}`,
        );
      }

      console.log(
        `Sending message to ${recipientNumber} for campaign contact ${campaignContact.id} using ${template.type} template...`,
      ); // console.log("Request Body:", JSON.stringify(requestBody, null, 2)); // Log do body para debug
      // Fazer a chamada para a API da Evolution
      const response = await fetch(`${apiUrl}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      const responseBody = await response.json(); // Tentar parsear JSON mesmo em erro
      // console.log("API Response:", responseBody); // Log da resposta da API
      if (!response.ok) {
        // Capturar mensagem de erro da API se disponível no body
        const apiErrorMessage =
          responseBody?.message ||
          responseBody?.error ||
          JSON.stringify(responseBody);
        throw new Error(
          `API Error ${response.status} (${response.statusText}): ${apiErrorMessage}`,
        );
      } // Verificar se a API retornou sucesso e IDs
      // A estrutura de resposta pode variar, ajustar conforme a Evolution API

      const messageId =
        responseBody?.id || responseBody?.key?.id || responseBody?.messageId;
      const remoteJid = responseBody?.remoteJid || responseBody?.jid;

      if (!messageId) {
        console.warn(
          `API did not return a message ID for campaign contact ${campaignContact.id}. Response:`,
          responseBody,
        ); // Tratar como sucesso parcial ou falha? Depende da API.
        // Por enquanto, vamos seguir como sucesso mas logar o aviso.
      } // Atualizar status do campaignContact para 'sent'

      await db
        .update(campaignContactsTables)
        .set({
          status: "sent", // Mensagem enviada para a API
          sentAt: new Date(),
          attempts: (campaignContact.attempts || 0) + 1,
          personalizedContent: campaignContact.personalizedContent, // Salva o conteúdo final
          mediaUrl: campaignContact.mediaUrl, // Salva a URL da mídia se houver
          messageId: messageId || null, // Salvar ID retornado pela API
          remoteJid: remoteJid || null, // Salvar JID retornado pela API
          errorMessage: null, // Limpa erro anterior
          nextAttemptAt: null, // Limpa agendamento de retry
          updatedAt: new Date(),
        })
        .where(eq(campaignContactsTables.id, campaignContact.id));

      console.log(
        `Message sent successfully for campaign contact ${campaignContact.id}. API Message ID: ${messageId}`,
      ); // Atualizar contadores da campanha (atomicamente)

      await db
        .update(campaignsTables)
        .set({
          messagesSent: sql`${campaignsTables.messagesSent} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(campaignsTables.id, campaign.id)); // Atualizar estatísticas da instância (atomicamente)

      await db
        .update(instancesTables)
        .set({
          totalMessagesSent: sql`${instancesTables.totalMessagesSent} + 1`,
          dailyMessagesSent: sql`${instancesTables.dailyMessagesSent} + 1`,
          lastMessageSentAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(instancesTables.instanceId, campaign.instanceId)); // Log da atividade de envio (opcionalmente, pode ser feito no webhook de delivery)
      // await rabbitmq.publishMessage("activities", "activities.log", { ... message_sent ... });
    } catch (error) {
      console.error(
        `Error sending message for campaign contact ${campaignContact.id} to ${campaignContact.contact.phoneNumber}:`,
        error,
      ); // Lógica de retentativa

      const newAttempts = (campaignContact.attempts || 0) + 1;
      const maxRetries = campaign.maxRetriesPerMessage || 3; // Usar configuração da campanha
      const shouldRetry = newAttempts < maxRetries;

      const errorMessage = String(error).substring(0, 500); // Truncar mensagem de erro

      await db
        .update(campaignContactsTables)
        .set({
          status: shouldRetry ? "pending" : "failed", // Mantém como pending para retry, ou marca como failed
          attempts: newAttempts,
          errorMessage: errorMessage,
          failedAt: shouldRetry ? null : new Date(), // Define failedAt apenas se esgotar retries
          nextAttemptAt: shouldRetry
            ? new Date(Date.now() + newAttempts * 30 * 1000)
            : null, // Retry com backoff simples (30s, 60s, 90s...)
          updatedAt: new Date(),
        })
        .where(eq(campaignContactsTables.id, campaignContact.id));

      if (!shouldRetry) {
        console.log(
          `Max retries reached for campaign contact ${campaignContact.id}. Marking as failed.`,
        ); // Atualizar contador de falhas da campanha apenas quando esgotar as retentativas
        await db
          .update(campaignsTables)
          .set({
            messagesFailed: sql`${campaignsTables.messagesFailed} + 1`,
            updatedAt: new Date(),
          })
          .where(eq(campaignsTables.id, campaign.id)); // Log da atividade de falha

        await rabbitmq.publishMessage("activities", "activities.log", {
          userId: campaign.userId,
          type: "message_failed",
          status: "error",
          title: "Mensagem falhou",
          description: `Falha ao enviar mensagem para ${campaignContact.contact.phoneNumber}: ${errorMessage}`,
          campaignId: campaign.id,
          contactId: campaignContact.contactId,
          messageId: campaignContact.id, // ID do nosso registro
          instanceId: campaign.instanceId,
          createdAt: new Date(),
          metadata: { error: String(error) }, // Log do erro completo nos metadados
        });
      } else {
        console.log(
          `Retrying message for campaign contact ${campaignContact.id}. Attempt ${newAttempts}/${maxRetries}. Next attempt at ${campaignContact.nextAttemptAt}`,
        ); // Log da atividade de retentativa (opcional, pode gerar muito log)
        // await rabbitmq.publishMessage("activities", "activities.log", { ... message_retrying ... });
      }
    }
  } // Remover este handler, a lógica de agendamento está no agendador interno
  // private async handleScheduledCampaign(data: { campaignId: string; userId: string; executeAt: string; }): Promise<void> { ... }
  // Consumidor da fila campaign.status.update (webhooks)

  private async updateCampaignStatus(data: UpdateStatusPayload): Promise<void> {
    console.log(
      `Updating status for message ID ${data.messageId || data.campaignContactId} to ${data.newStatus}`,
    );
    try {
      // Encontrar o registro campaignContact usando messageId (da API) ou nosso ID
      const campaignContact = await db.query.campaignContactsTables.findFirst({
        where: data.messageId
          ? eq(campaignContactsTables.messageId, data.messageId)
          : eq(campaignContactsTables.id, data.campaignContactId!),
        with: {
          campaign: {
            columns: { id: true, userId: true, name: true, instanceId: true },
          },
          contact: {
            columns: { id: true, phoneNumber: true },
          },
        },
      });

      if (!campaignContact) {
        console.warn(
          `Campaign contact not found for message ID ${data.messageId || data.campaignContactId}`,
        );
        return; // Ignorar se não encontrar
      } // Evitar atualizar para um status anterior (ex: de read para delivered)

      const statusOrder: MessageStatus[] = [
        "pending",
        "queued",
        "sent",
        "delivered",
        "read",
        "failed",
        "cancelled",
      ];
      const currentOrder = statusOrder.indexOf(
        campaignContact.status as MessageStatus,
      );
      const newOrder = statusOrder.indexOf(data.newStatus);

      if (newOrder <= currentOrder && data.newStatus !== "failed") {
        console.log(
          `Ignoring status update for campaign contact ${campaignContact.id} from ${campaignContact.status} to ${data.newStatus}`,
        );
        return;
      }

      const updateData: any = {
        status: data.newStatus,
        updatedAt: new Date(),
        metadata: data.webhookPayload
          ? { webhook: data.webhookPayload }
          : campaignContact.metadata, // Salva payload do webhook
      }; // Definir timestamps e limpar campos de erro/retry se sucesso

      switch (data.newStatus) {
        case "delivered":
          updateData.deliveredAt = new Date();
          updateData.errorMessage = null;
          updateData.nextAttemptAt = null;
          break;
        case "read":
          updateData.readAt = new Date();
          updateData.errorMessage = null;
          updateData.nextAttemptAt = null; // Se a mensagem foi lida, ela também foi entregue
          if (!campaignContact.deliveredAt) {
            updateData.deliveredAt = new Date();
          }
          break;
        case "failed":
          updateData.failedAt = new Date();
          updateData.errorMessage =
            data.error || "Erro desconhecido via webhook";
          updateData.nextAttemptAt = null; // Falha final, não retenta via webhook
          break; // TODO: Handle 'queued', 'sent', 'cancelled' via webhook if API sends them
      } // Atualizar o registro campaignContact

      await db
        .update(campaignContactsTables)
        .set(updateData)
        .where(eq(campaignContactsTables.id, campaignContact.id));

      console.log(
        `Status updated for campaign contact ${campaignContact.id} to ${data.newStatus}`,
      ); // Atualizar contadores da campanha (atomicamente)
      // Evitar dupla contagem se o status já estava no estado final

      const campaignUpdate: any = { updatedAt: new Date() };
      let logType: string | null = null;
      let logStatus: string = "info";

      if (
        data.newStatus === "delivered" &&
        campaignContact.status !== "delivered" &&
        campaignContact.status !== "read"
      ) {
        campaignUpdate.messagesDelivered = sql`${campaignsTables.messagesDelivered} + 1`;
        logType = "message_delivered";
        logStatus = "success";
      } else if (
        data.newStatus === "read" &&
        campaignContact.status !== "read"
      ) {
        campaignUpdate.messagesRead = sql`${campaignsTables.messagesRead} + 1`;
        logType = "message_read";
        logStatus = "success";
      } else if (
        data.newStatus === "failed" &&
        campaignContact.status !== "failed"
      ) {
        // O contador de falhas já é incrementado em sendMessage quando esgotam as retries.
        // Se a API enviar um webhook de falha antes das retries esgotarem, podemos atualizar o status aqui,
        // mas o contador de falhas da campanha só deve ser incrementado uma vez.
        // Uma abordagem seria só incrementar aqui se o status anterior não era 'failed' E o número de tentativas já atingiu o máximo.
        // Ou, mais simples, garantir que sendMessage só incrementa o contador da campanha NA ÚLTIMA falha.
        // Por enquanto, vamos logar a falha via webhook.
        logType = "message_failed";
        logStatus = "error";
      }

      if (Object.keys(campaignUpdate).length > 1) {
        // Se há algo para atualizar além do updatedAt
        await db
          .update(campaignsTables)
          .set(campaignUpdate)
          .where(eq(campaignsTables.id, campaignContact.campaignId!));
      } // Log da atividade de webhook

      if (logType) {
        await rabbitmq.publishMessage("activities", "activities.log", {
          userId: campaignContact.campaign?.userId!,
          type: logType,
          status: logStatus,
          title: `Mensagem ${data.newStatus}`,
          description: `Mensagem para ${campaignContact.contact?.phoneNumber} na campanha '${campaignContact.campaign?.name}' foi ${data.newStatus}.`,
          campaignId: campaignContact.campaignId!,
          contactId: campaignContact.contactId!,
          messageId: campaignContact.id, // ID do nosso registro
          instanceId: campaignContact.campaign?.instanceId,
          createdAt: new Date(),
          metadata: data.webhookPayload,
        });
      } // TODO: Verificar se a campanha foi concluída após esta atualização (se todos os contatos terminaram)
      // Isso já é verificado no final de cada lote em executeCampaign, mas pode ser útil aqui também.
    } catch (error) {
      console.error(
        `Error updating status for message ID ${data.messageId || data.campaignContactId}:`,
        error,
      ); // Logar a falha no processamento do webhook (opcional)
      await rabbitmq.publishMessage("activities", "activities.log", {
        userId: data.userId || "system", // Tentar obter userId se possível
        type: "webhook_received",
        status: "error",
        title: "Falha ao processar webhook",
        description: `Erro ao atualizar status da mensagem ${data.messageId || data.campaignContactId}: ${error}`,
        messageId: data.campaignContactId,
        createdAt: new Date(),
        metadata: { payload: data.webhookPayload, error: String(error) },
      });
    }
  } // Consumidor da fila activities.log

  private async logActivity(data: LogActivityPayload): Promise<void> {
    try {
      // Inserir a atividade na tabela activitiesTables
      await db.insert(activitiesTables).values({
        id: crypto.randomUUID(), // Gerar UUID para a atividade
        userId: data.userId,
        type: data.type,
        status: data.status,
        title: data.title,
        description: data.description,
        campaignId: data.campaignId,
        instanceId: data.instanceId,
        contactId: data.contactId,
        templateId: data.templateId,
        groupId: data.groupId,
        messageId: data.messageId,
        metadata: data.metadata,
        createdAt: data.createdAt, // Usar timestamp da criação original
      }); // console.log(`Activity logged: ${data.type}`); // Evitar log excessivo
    } catch (error) {
      console.error("Failed to save activity to DB:", error); // Opcional: Tentar logar em um arquivo ou serviço de log externo se o DB falhar
    }
  }
}

export const campaignWorker = new CampaignWorker();
