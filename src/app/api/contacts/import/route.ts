// src/app/api/contacts/import/route.ts
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import * as XLSX from "xlsx";

import { db } from "@/db";
import { contactGroupMembersTables, contactGroupsTables, contactsTables } from "@/db/schema";
import { auth } from "@/lib/auth";

interface ContactData {
  name: string;
  phoneNumber: string;
  email?: string;
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "Arquivo não fornecido" },
        { status: 400 }
      );
    }

    console.log("Processando arquivo:", {
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size
    });

    // Processar arquivo dependendo do tipo
    let contacts: ContactData[] = [];
    const arrayBuffer = await file.arrayBuffer();

    if (file.type === "text/csv" || file.name.toLowerCase().endsWith('.csv')) {
      // Processar CSV
      const uint8Array = new Uint8Array(arrayBuffer);
      let fileContent: string;

      // Tentar diferentes encodings
      try {
        fileContent = new TextDecoder('utf-8').decode(uint8Array);
        console.log("UTF-8 decode success");
      } catch {
        try {
          fileContent = new TextDecoder('iso-8859-1').decode(uint8Array);
          console.log("ISO-8859-1 decode success");
        } catch {
          fileContent = new TextDecoder('windows-1252').decode(uint8Array);
          console.log("Windows-1252 decode success");
        }
      }

      // Limpar caracteres problemáticos
      fileContent = fileContent
        .replace(/\+ACI-/g, '')
        .replace(/\ufeff/g, '')
        .trim();

      console.log("Conteúdo do arquivo limpo:", {
        fileName: file.name,
        fileType: 'csv',
        fileSize: file.size,
        contentPreview: fileContent.substring(0, 200),
        lines: fileContent.split('\n').slice(0, 3)
      });

      // Parse CSV
      const parseResult = Papa.parse(fileContent, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.toLowerCase().trim()
      });

      console.log("CSV Parse Results:", parseResult);

      if (parseResult.errors.length > 0) {
        console.error("Erros no parse do CSV:", parseResult.errors);
        return NextResponse.json({
          error: "Erro ao processar CSV",
          details: parseResult.errors
        }, { status: 400 });
      }

      // Mapear dados do CSV
      contacts = parseResult.data.map((row: any, index: number) => {
        const name = row.nome || row.name || '';
        const phoneNumber = row.telefone || row.phone || row.telefone || '';
        const email = row.email || undefined;

        console.log(`Linha ${index + 1}:`, {
          originalRow: row,
          extractedName: name,
          extractedPhone: phoneNumber,
          extractedEmail: email
        });

        return {
          name: name.trim(),
          phoneNumber: phoneNumber.toString().trim(),
          email: email?.trim() || undefined
        };
      }).filter(contact => contact.name && contact.phoneNumber);

    } else {
      // Processar Excel (XLSX/XLS)
      const workbook = XLSX.read(arrayBuffer);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      if (jsonData.length < 2) {
        return NextResponse.json({
          error: "Arquivo deve ter pelo menos 2 linhas (cabeçalho + dados)"
        }, { status: 400 });
      }

      const headers = (jsonData[0] as string[]).map(h => h.toLowerCase().trim());
      const rows = jsonData.slice(1) as any[][];

      contacts = rows.map((row, index) => {
        const obj: any = {};
        headers.forEach((header, colIndex) => {
          obj[header] = row[colIndex];
        });

        const name = obj.nome || obj.name || '';
        const phoneNumber = obj.telefone || obj.phone || obj.telefone || '';
        const email = obj.email || undefined;

        console.log(`Linha Excel ${index + 1}:`, {
          originalRow: obj,
          extractedName: name,
          extractedPhone: phoneNumber,
          extractedEmail: email
        });

        return {
          name: name?.toString()?.trim() || '',
          phoneNumber: phoneNumber?.toString()?.trim() || '',
          email: email?.toString()?.trim() || undefined
        };
      }).filter(contact => contact.name && contact.phoneNumber);
    }

    console.log("Contatos mapeados:", contacts);

    if (contacts.length === 0) {
      return NextResponse.json({
        error: "Nenhum contato válido encontrado",
        details: "Verifique se o arquivo contém as colunas 'nome' e 'telefone' com dados válidos"
      }, { status: 400 });
    }

    // **INSERÇÃO DIRETA NO BANCO DE DADOS**
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // 1. Verificar/criar grupo padrão "Importados"
    let defaultGroup;
    try {
      const existingGroups = await db
        .select()
        .from(contactGroupsTables)
        .where(and(
          eq(contactGroupsTables.userId, userId),
          eq(contactGroupsTables.name, "Importados")
        ));

      if (existingGroups.length > 0) {
        defaultGroup = existingGroups[0];
        console.log("Grupo 'Importados' encontrado:", defaultGroup.id);
      } else {
        const newGroups = await db
          .insert(contactGroupsTables)
          .values({
            userId,
            name: "Importados",
            description: "Contatos importados via CSV/Excel",
            color: "#10b981",
            isDefault: false,
            isSystemGroup: false,
            totalContacts: 0,
            activeContacts: 0
          })
          .returning();
        defaultGroup = newGroups[0];
        console.log("Grupo 'Importados' criado:", defaultGroup.id);
      }
    } catch (error) {
      console.error("Erro ao criar grupo padrão:", error);
      return NextResponse.json({
        error: "Erro ao criar grupo de contatos"
      }, { status: 500 });
    }

    // 2. Inserir contatos um por um
    for (const contactData of contacts) {
      try {
        // Limpar telefone (apenas números)
        const cleanPhone = contactData.phoneNumber.replace(/\D/g, '');

        if (cleanPhone.length < 10 || cleanPhone.length > 15) {
          errorCount++;
          errors.push(`Telefone inválido: ${contactData.phoneNumber} (deve ter entre 10 e 15 dígitos)`);
          continue;
        }

        // Verificar se contato já existe
        const existingContacts = await db
          .select()
          .from(contactsTables)
          .where(and(
            eq(contactsTables.userId, userId),
            eq(contactsTables.phoneNumber, cleanPhone)
          ));

        if (existingContacts.length > 0) {
          errorCount++;
          errors.push(`Contato já existe: ${contactData.name} (${cleanPhone})`);
          continue;
        }

        // Validar email se fornecido
        if (contactData.email && !contactData.email.includes('@')) {
          contactData.email = undefined; // Ignorar email inválido
        }

        // Inserir contato
        const newContacts = await db
          .insert(contactsTables)
          .values({
            userId,
            name: contactData.name,
            phoneNumber: cleanPhone,
            email: contactData.email || null,
            source: "import",
            sourceDetails: {
              importedAt: new Date().toISOString(),
              fileName: file.name,
              fileType: file.type || 'unknown'
            },
            isActive: true,
            isValidated: false,
            isBlocked: false,
            hasOptedOut: false,
            gdprConsent: false,
            totalMessagesSent: 0,
            totalMessagesReceived: 0,
            totalCampaigns: 0,
            engagementScore: 0
          })
          .returning();

        const newContact = newContacts[0];

        // Adicionar ao grupo padrão
        if (defaultGroup && newContact) {
          await db
            .insert(contactGroupMembersTables)
            .values({
              contactId: newContact.id,
              groupId: defaultGroup.id,
              isActive: true
            });
        }

        successCount++;
        console.log(`✅ Contato inserido: ${contactData.name} (${cleanPhone})`);

      } catch (error) {
        errorCount++;
        const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
        console.error(`❌ Erro ao inserir contato ${contactData.name}:`, error);
        errors.push(`Erro ao inserir ${contactData.name}: ${errorMsg}`);
      }
    }

    // 3. Atualizar contador do grupo
    if (defaultGroup && successCount > 0) {
      try {
        await db
          .update(contactGroupsTables)
          .set({
            totalContacts: defaultGroup.totalContacts + successCount,
            activeContacts: defaultGroup.activeContacts + successCount,
            updatedAt: new Date()
          })
          .where(eq(contactGroupsTables.id, defaultGroup.id));

        console.log(`Contador do grupo atualizado: +${successCount} contatos`);
      } catch (error) {
        console.error("Erro ao atualizar contador do grupo:", error);
      }
    }

    console.log(`✅ Importação concluída: ${successCount} sucessos, ${errorCount} erros`);

    return NextResponse.json({
      message: `Importação concluída! ${successCount} contatos importados com sucesso${errorCount > 0 ? `, ${errorCount} com erro` : ''}.`,
      imported: successCount,
      errors: errorCount > 0 ? errors.slice(0, 10) : [], // Limitar a 10 erros
      totalProcessed: contacts.length,
      successCount,
      errorCount,
      groupId: defaultGroup?.id
    }, { status: 200 });

  } catch (error) {
    console.error("Error importing contacts:", error);

    const errorMessage = error instanceof Error ? error.message : "Erro interno do servidor";

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
