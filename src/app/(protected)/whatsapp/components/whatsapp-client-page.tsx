//src/app/(protected)/whatsapp/components/whatsapp-client-page.tsx
"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { CreateInstanceForm } from "./create-instance-form";
import { Instance, InstanceList } from "./instance-list"; // Importe o tipo Instance

interface WhatsappClientPageProps {
  initialInstances: Instance[]; // Recebe as instâncias como prop
}

export function WhatsappClientPage({
  initialInstances,
}: WhatsappClientPageProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    // Padding horizontal responsivo: px-4 em telas pequenas, px-6 em telas médias e maiores
    <div className="container mx-auto px-4 py-8 md:px-6">
      <div className="mb-6 flex items-center justify-between">
        {/* Título responsivo: text-2xl em telas pequenas, text-3xl em telas médias e maiores */}
        <h1 className="text-2xl font-bold md:text-3xl">
          Gerenciar Instâncias de WhatsApp
        </h1>
        {/* Passe o estado e a função de atualização para o Dialog */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Criar Nova Instância
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Nova Instância de WhatsApp</DialogTitle>
            </DialogHeader>
            {/* Passe a função para fechar o modal para o formulário */}
            <CreateInstanceForm onClose={() => setIsModalOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>
      {/* Passe as instâncias iniciais para o InstanceList */}
      <InstanceList initialInstances={initialInstances} />
    </div>
  );
}
