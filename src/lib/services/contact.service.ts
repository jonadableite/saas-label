// src/lib/services/contact.service.ts
import { and, eq, like, or, sql } from "drizzle-orm";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { z } from "zod";

import { db } from "@/db";
import {
  type Contact,
  type ContactGroup,
  contactGroupMembersTables,
  contactGroupsTables,
  contactsTables,
  type NewContact,
  type NewContactGroup,
} from "@/db/schema";
import { rabbitmq, redis } from "@/lib/queue/config";

// ================================
// SCHEMAS DE VALIDAÇÃO
// ================================

export const ImportContactsSchema = z.object({
  groupId: z.string().optional(),
  skipDuplicates: z.boolean().default(true),
  validateNumbers: z.boolean().default(true),
  contacts: z.array(
    z.object({
      name: z.string().min(1),
      phoneNumber: z.string().min(10),
      email: z.string().email().optional(),
      customFields: z.record(z.any()).optional(),
      tags: z.array(z.string()).optional(),
    }),
  ),
});

export const BulkImportSchema = z.object({
  file: z.string(), // Base64 ou URL do arquivo
  fileName: z.string(),
  fileType: z.enum(["csv", "xlsx", "xls"]),
  groupId: z.string().optional(),
  mapping: z.object({
    name: z.string(),
    phoneNumber: z.string(),
    email: z.string().optional(),
  }),
  skipDuplicates: z.boolean().default(true),
  validateNumbers: z.boolean().default(true),
});

// ================================
// SERVIÇO DE CONTATOS
// ================================

export class ContactService {
  // ================================
  // CRUD BÁSICO
  // ================================

  async createContact(
    userId: string,
    data: NewContact & { groupIds?: string[] },
  ): Promise<Contact> {
    const { groupIds, ...contactData } = data;

    // Verificar duplicatas
    const existing = await db.query.contactsTables.findFirst({
      where: and(
        eq(contactsTables.userId, userId),
        eq(contactsTables.phoneNumber, contactData.phoneNumber),
        sql`${contactsTables.deletedAt} IS NULL`,
      ),
    });

    if (existing) {
      throw new Error("Contato com este número já existe");
    }

    // Validar número se necessário
    if (contactData.phoneNumber) {
      const isValid = await this.validatePhoneNumber(contactData.phoneNumber);
      if (!isValid) {
        throw new Error("Número de telefone inválido");
      }
    }

    const [contact] = await db
      .insert(contactsTables)
      .values({
        ...contactData,
        userId,
      })
      .returning();

    // Adicionar aos grupos se especificado
    if (groupIds?.length) {
      await this.addContactToGroups(contact.id, groupIds);
    }

    return contact;
  }

  async getContacts(
    userId: string,
    filters: {
      groupId?: string;
      search?: string;
      tags?: string[];
      isActive?: boolean;
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<{ contacts: Contact[]; total: number }> {
    const { groupId, search, tags, isActive, limit = 20, offset = 0 } = filters;

    let query = db.select().from(contactsTables);
    let countQuery = db
      .select({ count: sql<number>`count(*)` })
      .from(contactsTables);

    const whereConditions = [
      eq(contactsTables.userId, userId),
      sql`${contactsTables.deletedAt} IS NULL`,
    ];

    if (isActive !== undefined) {
      whereConditions.push(eq(contactsTables.isActive, isActive));
    }

    if (search) {
      whereConditions.push(
        or(
          like(contactsTables.name, `%${search}%`),
          like(contactsTables.phoneNumber, `%${search}%`),
          like(contactsTables.email, `%${search}%`),
        ),
      );
    }

    if (tags?.length) {
      whereConditions.push(sql`${contactsTables.tags} && ${tags}`);
    }

    // Filtro por grupo (join)
    if (groupId) {
      query = query.innerJoin(
        contactGroupMembersTables,
        eq(contactsTables.id, contactGroupMembersTables.contactId),
      );
      countQuery = countQuery.innerJoin(
        contactGroupMembersTables,
        eq(contactsTables.id, contactGroupMembersTables.contactId),
      );
      whereConditions.push(eq(contactGroupMembersTables.groupId, groupId));
    }

    const [contacts, totalResult] = await Promise.all([
      query
        .where(and(...whereConditions))
        .limit(limit)
        .offset(offset)
        .orderBy(sql`${contactsTables.createdAt} DESC`),
      countQuery
        .where(and(...whereConditions))
        .then((result) => result[0]?.count || 0),
    ]);

    return { contacts, total: totalResult };
  }

  // ================================
  // IMPORTAÇÃO EM MASSA
  // ================================

async importContactsFromFile(
  userId: string,
  data: z.infer<typeof BulkImportSchema>,
): Promise<{
  errors: any;
  imported: any;
  jobId: string;
  message: string;
}> {
  const validatedData = BulkImportSchema.parse(data);
  const jobId = crypto.randomUUID();

  // Processar arquivo
  let contacts: any[] = [];

  try {
    console.log("Processando arquivo:", {
      fileType: validatedData.fileType,
      fileName: validatedData.fileName,
      mapping: validatedData.mapping
    });

    if (validatedData.fileType === "csv") {
      contacts = await this.parseCSV(validatedData.file);
    } else {
      contacts = await this.parseExcel(validatedData.file);
    }

    console.log("Contatos parseados:", contacts.slice(0, 3)); // Só os primeiros 3

  } catch (error) {
    console.error("Erro ao processar arquivo:", error);
    throw new Error("Erro ao processar arquivo: " + error);
  }

  if (contacts.length === 0) {
    throw new Error("Nenhum dado encontrado no arquivo");
  }

  // Função para encontrar campo (mais flexível)
  const findFieldValue = (row: any, possibleKeys: string[]): string | undefined => {
    const keys = Object.keys(row);

    for (const possibleKey of possibleKeys) {
      // Tentar busca exata
      if (row[possibleKey]) {
        return row[possibleKey];
      }

      // Tentar busca case-insensitive
      const foundKey = keys.find(key =>
        key.toLowerCase().includes(possibleKey.toLowerCase()) ||
        possibleKey.toLowerCase().includes(key.toLowerCase())
      );

      if (foundKey && row[foundKey]) {
        return row[foundKey];
      }
    }

    return undefined;
  };

  // Mapear campos com validação flexível
  const mappedContacts = contacts
    .map((row, index) => {
      try {
        // Tentar diferentes variações do nome
        const name = findFieldValue(row, ['nome', 'name', 'cliente', 'contact']);

        // Tentar diferentes variações do telefone
        const phoneNumber = findFieldValue(row, ['telefone', 'phone', 'celular', 'mobile']);

        // Email é opcional
        const email = findFieldValue(row, ['email', 'e-mail', 'mail']);

        console.log(`Linha ${index + 1}:`, {
          originalRow: row,
          extractedName: name,
          extractedPhone: phoneNumber,
          extractedEmail: email
        });

        if (!name || !phoneNumber) {
          console.warn(`Linha ${index + 1}: dados incompletos`, {
            name: name || 'VAZIO',
            phone: phoneNumber || 'VAZIO',
            availableKeys: Object.keys(row)
          });
          return null;
        }

        return {
          name: String(name).trim(),
          phoneNumber: this.formatPhoneNumber(String(phoneNumber).trim()),
          email: email ? String(email).trim() : undefined,
        };
      } catch (error) {
        console.error(`Erro ao processar linha ${index + 1}:`, error, row);
        return null;
      }
    })
    .filter((contact): contact is NonNullable<typeof contact> => contact !== null);

  console.log("Contatos mapeados:", mappedContacts);

  if (mappedContacts.length === 0) {
    const sampleRow = contacts[0];
    const availableFields = Object.keys(sampleRow || {});
    throw new Error(
      `Nenhum contato válido encontrado. ` +
      `Campos disponíveis no arquivo: ${availableFields.join(', ')}. ` +
      `Esperado: nome/name, telefone/phone`
    );
  }

  // Resto do código permanece igual...
  await redis.setex(
    `import:${jobId}`,
    3600,
    JSON.stringify({
      userId,
      contacts: mappedContacts,
      groupId: validatedData.groupId,
      skipDuplicates: validatedData.skipDuplicates,
      validateNumbers: validatedData.validateNumbers,
      total: mappedContacts.length,
      processed: 0,
      status: "pending",
    }),
  );

  await rabbitmq.publishMessage("contacts", "contacts.import", {
  jobId,
  userId,
  contactsCount: mappedContacts.length,
  options: {
    groupId: validatedData.groupId,
    skipDuplicates: validatedData.skipDuplicates,
    validateNumbers: validatedData.validateNumbers,
  },
});

  return {
    jobId,
    message: `Importação iniciada. ${mappedContacts.length} contatos serão processados.`,
    imported: 0,
    errors: []
  };
}


  async importContacts(
    userId: string,
    data: z.infer<typeof ImportContactsSchema>,
  ): Promise<{
    imported: number;
    skipped: number;
    errors: Array<{ contact: any; error: string }>;
  }> {
    const validatedData = ImportContactsSchema.parse(data);
    const results = {
      imported: 0,
      skipped: 0,
      errors: [] as Array<{ contact: any; error: string }>,
    };

    // Buscar contatos existentes se skipDuplicates for true
    let existingNumbers: Set<string> = new Set();
    if (validatedData.skipDuplicates) {
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
    const batchSize = 100;
    for (let i = 0; i < validatedData.contacts.length; i += batchSize) {
      const batch = validatedData.contacts.slice(i, i + batchSize);
      const contactsToInsert: NewContact[] = [];

      for (const contactData of batch) {
        try {
          const formattedNumber = this.formatPhoneNumber(
            contactData.phoneNumber,
          );

          // Verificar duplicata
          if (
            validatedData.skipDuplicates &&
            existingNumbers.has(formattedNumber)
          ) {
            results.skipped++;
            continue;
          }

          // Validar número se necessário
          if (validatedData.validateNumbers) {
            const isValid = await this.validatePhoneNumber(formattedNumber);
            if (!isValid) {
              results.errors.push({
                contact: contactData,
                error: "Número de telefone inválido",
              });
              continue;
            }
          }

          contactsToInsert.push({
            ...contactData,
            phoneNumber: formattedNumber,
            userId,
          });
        } catch (error) {
          results.errors.push({
            contact: contactData,
            error: String(error),
          });
        }
      }

      // Inserir lote
      if (contactsToInsert.length > 0) {
        try {
          await db
            .insert(contactsTables)
            .values(contactsToInsert)
            .onConflictDoNothing();
          results.imported += contactsToInsert.length;
        } catch (error) {
          results.errors.push({
            contact: contactsToInsert,
            error: "Erro ao inserir lote: " + error,
          });
        }
      }
    }

    // Adicionar contatos ao grupo se especificado
    if (validatedData.groupId && results.imported > 0) {
      await this.addImportedContactsToGroup(userId, validatedData.groupId);
    }

    // Log da atividade
    await this.logActivity(userId, {
      type: "contact_imported",
      status: results.errors.length > 0 ? "warning" : "success",
      title: "Contatos importados",
      description: `${results.imported} contatos importados, ${results.skipped} pulados, ${results.errors.length} erros`,
      metadata: {
        imported: results.imported,
        skipped: results.skipped,
        errors: results.errors.length,
      },
    });

    return results;
  }

  async getImportStatus(jobId: string): Promise<{
    status: "pending" | "processing" | "completed" | "failed";
    total: number;
    processed: number;
    errors?: any[];
  } | null> {
    const data = await redis.get(`import:${jobId}`);
    return data ? JSON.parse(data) : null;
  }

  // ================================
  // GESTÃO DE GRUPOS
  // ================================

  async createContactGroup(
    userId: string,
    data: NewContactGroup,
  ): Promise<ContactGroup> {
    const [group] = await db
      .insert(contactGroupsTables)
      .values({
        ...data,
        userId,
      })
      .returning();

    return group;
  }

  // MÉTODO ATUALIZADO PARA COMPATIBILIDADE COM API
  async getContactGroups(userId: string): Promise<{
    groups: Array<{
      id: string;
      name: string;
      totalContacts: number;
      description?: string | null;
    }>;
    total: number;
  }> {
    try {
      const groups = await db.query.contactGroupsTables.findMany({
        where: and(
          eq(contactGroupsTables.userId, userId),
          sql`${contactGroupsTables.deletedAt} IS NULL`,
        ),
        orderBy: sql`${contactGroupsTables.name} ASC`,
      });

      const formattedGroups = groups.map(group => ({
        id: group.id,
        name: group.name,
        totalContacts: group.totalContacts || 0,
        description: group.description,
      }));

      return {
        groups: formattedGroups,
        total: formattedGroups.length,
      };
    } catch (error) {
      console.error("Error getting contact groups:", error);
      return { groups: [], total: 0 };
    }
  }

  async addContactToGroups(
    contactId: string,
    groupIds: string[],
  ): Promise<void> {
    const members = groupIds.map((groupId) => ({
      contactId,
      groupId,
    }));

    await db
      .insert(contactGroupMembersTables)
      .values(members)
      .onConflictDoNothing();

    // Atualizar contadores dos grupos
    for (const groupId of groupIds) {
      await db
        .update(contactGroupsTables)
        .set({
          totalContacts: sql`${contactGroupsTables.totalContacts} + 1`,
        })
        .where(eq(contactGroupsTables.id, groupId));
    }
  }

  // ================================
  // UTILITÁRIOS
  // ================================

private async parseCSV(fileContent: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    // Limpar conteúdo antes do parse
    const cleanContent = fileContent
      .replace(/\+ACI-/g, '') // Remove caracteres problemáticos
      .replace(/\ufeff/g, '') // Remove BOM
      .replace(/^\s+|\s+$/g, '') // Remove espaços no início/fim
      .trim();

    console.log("Conteúdo limpo para parse:", {
      original: fileContent.substring(0, 100),
      cleaned: cleanContent.substring(0, 100),
      lines: cleanContent.split('\n').slice(0, 3)
    });

    Papa.parse(cleanContent, {
      header: true,
      skipEmptyLines: true,
      delimiter: ",",
      transformHeader: (header: string) => {
        // Normalizar headers
        return header
          .toLowerCase()
          .trim()
          .replace(/[^\w]/g, '') // Remove caracteres especiais
          .replace(/[áàâãä]/g, 'a')
          .replace(/[éèêë]/g, 'e')
          .replace(/[íìîï]/g, 'i')
          .replace(/[óòôõö]/g, 'o')
          .replace(/[úùûü]/g, 'u')
          .replace(/[ç]/g, 'c');
      },
      transform: (value: string) => {
        // Limpar valores
        return value
          .replace(/\+ACI-/g, '')
          .trim();
      },
      complete: (results) => {
        console.log("CSV Parse Results:", {
          data: results.data.slice(0, 3),
          totalRows: results.data.length,
          errors: results.errors,
          meta: results.meta
        });

        if (results.errors.length > 0) {
          console.error("CSV Errors:", results.errors);
          reject(
            new Error("Erro ao analisar CSV: " + results.errors[0].message),
          );
        } else {
          resolve(results.data);
        }
      },
      error: (error) => {
        console.error("Papa Parse Error:", error);
        reject(error);
      },
    });
  });
}


  private async parseExcel(fileContent: string): Promise<any[]> {
    try {
      const buffer = Buffer.from(fileContent, "base64");
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      return XLSX.utils.sheet_to_json(sheet);
    } catch (error) {
      throw new Error("Erro ao analisar arquivo Excel: " + error);
    }
  }

 private formatPhoneNumber(phone: string): string {
  // Remove todos os caracteres não numéricos
  const cleaned = phone.replace(/\D/g, "");

  // Se já tem código do país (55), manter
  if (cleaned.startsWith("55") && cleaned.length >= 12) {
    return cleaned;
  }

  // Se tem 11 dígitos (com 9 no celular), adicionar 55
  if (cleaned.length === 11) {
    return "55" + cleaned;
  }

  // Se tem 10 dígitos (sem 9), adicionar 55
  if (cleaned.length === 10) {
    return "55" + cleaned;
  }

  // Retornar limpo mesmo se não estiver no formato esperado
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

  private async addImportedContactsToGroup(
    userId: string,
    groupId: string,
  ): Promise<void> {
    // Buscar contatos recém-importados (últimos 5 minutos)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const recentContacts = await db
      .select({ id: contactsTables.id })
      .from(contactsTables)
      .where(
        and(
          eq(contactsTables.userId, userId),
          sql`${contactsTables.createdAt} > ${fiveMinutesAgo}`,
        ),
      );

    if (recentContacts.length > 0) {
      // CORRIGIDO: Adicionar todos os contatos recentes ao grupo
      const contactIds = recentContacts.map(c => c.id);
      for (const contactId of contactIds) {
        await this.addContactToGroups(contactId, [groupId]);
      }
    }
  }

  private async logActivity(
    userId: string,
    activity: {
      type: any;
      status: any;
      title: string;
      description: string;
      metadata?: any;
    },
  ): Promise<void> {
    await rabbitmq.publishMessage("contacts", "activities.log", {
      userId,
      ...activity,
      timestamp: Date.now(),
    });
  }
}

export const contactService = new ContactService();
