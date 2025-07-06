// src/app/(protected)/campaigns/templates/page.tsx
"use client";

import {
  FileText,
  Filter,
  ImageIcon,
  List,
  MessageSquare,
  MessageSquareText,
  Music,
  Plus,
  Search,
  Sticker,
  Video,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { CreateTemplateModal } from "./_components/create-template-modal";
import { EditTemplateModal } from "./_components/edit-template-modal";
import { PreviewTemplateModal } from "./_components/preview-template-modal";
import TemplateCard from "./_components/template-card";

// Interface para o template, baseada na estrutura que a API de GET retorna
interface Template {
  id: string;
  // Note: A API parece usar 'type' para classificação e 'category' para tipo de mensagem.
  // Vamos usar 'type' para classificação (promotional, etc.) e 'category' para tipo de mensagem (texto, midia, etc.)
  type: "promotional" | "informational" | "reminder" | "transactional" | string; // API's classification
  category:
    | "texto"
    | "midia"
    | "documento"
    | "botoes"
    | "lista"
    | "video"
    | "audio"
    | "sticker"
    | string; // API's message type
  name: string;
  content?: string;
  variables?: string[]; // Variables extracted from content
  usage?: number; // Assuming this is usage count
  lastUsed?: string; // Assuming this is last used date string
  createdAt: string;
  mediaUrl?: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  buttons?: any[]; // Structure needs to match buttonSchema from modal
  listConfig?: {
    // Assuming list config is nested in API response
    title?: string;
    buttonText?: string;
    footerText?: string;
    sections?: any[]; // Structure needs to match listSectionSchema from modal
  };
  spintexEnabled?: boolean;
  variations?: string[];
  description?: string;
  tags?: string[];
  // API might also return these top-level for button/list types, need clarification
  title?: string; // Used for button/list title
  footer?: string; // Used for button footer
  buttonText?: string; // Used for list button text
  footerText?: string; // Used for list footer text
  sections?: any[]; // Used for list type (alternative to listConfig)
  // Add other fields returned by your API
  timesUsed?: number; // Added based on TemplateService
  successRate?: number; // Added based on TemplateService
  lastUsedAt?: string; // Added based on TemplateService
}

const getCategoryIcon = (category: string) => {
  switch (category) {
    case "texto":
      return (
        <MessageSquareText className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
      );
    case "midia":
    case "image":
      return (
        <ImageIcon className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
      );
    case "documento":
      return (
        <FileText className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
      );
    case "video":
      return <Video className="text-muted-foreground mx-auto mb-4 h-12 w-12" />;
    case "audio":
      return <Music className="text-muted-foreground mx-auto mb-4 h-12 w-12" />;
    case "sticker":
      return (
        <Sticker className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
      );
    case "botoes":
      return (
        <MessageSquare className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
      );
    case "lista":
      return <List className="text-muted-foreground mx-auto mb-4 h-12 w-12" />;
    default:
      return (
        <MessageSquareText className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
      );
  }
};

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all"); // Filter by API 'type' (classification)
  const [categoryFilter, setCategoryFilter] = useState("all"); // Filter by API 'category' (message type)
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);

  // --- Data Fetching ---
  const fetchTemplates = async () => {
    setIsLoadingTemplates(true);
    try {
      const response = await fetch("/api/templates");
      if (!response.ok) {
        throw new Error("Failed to fetch templates");
      }
      const data = await response.json();
      // CORRECTED: Ensure 'templates' state is set with the array
      if (Array.isArray(data.templates)) {
        setTemplates(data.templates);
      } else {
        console.error("API response did not contain a templates array:", data);
        setTemplates([]); // Set to empty array to avoid errors
        toast.error("Formato inesperado na resposta da API de templates.");
      }
    } catch (error) {
      console.error("Error fetching templates:", error);
      toast.error("Erro ao carregar templates.");
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []); // Fetch templates on component mount

  // --- State Handlers for CRUD Operations ---
  // Handle template creation
  const handleCreateTemplate = (newTemplate: Template) => {
    // API POST /api/templates returns { template: {...} }
    // Add the new template to the state
    setTemplates((prevTemplates) => [...prevTemplates, newTemplate]);
    toast.success("Template criado com sucesso!");
  };

  // Handle template update
  const handleUpdateTemplate = (updatedTemplate: Template) => {
    // API PUT /api/templates/[id] returns { template: {...} }
    // Replace the old template with the updated one in the state
    setTemplates((prevTemplates) =>
      prevTemplates.map((t) =>
        t.id === updatedTemplate.id ? updatedTemplate : t,
      ),
    );
    toast.success("Template atualizado com sucesso!");
  };

  // Handle template deletion (assuming a DELETE API exists)
  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm("Tem certeza que deseja excluir este template?")) {
      return;
    }
    try {
      // Assuming DELETE /api/templates/[id] exists and returns success status
      const response = await fetch(`/api/templates/${templateId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Failed to delete template");
      }
      // Remove the template from the state
      setTemplates((prevTemplates) =>
        prevTemplates.filter((t) => t.id !== templateId),
      );
      toast.success("Template excluído com sucesso!");
    } catch (error) {
      console.error("Error deleting template:", error);
      toast.error("Erro ao excluir template.");
    }
  };

  // Handle template duplication (assuming a DUPLICATE API or logic exists)
  const handleDuplicateTemplate = async (template: Template) => {
    try {
      // This is a simplified client-side duplication logic for demonstration.
      // A robust solution would involve a backend API endpoint for duplication
      // to handle database insertion and unique ID generation properly.
      const newTemplateData = {
        ...template,
        id: crypto.randomUUID(), // Generate a new client-side ID (replace with backend ID)
        name: `${template.name} (Cópia)`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        // Reset usage stats for the copy
        timesUsed: 0,
        successRate: 0,
        lastUsedAt: undefined,
      };

      // Assuming you would then POST this new template data to your API
      const response = await fetch("/api/templates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newTemplateData), // Send the new template data
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to duplicate template");
      }

      const createdTemplate = await response.json(); // API returns { template: {...} }

      // Add the newly created template (from API response) to the state
      handleCreateTemplate(createdTemplate.template);

      toast.success("Template duplicado com sucesso!");
    } catch (error: any) {
      console.error("Error duplicating template:", error);
      toast.error(`Erro ao duplicar template: ${error.message}`);
    }
  };

  // --- Filtering and Searching ---
  const filteredTemplates = useMemo(() => {
    // CORRECTED: Ensure 'templates' is the array before filtering
    if (!Array.isArray(templates)) {
      console.error("Templates state is not an array:", templates);
      return []; // Return empty array if state is invalid
    }

    return templates.filter((template) => {
      const matchesSearch =
        template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        template.content?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        template.description
          ?.toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        template.tags?.some((tag) =>
          tag.toLowerCase().includes(searchTerm.toLowerCase()),
        );

      const matchesType = typeFilter === "all" || template.type === typeFilter;
      const matchesCategory =
        categoryFilter === "all" || template.category === categoryFilter;

      return matchesSearch && matchesType && matchesCategory;
    });
  }, [templates, searchTerm, typeFilter, categoryFilter]);

  // --- Stats Calculation ---
  const stats = useMemo(() => {
    const total = templates.length;
    const filteredTotal = filteredTemplates.length;
    const text = templates.filter((t) => t.category === "texto").length;
    const media = templates.filter((t) =>
      ["midia", "image", "documento", "video", "audio", "sticker"].includes(
        t.category,
      ),
    ).length;
    const buttons = templates.filter((t) => t.category === "botoes").length;
    const lists = templates.filter((t) => t.category === "lista").length;

    return {
      total,
      filteredTotal,
      text,
      media,
      buttons,
      lists,
    };
  }, [templates, filteredTemplates]); // Depend on templates and filteredTemplates

  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      {" "}
      {/* Modified className here */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Templates</h1>
        <CreateTemplateModal onTemplateCreated={handleCreateTemplate}>
          <Button variant="magic" >
            <Plus className="mr-2 h-4 w-4" />
            Criar Novo Template
          </Button>
        </CreateTemplateModal>
      </div>
      {/* Stats Cards */}
      <div className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total de Templates
            </CardTitle>
            <FileText className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            {isLoadingTemplates ? (
              <div className="bg-muted h-6 w-12 animate-pulse rounded"></div>
            ) : (
              <div className="text-2xl font-bold">{stats.total}</div>
            )}
            <p className="text-muted-foreground text-xs">
              Templates cadastrados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Templates de Texto
            </CardTitle>
            <MessageSquareText className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            {isLoadingTemplates ? (
              <div className="bg-muted h-6 w-12 animate-pulse rounded"></div>
            ) : (
              <div className="text-2xl font-bold">{stats.text}</div>
            )}
            <p className="text-muted-foreground text-xs">Apenas texto</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Templates de Mídia
            </CardTitle>
            <ImageIcon className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            {isLoadingTemplates ? (
              <div className="bg-muted h-6 w-12 animate-pulse rounded"></div>
            ) : (
              <div className="text-2xl font-bold">{stats.media}</div>
            )}
            <p className="text-muted-foreground text-xs">
              Imagem, vídeo, áudio, documento, sticker
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Templates Interativos
            </CardTitle>
            <MessageSquare className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            {isLoadingTemplates ? (
              <div className="bg-muted h-6 w-12 animate-pulse rounded"></div>
            ) : (
              <div className="text-2xl font-bold">
                {stats.buttons + stats.lists}
              </div>
            )}
            <p className="text-muted-foreground text-xs">Botões e listas</p>
          </CardContent>
        </Card>
      </div>
      {/* Filters */}
      <div className="mb-6 flex flex-col gap-2 md:flex-row">
        <div className="relative max-w-sm flex-1">
          <Search className="text-muted-foreground absolute top-2.5 left-2 h-4 w-4" />
          <Input
            placeholder="Buscar templates..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full md:w-[180px]">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Filtrar por Categoria" />{" "}
            {/* Filter by API type (classification) */}
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as Categorias</SelectItem>
            <SelectItem value="promotional">Promocional</SelectItem>
            <SelectItem value="informational">Informativo</SelectItem>
            <SelectItem value="reminder">Lembrete</SelectItem>
            <SelectItem value="transactional">Transacional</SelectItem>
            {/* Add other categories as needed */}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full md:w-[180px]">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Filtrar por Tipo" />{" "}
            {/* Filter by API category (message type) */}
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Tipos</SelectItem>
            <SelectItem value="texto">Texto</SelectItem>
            <SelectItem value="midia">Mídia</SelectItem>
            <SelectItem value="documento">Documento</SelectItem>
            <SelectItem value="video">Vídeo</SelectItem>
            <SelectItem value="audio">Áudio</SelectItem>
            <SelectItem value="sticker">Sticker</SelectItem>
            <SelectItem value="botoes">Botões</SelectItem>
            <SelectItem value="lista">Lista</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {/* Templates Grid */}
      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">Todos ({stats.filteredTotal})</TabsTrigger>
          <TabsTrigger value="texto">
            Texto (
            {filteredTemplates.filter((t) => t.category === "texto").length})
          </TabsTrigger>
          <TabsTrigger value="midia">
            Mídia (
            {
              filteredTemplates.filter((t) =>
                ["midia", "video", "audio", "documento", "sticker"].includes(
                  t.category,
                ),
              ).length
            }
            )
          </TabsTrigger>
          <TabsTrigger value="botoes">
            Botões (
            {filteredTemplates.filter((t) => t.category === "botoes").length})
          </TabsTrigger>
          <TabsTrigger value="lista">
            Listas (
            {filteredTemplates.filter((t) => t.category === "lista").length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="all">
          {isLoadingTemplates ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {/* Skeleton Loaders */}
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="bg-muted h-4 w-4 rounded"></div>
                        <div className="bg-muted h-5 w-32 rounded"></div>
                      </div>
                      <div className="bg-muted h-6 w-6 rounded"></div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="bg-muted h-4 w-20 rounded"></div>
                      <div className="bg-muted h-4 w-16 rounded"></div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="bg-muted h-20 w-full rounded"></div>
                    <div className="bg-muted h-4 w-full rounded"></div>
                    <div className="bg-muted h-4 w-5/6 rounded"></div>
                    <div className="flex flex-wrap gap-1">
                      <div className="bg-muted h-4 w-16 rounded"></div>
                      <div className="bg-muted h-4 w-16 rounded"></div>
                    </div>
                    <div className="text-muted-foreground flex items-center justify-between border-t pt-2 text-xs">
                      <div className="bg-muted h-3 w-16 rounded"></div>
                      <div className="bg-muted h-3 w-20 rounded"></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="py-12 text-center">
              <MessageSquare className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
              <h3 className="mb-2 text-lg font-semibold">
                Nenhum template encontrado
              </h3>
              <p className="text-muted-foreground mb-4">
                Tente ajustar os filtros ou criar um novo template
              </p>
              <CreateTemplateModal onTemplateCreated={handleCreateTemplate}>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Criar Novo Template
                </Button>
              </CreateTemplateModal>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredTemplates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onEdit={() => setEditingTemplate(template)}
                  onPreview={() => setPreviewTemplate(template)}
                  onDelete={() => handleDeleteTemplate(template.id)}
                  onDuplicate={() => handleDuplicateTemplate(template)}
                />
              ))}
            </div>
          )}
        </TabsContent>
        {/* Render tabs for specific categories */}
        {(["texto", "midia", "botoes", "lista"] as const).map((category) => {
          // Group media types under 'midia' tab for display
          const tabCategories =
            category === "midia"
              ? ["midia", "video", "audio", "documento", "sticker"]
              : [category];
          const templatesForTab = filteredTemplates.filter((t) =>
            tabCategories.includes(t.category),
          );
          return (
            <TabsContent key={category} value={category}>
              {isLoadingTemplates ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {/* Skeleton Loaders */}
                  {[...Array(3)].map((_, i) => (
                    <Card key={i} className="animate-pulse">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <div className="bg-muted h-4 w-4 rounded"></div>
                            <div className="bg-muted h-5 w-32 rounded"></div>
                          </div>
                          <div className="bg-muted h-6 w-6 rounded"></div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="bg-muted h-4 w-20 rounded"></div>
                          <div className="bg-muted h-4 w-16 rounded"></div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="bg-muted h-20 w-full rounded"></div>
                        <div className="bg-muted h-4 w-full rounded"></div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : templatesForTab.length === 0 ? (
                <div className="py-12 text-center">
                  {getCategoryIcon(category)}
                  <h3 className="mt-4 mb-2 text-lg font-semibold">
                    Nenhum template de {category}
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    Crie templates com {category} para enriquecer suas campanhas
                  </p>
                  <CreateTemplateModal onTemplateCreated={handleCreateTemplate}>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      Criar Template de {category}
                    </Button>
                  </CreateTemplateModal>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {templatesForTab.map((template) => (
                    <TemplateCard
                      key={template.id}
                      template={template}
                      onEdit={() => setEditingTemplate(template)}
                      onPreview={() => setPreviewTemplate(template)}
                      onDelete={() => handleDeleteTemplate(template.id)}
                      onDuplicate={() => handleDuplicateTemplate(template)}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          );
        })}
      </Tabs>
      {/* Modals */}
      {editingTemplate && (
        <EditTemplateModal
          template={editingTemplate}
          open={!!editingTemplate}
          onOpenChange={() => setEditingTemplate(null)}
          onTemplateUpdated={handleUpdateTemplate} // Pass the handler to update state after API call
        />
      )}
      {previewTemplate && (
        <PreviewTemplateModal
          template={previewTemplate}
          open={!!previewTemplate}
          onOpenChange={() => setPreviewTemplate(null)}
        />
      )}
    </div>
  );
}
