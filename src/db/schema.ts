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
  "pending", // Pendente
  "queued", // Na fila
  "sent", // Enviada
  "delivered", // Entregue
  "read", // Lida
  "failed", // Falhou
  "cancelled", // Cancelada
]);

export const activityTypeEnum = pgEnum("activity_type", [
  "campaign_created",
  "campaign_started",
  "campaign_completed",
  "campaign_paused",
  "campaign_cancelled",
  "instance_connected",
  "instance_disconnected",
  "instance_error",
  "message_sent",
  "message_failed",
  "contact_imported",
  "contact_validated",
  "template_created",
  "template_updated",
  "limit_reached",
  "system_error",
  "webhook_received",
]);

export const activityStatusEnum = pgEnum("activity_status", [
  "success",
  "warning",
  "error",
  "info",
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
  plan: text("plan").default("free"),

  // Configurações do usuário
  timezone: text("timezone").default("America/Sao_Paulo"),
  dailyMessageLimit: integer("daily_message_limit").default(1000),
  monthlyMessageLimit: integer("monthly_message_limit").default(10000),
  isActive: boolean("is_active").default(true),

  // Estatísticas
  totalCampaigns: integer("total_campaigns").default(0),
  totalContacts: integer("total_contacts").default(0),
  totalMessagesSent: integer("total_messages_sent").default(0),

  // Configurações avançadas
  settings: jsonb("settings"), // Configurações em JSON

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
    status: text("status"),
    ownerJid: text("owner_jid"),
    profileName: text("profile_name"),
    profilePicUrl: text("profile_pic_url"),
    qrcode: boolean("qrcode").default(true),
    phoneNumber: text("phone_number"),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => new Date())
      .notNull(),

    // Estatísticas da instância
    totalMessagesSent: integer("total_messages_sent").default(0),
    dailyMessagesSent: integer("daily_messages_sent").default(0),
    monthlyMessagesSent: integer("monthly_messages_sent").default(0),
    lastMessageSentAt: timestamp("last_message_sent_at"),
    lastResetAt: timestamp("last_reset_at").$defaultFn(() => new Date()),

    // Status de conexão
    isConnected: boolean("is_connected").default(false),
    lastConnectedAt: timestamp("last_connected_at"),
    disconnectedAt: timestamp("disconnected_at"),

    // Configurações da instância
    webhookUrl: text("webhook_url"),
    webhookEnabled: boolean("webhook_enabled").default(false),

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
    scheduleAt: timestamp("schedule_at"),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    pausedAt: timestamp("paused_at"),
    cancelledAt: timestamp("cancelled_at"),

    // Configurações avançadas
    sendDelay: integer("send_delay").default(1000), // ms entre mensagens
    maxRetriesPerMessage: integer("max_retries_per_message").default(3),
    enableScheduling: boolean("enable_scheduling").default(false),
    sendOnlyBusinessHours: boolean("send_only_business_hours").default(false),
    businessHoursStart: text("business_hours_start").default("09:00"),
    businessHoursEnd: text("business_hours_end").default("18:00"),

    // Filtros e segmentação
    targetGroups: text("target_groups").array(), // IDs dos grupos alvo
    excludeGroups: text("exclude_groups").array(), // IDs dos grupos a excluir

    // Estatísticas
    totalContacts: integer("total_contacts").default(0),
    messagesSent: integer("messages_sent").default(0),
    messagesDelivered: integer("messages_delivered").default(0),
    messagesRead: integer("messages_read").default(0),
    messagesFailed: integer("messages_failed").default(0),
    messagesQueued: integer("messages_queued").default(0),

    // Estimativas e custos
    estimatedCost: integer("estimated_cost").default(0), // em centavos
    actualCost: integer("actual_cost").default(0), // em centavos

    // Metadados
    settings: jsonb("settings"), // Configurações adicionais em JSON
    variables: jsonb("variables"), // Variáveis globais da campanha

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
    color: text("color").default("#3b82f6"), // Cor para identificação

    // Configurações do grupo
    isDefault: boolean("is_default").default(false),
    isSystemGroup: boolean("is_system_group").default(false), // Para grupos especiais

    // Estatísticas
    totalContacts: integer("total_contacts").default(0),
    activeContacts: integer("active_contacts").default(0),

    // Tags e categorização
    tags: text("tags").array(),

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
    customFields: jsonb("custom_fields"), // Campos personalizados
    tags: text("tags").array(), // Tags para classificação

    // Endereço
    address: jsonb("address"), // JSON com endereço completo

    // Status e validação
    isActive: boolean("is_active").default(true),
    isBlocked: boolean("is_blocked").default(false),
    isValidated: boolean("is_validated").default(false),
    validatedAt: timestamp("validated_at"),

    // Opt-out e privacidade
    hasOptedOut: boolean("has_opted_out").default(false),
    optedOutAt: timestamp("opted_out_at"),
    gdprConsent: boolean("gdpr_consent").default(false),
    consentDate: timestamp("consent_date"),

    // Estatísticas de interação
    totalMessagesSent: integer("total_messages_sent").default(0),
    totalMessagesReceived: integer("total_messages_received").default(0),
    totalCampaigns: integer("total_campaigns").default(0),
    lastMessageAt: timestamp("last_message_at"),
    lastCampaignAt: timestamp("last_campaign_at"),

    // Pontuação de engajamento
    engagementScore: integer("engagement_score").default(0), // 0-100

    // Origem do contato
    source: text("source"), // manual, import, api, form, etc.
    sourceDetails: jsonb("source_details"),

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
    isActive: boolean("is_active").default(true),

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
    category: text("category").default("general"), // marketing, support, notification

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
    variables: text("variables").array(), // Ex: ["nome", "empresa"]
    requiredVariables: text("required_variables").array(), // Variáveis obrigatórias

    // Configurações
    isActive: boolean("is_active").default(true),
    isDefault: boolean("is_default").default(false),
    isSystemTemplate: boolean("is_system_template").default(false),

    // Aprovação e moderação
    isApproved: boolean("is_approved").default(true),
    approvedBy: text("approved_by"),
    approvedAt: timestamp("approved_at"),
    rejectionReason: text("rejection_reason"),

    // Estatísticas
    timesUsed: integer("times_used").default(0),
    successRate: integer("success_rate").default(0), // Porcentagem de sucesso
    avgDeliveryTime: integer("avg_delivery_time").default(0), // Em segundos
    lastUsedAt: timestamp("last_used_at"),

    // SEO e busca
    tags: text("tags").array(),
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
// TABELAS DE CAMPANHAS E CONTATOS
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
    priority: integer("priority").default(1), // 1-5, 1 sendo maior prioridade

    // Dados da mensagem personalizada
    personalizedContent: text("personalized_content"), // Conteúdo com variáveis substituídas
    variables: jsonb("variables"), // Variáveis específicas deste contato
    mediaUrl: text("media_url"), // URL da mídia personalizada se houver

    // Tentativas e erros
    attempts: integer("attempts").default(0),
    maxAttempts: integer("max_attempts").default(3),
    lastAttemptAt: timestamp("last_attempt_at"),
    nextAttemptAt: timestamp("next_attempt_at"),
    errorMessage: text("error_message"),
    errorCode: text("error_code"),

    // IDs de mensagem do WhatsApp
    messageId: text("message_id"), // ID da mensagem no WhatsApp
    remoteJid: text("remote_jid"), // JID do contato no WhatsApp

    // Timestamps de status
    queuedAt: timestamp("queued_at"),
    sentAt: timestamp("sent_at"),
    deliveredAt: timestamp("delivered_at"),
    readAt: timestamp("read_at"),
    failedAt: timestamp("failed_at"),
    cancelledAt: timestamp("cancelled_at"),

    // Métricas de entrega
    deliveryTime: integer("delivery_time"), // Tempo para entrega em segundos
    readTime: integer("read_time"), // Tempo para leitura em segundos

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

    // Dados adicionais
    metadata: jsonb("metadata"), // Dados específicos da atividade
    tags: text("tags").array(),

    // Impacto e importância
    severity: text("severity").default("low"), // low, medium, high, critical
    isRead: boolean("is_read").default(false),
    isArchived: boolean("is_archived").default(false),

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
    totalRows: integer("total_rows").default(0),
    processedRows: integer("processed_rows").default(0),
    successfulRows: integer("successful_rows").default(0),
    failedRows: integer("failed_rows").default(0),
    skippedRows: integer("skipped_rows").default(0),

    // Configurações da importação
    groupIds: text("group_ids").array(), // Grupos para adicionar os contatos
    skipDuplicates: boolean("skip_duplicates").default(true),
    validateNumbers: boolean("validate_numbers").default(true),
    fieldMapping: jsonb("field_mapping"), // Mapeamento dos campos

    // Resultados e erros
    errors: jsonb("errors"), // Lista de erros encontrados
    warnings: jsonb("warnings"), // Lista de avisos

    // Progresso
    progressPercentage: integer("progress_percentage").default(0),
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
  ({ one }) => ({
    campaign: one(campaignsTables, {
      fields: [campaignContactsTables.campaignId],
      references: [campaignsTables.id],
    }),
    contact: one(contactsTables, {
      fields: [campaignContactsTables.contactId],
      references: [contactsTables.id],
    }),
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
  instanceId: z.string().optional(),
  templateId: z.string().optional(),
  scheduleAt: z.date().optional(),
  sendDelay: z.number().min(100).max(60000).default(1000),
  maxRetriesPerMessage: z.number().min(0).max(5).default(3),
  enableScheduling: z.boolean().default(false),
  sendOnlyBusinessHours: z.boolean().default(false),
  businessHoursStart: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .default("09:00"),
  businessHoursEnd: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .default("18:00"),
  targetGroups: z.array(z.string()).optional(),
  excludeGroups: z.array(z.string()).optional(),
  settings: z.record(z.any()).optional(),
  variables: z.record(z.any()).optional(),
});

export const CreateContactSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  firstName: z.string().max(50).optional(),
  lastName: z.string().max(50).optional(),
  phoneNumber: z.string().min(9, "Número de telefone inválido").max(15),
  email: z.string().email().optional().or(z.literal("")),
  company: z.string().max(100).optional(),
  position: z.string().max(100).optional(),
  birthDate: z.date().optional(),
  notes: z.string().max(1000).optional(),
  customFields: z.record(z.any()).optional(),
  tags: z.array(z.string()).optional(),
  address: z.record(z.any()).optional(),
  groupIds: z.array(z.string()).optional(),
  source: z.string().optional(),
  sourceDetails: z.record(z.any()).optional(),
  gdprConsent: z.boolean().default(false),
});

export const CreateContactGroupSchema = z.object({
  name: z.string().min(1, "Nome do grupo é obrigatório").max(50),
  description: z.string().max(500).optional(),
  color: z
    .string()
    .regex(/^#[0-9A-F]{6}$/i)
    .default("#3b82f6"),
  tags: z.array(z.string()).optional(),
});

export const CreateTemplateSchema = z.object({
  name: z.string().min(1, "Nome do template é obrigatório").max(100),
  description: z.string().max(500).optional(),
  type: z
    .enum([
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
    ])
    .default("text"),
  category: z.string().max(50).default("general"),
  content: z.string().min(1, "Conteúdo é obrigatório"),
  mediaUrl: z.string().url().optional().or(z.literal("")),
  fileName: z.string().optional(),
  buttons: z.array(z.any()).optional(),
  listSections: z.array(z.any()).optional(),
  variables: z.array(z.string()).optional(),
  requiredVariables: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  searchKeywords: z.string().optional(),
});

export const UpdateCampaignStatusSchema = z.object({
  status: z.enum([
    "draft",
    "scheduled",
    "running",
    "paused",
    "completed",
    "cancelled",
    "failed",
  ]),
});

export const ImportContactsSchema = z.object({
  fileName: z.string().min(1),
  originalFileName: z.string().min(1),
  fileSize: z.number().min(1),
  fileType: z.enum(["csv", "xlsx", "xls"]),
  groupIds: z.array(z.string()).optional(),
  skipDuplicates: z.boolean().default(true),
  validateNumbers: z.boolean().default(true),
  fieldMapping: z.record(z.string()).optional(),
});

// ================================
// TIPOS TYPESCRIPT
// ================================

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

export type Activity = typeof activitiesTables.$inferSelect;
export type NewActivity = typeof activitiesTables.$inferInsert;

export type ContactImport = typeof contactImportsTables.$inferSelect;
export type NewContactImport = typeof contactImportsTables.$inferInsert;

export type CampaignStatus = (typeof campaignStatusEnum.enumValues)[number];
export type MessageStatus = (typeof messageStatusEnum.enumValues)[number];
export type ActivityType = (typeof activityTypeEnum.enumValues)[number];
export type ActivityStatus = (typeof activityStatusEnum.enumValues)[number];
export type TemplateType = (typeof templateTypeEnum.enumValues)[number];
export type ImportStatus = (typeof importStatusEnum.enumValues)[number];
