// src/lib/workers/contact.worker.ts
import { and, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  contactGroupMembersTables,
  contactGroupsTables,
  contactsTables,
  type NewContact,
} from "@/db/schema";
import { rabbitmq, redis } from "@/lib/queue/config";

export class ContactWorker {
  async start(): Promise<void> {
    console.log("🚀 Starting Contact Worker...");

    // Consumir fila de importação de contatos
    await rabbitmq.consumeQueue(
      "contacts.import",
      this.processImport.bind(this),
      {
        concurrency: 2,
      },
    );

    // Consumir fila de validação de contatos
    await rabbitmq.consumeQueue(
      "contacts.validate",
      this.validateContacts.bind(this),
      {
        concurrency: 5,
      },
    );

    // Consumir fila de processamento de contatos
    await rabbitmq.consumeQueue(
      "contacts.process",
      this.processContacts.bind(this),
      {
        concurrency: 3,
      },
    );

    console.log("✅ Contact Worker started successfully");
  }

  private async processImport(data: {
    jobId: string;
    userId: string;
    contactsCount: number;
    options: {
      groupId?: string;
      skipDuplicates?: boolean;
      validateNumbers?: boolean;
    };
  }): Promise<void> {
    const { jobId, userId, options } = data;

    try {
      console.log(`Processing import job ${jobId}...`);

      // Buscar dados do cache
      const importData = await redis.get(`import:${jobId}`);
      if (!importData) {
        throw new Error("Import data not found");
      }

      const { contacts, groupId, skipDuplicates, validateNumbers } =
        JSON.parse(importData);

      // Atualizar status
      await redis.setex(
        `import:${jobId}`,
        3600,
        JSON.stringify({
          ...JSON.parse(importData),
          status: "processing",
        }),
      );

      const results = {
        imported: 0,
        skipped: 0,
        errors: [] as Array<{ contact: any; error: string }>,
      };

      // Buscar contatos existentes se skipDuplicates for true
      let existingNumbers: Set<string> = new Set();
      if (skipDuplicates) {
        const existing = await db
          .select({ phoneNumber: contactsTables.phoneNumber })
          .from(contactsTables)
          .where(
            and(
              eq(contactsTables.userId, userId),
              sql`${contactsTables.deletedAt} IS NULL`,
            ),
          );
        existingNumbers = new Set(existing.map((c) => c.phoneNumber));
      }

      // Processar contatos em lotes
      const batchSize = 50;
      for (let i = 0; i < contacts.length; i += batchSize) {
        const batch = contacts.slice(i, i + batchSize);
        const contactsToInsert: NewContact[] = [];
        const contactsToValidate: any[] = [];

        for (const contactData of batch) {
          try {
            const formattedNumber = this.formatPhoneNumber(
              contactData.phoneNumber,
            );

            // Verificar duplicata
            if (skipDuplicates && existingNumbers.has(formattedNumber)) {
              results.skipped++;
              continue;
            }

            const contactToProcess = {
              ...contactData,
              phoneNumber: formattedNumber,
              userId,
            };

            if (validateNumbers) {
              contactsToValidate.push(contactToProcess);
            } else {
              contactsToInsert.push(contactToProcess);
            }
          } catch (error) {
            results.errors.push({
              contact: contactData,
              error: String(error),
            });
          }
        }

        // Validar números se necessário
        if (contactsToValidate.length > 0) {
          for (const contact of contactsToValidate) {
            try {
              const isValid = await this.validatePhoneNumber(
                contact.phoneNumber,
              );
              if (isValid) {
                contactsToInsert.push(contact);
              } else {
                results.errors.push({
                  contact,
                  error: "Número de telefone inválido",
                });
              }
            } catch (error) {
              results.errors.push({
                contact,
                error: "Erro na validação: " + error,
              });
            }
          }
        }

        // Inserir lote
        if (contactsToInsert.length > 0) {
          try {
            const insertedContacts = await db
              .insert(contactsTables)
              .values(contactsToInsert)
              .onConflictDoNothing()
              .returning({ id: contactsTables.id });

            results.imported += insertedContacts.length;

            // Adicionar ao grupo se especificado
            if (groupId && insertedContacts.length > 0) {
              const groupMembers = insertedContacts.map((contact) => ({
                contactId: contact.id,
                groupId,
              }));

              await db
                .insert(contactGroupMembersTables)
                .values(groupMembers)
                .onConflictDoNothing();

              // Atualizar contador do grupo
              await db
                .update(contactGroupsTables)
                .set({
                  totalContacts: sql`${contactGroupsTables.totalContacts} + ${insertedContacts.length}`,
                })
                .where(eq(contactGroupsTables.id, groupId));
            }
          } catch (error) {
            results.errors.push({
              contact: contactsToInsert,
              error: "Erro ao inserir lote: " + error,
            });
          }
        }

        // Atualizar progresso
        const processed = Math.min(i + batchSize, contacts.length);
        await redis.setex(
          `import:${jobId}`,
          3600,
          JSON.stringify({
            ...JSON.parse(importData),
            status: "processing",
            processed,
            results,
          }),
        );
      }

      // Finalizar importação
      await redis.setex(
        `import:${jobId}`,
        3600,
        JSON.stringify({
          ...JSON.parse(importData),
          status: "completed",
          processed: contacts.length,
          results,
        }),
      );

      // Log da atividade
      await rabbitmq.publishMessage("contacts", "activities.log", {
        userId,
        type: "contact_imported",
        status: results.errors.length > 0 ? "warning" : "success",
        title: "Importação de contatos concluída",
        description: `${results.imported} contatos importados, ${results.skipped} pulados, ${results.errors.length} erros`,
        metadata: {
          jobId,
          imported: results.imported,
          skipped: results.skipped,
          errors: results.errors.length,
        },
      });

      console.log(
        `Import job ${jobId} completed: ${results.imported} imported, ${results.skipped} skipped, ${results.errors.length} errors`,
      );
    } catch (error) {
      console.error(`Error processing import job ${jobId}:`, error);

      // Marcar como falhado
      await redis.setex(
        `import:${jobId}`,
        3600,
        JSON.stringify({
          status: "failed",
          error: String(error),
        }),
      );

      // Log do erro
      await rabbitmq.publishMessage("contacts", "activities.log", {
        userId,
        type: "contact_imported",
        status: "error",
        title: "Erro na importação de contatos",
        description: `Falha na importação: ${error}`,
        metadata: { jobId },
      });
    }
  }

  private async validateContacts(data: {
    contactIds: string[];
    userId: string;
  }): Promise<void> {
    const { contactIds, userId } = data;

    try {
      const contacts = await db.query.contactsTables.findMany({
        where: and(
          eq(contactsTables.userId, userId),
          sql`${contactsTables.id} = ANY(${contactIds})`,
        ),
      });

      for (const contact of contacts) {
        const isValid = await this.validatePhoneNumber(contact.phoneNumber);

        await db
          .update(contactsTables)
          .set({
            isValidated: true,
            isActive: isValid,
            validatedAt: new Date(),
          })
          .where(eq(contactsTables.id, contact.id));
      }
    } catch (error) {
      console.error("Error validating contacts:", error);
    }
  }

  private async processContacts(data: {
    operation: "cleanup" | "sync" | "update";
    userId: string;
    options?: any;
  }): Promise<void> {
    const { operation, userId, options = {} } = data;

    try {
      switch (operation) {
        case "cleanup":
          await this.cleanupInvalidContacts(userId);
          break;
        case "sync":
          await this.syncContactGroups(userId);
          break;
        case "update":
          await this.updateContactMetadata(userId, options);
          break;
      }
    } catch (error) {
      console.error(`Error processing contacts operation ${operation}:`, error);
    }
  }

  // ================================
  // UTILITÁRIOS PRIVADOS
  // ================================

  private formatPhoneNumber(phone: string): string {
    // Remove todos os caracteres não numéricos
    const cleaned = phone.replace(/\D/g, "");

    // Adiciona código do país se não tiver
    if (cleaned.length === 11 && cleaned.startsWith("0")) {
      return "55" + cleaned.substring(1);
    } else if (cleaned.length === 10) {
      return "55" + cleaned;
    } else if (cleaned.length === 11 && !cleaned.startsWith("55")) {
      return "55" + cleaned;
    }

    return cleaned;
  }

  private async validatePhoneNumber(phone: string): Promise<boolean> {
    // Validação básica para números brasileiros
    const cleaned = phone.replace(/\D/g, "");

    // Deve ter entre 12-13 dígitos (com código do país)
    if (cleaned.length < 12 || cleaned.length > 13) {
      return false;
    }

    // Deve começar com 55 (Brasil)
    if (!cleaned.startsWith("55")) {
      return false;
    }

    // O nono dígito deve ser 9 para celulares
    const localNumber = cleaned.substring(4);
    if (localNumber.length === 9 && localNumber[0] !== "9") {
      return false;
    }

    return true;
  }

  private async cleanupInvalidContacts(userId: string): Promise<void> {
    // Marcar contatos inválidos como inativos
    await db
      .update(contactsTables)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(contactsTables.userId, userId),
          eq(contactsTables.isValidated, true),
          eq(contactsTables.isActive, false),
        ),
      );
  }

  private async syncContactGroups(userId: string): Promise<void> {
    // Atualizar contadores dos grupos
    const groups = await db.query.contactGroupsTables.findMany({
      where: eq(contactGroupsTables.userId, userId),
    });

    for (const group of groups) {
      const count = await db
        .select({ count: sql<number>`count(*)` })
        .from(contactGroupMembersTables)
        .innerJoin(
          contactsTables,
          eq(contactGroupMembersTables.contactId, contactsTables.id),
        )
        .where(
          and(
            eq(contactGroupMembersTables.groupId, group.id),
            eq(contactsTables.isActive, true),
            sql`${contactsTables.deletedAt} IS NULL`,
          ),
        );

      await db
        .update(contactGroupsTables)
        .set({
          totalContacts: count[0]?.count || 0,
          updatedAt: new Date(),
        })
        .where(eq(contactGroupsTables.id, group.id));
    }
  }

  private async updateContactMetadata(
    userId: string,
    options: any,
  ): Promise<void> {
    // Implementar atualizações de metadata conforme necessário
    // Por exemplo, atualizar tags, última interação, etc.
  }
}

export const contactWorker = new ContactWorker();
