// src/lib/services/activity.service.ts
import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { activitiesTables } from "@/db/schema";

export interface ActivityData {
  userId: string;
  type:
    | "campaign_created"
    | "campaign_started"
    | "campaign_completed"
    | "campaign_paused"
    | "campaign_cancelled"
    | "instance_connected"
    | "instance_disconnected"
    | "instance_error"
    | "message_sent"
    | "message_failed"
    | "contact_imported"
    | "template_created"
    | "limit_reached";
  status: "success" | "warning" | "error" | "info";
  title: string;
  description?: string;
  campaignId?: string;
  instanceId?: string;
  metadata?: Record<string, any>;
}

export class ActivityLogger {
  async log(data: ActivityData) {
    try {
      const [activity] = await db
        .insert(activitiesTables)
        .values({
          userId: data.userId,
          type: data.type,
          status: data.status,
          title: data.title,
          description: data.description,
          campaignId: data.campaignId,
          instanceId: data.instanceId,
          metadata: data.metadata,
        })
        .returning();

      return activity;
    } catch (error) {
      console.error("Erro ao salvar atividade:", error);
      // Não falhar a operação principal se o log falhar
      return null;
    }
  }

  async getRecentActivities(userId: string, limit: number = 10) {
    const activities = await db
      .select({
        id: activitiesTables.id,
        type: activitiesTables.type,
        status: activitiesTables.status,
        title: activitiesTables.title,
        description: activitiesTables.description,
        metadata: activitiesTables.metadata,
        createdAt: activitiesTables.createdAt,
      })
      .from(activitiesTables)
      .where(eq(activitiesTables.userId, userId))
      .orderBy(desc(activitiesTables.createdAt))
      .limit(limit);

    return activities;
  }

  async getActivityStats(userId: string, days: number = 7) {
    const stats = await db.execute(sql`
      SELECT
        DATE(created_at) as date,
        type,
        status,
        COUNT(*) as count
      FROM ${activitiesTables}
      WHERE user_id = ${userId}
        AND created_at >= NOW() - INTERVAL '${days} days'
      GROUP BY DATE(created_at), type, status
      ORDER BY date DESC
    `);

    return stats.rows;
  }
}
