// src/app/(protected)/campaigns/templates/_components/preview-template-modal.tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowRight,
  Copy,
  Download,
  Eye,
  FileText,
  Image,
  List,
  MessageSquare,
  MousePointer,
  Music,
  Phone,
  RefreshCw,
  Send,
  Video
} from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SpintexProcessor } from "@/lib/spintex";

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
  description?: string;
  tags?: string[];
  title?: string;
  footer?: string;
  buttonText?: string;
  footerText?: string;
  sections?: any[];
}

interface PreviewTemplateModalProps {
  template: Template;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Schema para as variáveis do template
const createVariableSchema = (variables: string[]) => {
  const schemaObj: Record<string, z.ZodString> = {};
  variables.forEach(variable => {
    schemaObj[variable] = z.string().optional();
  });
  return z.object(schemaObj);
};

export function PreviewTemplateModal({
  template,
  open,
  onOpenChange
}: PreviewTemplateModalProps) {
  const [previewVariation, setPreviewVariation] = useState(0);
  const [testPhoneNumber, setTestPhoneNumber] = useState("");
  const [isSending, setIsSending] = useState(false);

  // Form para variáveis
  const variableSchema = createVariableSchema(template.variables || []);
  const form = useForm({
    resolver: zodResolver(variableSchema),
    defaultValues: template.variables?.reduce((acc, variable) => {
      acc[variable] = "";
      return acc;
    }, {} as Record<string, string>) || {}
  });

  const watchedVariables = form.watch();

  // Processar conteúdo com variáveis e spintex
  const processedContent = (() => {
    let content = template.content;

    // Substituir variáveis
    template.variables?.forEach(variable => {
      const value = watchedVariables[variable] || `{{${variable}}}`;
      content = content.replace(new RegExp(`{{${variable}}}`, 'g'), value);
    });

    // Processar spintex se habilitado
    if (template.spintexEnabled) {
      const variations = SpintexProcessor.generateVariations(content);
      return variations[previewVariation] || variations[0] || content;
    }

    return content;
  })();

  // Gerar variações do template
  const generateNewVariation = () => {
    if (template.spintexEnabled) {
      const variations = SpintexProcessor.generateVariations(template.content);
      setPreviewVariation((prev) => (prev + 1) % variations.length);
    }
  };

  // Copiar conteúdo para clipboard
  const copyToClipboard = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      toast.success("Conteúdo copiado para a área de transferência!");
    } catch (error) {
      toast.error("Erro ao copiar conteúdo");
    }
  };

  // Enviar mensagem de teste
  const sendTestMessage = async () => {
    if (!testPhoneNumber) {
      toast.error("Digite um número de telefone para teste");
      return;
    }

    setIsSending(true);
    try {
      const payload = createMessagePayload();

      // Simular envio da API (substituir pela sua implementação real)
      await new Promise(resolve => setTimeout(resolve, 2000));

      toast.success("Mensagem de teste enviada com sucesso!");
      setTestPhoneNumber("");
    } catch (error) {
      toast.error("Erro ao enviar mensagem de teste");
    } finally {
      setIsSending(false);
    }
  };

  // Criar payload para API baseado no tipo de template
  const createMessagePayload = () => {
    const basePayload = {
      number: testPhoneNumber,
    };

    switch (template.category) {
      case "texto":
        return {
          ...basePayload,
          text: processedContent
        };

      case "midia":
      case "video":
      case "audio":
      case "documento":
        return {
          ...basePayload,
          media: template.mediaUrl,
          caption: processedContent
        };

      case "botoes":
        return {
          ...basePayload,
          title: template.title || "Título",
          description: processedContent,
          footer: template.footer || "Rodapé",
          buttons: template.buttons || []
        };

      case "lista":
        return {
          ...basePayload,
          title: template.title || "Lista",
          description: processedContent,
          buttonText: template.buttonText || "Clique aqui",
          footerText: template.footerText || "Rodapé",
          sections: template.sections || []
        };

      default:
        return {
          ...basePayload,
          text: processedContent
        };
    }
  };

  // Componente de preview da mensagem
  const MessagePreview = () => {
    const getCategoryIcon = () => {
      switch (template.category) {
        case "midia": return <Image className="h-4 w-4" />;
        case "video": return <Video className="h-4 w-4" />;
        case "audio": return <Music className="h-4 w-4" />;
        case "documento": return <FileText className="h-4 w-4" />;
        case "botoes": return <MousePointer className="h-4 w-4" />;
        case "lista": return <List className="h-4 w-4" />;
        default: return <MessageSquare className="h-4 w-4" />;
      }
    };

    return (
      <div className="space-y-4">
        {/* Header do preview */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getCategoryIcon()}
            <span className="font-medium">Preview da Mensagem</span>
            <Badge variant="outline">{template.category}</Badge>
          </div>
          <div className="flex items-center gap-2">
            {template.spintexEnabled && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={generateNewVariation}
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Nova Variação
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard(createMessagePayload().text || processedContent)}
            >
              <Copy className="h-4 w-4 mr-1" />
              Copiar
            </Button>
          </div>
        </div>

        {/* Container da mensagem */}
        <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg">
          <div className="bg-white rounded-lg shadow-sm max-w-md mx-auto">
            {/* Mídia preview */}
            {template.mediaUrl && (
              <div className="aspect-video bg-gray-100 rounded-t-lg flex items-center justify-center">
                {template.category === "video" ? (
                  <div className="text-center">
                    <Video className="h-12 w-12 mx-auto text-gray-400 mb-2" />
                    <p className="text-sm text-gray-500">Vídeo</p>
                  </div>
                ) : template.category === "audio" ? (
                  <div className="text-center">
                    <Music className="h-12 w-12 mx-auto text-gray-400 mb-2" />
                    <p className="text-sm text-gray-500">Áudio</p>
                  </div>
                ) : template.category === "documento" ? (
                  <div className="text-center">
                    <FileText className="h-12 w-12 mx-auto text-gray-400 mb-2" />
                    <p className="text-sm text-gray-500">Documento</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <Image className="h-12 w-12 mx-auto text-gray-400 mb-2" />
                    <p className="text-sm text-gray-500">Imagem</p>
                  </div>
                )}
              </div>
            )}

            <div className="p-4">
              {/* Título (para botões e listas) */}
              {(template.category === "botoes" || template.category === "lista") && template.title && (
                <div className="font-bold text-lg mb-2">{template.title}</div>
              )}

              {/* Conteúdo principal */}
              <div className="whitespace-pre-wrap text-sm mb-3">
                {processedContent}
              </div>

              {/* Botões */}
              {template.category === "botoes" && template.buttons && (
                <div className="space-y-2">
                  {template.buttons.map((button, index) => (
                    <div
                      key={index}
                      className="border border-green-200 rounded-md p-2 text-center text-sm text-green-600 bg-green-50 hover:bg-green-100 cursor-pointer transition-colors"
                    >
                      {button.type === "url" && <ArrowRight className="h-3 w-3 inline mr-1" />}
                      {button.type === "call" && <Phone className="h-3 w-3 inline mr-1" />}
                      {button.type === "copy" && <Copy className="h-3 w-3 inline mr-1" />}
                      {button.displayText}
                    </div>
                  ))}
                </div>
              )}

              {/* Lista */}
              {template.category === "lista" && (
                <div className="border border-gray-200 rounded-md p-3 bg-gray-50">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">
                      {template.buttonText || "Selecionar opção"}
                    </span>
                    <ArrowRight className="h-4 w-4 text-gray-400" />
                  </div>
                </div>
              )}

              {/* Rodapé */}
              {(template.category === "botoes" || template.category === "lista") &&
               (template.footer || template.footerText) && (
                <div className="text-xs text-gray-500 mt-3 pt-2 border-t">
                  {template.footer || template.footerText}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Preview: {template.name}
          </DialogTitle>
          <DialogDescription>
            Visualize como o template será exibido no WhatsApp
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="preview" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="preview">Preview Visual</TabsTrigger>
            <TabsTrigger value="variables">Variáveis</TabsTrigger>
            <TabsTrigger value="code">Código API</TabsTrigger>
          </TabsList>

          {/* Preview Visual */}
          <TabsContent value="preview" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Informações do template */}
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Informações do Template</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Tipo:</span>
                      <Badge className={
                        template.type === "promotional" ? "bg-green-100 text-green-800" :
                        template.type === "informational" ? "bg-blue-100 text-blue-800" :
                        template.type === "reminder" ? "bg-yellow-100 text-yellow-800" :
                        "bg-purple-100 text-purple-800"
                      }>
                        {template.type}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Categoria:</span>
                      <Badge variant="outline">{template.category}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Variáveis:</span>
                      <span className="text-sm">{template.variables?.length || 0}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Usado:</span>
                      <span className="text-sm">{template.usage}x</span>
                    </div>
                    {template.spintexEnabled && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Spintex:</span>
                        <Badge variant="secondary">Habilitado</Badge>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Variáveis detectadas */}
                {template.variables && template.variables.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Variáveis Detectadas</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {template.variables.map((variable) => (
                          <Badge key={variable} variant="secondary">
                            {`{{${variable}}}`}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Tags */}
                {template.tags && template.tags.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Tags</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {template.tags.map((tag) => (
                          <Badge key={tag} variant="outline">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Preview da mensagem */}
              <div>
                <MessagePreview />
              </div>
            </div>

            {/* Teste de envio */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Enviar Teste</CardTitle>
                <DialogDescription>
                  Envie uma mensagem de teste para verificar como ficará no WhatsApp
                </DialogDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Input
                    placeholder="55999999999 (número com código do país)"
                    value={testPhoneNumber}
                    onChange={(e) => setTestPhoneNumber(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    onClick={sendTestMessage}
                    disabled={isSending || !testPhoneNumber}
                  >
                    {isSending ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Enviar Teste
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Configuração de variáveis */}
          <TabsContent value="variables" className="space-y-4">
            {template.variables && template.variables.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>Definir Valores das Variáveis</CardTitle>
                  <DialogDescription>
                    Configure valores para as variáveis para ver o resultado final
                  </DialogDescription>
                </CardHeader>
                <CardContent>
                  <Form {...form}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {template.variables.map((variable) => (
                        <FormField
                          key={variable}
                          control={form.control}
                          name={variable}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{`{{${variable}}}`}</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder={`Valor para ${variable}`}
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      ))}
                    </div>
                  </Form>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="text-center py-8">
                  <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Nenhuma variável encontrada</h3>
                  <p className="text-muted-foreground">
                    Este template não possui variáveis configuradas
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Preview com variáveis aplicadas */}
            <Card>
              <CardHeader>
                <CardTitle>Preview com Variáveis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-muted p-4 rounded-md">
                  <pre className="whitespace-pre-wrap text-sm">{processedContent}</pre>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Código da API */}
          <TabsContent value="code" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Payload da Evolution API</CardTitle>
                <DialogDescription>
                  Código JSON que será enviado para a Evolution API
                </DialogDescription>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  <ScrollArea className="h-96">
                    <pre className="text-sm p-4 bg-muted rounded-md">
                      {JSON.stringify(createMessagePayload(), null, 2)}
                    </pre>
                  </ScrollArea>
                  <Button
                    variant="outline"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={() => copyToClipboard(JSON.stringify(createMessagePayload(), null, 2))}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Endpoint information */}
            <Card>
              <CardHeader>
                <CardTitle>Informações do Endpoint</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <span className="font-medium">Método: </span>
                  <Badge>POST</Badge>
                </div>
                <div>
                  <span className="font-medium">URL: </span>
                  <code className="text-sm bg-muted px-2 py-1 rounded">
                    {template.category === "texto" && "https://api.domain.com/message/sendText/instance"}
                    {template.category === "midia" && "https://api.domain.com/message/sendMedia/instance"}
                    {template.category === "botoes" && "https://api.domain.com/message/sendButtons/instance"}
                    {template.category === "lista" && "https://api.domain.com/message/sendList/instance"}
                    {template.category === "audio" && "https://api.domain.com/message/sendWhatsAppAudio/instance"}
                    {(template.category === "video" || template.category === "documento") && "https://api.domain.com/message/sendMedia/instance"}
                  </code>
                </div>
                <div>
                  <span className="font-medium">Headers: </span>
                  <code className="text-sm bg-muted px-2 py-1 rounded">
                    Authorization: API_KEY
                  </code>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button onClick={() => copyToClipboard(JSON.stringify(createMessagePayload(), null, 2))}>
            <Download className="h-4 w-4 mr-2" />
            Exportar JSON
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
