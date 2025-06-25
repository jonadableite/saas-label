// src/lib/queue/config.ts
import amqp, { Channel, Connection } from "amqplib";
import Redis from "ioredis";

// ================================
// CONFIGURAÇÃO DO REDIS
// ================================

export const redis = new Redis(process.env.CACHE_REDIS_URI!, {
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  keepAlive: 30000,
  connectTimeout: 10000,
  commandTimeout: 5000,
});

redis.on("connect", () => {
  console.log("✅ Redis connected successfully");
});

redis.on("error", (error) => {
  console.error("❌ Redis connection error:", error);
});

// ================================
// CONFIGURAÇÃO DO RABBITMQ
// ================================

class RabbitMQManager {
  private connection: Connection | null = null;
  private channel: Channel | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;

  async connect(): Promise<void> {
    try {
      this.connection = await amqp.connect(process.env.RABBITMQ_URI!);
      this.channel = await this.connection.createChannel();

      // Configurar event listeners
      this.connection.on("error", this.handleConnectionError.bind(this));
      this.connection.on("close", this.handleConnectionClose.bind(this));

      // Configurar filas
      await this.setupQueues();

      console.log("✅ RabbitMQ connected successfully");
      this.reconnectAttempts = 0;
    } catch (error) {
      console.error("❌ RabbitMQ connection error:", error);
      await this.handleReconnect();
    }
  }

  private async handleConnectionError(error: Error): Promise<void> {
    console.error("RabbitMQ connection error:", error);
    await this.handleReconnect();
  }

  private async handleConnectionClose(): Promise<void> {
    console.warn("RabbitMQ connection closed");
    await this.handleReconnect();
  }

  private async handleReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("Max reconnection attempts reached");
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

    console.log(
      `Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`,
    );

    setTimeout(() => {
      this.connect();
    }, delay);
  }

  private async setupQueues(): Promise<void> {
  if (!this.channel) throw new Error("Channel not initialized");

  try {

    const exchanges = [
      { name: "campaigns", type: "topic" },
      { name: "contacts", type: "topic" },
      { name: "messages", type: "topic" },
      { name: "dlx", type: "topic" }
    ];

    for (const exchange of exchanges) {
      await this.channel.assertExchange(exchange.name, exchange.type, {
        durable: true,
        autoDelete: false
      });
      console.log(`✅ Exchange '${exchange.name}' created/verified`);
    }

    const queues = [
      { name: "campaign.create", exchange: "campaigns", routingKey: "campaign.create" },
      { name: "campaign.execute", exchange: "campaigns", routingKey: "campaign.execute" },
      { name: "campaign.schedule", exchange: "campaigns", routingKey: "campaign.schedule" },
      { name: "campaign.status.update", exchange: "campaigns", routingKey: "campaign.status.*" },

      { name: "contacts.import", exchange: "contacts", routingKey: "contacts.import" },
      { name: "contacts.validate", exchange: "contacts", routingKey: "contacts.validate" },
      { name: "contacts.process", exchange: "contacts", routingKey: "contacts.process" },

      { name: "messages.send", exchange: "messages", routingKey: "messages.send" },
      { name: "messages.retry", exchange: "messages", routingKey: "messages.retry" },
      { name: "messages.status.update", exchange: "messages", routingKey: "messages.status.*" },

      { name: "activities.log", exchange: "messages", routingKey: "activities.*" },
    ];

    for (const queue of queues) {
      await this.channel.assertQueue(queue.name, {
        durable: true,
        arguments: {
          "x-dead-letter-exchange": "dlx",
          "x-dead-letter-routing-key": `${queue.name}.dlq`,
          "x-message-ttl": 86400000, // 24 horas
        },
      });

      await this.channel.assertQueue(`${queue.name}.dlq`, { durable: true });
      await this.channel.bindQueue(
        `${queue.name}.dlq`,
        "dlx",
        `${queue.name}.dlq`,
      );

      await this.channel.bindQueue(queue.name, queue.exchange, queue.routingKey);
      console.log(`✅ Queue '${queue.name}' bound to exchange '${queue.exchange}'`);
    }

    await this.channel.prefetch(10);
    console.log("✅ All queues and exchanges configured successfully");

  } catch (error) {
    console.error("❌ Error setting up queues:", error);
    throw error;
  }
}

  async publishMessage(
    exchange: string,
    routingKey: string,
    message: any,
    options: { priority?: number; delay?: number } = {},
  ): Promise<boolean> {
    if (!this.channel) {
      await this.connect();
    }

    const messageBuffer = Buffer.from(JSON.stringify(message));
    const publishOptions: any = {
      persistent: true,
      timestamp: Date.now(),
      messageId: crypto.randomUUID(),
      priority: options.priority || 0,
    };

    // Implementar delay se especificado
    if (options.delay) {
      publishOptions.headers = {
        "x-delay": options.delay,
      };
    }

    return this.channel!.publish(
      exchange,
      routingKey,
      messageBuffer,
      publishOptions,
    );
  }

  async consumeQueue(
    queueName: string,
    handler: (message: any) => Promise<void>,
    options: { concurrency?: number } = {},
  ): Promise<void> {
    if (!this.channel) {
      await this.connect();
    }

    const concurrency = options.concurrency || 1;

    for (let i = 0; i < concurrency; i++) {
      await this.channel!.consume(queueName, async (msg) => {
        if (!msg) return;

        try {
          const content = JSON.parse(msg.content.toString());
          await handler(content);
          this.channel!.ack(msg);
        } catch (error) {
          console.error(
            `Error processing message in queue ${queueName}:`,
            error,
          );

          // Rejeitar mensagem e enviar para DLQ após 3 tentativas
          const retryCount =
            (msg.properties.headers?.["x-retry-count"] || 0) + 1;

          if (retryCount <= 3) {
            // Republicar com delay exponencial
            const delay = Math.pow(2, retryCount) * 1000;
            setTimeout(() => {
              this.publishMessage(
                "campaigns", // ou o exchange apropriado
                queueName.replace(".", ".retry."),
                JSON.parse(msg.content.toString()),
                { delay },
              );
            }, delay);
          }

          this.channel!.nack(msg, false, retryCount <= 3);
        }
      });
    }
  }

  getChannel(): Channel | null {
    return this.channel;
  }

  async close(): Promise<void> {
    if (this.channel) {
      await this.channel.close();
    }
    if (this.connection) {
      await this.connection.close();
    }
  }
}

export const rabbitmq = new RabbitMQManager();

// ================================
// INICIALIZAÇÃO
// ================================

export async function initializeQueues(): Promise<void> {
  try {
    await redis.ping();
    await rabbitmq.connect();
    console.log("✅ All queue systems initialized successfully");
  } catch (error) {
    console.error("❌ Failed to initialize queue systems:", error);
    throw error;
  }
}
