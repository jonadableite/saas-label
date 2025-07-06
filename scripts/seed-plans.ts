import { eq } from "drizzle-orm";

import { db } from "@/db/index";
import { NewPlan, plansTables } from "@/db/schema";

async function seedPlans() {
  const rawPlans = [
    {
      id: "plan_free_001", // ID fixo para o plano Free
      name: "FREE",
      annualPriceValue: 0,
      monthlyPriceValue: 0,
      description: "Plano gratuito com funcionalidades básicas e limites zero.",
      features: ["Acesso básico", "0 mensagens", "0 contatos", "0 instâncias"],
      messageLimit: 0,
      instanceLimit: 0,
      contactLimit: 0,
      campaignLimit: 0,
      storageLimitMb: 0,
      isPublic: true,
      sortOrder: 0, // Garante que o plano Free apareça primeiro
    },
    {
      name: "STARTER",
      annualPriceValue: 1299.0,
      monthlyPriceValue: 129.9,
      description: "Ideal para iniciantes e pequenos negócios",
      features: [
        "15.000 mensagens/mês",
        "1.000 leads/mês",
        "2 automações ativas",
        "Suporte por email",
        "Analytics básico",
        "Aquecedor básico",
      ],
    },
    {
      name: "PRO",
      annualPriceValue: 2499.0,
      monthlyPriceValue: 249.9,
      popular: true,
      description:
        "Perfeito para usuários que precisam de mais recursos e suporte prioritário",
      features: [
        "2 Agentes de IA",
        "50.000 mensagens/mês",
        "5.000 leads/mês",
        "Automações ilimitadas",
        "Suporte prioritário",
        "Analytics avançado",
        "API completa",
        "Aquecedor avançado",
        "Integrações premium",
      ],
    },
    {
      name: "ENTERPRISE",
      annualPriceValue: 4999.0,
      monthlyPriceValue: 499.9,
      description:
        "Solução completa para grandes empresas e necessidades complexas",
      features: [
        "Agentes ilimitados",
        "Disparos ilimitados",
        "Mensagens ilimitadas",
        "Automações ilimitadas",
        "Leads ilimitados",
        "Recursos exclusivos",
        "Suporte 24/7 VIP",
        "Analytics personalizado",
        "API dedicada",
        "Setup assistido",
        "Integrações personalizadas",
        "Aquecedor personalizado",
        "Treinamento da equipe",
      ],
    },
  ];

  const plansToInsert: NewPlan[] = rawPlans.map((plan, index) => {
    // Lógica específica para o plano "Free"
    if (plan.name === "Free") {
      return {
        id: plan.id, // Usa o ID fixo
        name: plan.name,
        description: plan.description,
        priceMonthlyCents: 0,
        priceAnnuallyCents: 0,
        messageLimit: 0,
        instanceLimit: 0,
        contactLimit: 0,
        campaignLimit: 0,
        storageLimitMb: 0,
        features: {}, // Ou adicione features específicas para o plano Free
        isPublic: true,
        sortOrder: plan.sortOrder,
      };
    }

    // Lógica existente para outros planos
    let messageLimit = 0;
    let contactLimit = 0;
    let instanceLimit = 1;
    let campaignLimit = 5;
    let storageLimitMb = 500;
    const parsedFeatures: Record<string, any> = {};

    plan.features.forEach((feature) => {
      if (feature.includes("mensagens/mês")) {
        messageLimit = parseInt(feature.replace(/\D/g, ""));
      } else if (feature.includes("leads/mês")) {
        contactLimit = parseInt(feature.replace(/\D/g, ""));
      } else if (
        feature.includes("ilimitados") ||
        feature.includes("ilimitadas")
      ) {
        const UNLIMITED_VALUE = 999999999;
        if (feature.includes("Mensagens ilimitadas"))
          messageLimit = UNLIMITED_VALUE;
        if (feature.includes("Leads ilimitados"))
          contactLimit = UNLIMITED_VALUE;
        if (feature.includes("Agentes ilimitados"))
          parsedFeatures.unlimited_ai_agents = true;
        if (feature.includes("Disparos ilimitados"))
          parsedFeatures.unlimited_dispatches = true;
        if (feature.includes("Automações ilimitadas"))
          parsedFeatures.unlimited_automations = true;
      } else if (feature.includes("automações ativas")) {
        parsedFeatures.active_automations = parseInt(
          feature.replace(/\D/g, ""),
        );
      } else if (feature.includes("Agentes de IA")) {
        parsedFeatures.ai_agents = parseInt(feature.replace(/\D/g, ""));
      } else if (feature.includes("Suporte por email")) {
        parsedFeatures.email_support = true;
      } else if (feature.includes("Suporte prioritário")) {
        parsedFeatures.priority_support = true;
      } else if (feature.includes("Suporte 24/7 VIP")) {
        parsedFeatures.vip_24_7_support = true;
      } else if (feature.includes("Analytics básico")) {
        parsedFeatures.analytics_basic = true;
      } else if (feature.includes("Analytics avançado")) {
        parsedFeatures.analytics_advanced = true;
      } else if (feature.includes("Analytics personalizado")) {
        parsedFeatures.custom_analytics = true;
      } else if (feature.includes("Aquecedor básico")) {
        parsedFeatures.warmer_basic = true;
      } else if (feature.includes("Aquecedor avançado")) {
        parsedFeatures.warmer_advanced = true;
      } else if (feature.includes("Aquecedor personalizado")) {
        parsedFeatures.warmer_custom = true;
      } else if (feature.includes("API completa")) {
        parsedFeatures.full_api = true;
      } else if (feature.includes("API dedicada")) {
        parsedFeatures.dedicated_api = true;
      } else if (feature.includes("Integrações premium")) {
        parsedFeatures.premium_integrations = true;
      } else if (feature.includes("Integrações personalizadas")) {
        parsedFeatures.custom_integrations = true;
      } else if (feature.includes("Setup assistido")) {
        parsedFeatures.assisted_setup = true;
      } else if (feature.includes("Treinamento da equipe")) {
        parsedFeatures.team_training = true;
      } else if (feature.includes("Recursos exclusivos")) {
        parsedFeatures.exclusive_resources = true;
      }
    });

    if (plan.name === "Pro") {
      instanceLimit = 3;
      campaignLimit = 20;
      storageLimitMb = 2000;
    } else if (plan.name === "Enterprise") {
      const UNLIMITED_VALUE = 999999999;
      instanceLimit = UNLIMITED_VALUE;
      campaignLimit = UNLIMITED_VALUE;
      storageLimitMb = UNLIMITED_VALUE;
    }

    if (plan.hasOwnProperty("popular") && plan.popular) {
      parsedFeatures.popular = true;
    }

    return {
      name: plan.name,
      description: plan.description,
      priceMonthlyCents: Math.round(plan.monthlyPriceValue * 100),
      priceAnnuallyCents: Math.round(plan.annualPriceValue * 100),
      messageLimit: messageLimit,
      instanceLimit: instanceLimit,
      contactLimit: contactLimit,
      campaignLimit: campaignLimit,
      storageLimitMb: storageLimitMb,
      features: parsedFeatures,
      isPublic: true,
      sortOrder: index + 1, // Ajusta a ordem para os planos pagos
    };
  });

  try {
    console.log("Iniciando a inserção dos planos...");
    // Deletar apenas os planos que estão sendo inseridos para evitar duplicatas
    for (const plan of plansToInsert) {
      await db.delete(plansTables).where(eq(plansTables.name, plan.name));
      console.log(`Plano '${plan.name}' existente deletado (se houver).`);
    }

    await db.insert(plansTables).values(plansToInsert);
    console.log("Planos inseridos com sucesso!");
  } catch (error) {
    console.error("Erro ao inserir planos:", error);
    process.exit(1); // Saia com código de erro
  } finally {
    // Se o seu 'db' tiver um método 'end()' para fechar a conexão (comum em alguns ORMs/drivers), chame-o aqui.
    // Ex: if (typeof db.end === 'function') await db.end();
  }
}

// Chame a função assíncrona e lide com o processo de saída
(async () => {
  await seedPlans();
  process.exit(0); // Saia com sucesso
})();
