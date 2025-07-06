// src/app/(protected)/superadmin/_components/plan-management.tsx
"use client";

import { PlusCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";

export function PlanManagement() {
  const plans = [
    {
      name: "Plano Básico",
      price: "R$ 49/mês",
      features: [
        "5.000 mensagens/mês",
        "1 instância de WhatsApp",
        "Suporte básico",
        "Relatórios semanais",
      ],
    },
    {
      name: "Plano Pro",
      price: "R$ 99/mês",
      features: [
        "20.000 mensagens/mês",
        "3 instâncias de WhatsApp",
        "Suporte prioritário",
        "Relatórios diários",
        "Automações avançadas",
      ],
    },
    {
      name: "Plano Enterprise",
      price: "Sob Consulta",
      features: [
        "Mensagens ilimitadas",
        "Instâncias ilimitadas",
        "Suporte dedicado 24/7",
        "Relatórios personalizados",
        "Integrações customizadas",
      ],
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gerenciamento de Planos</CardTitle>
        <CardDescription>
          Defina e edite os planos de assinatura disponíveis na plataforma.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex justify-end">
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" /> Criar Novo Plano
          </Button>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan, index) => (
            <Card
              key={index}
              className={
                plan.name === "Plano Pro" ? "border-primary border-2" : ""
              }
            >
              <CardHeader>
                <CardTitle>{plan.name}</CardTitle>
                <CardDescription className="text-xl font-semibold">
                  {plan.price}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="text-muted-foreground list-inside list-disc space-y-1 text-sm">
                  {plan.features.map((feature, fIndex) => (
                    <li key={fIndex}>{feature}</li>
                  ))}
                </ul>
                <Button variant="outline" className="mt-6 w-full">
                  Editar Plano
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
