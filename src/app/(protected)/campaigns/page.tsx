// src/app/(protected)/campaigns/page.tsx
"use client";

import {
  Edit,
  Eye,
  Filter,
  MoreVertical,
  Pause,
  Play,
  Search,
  Square,
  Trash2,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Importar o modal
import { CreateCampaignModal } from "./_components/create-campaign-modal";

// Mock data - substituir por dados reais
const campaigns = [
  {
    id: "1",
    name: "Campanha Black Friday 2025",
    status: "active",
    template: "Oferta Especial",
    contacts: 1250,
    sent: 856,
    delivered: 832,
    read: 445,
    replied: 67,
    createdAt: "2025-06-23",
    scheduledFor: null,
    instance: "WhatsApp Business",
  },
  {
    id: "2",
    name: "Newsletter Semanal",
    status: "scheduled",
    template: "Newsletter Template",
    contacts: 2100,
    sent: 0,
    delivered: 0,
    read: 0,
    replied: 0,
    createdAt: "2025-06-22",
    scheduledFor: "2025-06-20 09:00",
    instance: "WhatsApp Business",
  },
  {
    id: "3",
    name: "Lançamento Produto X",
    status: "completed",
    template: "Lançamento",
    contacts: 850,
    sent: 850,
    delivered: 834,
    read: 521,
    replied: 89,
    createdAt: "2025-06-23",
    scheduledFor: null,
    instance: "WhatsApp Business",
  },
  {
    id: "4",
    name: "Pesquisa Satisfação",
    status: "paused",
    template: "Pesquisa NPS",
    contacts: 500,
    sent: 245,
    delivered: 240,
    read: 156,
    replied: 78,
    createdAt: "2025-06-23",
    scheduledFor: null,
    instance: "WhatsApp Personal",
  },
];

const getStatusBadge = (status: string) => {
  const variants = {
    active: {
      variant: "default" as const,
      label: "Ativa",
      color: "bg-green-500",
    },
    scheduled: {
      variant: "secondary" as const,
      label: "Agendada",
      color: "bg-blue-500",
    },
    completed: {
      variant: "outline" as const,
      label: "Concluída",
      color: "bg-gray-500",
    },
    paused: {
      variant: "destructive" as const,
      label: "Pausada",
      color: "bg-yellow-500",
    },
    cancelled: {
      variant: "destructive" as const,
      label: "Cancelada",
      color: "bg-red-500",
    },
  };

  return variants[status as keyof typeof variants] || variants.active;
};

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function CampaignsPage() {
  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Campanhas</h2>
          <p className="text-muted-foreground">
            Gerencie suas campanhas de WhatsApp marketing
          </p>
        </div>
        {/* Usar o componente do modal */}
        <CreateCampaignModal />
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total de Campanhas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">4</div>
            <p className="text-muted-foreground text-xs">
              +2 desde o mês passado
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Mensagens Enviadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1,951</div>
            <p className="text-muted-foreground text-xs">
              +12% desde a semana passada
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Taxa de Entrega
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">97.8%</div>
            <p className="text-muted-foreground text-xs">+0.5% desde ontem</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Taxa de Resposta
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">6.2%</div>
            <p className="text-muted-foreground text-xs">-0.3% desde ontem</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 gap-2">
          <div className="relative max-w-sm flex-1">
            <Search className="text-muted-foreground absolute top-2.5 left-2 h-4 w-4" />
            <Input placeholder="Buscar campanhas..." className="pl-8" />
          </div>
          <Select defaultValue="all">
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Status</SelectItem>
              <SelectItem value="active">Ativas</SelectItem>
              <SelectItem value="scheduled">Agendadas</SelectItem>
              <SelectItem value="completed">Concluídas</SelectItem>
              <SelectItem value="paused">Pausadas</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon">
            <Filter className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Campaigns Table */}
      <Card>
        <CardHeader>
          <CardTitle>Suas Campanhas</CardTitle>
          <CardDescription>
            Lista completa de todas as suas campanhas de WhatsApp
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {campaigns.map((campaign) => {
              const statusInfo = getStatusBadge(campaign.status);
              const progress =
                campaign.contacts > 0
                  ? (campaign.sent / campaign.contacts) * 100
                  : 0;
              const deliveryRate =
                campaign.sent > 0
                  ? (campaign.delivered / campaign.sent) * 100
                  : 0;
              const readRate =
                campaign.delivered > 0
                  ? (campaign.read / campaign.delivered) * 100
                  : 0;

              return (
                <div
                  key={campaign.id}
                  className="hover:bg-muted/50 flex items-center justify-between rounded-lg border p-4 transition-colors"
                >
                  <div className="flex flex-1 items-center gap-4">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback>
                        {campaign.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase()}
                      </AvatarFallback>
                    </Avatar>

                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <h3 className="truncate font-semibold">
                          {campaign.name}
                        </h3>
                        <Badge variant={statusInfo.variant}>
                          {statusInfo.label}
                        </Badge>
                      </div>

                      <div className="text-muted-foreground flex items-center gap-4 text-sm">
                        <span>Template: {campaign.template}</span>
                        <span>•</span>
                        <span>{campaign.contacts} contatos</span>
                        <span>•</span>
                        <span>Criada em {formatDate(campaign.createdAt)}</span>
                        {campaign.scheduledFor && (
                          <>
                            <span>•</span>
                            <span>
                              Agendada para {formatDate(campaign.scheduledFor)}
                            </span>
                          </>
                        )}
                      </div>

                      {campaign.status !== "scheduled" && (
                        <div className="mt-2">
                          <div className="text-muted-foreground mb-1 flex items-center gap-2 text-xs">
                            <span>
                              Progresso: {campaign.sent}/{campaign.contacts}
                            </span>
                            <span>•</span>
                            <span>Entrega: {deliveryRate.toFixed(1)}%</span>
                            <span>•</span>
                            <span>Leitura: {readRate.toFixed(1)}%</span>
                          </div>
                          <Progress value={progress} className="h-2" />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {campaign.status === "active" && (
                      <Button variant="outline" size="sm">
                        <Pause className="h-4 w-4" />
                      </Button>
                    )}
                    {campaign.status === "paused" && (
                      <Button variant="outline" size="sm">
                        <Play className="h-4 w-4" />
                      </Button>
                    )}
                    {campaign.status === "scheduled" && (
                      <Button variant="outline" size="sm">
                        <Play className="h-4 w-4" />
                      </Button>
                    )}

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Eye className="mr-2 h-4 w-4" />
                          Ver Detalhes
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Edit className="mr-2 h-4 w-4" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Square className="mr-2 h-4 w-4" />
                          Duplicar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive">
                          <Trash2 className="mr-2 h-4 w-4" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
