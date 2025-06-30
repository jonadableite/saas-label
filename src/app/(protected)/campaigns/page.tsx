// src/app/(protected)/campaigns/page.tsx
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"; // Import react-query hooks
import { format } from "date-fns"; // Import format for date formatting
import { ptBR } from "date-fns/locale"; // Import locale
import {
  Edit,
  Eye,
  Loader2, // Add Loader icon for loading states
  MoreVertical,
  Pause,
  Play,
  Search,
  Square,
  Trash2,
} from "lucide-react";
import { useState } from "react"; // Import useState

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
import { Toaster } from "@/components/ui/sonner";

// Import the modal
import { CreateCampaignModal } from "./_components/create-campaign-modal";

// Define the type for a Campaign based on your API response
// Adjust this type according to the actual data structure returned by your GET /api/campaigns
interface Campaign {
  id: string;
  name: string;
  status: "active" | "scheduled" | "completed" | "paused" | "cancelled"; // Use specific status types
  templateName: string; // Assuming your API returns template name
  contactsCount: number; // Assuming your API returns total contacts
  sentCount: number; // Assuming your API returns sent count
  deliveredCount: number; // Assuming your API returns delivered count
  readCount: number; // Assuming your API returns read count
  repliedCount: number; // Assuming your API returns replied count
  createdAt: string; // ISO string date
  scheduledFor: string | null; // ISO string date or null
  instanceName: string; // Assuming your API returns instance name
  // Add other fields from your API response if necessary
}

// Define the type for the API response (list of campaigns and potentially total count for pagination)
interface CampaignsApiResponse {
  campaigns: Campaign[];
  totalCount: number; // Useful for pagination later
}

const getStatusBadge = (status: Campaign["status"]) => {
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
      variant: "destructive" as const, // Changed to destructive for paused as it's an interruption
      label: "Pausada",
      color: "bg-yellow-500",
    },
    cancelled: {
      variant: "destructive" as const,
      label: "Cancelada",
      color: "bg-red-500",
    },
  };

  return (
    variants[status] || {
      variant: "secondary" as const,
      label: "Desconhecido",
      color: "bg-gray-400",
    }
  );
};

// Function to format date and time
const formatDateTime = (dateString: string | null) => {
  if (!dateString) return "N/A";
  try {
    return format(new Date(dateString), "dd/MM/yyyy HH:mm", { locale: ptBR });
  } catch (error) {
    console.error("Error formatting date:", dateString, error);
    return "Data Inválida";
  }
};

export default function CampaignsPage() {
  const queryClient = useQueryClient();
  const { toast } = Toaster();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<Campaign["status"] | "all">(
    "all",
  );
  // You might add state for pagination here later (e.g., page, pageSize)

  // Fetch campaigns using react-query
  const { data, isLoading, isError, error } = useQuery<
    CampaignsApiResponse,
    Error
  >({
    queryKey: ["campaigns", { status: statusFilter, search: searchTerm }], // Query key includes filters
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") {
        params.append("status", statusFilter);
      }
      if (searchTerm) {
        // Assuming your API supports a search query parameter
        params.append("search", searchTerm);
      }
      // Add limit and offset if implementing pagination
      // params.append('limit', pageSize.toString());
      // params.append('offset', (page * pageSize).toString());

      const response = await fetch(`/api/campaigns?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to fetch campaigns");
      }
      return response.json();
    },
    // Keep data fresh
    staleTime: 1000 * 60 * 5, // Data is considered fresh for 5 minutes
    refetchOnWindowFocus: true, // Refetch when window regains focus
  });

  // Mutation for starting a campaign
  const startCampaignMutation = useMutation({
    mutationFn: async (campaignId: string) => {
      const response = await fetch(`/api/campaigns/${campaignId}/start`, {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error("Failed to start campaign");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] }); // Invalidate cache to refetch
      toast({
        title: "Campanha Iniciada",
        description: "A campanha foi iniciada com sucesso.",
      });
    },
    onError: (err) => {
      toast({
        title: "Erro ao Iniciar Campanha",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  // Mutation for pausing a campaign (assuming you have this API)
  const pauseCampaignMutation = useMutation({
    mutationFn: async (campaignId: string) => {
      const response = await fetch(`/api/campaigns/${campaignId}/pause`, {
        // Adjust endpoint
        method: "POST", // Or PUT/PATCH
      });
      if (!response.ok) {
        throw new Error("Failed to pause campaign");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      toast({
        title: "Campanha Pausada",
        description: "A campanha foi pausada com sucesso.",
      });
    },
    onError: (err) => {
      toast({
        title: "Erro ao Pausar Campanha",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  // Mutation for deleting a campaign (assuming you have this API)
  const deleteCampaignMutation = useMutation({
    mutationFn: async (campaignId: string) => {
      const response = await fetch(`/api/campaigns/${campaignId}`, {
        // Adjust endpoint
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Failed to delete campaign");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      toast({
        title: "Campanha Excluída",
        description: "A campanha foi excluída com sucesso.",
      });
    },
    onError: (err) => {
      toast({
        title: "Erro ao Excluir Campanha",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  // Mutation for duplicating a campaign (assuming you have this API)
  const duplicateCampaignMutation = useMutation({
    mutationFn: async (campaignId: string) => {
      const response = await fetch(`/api/campaigns/${campaignId}/duplicate`, {
        // Adjust endpoint
        method: "POST",
      });
      if (!response.ok) {
        throw new Error("Failed to duplicate campaign");
      }
      return response.json(); // Assuming it returns the new campaign
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      toast({
        title: "Campanha Duplicada",
        description: "A campanha foi duplicada com sucesso.",
      });
    },
    onError: (err) => {
      toast({
        title: "Erro ao Duplicar Campanha",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const campaigns = data?.campaigns || []; // Use fetched data or empty array

  // Calculate total stats from fetched data (if needed for the stats cards)
  const totalCampaigns = campaigns.length; // Or use data.totalCount if your API provides it
  const totalSentMessages = campaigns.reduce((sum, c) => sum + c.sentCount, 0);
  const totalDeliveredMessages = campaigns.reduce(
    (sum, c) => sum + c.deliveredCount,
    0,
  );
  const averageDeliveryRate =
    totalSentMessages > 0
      ? (totalDeliveredMessages / totalSentMessages) * 100
      : 0;
  const totalRepliedMessages = campaigns.reduce(
    (sum, c) => sum + c.repliedCount,
    0,
  );
  const averageReplyRate =
    totalDeliveredMessages > 0
      ? (totalRepliedMessages / totalDeliveredMessages) * 100
      : 0;

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
        {/* Assuming CreateCampaignModal needs a way to refetch campaigns after creation */}
        <CreateCampaignModal
          onSuccess={() =>
            queryClient.invalidateQueries({ queryKey: ["campaigns"] })
          }
        />
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
            {isLoading ? (
              <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
            ) : (
              <div className="text-2xl font-bold">{totalCampaigns}</div>
            )}
            {/* Placeholder for comparison stat */}
            <p className="text-muted-foreground text-xs">
              {/* +X desde o período anterior (requires more data/logic) */}
              Dados atualizados
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
            {isLoading ? (
              <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
            ) : (
              <div className="text-2xl font-bold">
                {totalSentMessages.toLocaleString()}
              </div>
            )}
            {/* Placeholder for comparison stat */}
            <p className="text-muted-foreground text-xs">Dados atualizados</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Taxa de Entrega Média
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
            ) : (
              <div className="text-2xl font-bold">
                {averageDeliveryRate.toFixed(1)}%
              </div>
            )}
            {/* Placeholder for comparison stat */}
            <p className="text-muted-foreground text-xs">Dados atualizados</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Taxa de Resposta Média
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
            ) : (
              <div className="text-2xl font-bold">
                {averageReplyRate.toFixed(1)}%
              </div>
            )}
            {/* Placeholder for comparison stat */}
            <p className="text-muted-foreground text-xs">Dados atualizados</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 gap-2">
          <div className="relative max-w-sm flex-1">
            <Search className="text-muted-foreground absolute top-2.5 left-2 h-4 w-4" />
            <Input
              placeholder="Buscar campanhas..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(value: Campaign["status"] | "all") =>
              setStatusFilter(value)
            }
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Status</SelectItem>
              <SelectItem value="active">Ativas</SelectItem>
              <SelectItem value="scheduled">Agendadas</SelectItem>
              <SelectItem value="completed">Concluídas</SelectItem>
              <SelectItem value="paused">Pausadas</SelectItem>
              {/* Add cancelled if applicable */}
              <SelectItem value="cancelled">Canceladas</SelectItem>
            </SelectContent>
          </Select>
          {/* Filter button can be used for more complex filtering if needed */}
          {/* <Button variant="outline" size="icon">
            <Filter className="h-4 w-4" />
          </Button> */}
        </div>
      </div>

      {/* Campaigns List */}
      <Card>
        <CardHeader>
          <CardTitle>Suas Campanhas</CardTitle>
          <CardDescription>
            Lista completa de todas as suas campanhas de WhatsApp
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="text-primary h-8 w-8 animate-spin" />
              <span className="text-muted-foreground ml-2">
                Carregando campanhas...
              </span>
            </div>
          ) : isError ? (
            <div className="flex h-40 items-center justify-center text-red-600">
              Erro ao carregar campanhas: {error.message}
            </div>
          ) : campaigns.length === 0 ? (
            <div className="text-muted-foreground flex h-40 items-center justify-center">
              Nenhuma campanha encontrada.
            </div>
          ) : (
            <div className="space-y-4">
              {campaigns.map((campaign) => {
                const statusInfo = getStatusBadge(campaign.status);
                const progress =
                  campaign.contactsCount > 0
                    ? (campaign.sentCount / campaign.contactsCount) * 100
                    : 0;
                const deliveryRate =
                  campaign.sentCount > 0
                    ? (campaign.deliveredCount / campaign.sentCount) * 100
                    : 0;
                const readRate =
                  campaign.deliveredCount > 0
                    ? (campaign.readCount / campaign.deliveredCount) * 100
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
                            .toUpperCase()
                            .slice(0, 2)}{" "}
                          {/* Limit to 2 characters */}
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

                        <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                          {" "}
                          {/* Use flex-wrap for better responsiveness */}
                          <span>Template: {campaign.templateName}</span>
                          <span>•</span>
                          <span>{campaign.contactsCount} contatos</span>
                          <span>•</span>
                          <span>
                            Criada em {formatDateTime(campaign.createdAt)}
                          </span>
                          {campaign.scheduledFor && (
                            <>
                              <span>•</span>
                              <span>
                                Agendada para{" "}
                                {formatDateTime(campaign.scheduledFor)}
                              </span>
                            </>
                          )}
                          {campaign.instanceName && (
                            <>
                              <span>•</span>
                              <span>Instância: {campaign.instanceName}</span>
                            </>
                          )}
                        </div>

                        {campaign.status !== "scheduled" &&
                          campaign.status !== "completed" &&
                          campaign.status !== "cancelled" && ( // Show progress only for running/paused
                            <div className="mt-2">
                              <div className="text-muted-foreground mb-1 flex items-center gap-2 text-xs">
                                <span>
                                  Progresso: {campaign.sentCount}/
                                  {campaign.contactsCount}
                                </span>
                                <span>•</span>
                                <span>Entrega: {deliveryRate.toFixed(1)}%</span>
                                <span>•</span>
                                <span>Leitura: {readRate.toFixed(1)}%</span>
                              </div>
                              <Progress value={progress} className="h-2" />
                            </div>
                          )}
                        {campaign.status === "completed" && (
                          <div className="text-muted-foreground mt-2 text-xs">
                            Campanha concluída. Total enviado:{" "}
                            {campaign.sentCount}/{campaign.contactsCount}
                          </div>
                        )}
                        {campaign.status === "cancelled" && (
                          <div className="text-muted-foreground mt-2 text-xs">
                            Campanha cancelada. Total enviado:{" "}
                            {campaign.sentCount}/{campaign.contactsCount}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Action Buttons based on status */}
                      {campaign.status === "active" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            pauseCampaignMutation.mutate(campaign.id)
                          }
                          disabled={pauseCampaignMutation.isLoading}
                        >
                          {pauseCampaignMutation.isLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Pause className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                      {(campaign.status === "paused" ||
                        campaign.status === "scheduled") && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            startCampaignMutation.mutate(campaign.id)
                          }
                          disabled={startCampaignMutation.isLoading}
                        >
                          {startCampaignMutation.isLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                        </Button>
                      )}

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              /* Implement view details logic */
                            }}
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            Ver Detalhes
                          </DropdownMenuItem>
                          {/* Show Edit only for non-active/completed/cancelled campaigns */}
                          {(campaign.status === "scheduled" ||
                            campaign.status === "paused") && (
                            <DropdownMenuItem
                              onClick={() => {
                                /* Implement edit logic */
                              }}
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() =>
                              duplicateCampaignMutation.mutate(campaign.id)
                            }
                            disabled={duplicateCampaignMutation.isLoading}
                          >
                            {duplicateCampaignMutation.isLoading ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Square className="mr-2 h-4 w-4" />
                            )}
                            Duplicar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {/* Allow deletion for non-active/completed/cancelled campaigns */}
                          {campaign.status !== "active" && (
                            <DropdownMenuItem
                              onClick={() =>
                                deleteCampaignMutation.mutate(campaign.id)
                              }
                              disabled={deleteCampaignMutation.isLoading}
                              className="text-destructive focus:text-red-700"
                            >
                              {deleteCampaignMutation.isLoading ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="mr-2 h-4 w-4" />
                              )}
                              Excluir
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
      {/* You might add pagination controls here */}
    </div>
  );
}
