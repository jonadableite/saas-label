// src/lib/workers/index.ts
import { initializeQueues } from "@/lib/queue/config";

import { activityWorker } from "./activity.worker";
import { campaignWorker } from "./campaign.worker";
import { contactWorker } from "./contact.worker";

export async function startWorkers(): Promise<void> {
  try {
    // Inicializar filas
    await initializeQueues();

    // Iniciar workers
    await Promise.all([
      campaignWorker.start(),
      contactWorker.start(),
      activityWorker.start(),
    ]);

    console.log("✅ All workers started successfully");
  } catch (error) {
    console.error("❌ Failed to start workers:", error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("Shutting down workers...");
  // Implementar cleanup
  process.exit(0);
});
