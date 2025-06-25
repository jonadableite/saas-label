// src/lib/auth.ts
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { customSession } from 'better-auth/plugins';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import * as schema from '@/db/schema';
import { usersTables } from '@/db/schema';

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    usePlural: true,
    schema,
  }),
  socialProviders: {
  google: {
  clientId: process.env.GOOGLE_CLIENT_ID as string,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
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

      const firstAccount = userData?.accounts?.[0]; // Obter a primeira conta, se existir

      return {
        user: {
          ...user,
          plan: userData?.plan,
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
  ],
  user: {
    modelName: 'usersTables',
    additionalFields: {
      stripeCustomerId: {
        type: 'string',
        fieldName: 'stripeCustomerId',
        required: false,
      },
      stripeSubscriptionId: {
        type: 'string',
        fieldName: 'stripeSubscriptionId',
        required: false,
      },
      plan: {
        type: 'string',
        fieldName: 'plan',
        required: false,
      },
    },
  },
  session: {
    modelName: 'sessionsTables',
  },
  account: {
    modelName: 'accountsTables',
  },
  verification: {
    modelName: 'verificationsTables',
  },
  emailAndPassword: {
    enabled: true,
  },
});
