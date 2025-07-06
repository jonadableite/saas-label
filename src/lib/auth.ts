// src/lib/auth.ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, customSession } from "better-auth/plugins";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import * as schema from "@/db/schema";
import { usersTables } from "@/db/schema";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    usePlural: false,
    schema,
  }),
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      mapProfileToUser: (profile) => {
        return {
          name: profile.name,
          image: profile.picture,
        };
      },
    },
  },
  plugins: [
    customSession(async ({ user, session }) => {
      // TODO: colocar cache
      // Buscar dados do usuário e contas associadas usando as relações definidas
      const userData = await db.query.usersTables.findFirst({
        where: eq(usersTables.id, user.id),
        with: {
          accounts: true,
        },
      });

      const firstAccount = userData?.accounts?.[0];

      return {
        user: {
          ...user,
          plan: userData?.plan,
          role: userData?.role,
          dailyMessageLimit: userData?.dailyMessageLimit,
          monthlyMessageLimit: userData?.monthlyMessageLimit,
          account: firstAccount
            ? {
                id: firstAccount.accountId,
                providerId: firstAccount.providerId,
              }
            : undefined,
        },
        session,
      };
    }),
    admin({
      adminRoles: ["admin", "superadmin"],
      defaultRole: "regular",
    }),
  ],
  user: {
    modelName: "usersTables",
    additionalFields: {
      stripeCustomerId: {
        type: "string",
        fieldName: "stripeCustomerId",
        required: false,
      },
      stripeSubscriptionId: {
        type: "string",
        fieldName: "stripeSubscriptionId",
        required: false,
      },
      plan: {
        type: "string",
        fieldName: "plan",
        required: false,
      },
      dailyMessageLimit: {
        type: "integer",
        fieldName: "dailyMessageLimit",
        required: false,
      },
      monthlyMessageLimit: {
        type: "integer",
        fieldName: "monthlyMessageLimit",
        required: false,
      },
      // Os campos 'role', 'banned', 'banReason', 'banExpires' serão adicionados automaticamente
      // pelo plugin 'admin' no schema do Drizzle.
    },
  },
  session: {
    modelName: "sessionsTables",
    // O campo 'impersonatedBy' será adicionado automaticamente pelo plugin 'admin'
    // no schema do Drizzle.
  },
  account: {
    modelName: "accountsTables",
  },
  verification: {
    modelName: "verificationsTables",
  },
  emailAndPassword: {
    enabled: true,
  },
});
