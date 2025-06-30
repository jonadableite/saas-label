// src/app/(protected)/campaigns/templates/_components/template-card.tsx
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertCircle,
  BarChart2,
  CircleDot,
  Clock,
  Copy,
  Edit,
  Eye,
  FileText,
  ImageIcon,
  List,
  MessageSquare,
  MessageSquareText,
  MoreVertical,
  Music,
  Send,
  Sticker,
  Tag,
  Trash2,
  Video,
} from "lucide-react";

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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
// Importar os tipos do schema para garantir consistência
import { Template, TemplateType } from "@/db/schema"; // Ajuste o caminho conforme necessário

// Definir a interface TemplateCardProps
interface TemplateCardProps {
  template: Template; // Usar o tipo Template do schema
  onEdit: () => void;
  onPreview: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

// Mapeamento de tipos de template para ícones
const getTemplateTypeIcon = (type: TemplateType) => {
  switch (type) {
    case "text":
      return <MessageSquareText className="h-4 w-4" />;
    case "image":
      return <ImageIcon className="h-4 w-4" />;
    case "document":
      return <FileText className="h-4 w-4" />;
    case "video":
      return <Video className="h-4 w-4" />;
    case "audio":
      return <Music className="h-4 w-4" />;
    case "sticker":
      return <Sticker className="h-4 w-4" />;
    case "button":
      return <MessageSquare className="h-4 w-4" />;
    case "list":
      return <List className="h-4 w-4" />;
    default:
      return <MessageSquareText className="h-4 w-4" />;
  }
};

// Função para formatar tamanho do arquivo
const formatBytes = (bytes: number, decimals = 2) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
};

export default function TemplateCard({
  template,
  onEdit,
  onPreview,
  onDelete,
  onDuplicate,
}: TemplateCardProps) {
  // Conteúdo principal a ser exibido (texto ou descrição)
  // Para templates de mídia, o content geralmente é a legenda
  const mainContent =
    template.content || template.description || "Sem conteúdo";

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div className="flex items-center gap-3">
          {/* Ícone do tipo de template */}
          <div className="bg-primary/10 text-primary flex h-8 w-8 items-center justify-center rounded-md">
            {getTemplateTypeIcon(template.type)}
          </div>
          <div className="flex flex-col">
            <CardTitle className="text-lg font-semibold">
              {template.name}
            </CardTitle>
            {/* Badges para tipo e categoria */}
            <div className="mt-1 flex gap-1">
              <Badge variant="secondary" className="px-2 py-0.5 text-xs">
                {template.type.charAt(0).toUpperCase() + template.type.slice(1)}
              </Badge>
              {template.category && template.category !== "general" && (
                <Badge variant="secondary" className="px-2 py-0.5 text-xs">
                  {template.category.charAt(0).toUpperCase() +
                    template.category.slice(1)}
                </Badge>
              )}
              {/* Indicadores de status */}
              {template.isActive && (
                <Badge
                  variant="outline"
                  className="border-green-600 px-2 py-0.5 text-xs text-green-600"
                >
                  <CircleDot className="mr-1 h-3 w-3 fill-green-600 text-green-600" />{" "}
                  Ativo
                </Badge>
              )}
              {/* Assumindo que você tenha um campo isApproved no schema ou API */}
              {/* {template.isApproved && (
                 <Badge variant="outline" className="px-2 py-0.5 text-xs text-blue-600 border-blue-600">
                   <CheckCircle2 className="mr-1 h-3 w-3 text-blue-600" /> Aprovado
                 </Badge>
              )} */}
            </div>
          </div>
        </div>
        {/* Menu de ações */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <span className="sr-only">Abrir menu</span>
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>
              <Edit className="mr-2 h-4 w-4" /> Editar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDuplicate}>
              <Copy className="mr-2 h-4 w-4" /> Duplicar
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={onDelete}
              className="text-red-600 focus:text-red-700"
            >
              <Trash2 className="mr-2 h-4 w-4" /> Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>

      <CardContent className="flex-grow space-y-4 text-sm">
        {/* Pré-visualização da Mídia */}
        {template.mediaUrl &&
          (template.type === "image" || template.type === "sticker") && (
            <div className="bg-muted relative flex h-40 w-full items-center justify-center overflow-hidden rounded-md">
              <img
                src={template.mediaUrl}
                alt={template.fileName || "Pré-visualização de imagem"}
                className="h-full w-full object-contain" // Use object-contain para não cortar a imagem
              />
            </div>
          )}
        {template.mediaUrl && template.type === "video" && (
          <div className="bg-muted relative flex h-40 w-full items-center justify-center overflow-hidden rounded-md">
            <video
              src={template.mediaUrl}
              controls
              className="h-full w-full object-contain"
            />
          </div>
        )}
        {template.mediaUrl && template.type === "audio" && (
          <div className="bg-muted relative w-full rounded-md p-2">
            <audio src={template.mediaUrl} controls className="w-full" />
          </div>
        )}
        {/* Detalhes do Documento (mantido como texto) */}
        {template.mediaUrl && template.type === "document" && (
          <div>
            <p className="text-muted-foreground mb-1 text-xs font-semibold">
              Documento:
            </p>
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <FileText className="text-muted-foreground h-4 w-4" />
              <span>{template.fileName || "Arquivo"}</span>
              {template.fileSize && (
                <span>({formatBytes(template.fileSize)})</span>
              )}
              {template.fileType && <span>{template.fileType}</span>}
            </div>
          </div>
        )}
        {/* Conteúdo/Descrição (Legenda para mídias) */}
        {mainContent && (
          <div>
            <p className="text-muted-foreground mb-1 text-xs font-semibold">
              Conteúdo:
            </p>
            <CardDescription className="line-clamp-3 text-gray-700">
              {mainContent}
            </CardDescription>
          </div>
        )}
        {/* Detalhes específicos por tipo (Botões/Lista) */}
        {template.type === "button" &&
          template.buttons &&
          template.buttons.length > 0 && (
            <div>
              <p className="text-muted-foreground mb-1 text-xs font-semibold">
                Botões:
              </p>
              <p className="text-sm text-gray-700">
                {template.buttons.length} botão(ões) configurado(s)
              </p>
            </div>
          )}
        {template.type === "list" &&
          template.listSections &&
          template.listSections.length > 0 && (
            <div>
              <p className="text-muted-foreground mb-1 text-xs font-semibold">
                Lista:
              </p>
              <p className="text-sm text-gray-700">
                {template.listSections.length} seção(ões) na lista
              </p>
            </div>
          )}
        {/* Variáveis */}
        {template.variables && template.variables.length > 0 && (
          <div>
            <p className="text-muted-foreground mb-1 text-xs font-semibold">
              Variáveis:
            </p>
            <div className="flex flex-wrap gap-1">
              {template.variables.map((variable, index) => (
                <Badge
                  key={index}
                  variant={
                    template.requiredVariables?.includes(variable)
                      ? "destructive"
                      : "secondary"
                  } // Destaque para obrigatórias
                  className="px-2 py-0.5 font-mono text-xs"
                >
                  {`{{${variable}}}`}
                  {template.requiredVariables?.includes(variable) && (
                    <AlertCircle className="ml-1 h-3 w-3" />
                  )}
                </Badge>
              ))}
            </div>
          </div>
        )}
        {/* Tags */}
        {template.tags && template.tags.length > 0 && (
          <div>
            <p className="text-muted-foreground mb-1 text-xs font-semibold">
              Tags:
            </p>
            <div className="flex flex-wrap gap-1">
              {template.tags.map((tag, index) => (
                <Badge
                  key={index}
                  variant="outline"
                  className="px-2 py-0.5 text-xs"
                >
                  <Tag className="text-muted-foreground mr-1 h-3 w-3" /> {tag}
                </Badge>
              ))}
            </div>
          </div>
        )}
        <Separator /> {/* Separador para estatísticas */}
        {/* Estatísticas */}
        <div className="text-muted-foreground grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
          <div className="flex items-center gap-1">
            <Send className="h-3 w-3" />
            <span>Usado: {template.timesUsed || 0} vezes</span>
          </div>
          {template.successRate !== undefined && (
            <div className="flex items-center gap-1">
              <BarChart2 className="h-3 w-3" />
              <span>Sucesso: {template.successRate}%</span>
            </div>
          )}
          {/* Assumindo que você tenha um campo avgDeliveryTime no schema ou API */}
          {/* {template.avgDeliveryTime !== undefined && (
                 <div className="flex items-center gap-1">
                     <Clock className="h-3 w-3" />
                     <span>Entrega Média: {template.avgDeliveryTime}s</span>
                 </div>
            )} */}
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>
              {template.lastUsedAt
                ? `Último uso: ${formatDistanceToNow(new Date(template.lastUsedAt), { addSuffix: true, locale: ptBR })}`
                : "Nunca usado"}
            </span>
          </div>
        </div>
      </CardContent>

      <div className="p-4 pt-0">
        <Button variant="outline" className="w-full" onClick={onPreview}>
          <Eye className="mr-2 h-4 w-4" /> Pré-visualizar
        </Button>
      </div>
    </Card>
  );
}
