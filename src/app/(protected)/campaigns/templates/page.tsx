// src/app/(protected)/campaigns/templates/page.tsx
"use client";

import {
  Copy,
  Edit,
  Eye,
  FileText,
  Filter,
  Image,
  List,
  MessageSquare,
  MoreVertical,
  MousePointer,
  Music,
  Plus,
  Search,
  Trash2,
  Video
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
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

// Tipos de template expandidos
interface Template {
  id: string;
  name: string;
  type: "promotional" | "informational" | "reminder" | "transactional";
  category: "texto" | "midia" | "documento" | "botoes" | "lista" | "video" | "audio";
  content: string;
  variables: string[];
  usage: number;
  lastUsed: string;
  createdAt: string;
  mediaUrl?: string;
  mediaType?: "image" | "video" | "audio" | "document";
  buttons?: any[];
  listConfig?: any;
  spintexEnabled?: boolean;
  variations?: string[];
}

// Templates de exemplo expandidos
const initialTemplates: Template[] = [
  {
    id: "1",
    name: "Oferta Especial Black Friday",
    type: "promotional",
    category: "texto",
    content: "🎉 *BLACK FRIDAY IMPERDÍVEL!*\n\nOlá {{nome}}!\n\nApenas hoje: *50% OFF* em todos os produtos!\n\n✅ Frete GRÁTIS\n✅ Até 12x sem juros\n✅ Entrega expressa\n\nClique aqui: {{link}}\n\n⏰ Oferta válida até 23:59h",
    variables: ["nome", "link"],
    usage: 156,
    lastUsed: "2024-01-15",
    createdAt: "2024-01-10",
    spintexEnabled: true,
    variations: [
      "🎉 *BLACK FRIDAY IMPERDÍVEL!*",
      "🔥 *SUPER BLACK FRIDAY!*",
      "💥 *BLACK FRIDAY ESPECIAL!*"
    ]
  },
  {
    id: "2",
    name: "Newsletter Semanal",
    type: "informational",
    category: "texto",
    content: "📰 *Newsletter Semanal*\n\nOlá {{nome}}!\n\nConfira as novidades desta semana:\n\n• {{novidade1}}\n• {{novidade2}}\n• {{novidade3}}\n\nPara mais informações, acesse: {{site}}",
    variables: ["nome", "novidade1", "novidade2", "novidade3", "site"],
    usage: 89,
    lastUsed: "2024-01-14",
    createdAt: "2024-01-05",
  },
  {
    id: "3",
    name: "Lembrete de Consulta",
    type: "reminder",
    category: "texto",
    content: "🏥 *Lembrete de Consulta*\n\nOlá {{nome}}!\n\nLembramos que você tem consulta agendada:\n\n📅 Data: {{data}}\n🕐 Horário: {{horario}}\n👨‍⚕️ Médico: {{medico}}\n📍 Local: {{endereco}}\n\nPor favor, chegue 15 minutos antes.",
    variables: ["nome", "data", "horario", "medico", "endereco"],
    usage: 234,
    lastUsed: "2024-01-16",
    createdAt: "2024-01-08",
  },
  {
    id: "4",
    name: "Produto com Imagem",
    type: "promotional",
    category: "midia",
    content: "🛍️ *Novidade Chegou!*\n\nOlá {{nome}}!\n\nConheça nosso novo produto: {{produto}}\n\n💰 Por apenas: {{preco}}\n\nClique no link para comprar: {{link}}",
    variables: ["nome", "produto", "preco", "link"],
    mediaUrl: "/templates/produto-exemplo.jpg",
    mediaType: "image",
    usage: 67,
    lastUsed: "2024-01-12",
    createdAt: "2024-01-07",
  },
  {
    id: "5",
    name: "Menu Interativo",
    type: "informational",
    category: "botoes",
    content: "🍕 *Bem-vindo ao {{restaurante}}!*\n\nOlá {{nome}}!\n\nEscolha uma das opções abaixo:",
    variables: ["restaurante", "nome"],
    buttons: [
      { type: "reply", displayText: "Ver Cardápio", id: "cardapio" },
      { type: "reply", displayText: "Fazer Pedido", id: "pedido" },
      { type: "url", displayText: "Localização", url: "https://maps.google.com" }
    ],
    usage: 45,
    lastUsed: "2024-01-13",
    createdAt: "2024-01-09",
  },
  {
    id: "6",
    name: "Catálogo de Produtos",
    type: "promotional",
    category: "lista",
    content: "🛒 *Catálogo {{loja}}*\n\nOlá {{nome}}!\n\nEscolha uma categoria:",
    variables: ["loja", "nome"],
    listConfig: {
      title: "Categorias",
      buttonText: "Selecionar",
      sections: [
        {
          title: "Roupas",
          rows: [
            { title: "Camisetas", description: "Várias cores e tamanhos", rowId: "camisetas" },
            { title: "Calças", description: "Jeans e sociais", rowId: "calcas" }
          ]
        }
      ]
    },
    usage: 23,
    lastUsed: "2024-01-11",
    createdAt: "2024-01-06",
  }
];

const getTypeColor = (type: string) => {
  const colors = {
    promotional: "bg-green-100 text-green-800",
    informational: "bg-blue-100 text-blue-800",
    reminder: "bg-yellow-100 text-yellow-800",
    transactional: "bg-purple-100 text-purple-800",
  };
  return colors[type as keyof typeof colors] || "bg-gray-100 text-gray-800";
};

const getCategoryIcon = (category: string) => {
  const icons = {
    texto: <MessageSquare className="h-4 w-4" />,
    midia: <Image className="h-4 w-4" />,
    documento: <FileText className="h-4 w-4" />,
    botoes: <MousePointer className="h-4 w-4" />,
    lista: <List className="h-4 w-4" />,
    video: <Video className="h-4 w-4" />,
    audio: <Music className="h-4 w-4" />,
  };
  return icons[category as keyof typeof icons] || <MessageSquare className="h-4 w-4" />;
};

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>(initialTemplates);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);

  // Filtros e busca
  const filteredTemplates = useMemo(() => {
    return templates.filter(template => {
      const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          template.content.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = typeFilter === "all" || template.type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [templates, searchTerm, typeFilter]);

  // Estatísticas
  const stats = useMemo(() => {
    const textTemplates = filteredTemplates.filter(t => t.category === "texto");
    const mediaTemplates = filteredTemplates.filter(t => t.category === "midia");
    const buttonTemplates = filteredTemplates.filter(t => t.category === "botoes");
    const listTemplates = filteredTemplates.filter(t => t.category === "lista");
    const mostUsed = templates.reduce((prev, current) =>
      prev.usage > current.usage ? prev : current
    );

    return {
      total: filteredTemplates.length,
      text: textTemplates.length,
      media: mediaTemplates.length,
      buttons: buttonTemplates.length,
      lists: listTemplates.length,
      mostUsed: mostUsed.usage,
      mostUsedName: mostUsed.name
    };
  }, [filteredTemplates, templates]);

  // Ações dos templates
  const handleDuplicate = (template: Template) => {
    const duplicated = {
      ...template,
      id: Date.now().toString(),
      name: `${template.name} (Cópia)`,
      usage: 0,
      createdAt: new Date().toISOString().split('T')[0],
      lastUsed: new Date().toISOString().split('T')[0]
    };
    setTemplates(prev => [duplicated, ...prev]);
    toast.success("Template duplicado com sucesso!");
  };

  const handleDelete = (templateId: string) => {
    setTemplates(prev => prev.filter(t => t.id !== templateId));
    toast.success("Template excluído com sucesso!");
  };

  const handleEdit = (template: Template) => {
    setEditingTemplate(template);
  };

  const handleUpdateTemplate = (updatedTemplate: Template) => {
    setTemplates(prev => prev.map(t =>
      t.id === updatedTemplate.id ? updatedTemplate : t
    ));
    setEditingTemplate(null);
    toast.success("Template atualizado com sucesso!");
  };

  const handleCreateTemplate = (newTemplate: Omit<Template, "id" | "usage" | "lastUsed" | "createdAt">) => {
    const template: Template = {
      ...newTemplate,
      id: Date.now().toString(),
      usage: 0,
      lastUsed: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString().split('T')[0]
    };
    setTemplates(prev => [template, ...prev]);
    toast.success("Template criado com sucesso!");
  };

  // Componente do card de template
  const TemplateCard = ({ template }: { template: Template }) => (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            {getCategoryIcon(template.category)}
            <CardTitle className="text-base truncate">{template.name}</CardTitle>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setPreviewTemplate(template)}>
                <Eye className="mr-2 h-4 w-4" />
                Visualizar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDuplicate(template)}>
                <Copy className="mr-2 h-4 w-4" />
                Duplicar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleEdit(template)}>
                <Edit className="mr-2 h-4 w-4" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => handleDelete(template.id)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={getTypeColor(template.type)}>
            {template.type}
          </Badge>
          <Badge variant="outline">{template.category}</Badge>
          {template.spintexEnabled && (
            <Badge variant="secondary" className="text-xs">
              Spintex
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {template.mediaUrl && (
          <div className="aspect-video rounded-md bg-muted flex items-center justify-center">
            {template.mediaType === "video" ? (
              <Video className="h-8 w-8 text-muted-foreground" />
            ) : template.mediaType === "audio" ? (
              <Music className="h-8 w-8 text-muted-foreground" />
            ) : (
              <Image className="h-8 w-8 text-muted-foreground" />
            )}
          </div>
        )}

        <div className="text-sm text-muted-foreground line-clamp-3">
          {template.content}
        </div>

        {template.buttons && template.buttons.length > 0 && (
          <div className="flex flex-wrap gap-1">
            <Badge variant="outline" className="text-xs">
              {template.buttons.length} botão(ões)
            </Badge>
          </div>
        )}

        {template.listConfig && (
          <div className="flex flex-wrap gap-1">
            <Badge variant="outline" className="text-xs">
              Lista interativa
            </Badge>
          </div>
        )}

        <div className="flex flex-wrap gap-1">
          {template.variables.map((variable) => (
            <Badge key={variable} variant="secondary" className="text-xs">
              {`{{${variable}}}`}
            </Badge>
          ))}
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
          <span>Usado {template.usage}x</span>
          <span>Criado em {formatDate(template.createdAt)}</span>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Templates</h2>
          <p className="text-muted-foreground">
            Crie e gerencie templates para suas campanhas
          </p>
        </div>
        <CreateTemplateModal onTemplateCreated={handleCreateTemplate}>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Template
          </Button>
        </CreateTemplateModal>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Templates</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              {templates.length > stats.total ? `${templates.length - stats.total} filtrado(s)` : "templates ativos"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mais Usado</CardTitle>
            <Copy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.mostUsed}</div>
            <p className="text-xs text-muted-foreground">
              {stats.mostUsedName}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Templates Texto</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.text}</div>
            <p className="text-xs text-muted-foreground">
              {stats.total > 0 ? Math.round((stats.text / stats.total) * 100) : 0}% do total
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Templates Interativos</CardTitle>
            <MousePointer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.buttons + stats.lists}</div>
            <p className="text-xs text-muted-foreground">
              Botões e listas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar templates..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filtrar por tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="promotional">Promocional</SelectItem>
            <SelectItem value="informational">Informativo</SelectItem>
            <SelectItem value="reminder">Lembrete</SelectItem>
            <SelectItem value="transactional">Transacional</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Templates Grid */}
      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">Todos ({filteredTemplates.length})</TabsTrigger>
          <TabsTrigger value="texto">Texto</TabsTrigger>
          <TabsTrigger value="midia">Mídia</TabsTrigger>
          <TabsTrigger value="botoes">Botões</TabsTrigger>
          <TabsTrigger value="lista">Listas</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredTemplates.map((template) => (
              <TemplateCard key={template.id} template={template} />
            ))}
          </div>
          {filteredTemplates.length === 0 && (
            <div className="text-center py-12">
              <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhum template encontrado</h3>
              <p className="text-muted-foreground mb-4">
                Tente ajustar os filtros ou criar um novo template
              </p>
            </div>
          )}
        </TabsContent>

        {(['texto', 'midia', 'botoes', 'lista'] as const).map((category) => (
          <TabsContent key={category} value={category}>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredTemplates
                .filter(t => t.category === category)
                .map((template) => (
                  <TemplateCard key={template.id} template={template} />
                ))}
            </div>
            {filteredTemplates.filter(t => t.category === category).length === 0 && (
              <div className="text-center py-12">
                {getCategoryIcon(category)}
                <h3 className="text-lg font-semibold mb-2 mt-4">
                  Nenhum template de {category}
                </h3>
                <p className="text-muted-foreground mb-4">
                  Crie templates com {category} para enriquecer suas campanhas
                </p>
                <CreateTemplateModal onTemplateCreated={handleCreateTemplate}>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Criar Template de {category}
                  </Button>
                </CreateTemplateModal>
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Modals */}
      {editingTemplate && (
        <EditTemplateModal
          template={editingTemplate}
          open={!!editingTemplate}
          onOpenChange={() => setEditingTemplate(null)}
          onTemplateUpdated={handleUpdateTemplate}
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
