// src/app/(protected)/campaigns/scheduled/page.tsx
import { Calendar, Clock, Edit, MoreVertical, Play, Trash2 } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const scheduledCampaigns = [
  {
    id: "1",
    name: "Newsletter Semanal",
    template: "Newsletter Template",
    contacts: 2100,
    scheduledFor: "2025-06-20T09:00:00",
    instance: "WhatsApp Business",
    recurring: "weekly",
  },
  {
    id: "2",
    name: "Promoção Final de Mês",
    template: "Promoção",
    contacts: 1500,
    scheduledFor: "2025-06-31T10:00:00",
    instance: "WhatsApp Business",
    recurring: null,
  },
  {
    id: "3",
    name: "Lembrete Consulta",
    template: "Lembrete Médico",
    contacts: 250,
    scheduledFor: "2025-06-25T08:00:00",
    instance: "WhatsApp Personal",
    recurring: "daily",
  },
];

const getTimeUntil = (date: string) => {
  const now = new Date();
  const scheduled = new Date(date);
  const diffMs = scheduled.getTime() - now.getTime();

  if (diffMs < 0) return "Vencido";

  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (diffDays > 0) {
    return `Em ${diffDays}d ${diffHours}h`;
  } else if (diffHours > 0) {
    return `Em ${diffHours}h ${diffMinutes}m`;
  } else {
    return `Em ${diffMinutes}m`;
  }
};

const formatScheduledDate = (date: string) => {
  return new Date(date).toLocaleDateString('pt-BR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const getRecurringBadge = (recurring: string | null) => {
  if (!recurring) return null;

  const labels = {
    daily: "Diário",
    weekly: "Semanal",
    monthly: "Mensal"
  };

  return <Badge variant="outline">{labels[recurring as keyof typeof labels]}</Badge>;
};

export default function ScheduledCampaignsPage() {
  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Campanhas Agendadas</h2>
          <p className="text-muted-foreground">
            Gerencie campanhas programadas para envio futuro
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Campanhas Agendadas</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">3</div>
            <p className="text-xs text-muted-foreground">
              Para os próximos 30 dias
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Contatos Agendados</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">3,850</div>
            <p className="text-xs text-muted-foreground">
              Total de destinatários
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Próximo Envio</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Em 2d 3h</div>
            <p className="text-xs text-muted-foreground">
              Newsletter Semanal
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Scheduled Campaigns List */}
      <Card>
        <CardHeader>
          <CardTitle>Campanhas Programadas</CardTitle>
          <CardDescription>
            Lista de campanhas com data e hora de envio definidas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {scheduledCampaigns.map((campaign) => (
              <div key={campaign.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-4 flex-1">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={`/campaigns/${campaign.id}.png`} />
                    <AvatarFallback>
                      {campaign.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold truncate">{campaign.name}</h3>
                      {getRecurringBadge(campaign.recurring)}
                    </div>

                    <div className="text-sm text-muted-foreground space-y-1">
                      <div className="flex items-center gap-4">
                        <span>Template: {campaign.template}</span>
                        <span>•</span>
                        <span>{campaign.contacts} contatos</span>
                        <span>•</span>
                        <span>{campaign.instance}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        <span>{formatScheduledDate(campaign.scheduledFor)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-sm font-medium">
                      {getTimeUntil(campaign.scheduledFor)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      até o envio
                    </div>
                  </div>

                  <Button variant="outline" size="sm">
                    <Play className="h-4 w-4" />
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Play className="mr-2 h-4 w-4" />
                        Enviar Agora
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Edit className="mr-2 h-4 w-4" />
                        Editar Agendamento
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Cancelar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
