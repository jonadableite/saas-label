// src/app/(protected)/superadmin/_components/system-settings.tsx
"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toaster } from "@/components/ui/sonner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export function SystemSettings() {
  const { toast } = Toaster();

  const handleSaveSettings = () => {
    // Lógica para salvar as configurações
    toast({
      title: "Configurações Salvas!",
      description: "As configurações do sistema foram atualizadas com sucesso.",
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configurações do Sistema</CardTitle>
        <CardDescription>
          Ajuste as configurações globais da plataforma, como nome, contato e
          funcionalidades.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="platform-name">Nome da Plataforma</Label>
          <Input id="platform-name" defaultValue="WhatLead SaaS" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="support-email">Email de Suporte</Label>
          <Input
            id="support-email"
            type="email"
            defaultValue="suporte@whatlead.com"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="welcome-message">
            Mensagem de Boas-Vindas (Novos Usuários)
          </Label>
          <Textarea
            id="welcome-message"
            rows={3}
            defaultValue="Bem-vindo ao WhatLead! Estamos felizes em tê-lo a bordo. Explore nossos recursos e comece a otimizar suas campanhas."
          />
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor="registration-enabled">
            Habilitar Registro de Novos Usuários
          </Label>
          <Switch id="registration-enabled" defaultChecked />
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor="maintenance-mode">
            Modo de Manutenção (Desabilita acesso para usuários)
          </Label>
          <Switch id="maintenance-mode" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="api-key-limit">
            Limite de Chaves API por Usuário
          </Label>
          <Input id="api-key-limit" type="number" defaultValue={5} min={1} />
        </div>
        <Button onClick={handleSaveSettings} className="mt-4">
          Salvar Configurações
        </Button>
      </CardContent>
    </Card>
  );
}
