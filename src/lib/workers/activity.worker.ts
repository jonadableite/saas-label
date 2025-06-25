// src/lib/workers/activity.worker.ts
import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { activitiesTables, type NewActivity } from "@/db/schema";
import { rabbitmq, redis } from "@/lib/queue/config";

// Definir tipos específicos para evitar 'any'
interface ActivityJobData {
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
    | "contact_imported"
    | "contact_updated"
    | "message_sent"
    | "message_failed"
    | "template_created"
    | "template_updated"
    | "webhook_received";
  status: "success" | "error" | "warning" | "info";
  title: string;
  description: string;
  campaignId?: string;
  instanceId?: string;
  contactId?: string;
  templateId?: string;
  metadata?: Record<string, unknown>;
  timestamp: number;
}

interface NotificationData {
  id: string;
  type: string;
  title: string;
  description: string;
  status: string;
  timestamp: string;
  read: boolean;
  metadata: {
    activityType: string;
    campaignId?: string;
    instanceId?: string;
  };
}

interface ActivityStats {
  total: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  byDay: Record<string, number>;
}

export class ActivityWorker {
  async start(): Promise<void> {
    console.log("🚀 Starting Activity Worker...");

    // Consumir fila de logs de atividades
    await rabbitmq.consumeQueue("activities.log", this.logActivity.bind(this), {
      concurrency: 10,
    });

    console.log("✅ Activity Worker started successfully");
  }

  private async logActivity(data: ActivityJobData): Promise<void> {
    try {
      const activityData: NewActivity = {
        userId: data.userId,
        type: data.type,
        status: data.status,
        title: data.title,
        description: data.description,
        campaignId: data.campaignId,
        instanceId: data.instanceId,
        contactId: data.contactId,
        templateId: data.templateId,
        metadata: data.metadata,
        createdAt: new Date(data.timestamp),
      };

      // Inserir atividade no banco
      await db.insert(activitiesTables).values(activityData);

      // Cache das atividades recentes do usuário
      const cacheKey = `activities:recent:${data.userId}`;

      // Adicionar nova atividade
      await redis.lpush(
        cacheKey,
        JSON.stringify({
          ...activityData,
          id: crypto.randomUUID(), // Temporário até ter o ID real
          createdAt: new Date(data.timestamp).toISOString(),
        }),
      );

      // Manter apenas 50 atividades recentes
      await redis.ltrim(cacheKey, 0, 49);
      await redis.expire(cacheKey, 3600); // 1 hora

      // Notificações em tempo real (WebSocket)
      await this.sendRealTimeNotification(data.userId, activityData);

      // Estatísticas de atividades por usuário
      await this.updateActivityStats(data.userId, data.type, data.status);

      console.log(`Activity logged for user ${data.userId}: ${data.title}`);
    } catch (error) {
      console.error("Error logging activity:", error);

      // Fallback: salvar no Redis para retry
      await redis.lpush(
        "activities:failed",
        JSON.stringify({
          ...data,
          error: String(error),
          failedAt: new Date().toISOString(),
        }),
      );
    }
  }

  private async sendRealTimeNotification(
    userId: string,
    activity: NewActivity,
  ): Promise<void> {
    try {
      // Implementar WebSocket ou Server-Sent Events
      // Por enquanto, salvamos no Redis para polling
      const notificationKey = `notifications:${userId}`;

      const notification: NotificationData = {
        id: crypto.randomUUID(),
        type: "activity",
        title: activity.title,
        description: activity.description,
        status: activity.status,
        timestamp:
          activity.createdAt?.toISOString() || new Date().toISOString(),
        read: false,
        metadata: {
          activityType: activity.type,
          campaignId: activity.campaignId,
          instanceId: activity.instanceId,
        },
      };

      await redis.lpush(notificationKey, JSON.stringify(notification));

      // Manter apenas 100 notificações
      await redis.ltrim(notificationKey, 0, 99);
      await redis.expire(notificationKey, 86400); // 24 horas
    } catch (error) {
      console.error("Error sending real-time notification:", error);
    }
  }

  private async updateActivityStats(
    userId: string,
    type: string,
    status: string,
  ): Promise<void> {
    try {
      const today = new Date().toISOString().split("T")[0];
      const statsKey = `stats:activities:${userId}:${today}`;

      // Incrementar contadores
      await redis.hincrby(statsKey, `total`, 1);
      await redis.hincrby(statsKey, `type:${type}`, 1);
      await redis.hincrby(statsKey, `status:${status}`, 1);

      // Expirar após 30 dias
      await redis.expire(statsKey, 30 * 24 * 3600);
    } catch (error) {
      console.error("Error updating activity stats:", error);
    }
  }

  // ================================
  // MÉTODOS PÚBLICOS PARA CONSULTA
  // ================================

  async getRecentActivities(
    userId: string,
    limit: number = 20,
  ): Promise<unknown[]> {
    try {
      const cacheKey = `activities:recent:${userId}`;
      const cached = await redis.lrange(cacheKey, 0, limit - 1);

      if (cached.length > 0) {
        return cached.map((item) => JSON.parse(item));
      }

      // Fallback: buscar do banco
      const activities = await db.query.activitiesTables.findMany({
        where: eq(activitiesTables.userId, userId),
        limit,
        orderBy: desc(activitiesTables.createdAt),
      });

      return activities;
    } catch (error) {
      console.error("Error getting recent activities:", error);
      return [];
    }
  }

  async getActivityStats(
    userId: string,
    days: number = 7,
  ): Promise<ActivityStats> {
    try {
      const stats: ActivityStats = {
        total: 0,
        byType: {},
        byStatus: {},
        byDay: {},
      };

      // Buscar stats dos últimos N dias
      for (let i = 0; i < days; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split("T")[0];

        const statsKey = `stats:activities:${userId}:${dateStr}`;
        const dayStats = await redis.hgetall(statsKey);

        if (Object.keys(dayStats).length > 0) {
          stats.byDay[dateStr] = parseInt(dayStats.total || "0");
          stats.total += parseInt(dayStats.total || "0");

          // Processar por tipo e status
          Object.entries(dayStats).forEach(([key, value]) => {
            if (key.startsWith("type:")) {
              const type = key.replace("type:", "");
              stats.byType[type] = (stats.byType[type] || 0) + parseInt(value);
            } else if (key.startsWith("status:")) {
              const status = key.replace("status:", "");
              stats.byStatus[status] =
                (stats.byStatus[status] || 0) + parseInt(value);
            }
          });
        }
      }

      return stats;
    } catch (error) {
      console.error("Error getting activity stats:", error);
      return {
        total: 0,
        byType: {},
        byStatus: {},
        byDay: {},
      };
    }
  }

  async getNotifications(
    userId: string,
    limit: number = 50,
  ): Promise<NotificationData[]> {
    try {
      const notificationKey = `notifications:${userId}`;
      const notifications = await redis.lrange(notificationKey, 0, limit - 1);

      return notifications.map((item) => JSON.parse(item) as NotificationData);
    } catch (error) {
      console.error("Error getting notifications:", error);
      return [];
    }
  }

  async markNotificationAsRead(
    userId: string,
    notificationId: string,
  ): Promise<void> {
    try {
      const notificationKey = `notifications:${userId}`;
      const notifications = await redis.lrange(notificationKey, 0, -1);

      const updatedNotifications = notifications.map((item) => {
        const notification = JSON.parse(item) as NotificationData;
        if (notification.id === notificationId) {
          notification.read = true;
        }
        return JSON.stringify(notification);
      });

      // Recriar a lista
      await redis.del(notificationKey);
      if (updatedNotifications.length > 0) {
        await redis.lpush(notificationKey, ...updatedNotifications);
        await redis.expire(notificationKey, 86400);
      }
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  }
}

export const activityWorker = new ActivityWorker();
