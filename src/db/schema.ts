// src/db/schema.ts
import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { z } from "zod";

// ================================
// ENUMS
// ================================

export const campaignStatusEnum = pgEnum("campaign_status", [
  "draft", // Rascunho
  "scheduled", // Agendada
  "running", // Em execução
  "paused", // Pausada
  "completed", // Concluída
  "cancelled", // Cancelada
  "failed", // Falhou
]);

export const messageStatusEnum = pgEnum("message_status", [
  "pending", // Pendente (Ainda não processada pelo worker)
  "queued", // Na fila (Adicionada à fila do worker)
  "processing", // Processando (Worker pegou a mensagem)
  "sent", // Enviada (API externa retornou sucesso)
  "delivered", // Entregue (Webhook de entrega recebido)
  "read", // Lida (Webhook de leitura recebido)
  "failed", // Falhou (API externa retornou erro ou worker falhou após retentativas)
  "cancelled", // Cancelada (Campanha cancelada antes do envio)
]);

export const activityTypeEnum = pgEnum("activity_type", [
  "campaign_created",
  "campaign_started",
  "campaign_completed",
  "campaign_paused",
  "campaign_cancelled",
  "campaign_failed", // Nova atividade para falha de campanha
  "instance_connected",
  "instance_disconnected",
  "instance_error",
  "message_queued", // Nova atividade para mensagem adicionada à fila
  "message_sent",
  "message_delivered", // Nova atividade para mensagem entregue
  "message_read", // Nova atividade para mensagem lida
  "message_failed",
  "contact_imported",
  "contact_validated",
  "template_created",
  "template_updated",
  "limit_reached",
  "system_error",
  "webhook_received",
  "user_created", // Nova atividade de usuário
  "user_updated", // Nova atividade de usuário
  "instance_created", // Nova atividade de instância
  "group_created", // Nova atividade de grupo
  "contact_created", // Nova atividade de contato
]);

export const activityStatusEnum = pgEnum("activity_status", [
  "success",
  "warning",
  "error",
  "info",
  "debug", // Adicionado para logs mais detalhados
]);

export const templateTypeEnum = pgEnum("template_type", [
  "text",
  "image",
  "document",
  "video",
  "audio",
  "sticker",
  "location",
  "contact",
  "list",
  "button",
]);

export const importStatusEnum = pgEnum("import_status", [
  "pending",
  "processing",
  "completed",
  "failed",
  "cancelled",
]);

// ================================
// TABELAS EXISTENTES (Mantidas e Melhoradas)
// ================================

export const usersTables = pgTable("users_tables", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified")
    .$defaultFn(() => false)
    .notNull(),
  image: text("image"),
  createdAt: timestamp("created_at")
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updated_at")
    .$defaultFn(() => new Date())
    .notNull(),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  plan: text("plan").default("free").notNull(), // Definir default e notNull

  // Configurações do usuário
  timezone: text("timezone").default("America/Sao_Paulo").notNull(), // Definir default e notNull
  dailyMessageLimit: integer("daily_message_limit").default(1000).notNull(), // Definir default e notNull
  monthlyMessageLimit: integer("monthly_message_limit")
    .default(10000)
    .notNull(), // Definir default e notNull
  isActive: boolean("is_active").default(true).notNull(), // Definir default e notNull

  // Estatísticas (Calculadas ou atualizadas por triggers/workers)
  totalCampaigns: integer("total_campaigns").default(0).notNull(),
  totalContacts: integer("total_contacts").default(0).notNull(),
  totalMessagesSent: integer("total_messages_sent").default(0).notNull(),

  // Configurações avançadas
  settings: jsonb("settings").default({}).notNull(), // Definir default como objeto vazio

  // Auditoria
  lastLoginAt: timestamp("last_login_at"),
  deletedAt: timestamp("deleted_at"), // Soft delete
});

export const instancesTables = pgTable(
  "instances_tables",
  {
    instanceId: text("instance_id").primaryKey().notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => usersTables.id, { onDelete: "cascade" }),
    instanceName: text("instance_name").notNull(),
    integration: text("integration").notNull().default("WHATSAPP-BAILEYS"),
    status: text("status").default("disconnected").notNull(), // Definir default e notNull
    ownerJid: text("owner_jid"),
    profileName: text("profile_name"),
    profilePicUrl: text("profile_pic_url"),
    qrcode: boolean("qrcode").default(true).notNull(), // Definir default e notNull
    phoneNumber: text("phone_number"),
    isActive: boolean("is_active").default(true).notNull(), // Definir default e notNull
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => new Date())
      .notNull(),

    // Estatísticas da instância (Calculadas ou atualizadas por triggers/workers)
    totalMessagesSent: integer("total_messages_sent").default(0).notNull(),
    dailyMessagesSent: integer("daily_messages_sent").default(0).notNull(),
    monthlyMessagesSent: integer("monthly_messages_sent").default(0).notNull(),
    lastMessageSentAt: timestamp("last_message_sent_at"),
    lastResetAt: timestamp("last_reset_at")
      .$defaultFn(() => new Date())
      .notNull(), // Definir default e notNull

    // Status de conexão
    isConnected: boolean("is_connected").default(false).notNull(), // Definir default e notNull
    lastConnectedAt: timestamp("last_connected_at"),
    disconnectedAt: timestamp("disconnected_at"),

    // Configurações da instância
    webhookUrl: text("webhook_url"),
    webhookEnabled: boolean("webhook_enabled").default(false).notNull(), // Definir default e notNull

    // Auditoria
    deletedAt: timestamp("deleted_at"), // Soft delete
  },
  (instances) => ({
    userIdIdx: index("instances_user_id_idx").on(instances.userId),
    statusIdx: index("instances_status_idx").on(instances.status),
    activeIdx: index("instances_active_idx").on(instances.isActive),
    phoneIdx: index("instances_phone_idx").on(instances.phoneNumber),
    deletedIdx: index("instances_deleted_idx").on(instances.deletedAt),
  }),
);

// ================================
// NOVAS TABELAS - CAMPANHAS
// ================================

export const campaignsTables = pgTable(
  "campaigns_tables",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => usersTables.id, { onDelete: "cascade" }),
    instanceId: text("instance_id").references(
      () => instancesTables.instanceId,
      { onDelete: "set null" },
    ),

    // Informações da campanha
    name: text("name").notNull(),
    description: text("description"),
    status: campaignStatusEnum("status").default("draft").notNull(),

    // Configurações de envio
    templateId: text("template_id").references(() => templatesTables.id, {
      onDelete: "set null",
    }),
    scheduleAt: timestamp("schedule_at"), // Data/hora agendada para iniciar
    startedAt: timestamp("started_at"), // Data/hora real que iniciou
    completedAt: timestamp("completed_at"), // Data/hora que terminou
    pausedAt: timestamp("paused_at"),
    cancelledAt: timestamp("cancelled_at"),

    // Configurações avançadas
    sendDelay: integer("send_delay").default(1000).notNull(), // ms entre mensagens
    maxRetriesPerMessage: integer("max_retries_per_message")
      .default(3)
      .notNull(),
    enableScheduling: boolean("enable_scheduling").default(false).notNull(),
    sendOnlyBusinessHours: boolean("send_only_business_hours")
      .default(false)
      .notNull(),
    businessHoursStart: text("business_hours_start").default("09:00").notNull(),
    businessHoursEnd: text("business_hours_end").default("18:00").notNull(),

    // Filtros e segmentação
    targetGroups: text("target_groups").array().default([]).notNull(), // IDs dos grupos alvo
    excludeGroups: text("exclude_groups").array().default([]).notNull(), // IDs dos grupos a excluir

    // Estatísticas (Calculadas ou atualizadas por workers/triggers)
    totalContacts: integer("total_contacts").default(0).notNull(), // Total de contatos na segmentação
    messagesQueued: integer("messages_queued").default(0).notNull(), // Total de mensagens adicionadas à fila
    messagesSent: integer("messages_sent").default(0).notNull(), // Total de mensagens enviadas pela API
    messagesDelivered: integer("messages_delivered").default(0).notNull(), // Total de mensagens entregues (webhook)
    messagesRead: integer("messages_read").default(0).notNull(), // Total de mensagens lidas (webhook)
    messagesFailed: integer("messages_failed").default(0).notNull(), // Total de mensagens que falharam após retentativas
    progressPercentage: integer("progress_percentage").default(0).notNull(), // Progresso calculado (messagesSent / totalContacts) * 100

    // Estimativas e custos (Opcional, pode ser calculado no frontend ou worker)
    estimatedCost: integer("estimated_cost").default(0).notNull(), // em centavos
    actualCost: integer("actual_cost").default(0).notNull(), // em centavos

    // Metadados
    settings: jsonb("settings").default({}).notNull(), // Configurações adicionais em JSON
    variables: jsonb("variables").default({}).notNull(), // Variáveis globais da campanha

    // Auditoria
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => new Date())
      .notNull(),
    deletedAt: timestamp("deleted_at"), // Soft delete
  },
  (campaigns) => ({
    userIdIdx: index("campaigns_user_id_idx").on(campaigns.userId),
    instanceIdIdx: index("campaigns_instance_id_idx").on(campaigns.instanceId),
    statusIdx: index("campaigns_status_idx").on(campaigns.status),
    scheduleIdx: index("campaigns_schedule_idx").on(campaigns.scheduleAt),
    createdAtIdx: index("campaigns_created_at_idx").on(campaigns.createdAt),
    deletedIdx: index("campaigns_deleted_idx").on(campaigns.deletedAt),
  }),
);

// ================================
// TABELAS DE CONTATOS
// ================================

export const contactGroupsTables = pgTable(
  "contact_groups_tables",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => usersTables.id, { onDelete: "cascade" }),

    name: text("name").notNull(),
    description: text("description"),
    color: text("color").default("#3b82f6").notNull(), // Cor para identificação

    // Configurações do grupo
    isDefault: boolean("is_default").default(false).notNull(),
    isSystemGroup: boolean("is_system_group").default(false).notNull(), // Para grupos especiais

    // Estatísticas (Calculadas ou atualizadas por triggers/workers)
    totalContacts: integer("total_contacts").default(0).notNull(),
    activeContacts: integer("active_contacts").default(0).notNull(),

    // Tags e categorização
    tags: text("tags").array().default([]).notNull(),

    // Auditoria
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => new Date())
      .notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (groups) => ({
    userIdIdx: index("contact_groups_user_id_idx").on(groups.userId),
    nameIdx: index("contact_groups_name_idx").on(groups.name),
    defaultIdx: index("contact_groups_default_idx").on(groups.isDefault),
    deletedIdx: index("contact_groups_deleted_idx").on(groups.deletedAt),
    userNameUnique: unique("contact_groups_user_name_unique").on(
      groups.userId,
      groups.name,
    ),
  }),
);

export const contactsTables = pgTable(
  "contacts_tables",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => usersTables.id, { onDelete: "cascade" }),

    // Informações do contato
    name: text("name"),
    firstName: text("first_name"),
    lastName: text("last_name"),
    phoneNumber: text("phone_number").notNull(),
    email: text("email"),

    // Informações adicionais
    company: text("company"),
    position: text("position"),
    birthDate: timestamp("birth_date"),
    notes: text("notes"),

    // Dados adicionais
    customFields: jsonb("custom_fields").default({}).notNull(), // Campos personalizados
    tags: text("tags").array().default([]).notNull(), // Tags para classificação

    // Endereço
    address: jsonb("address").default({}).notNull(), // JSON com endereço completo

    // Status e validação
    isActive: boolean("is_active").default(true).notNull(),
    isBlocked: boolean("is_blocked").default(false).notNull(),
    isValidated: boolean("is_validated").default(false).notNull(),
    validatedAt: timestamp("validated_at"),

    // Opt-out e privacidade
    hasOptedOut: boolean("has_opted_out").default(false).notNull(),
    optedOutAt: timestamp("opted_out_at"),
    gdprConsent: boolean("gdpr_consent").default(false).notNull(),
    consentDate: timestamp("consent_date"),

    // Estatísticas de interação (Calculadas ou atualizadas por workers/triggers)
    totalMessagesSent: integer("total_messages_sent").default(0).notNull(),
    totalMessagesReceived: integer("total_messages_received")
      .default(0)
      .notNull(),
    totalCampaigns: integer("total_campaigns").default(0).notNull(),
    lastMessageAt: timestamp("last_message_at"),
    lastCampaignAt: timestamp("last_campaign_at"),

    // Pontuação de engajamento (Calculada ou atualizada por workers/triggers)
    engagementScore: integer("engagement_score").default(0).notNull(), // 0-100

    // Origem do contato
    source: text("source"), // manual, import, api, form, etc.
    sourceDetails: jsonb("source_details").default({}).notNull(),

    // Auditoria
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => new Date())
      .notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (contacts) => ({
    userIdIdx: index("contacts_user_id_idx").on(contacts.userId),
    phoneIdx: index("contacts_phone_idx").on(contacts.phoneNumber),
    nameIdx: index("contacts_name_idx").on(contacts.name),
    emailIdx: index("contacts_email_idx").on(contacts.email),
    activeIdx: index("contacts_active_idx").on(contacts.isActive),
    validatedIdx: index("contacts_validated_idx").on(contacts.isValidated),
    blockedIdx: index("contacts_blocked_idx").on(contacts.isBlocked),
    deletedIdx: index("contacts_deleted_idx").on(contacts.deletedAt),
    createdAtIdx: index("contacts_created_at_idx").on(contacts.createdAt),
    userPhoneUnique: unique("contacts_user_phone_unique").on(
      contacts.userId,
      contacts.phoneNumber,
    ),
  }),
);

// Tabela de relacionamento N:N entre contatos e grupos
export const contactGroupMembersTables = pgTable(
  "contact_group_members_tables",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    contactId: text("contact_id")
      .notNull()
      .references(() => contactsTables.id, { onDelete: "cascade" }),
    groupId: text("group_id")
      .notNull()
      .references(() => contactGroupsTables.id, { onDelete: "cascade" }),

    // Dados adicionais da associação
    addedBy: text("added_by"), // ID do usuário que adicionou
    isActive: boolean("is_active").default(true).notNull(), // Definir default e notNull

    // Auditoria
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (members) => ({
    contactGroupUnique: unique("contact_group_unique").on(
      members.contactId,
      members.groupId,
    ),
    contactIdx: index("contact_group_members_contact_idx").on(
      members.contactId,
    ),
    groupIdx: index("contact_group_members_group_idx").on(members.groupId),
    activeIdx: index("contact_group_members_active_idx").on(members.isActive),
  }),
);

// ================================
// TABELAS DE TEMPLATES
// ================================

export const templatesTables = pgTable(
  "templates_tables",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => usersTables.id, { onDelete: "cascade" }),

    // Informações do template
    name: text("name").notNull(),
    description: text("description"),
    type: templateTypeEnum("type").default("text").notNull(),
    category: text("category").default("general").notNull(), // marketing, support, notification

    // Conteúdo
    content: text("content").notNull(),
    mediaUrl: text("media_url"), // Para imagens, vídeos, etc.
    fileName: text("file_name"), // Nome original do arquivo
    fileType: text("file_type"), // MIME type
    fileSize: integer("file_size"), // Tamanho em bytes

    // Para templates de lista e botões
    buttons: jsonb("buttons"), // Configuração dos botões
    listSections: jsonb("list_sections"), // Seções da lista

    // Variáveis disponíveis no template
    variables: text("variables").array().default([]).notNull(), // Ex: ["nome", "empresa"]
    requiredVariables: text("required_variables").array().default([]).notNull(), // Variáveis obrigatórias

    // Configurações
    isActive: boolean("is_active").default(true).notNull(),
    isDefault: boolean("is_default").default(false).notNull(),
    isSystemTemplate: boolean("is_system_template").default(false).notNull(),

    // Aprovação e moderação (Se aplicável, ex: WhatsApp Business API templates)
    isApproved: boolean("is_approved").default(true).notNull(), // Assume true por padrão para integrações não-oficiais
    approvedBy: text("approved_by"),
    approvedAt: timestamp("approved_at"),
    rejectionReason: text("rejection_reason"),

    // Estatísticas (Calculadas ou atualizadas por workers/triggers)
    timesUsed: integer("times_used").default(0).notNull(),
    successRate: integer("success_rate").default(0).notNull(), // Porcentagem de sucesso (0-100)
    avgDeliveryTime: integer("avg_delivery_time").default(0).notNull(), // Em segundos
    lastUsedAt: timestamp("last_used_at"),

    // SEO e busca
    tags: text("tags").array().default([]).notNull(),
    searchKeywords: text("search_keywords"),

    // Auditoria
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => new Date())
      .notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (templates) => ({
    userIdIdx: index("templates_user_id_idx").on(templates.userId),
    typeIdx: index("templates_type_idx").on(templates.type),
    categoryIdx: index("templates_category_idx").on(templates.category),
    activeIdx: index("templates_active_idx").on(templates.isActive),
    approvedIdx: index("templates_approved_idx").on(templates.isApproved),
    deletedIdx: index("templates_deleted_idx").on(templates.deletedAt),
    timesUsedIdx: index("templates_times_used_idx").on(templates.timesUsed),
  }),
);

// ================================
// TABELAS DE CAMPANHAS E CONTATOS (MENSAGENS INDIVIDUAIS)
// ================================

export const campaignContactsTables = pgTable(
  "campaign_contacts_tables",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => campaignsTables.id, { onDelete: "cascade" }),
    contactId: text("contact_id")
      .notNull()
      .references(() => contactsTables.id, { onDelete: "cascade" }),

    // Status do envio para este contato
    status: messageStatusEnum("status").default("pending").notNull(),
    priority: integer("priority").default(1).notNull(), // 1-5, 1 sendo maior prioridade

    // Dados da mensagem personalizada
    personalizedContent: text("personalized_content"), // Conteúdo com variáveis substituídas
    variables: jsonb("variables").default({}).notNull(), // Variáveis específicas deste contato
    mediaUrl: text("media_url"), // URL da mídia personalizada se houver
    // Adicionar campos para tipos de template específicos se necessário (ex: buttons, list_sections)
    buttons: jsonb("buttons"),
    listSections: jsonb("list_sections"),

    // Tentativas e erros
    attempts: integer("attempts").default(0).notNull(),
    maxAttempts: integer("max_attempts").default(3).notNull(),
    lastAttemptAt: timestamp("last_attempt_at"),
    nextAttemptAt: timestamp("next_attempt_at"), // Usado para agendar retentativas
    errorMessage: text("error_message"),
    errorCode: text("error_code"),

    // IDs de mensagem do WhatsApp (API Externa)
    messageId: text("message_id"), // ID da mensagem retornado pela API externa
    remoteJid: text("remote_jid"), // JID do contato no WhatsApp (pode ser diferente do phoneNumber)

    // Timestamps de status
    queuedAt: timestamp("queued_at"), // Quando foi adicionada à fila do worker
    processingAt: timestamp("processing_at"), // Quando o worker começou a processar
    sentAt: timestamp("sent_at"), // Quando a API externa retornou sucesso
    deliveredAt: timestamp("delivered_at"), // Quando o webhook de entrega foi recebido
    readAt: timestamp("read_at"), // Quando o webhook de leitura foi recebido
    failedAt: timestamp("failed_at"), // Quando falhou após retentativas
    cancelledAt: timestamp("cancelled_at"), // Quando foi cancelada

    // Métricas de entrega (Calculadas)
    deliveryTime: integer("delivery_time"), // Tempo para entrega em segundos (sentAt - queuedAt) ou (deliveredAt - sentAt) dependendo da definição
    readTime: integer("read_time"), // Tempo para leitura em segundos (readAt - deliveredAt)

    // Auditoria
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (campaignContacts) => ({
    campaignIdx: index("campaign_contacts_campaign_idx").on(
      campaignContacts.campaignId,
    ),
    contactIdx: index("campaign_contacts_contact_idx").on(
      campaignContacts.contactId,
    ),
    statusIdx: index("campaign_contacts_status_idx").on(
      campaignContacts.status,
    ),
    priorityIdx: index("campaign_contacts_priority_idx").on(
      campaignContacts.priority,
    ),
    nextAttemptIdx: index("campaign_contacts_next_attempt_idx").on(
      campaignContacts.nextAttemptAt,
    ),
    messageIdIdx: index("campaign_contacts_message_id_idx").on(
      campaignContacts.messageId,
    ),
    campaignContactUnique: unique("campaign_contact_unique").on(
      campaignContacts.campaignId,
      campaignContacts.contactId,
    ),
  }),
);

// ================================
// TABELAS DE ATIVIDADES
// ================================

export const activitiesTables = pgTable(
  "activities_tables",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => usersTables.id, { onDelete: "cascade" }),

    // Informações da atividade
    type: activityTypeEnum("type").notNull(),
    status: activityStatusEnum("status").notNull(),
    title: text("title").notNull(),
    description: text("description"),

    // Referências opcionais
    campaignId: text("campaign_id").references(() => campaignsTables.id, {
      onDelete: "set null",
    }),
    instanceId: text("instance_id").references(
      () => instancesTables.instanceId,
      { onDelete: "set null" },
    ),
    contactId: text("contact_id").references(() => contactsTables.id, {
      onDelete: "set null",
    }),
    templateId: text("template_id").references(() => templatesTables.id, {
      onDelete: "set null",
    }),
    // Adicionar referência para campaign_contact_id se a atividade for específica de uma mensagem
    campaignContactId: text("campaign_contact_id").references(
      () => campaignContactsTables.id,
      {
        onDelete: "set null",
      },
    ),

    // Dados adicionais
    metadata: jsonb("metadata").default({}).notNull(), // Dados específicos da atividade
    tags: text("tags").array().default([]).notNull(),

    // Impacto e importância
    severity: text("severity").default("low").notNull(), // low, medium, high, critical
    isRead: boolean("is_read").default(false).notNull(),
    isArchived: boolean("is_archived").default(false).notNull(),

    // Duração (para atividades que têm início e fim)
    startedAt: timestamp("started_at"),
    endedAt: timestamp("ended_at"),
    duration: integer("duration"), // Em segundos

    // Auditoria
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (activities) => ({
    userIdIdx: index("activities_user_id_idx").on(activities.userId),
    typeIdx: index("activities_type_idx").on(activities.type),
    statusIdx: index("activities_status_idx").on(activities.status),
    severityIdx: index("activities_severity_idx").on(activities.severity),
    readIdx: index("activities_read_idx").on(activities.isRead),
    archivedIdx: index("activities_archived_idx").on(activities.isArchived),
    createdAtIdx: index("activities_created_at_idx").on(activities.createdAt),
    campaignIdx: index("activities_campaign_idx").on(activities.campaignId),
    instanceIdx: index("activities_instance_idx").on(activities.instanceId),
    contactIdx: index("activities_contact_idx").on(activities.contactId),
    campaignContactIdx: index("activities_campaign_contact_idx").on(
      activities.campaignContactId,
    ), // Novo índice
  }),
);

// ================================
// TABELAS DE IMPORTAÇÃO
// ================================

export const contactImportsTables = pgTable(
  "contact_imports_tables",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => usersTables.id, { onDelete: "cascade" }),

    // Informações da importação
    fileName: text("file_name").notNull(),
    originalFileName: text("original_file_name").notNull(),
    fileSize: integer("file_size").notNull(),
    fileType: text("file_type").notNull(), // csv, xlsx, etc.

    // Status e progresso
    status: importStatusEnum("status").default("pending").notNull(),
    totalRows: integer("total_rows").default(0).notNull(),
    processedRows: integer("processed_rows").default(0).notNull(),
    successfulRows: integer("successful_rows").default(0).notNull(),
    failedRows: integer("failed_rows").default(0).notNull(),
    skippedRows: integer("skipped_rows").default(0).notNull(),

    // Configurações da importação
    groupIds: text("group_ids").array().default([]).notNull(), // Grupos para adicionar os contatos
    skipDuplicates: boolean("skip_duplicates").default(true).notNull(),
    validateNumbers: boolean("validate_numbers").default(true).notNull(),
    fieldMapping: jsonb("field_mapping").default({}).notNull(), // Mapeamento dos campos

    // Resultados e erros
    errors: jsonb("errors").default([]).notNull(), // Lista de erros encontrados
    warnings: jsonb("warnings").default([]).notNull(), // Lista de avisos

    // Progresso
    progressPercentage: integer("progress_percentage").default(0).notNull(),
    estimatedTimeRemaining: integer("estimated_time_remaining"), // Em segundos

    // Auditoria
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (imports) => ({
    userIdIdx: index("contact_imports_user_id_idx").on(imports.userId),
    statusIdx: index("contact_imports_status_idx").on(imports.status),
    createdAtIdx: index("contact_imports_created_at_idx").on(imports.createdAt),
  }),
);

// ================================
// TABELAS DE SESSÕES E CONTAS (Mantidas)
// ================================

export const sessionsTables = pgTable("sessions_tables", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => usersTables.id, { onDelete: "cascade" }),
});

export const accountsTables = pgTable("accounts_tables", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => usersTables.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const verificationsTables = pgTable("verifications_tables", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").$defaultFn(() => new Date()),
  updatedAt: timestamp("updated_at").$defaultFn(() => new Date()),
});

// ================================
// RELAÇÕES
// ================================

export const usersRelations = relations(usersTables, ({ many }) => ({
  instances: many(instancesTables),
  sessions: many(sessionsTables),
  accounts: many(accountsTables),
  campaigns: many(campaignsTables),
  contacts: many(contactsTables),
  contactGroups: many(contactGroupsTables),
  templates: many(templatesTables),
  activities: many(activitiesTables),
  contactImports: many(contactImportsTables),
}));

export const instancesRelations = relations(
  instancesTables,
  ({ one, many }) => ({
    user: one(usersTables, {
      fields: [instancesTables.userId],
      references: [usersTables.id],
    }),
    campaigns: many(campaignsTables),
    activities: many(activitiesTables),
  }),
);

export const campaignsRelations = relations(
  campaignsTables,
  ({ one, many }) => ({
    user: one(usersTables, {
      fields: [campaignsTables.userId],
      references: [usersTables.id],
    }),
    instance: one(instancesTables, {
      fields: [campaignsTables.instanceId],
      references: [instancesTables.instanceId],
    }),
    template: one(templatesTables, {
      fields: [campaignsTables.templateId],
      references: [templatesTables.id],
    }),
    campaignContacts: many(campaignContactsTables),
    activities: many(activitiesTables),
  }),
);

export const contactsRelations = relations(contactsTables, ({ one, many }) => ({
  user: one(usersTables, {
    fields: [contactsTables.userId],
    references: [usersTables.id],
  }),
  groupMembers: many(contactGroupMembersTables),
  campaignContacts: many(campaignContactsTables),
  activities: many(activitiesTables),
}));

export const contactGroupsRelations = relations(
  contactGroupsTables,
  ({ one, many }) => ({
    user: one(usersTables, {
      fields: [contactGroupsTables.userId],
      references: [usersTables.id],
    }),
    members: many(contactGroupMembersTables),
  }),
);

export const contactGroupMembersRelations = relations(
  contactGroupMembersTables,
  ({ one }) => ({
    contact: one(contactsTables, {
      fields: [contactGroupMembersTables.contactId],
      references: [contactsTables.id],
    }),
    group: one(contactGroupsTables, {
      fields: [contactGroupMembersTables.groupId],
      references: [contactGroupsTables.id],
    }),
  }),
);

export const templatesRelations = relations(
  templatesTables,
  ({ one, many }) => ({
    user: one(usersTables, {
      fields: [templatesTables.userId],
      references: [usersTables.id],
    }),
    campaigns: many(campaignsTables),
    activities: many(activitiesTables),
  }),
);

export const campaignContactsRelations = relations(
  campaignContactsTables,
  ({ one, many }) => ({
    campaign: one(campaignsTables, {
      fields: [campaignContactsTables.campaignId],
      references: [campaignsTables.id],
    }),
    contact: one(contactsTables, {
      fields: [campaignContactsTables.contactId],
      references: [contactsTables.id],
    }),
    activities: many(activitiesTables), // Adicionar relação com activities
  }),
);

export const activitiesRelations = relations(activitiesTables, ({ one }) => ({
  user: one(usersTables, {
    fields: [activitiesTables.userId],
    references: [usersTables.id],
  }),
  campaign: one(campaignsTables, {
    fields: [activitiesTables.campaignId],
    references: [campaignsTables.id],
  }),
  instance: one(instancesTables, {
    fields: [activitiesTables.instanceId],
    references: [instancesTables.instanceId],
  }),
  contact: one(contactsTables, {
    fields: [activitiesTables.contactId],
    references: [contactsTables.id],
  }),
  template: one(templatesTables, {
    fields: [activitiesTables.templateId],
    references: [templatesTables.id],
  }),
  campaignContact: one(campaignContactsTables, {
    // Nova relação
    fields: [activitiesTables.campaignContactId],
    references: [campaignContactsTables.id],
  }),
}));

export const contactImportsRelations = relations(
  contactImportsTables,
  ({ one }) => ({
    user: one(usersTables, {
      fields: [contactImportsTables.userId],
      references: [usersTables.id],
    }),
  }),
);

export const sessionsRelations = relations(sessionsTables, ({ one }) => ({
  user: one(usersTables, {
    fields: [sessionsTables.userId],
    references: [usersTables.id],
  }),
}));

export const accountsRelations = relations(accountsTables, ({ one }) => ({
  user: one(usersTables, {
    fields: [accountsTables.userId],
    references: [usersTables.id],
  }),
}));

// ================================
// SCHEMAS DE VALIDAÇÃO ZOD
// ================================

export const CreateInstanceSchema = z.object({
  instanceName: z.string().min(1, "Nome da instância é obrigatório").max(50),
  webhookUrl: z.string().url().optional().or(z.literal("")),
  webhookEnabled: z.boolean().default(false),
});

export const CreateCampaignSchema = z.object({
  name: z.string().min(1, "Nome da campanha é obrigatório").max(100),
  description: z.string().max(500).optional(),
  instanceId: z.string().optional(), // Pode ser null/undefined inicialmente se a instância for selecionada depois
  templateId: z.string().optional(), // Pode ser null/undefined inicialmente se o template for selecionado depois
  scheduleAt: z.date().optional().nullable(), // Permitir null
  sendDelay: z.number().int().min(100).max(60000).default(1000),
  maxRetriesPerMessage: z.number().int().min(0).max(5).default(3),
  enableScheduling: z.boolean().default(false),
  sendOnlyBusinessHours: z.boolean().default(false),
  businessHoursStart: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Formato de hora inválido (HH:mm)")
    .default("09:00"),
  businessHoursEnd: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Formato de hora inválido (HH:mm)")
    .default("18:00"),
  targetGroups: z.array(z.string()).optional().default([]),
  excludeGroups: z.array(z.string()).optional().default([]),
  settings: z.record(z.any()).optional().default({}),
  variables: z.record(z.any()).optional().default({}),
});

export const CreateContactSchema = z.object({
  name: z.string().min(1).max(100).optional(), // Nome pode ser opcional se firstName/lastName existirem
  firstName: z.string().max(50).optional(),
  lastName: z.string().max(50).optional(),
  phoneNumber: z.string().min(9, "Número de telefone inválido").max(15), // Adicionar validação de formato de telefone mais robusta se necessário
  email: z
    .string()
    .email("Formato de email inválido")
    .optional()
    .or(z.literal("")),
  company: z.string().max(100).optional(),
  position: z.string().max(100).optional(),
  birthDate: z.date().optional().nullable(),
  notes: z.string().max(1000).optional(),
  customFields: z.record(z.any()).optional().default({}),
  tags: z.array(z.string()).optional().default([]),
  address: z.record(z.any()).optional().default({}),
  groupIds: z.array(z.string()).optional().default([]), // IDs dos grupos para adicionar o contato
  source: z.string().optional(),
  sourceDetails: z.record(z.any()).optional().default({}),
  gdprConsent: z.boolean().default(false),
});

export const CreateContactGroupSchema = z.object({
  name: z.string().min(1, "Nome do grupo é obrigatório").max(50),
  description: z.string().max(500).optional(),
  color: z
    .string()
    .regex(/^#[0-9A-F]{6}$/i, "Formato de cor inválido (HEX)")
    .default("#3b82f6"),
  tags: z.array(z.string()).optional().default([]),
});

export const CreateTemplateSchema = z.object({
  name: z.string().min(1, "Nome do template é obrigatório").max(100),
  description: z.string().max(500).optional(),
  type: z
    .enum(templateTypeEnum.enumValues) // Usar enumValues do drizzle
    .default("text"),
  category: z.string().max(50).default("general"),
  content: z.string().min(1, "Conteúdo é obrigatório"),
  mediaUrl: z.string().url("URL inválida").optional().or(z.literal("")),
  fileName: z.string().optional(),
  buttons: z.array(z.any()).optional().default([]), // Definir default como array vazio
  listSections: z.array(z.any()).optional().default([]), // Definir default como array vazio
  variables: z.array(z.string()).optional().default([]),
  requiredVariables: z.array(z.string()).optional().default([]),
  tags: z.array(z.string()).optional().default([]),
  searchKeywords: z.string().optional(),
});

export const UpdateCampaignStatusSchema = z.object({
  status: z.enum(campaignStatusEnum.enumValues), // Usar enumValues do drizzle
});

export const ImportContactsSchema = z.object({
  fileName: z.string().min(1),
  originalFileName: z.string().min(1),
  fileSize: z.number().int().min(1),
  fileType: z.enum(["csv", "xlsx", "xls"]),
  groupIds: z.array(z.string()).optional().default([]),
  skipDuplicates: z.boolean().default(true),
  validateNumbers: z.boolean().default(true),
  fieldMapping: z.record(z.string()).optional().default({}),
});

// ================================
// TIPOS TYPESCRIPT
// ================================

// Usar inferSelect e inferInsert para obter os tipos diretamente do schema
export type User = typeof usersTables.$inferSelect;
export type NewUser = typeof usersTables.$inferInsert;

export type Instance = typeof instancesTables.$inferSelect;
export type NewInstance = typeof instancesTables.$inferInsert;

export type Campaign = typeof campaignsTables.$inferSelect;
export type NewCampaign = typeof campaignsTables.$inferInsert;

export type Contact = typeof contactsTables.$inferSelect;
export type NewContact = typeof contactsTables.$inferInsert;

export type ContactGroup = typeof contactGroupsTables.$inferSelect;
export type NewContactGroup = typeof contactGroupsTables.$inferInsert;

export type ContactGroupMember = typeof contactGroupMembersTables.$inferSelect;
export type NewContactGroupMember =
  typeof contactGroupMembersTables.$inferInsert;

export type Template = typeof templatesTables.$inferSelect;
export type NewTemplate = typeof templatesTables.$inferInsert;

export type CampaignContact = typeof campaignContactsTables.$inferSelect;
export type NewCampaignContact = typeof campaignContactsTables.$inferInsert;

export type CreateCampaignInput = z.infer<typeof CreateCampaignSchema>;
export type UpdateCampaignInput = z.infer<typeof CreateCampaignSchema>;

export type Activity = typeof activitiesTables.$inferSelect;
export type NewActivity = typeof activitiesTables.$inferInsert;

export type ContactImport = typeof contactImportsTables.$inferSelect;
export type NewContactImport = typeof contactImportsTables.$inferInsert;

// Tipos para os enums, usando os próprios enums do drizzle
export type CampaignStatus = (typeof campaignStatusEnum.enumValues)[number];
export type MessageStatus = (typeof messageStatusEnum.enumValues)[number];
export type ActivityType = (typeof activityTypeEnum.enumValues)[number];
export type ActivityStatus = (typeof activityStatusEnum.enumValues)[number];
export type TemplateType = (typeof templateTypeEnum.enumValues)[number];
export type ImportStatus = (typeof importStatusEnum.enumValues)[number];
