// src/db/schema.ts
import { relations } from "drizzle-orm";
import { boolean, index, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod";

// Definição da tabela de usuários
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
  plan: text("plan"),
});

// Relações para a tabela de usuários
export const usersRelations = relations(usersTables, ({ many }) => ({
  instances: many(instancesTables),
  sessions: many(sessionsTables),
  accounts: many(accountsTables),
}));

// Tabela de instâncias da Evolution API
export const instancesTables = pgTable(
  "instances_tables",
  {
    instanceId: text("instance_id").primaryKey().notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => usersTables.id, { onDelete: "cascade" }),
    instanceName: text("instance_name").notNull(),
    number: text("number"),
    integration: text("integration").notNull().default("WHATSAPP-BAILEYS"),
    status: text("status"), // Status da conexão da instância (e.g., 'open', 'connecting', 'close')
    ownerJid: text("owner_jid"),
    profileName: text("profile_name"),
    profilePicUrl: text("profile_pic_url"),
    qrcode: boolean("qrcode").default(true),
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (instances) => {
    return {
      userIdIdx: index("user_id_idx").on(instances.userId),
    };
  },
);

// Relações para a tabela de instâncias
export const instancesRelations = relations(instancesTables, ({ one }) => ({
  user: one(usersTables, {
    fields: [instancesTables.userId],
    references: [usersTables.id],
  }),
}));

// Definições das tabelas de sessão e conta
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

// Relações para as tabelas de sessão e conta
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

export const CreateInstanceSchema = z.object({
  instanceName: z.string().min(1, "Nome da instância é obrigatório"),
});
