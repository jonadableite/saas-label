// src/lib/services/template.service.ts
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { templatesTables } from "@/db/schema";

import { SpintexProcessor } from "../spintex";

export interface TemplateMessage {
  type: 'text' | 'image' | 'document' | 'video' | 'audio' | 'sticker' | 'button' | 'list';
  content: string;
  mediaUrl?: string;
  buttons?: any[];
  listSections?: any[];
  fileName?: string;
}

export interface ProcessedTemplate {
  evolutionPayload: any;
  processedContent: string;
  mediaUrl?: string;
}

export class TemplateService {
  /**
   * Busca template por ID
   */
  static async getTemplate(templateId: string, userId: string) {
    const template = await db
      .select()
      .from(templatesTables)
      .where(
        and(
          eq(templatesTables.id, templateId),
          eq(templatesTables.userId, userId),
          eq(templatesTables.isActive, true)
        )
      )
      .limit(1);

    return template[0] || null;
  }

  /**
   * Processa template e retorna payload para Evolution API
   */
  static async processTemplateForEvolution(
    templateId: string,
    userId: string,
    recipientNumber: string,
    variables: Record<string, string> = {}
  ): Promise<ProcessedTemplate> {
    const template = await this.getTemplate(templateId, userId);

    if (!template) {
      throw new Error(`Template ${templateId} não encontrado`);
    }

    // Valida variáveis obrigatórias
    const validation = SpintexProcessor.validateVariables(
      template.content,
      variables,
      template.requiredVariables || []
    );

    if (!validation.valid) {
      throw new Error(`Variáveis obrigatórias faltando: ${validation.missing.join(', ')}`);
    }

    // Processa o conteúdo
    const processedContent = SpintexProcessor.processTemplate(template.content, variables);

    // Monta payload baseado no tipo
    let evolutionPayload: any = {
      number: recipientNumber,
    };

    switch (template.type) {
      case 'text':
        evolutionPayload = {
          ...evolutionPayload,
          text: processedContent,
        };
        break;

      case 'image':
        evolutionPayload = {
          ...evolutionPayload,
          media: template.mediaUrl,
          caption: processedContent,
        };
        break;

      case 'document':
        evolutionPayload = {
          ...evolutionPayload,
          media: template.mediaUrl,
          fileName: template.fileName || 'documento.pdf',
          caption: processedContent,
        };
        break;

      case 'video':
        evolutionPayload = {
          ...evolutionPayload,
          media: template.mediaUrl,
          caption: processedContent,
        };
        break;

      case 'audio':
        evolutionPayload = {
          ...evolutionPayload,
          audio: template.mediaUrl,
        };
        break;

      case 'sticker':
        evolutionPayload = {
          ...evolutionPayload,
          sticker: template.mediaUrl,
        };
        break;

      case 'button':
        const processedButtons = template.buttons?.map((button: any) => ({
          ...button,
          displayText: SpintexProcessor.processTemplate(button.displayText, variables)
        }));

        evolutionPayload = {
          ...evolutionPayload,
          title: "Mensagem",
          description: processedContent,
          footer: "Powered by WhatsApp Marketing",
          buttons: processedButtons,
        };
        break;

      case 'list':
        const processedSections = template.listSections?.map((section: any) => ({
          ...section,
          title: SpintexProcessor.processTemplate(section.title, variables),
          rows: section.rows.map((row: any) => ({
            ...row,
            title: SpintexProcessor.processTemplate(row.title, variables),
            description: SpintexProcessor.processTemplate(row.description, variables),
          }))
        }));

        evolutionPayload = {
          ...evolutionPayload,
          title: "Lista de Opções",
          description: processedContent,
          buttonText: "Ver Opções",
          footerText: "Selecione uma opção",
          sections: processedSections,
        };
        break;

      default:
        throw new Error(`Tipo de template não suportado: ${template.type}`);
    }

    return {
      evolutionPayload,
      processedContent,
      mediaUrl: template.mediaUrl,
    };
  }

  /**
   * Lista templates do usuário
   */
  static async getUserTemplates(userId: string, type?: string) {
    let query = db
      .select()
      .from(templatesTables)
      .where(
        and(
          eq(templatesTables.userId, userId),
          eq(templatesTables.isActive, true)
        )
      );

    if (type) {
      query = query.where(eq(templatesTables.type, type as any));
    }

    return await query.orderBy(templatesTables.createdAt);
  }

  /**
   * Cria novo template
   */
  static async createTemplate(userId: string, templateData: any) {
    // Extrai variáveis automaticamente do conteúdo
    const extractedVariables = SpintexProcessor.extractVariables(templateData.content);

    const template = await db.insert(templatesTables).values({
      id: crypto.randomUUID(),
      userId,
      name: templateData.name,
      description: templateData.description,
      type: templateData.type,
      category: templateData.category || 'general',
      content: templateData.content,
      mediaUrl: templateData.mediaUrl,
      fileName: templateData.fileName,
      fileType: templateData.fileType,
      fileSize: templateData.fileSize,
      buttons: templateData.buttons,
      listSections: templateData.listSections,
      variables: extractedVariables,
      requiredVariables: templateData.requiredVariables || extractedVariables,
      tags: templateData.tags || [],
      isActive: true,
      isApproved: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    return template[0];
  }

  /**
   * Atualiza estatísticas de uso do template
   */
  static async updateTemplateStats(templateId: string, success: boolean) {
    const template = await db
      .select()
      .from(templatesTables)
      .where(eq(templatesTables.id, templateId))
      .limit(1);

    if (template[0]) {
      const timesUsed = (template[0].timesUsed || 0) + 1;
      const currentSuccessRate = template[0].successRate || 0;
      const newSuccessRate = success
        ? Math.round(((currentSuccessRate * (timesUsed - 1)) + 100) / timesUsed)
        : Math.round((currentSuccessRate * (timesUsed - 1)) / timesUsed);

      await db
        .update(templatesTables)
        .set({
          timesUsed,
          successRate: newSuccessRate,
          lastUsedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(templatesTables.id, templateId));
    }
  }
}
