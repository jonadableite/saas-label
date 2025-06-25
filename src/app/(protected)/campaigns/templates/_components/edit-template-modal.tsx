// src/app/(protected)/campaigns/templates/_components/edit-template-modal.tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, Loader2, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SpintexProcessor } from "@/lib/spintex";

const buttonSchema = z.object({
  type: z.enum(["reply", "copy", "url", "call", "pix"]),
  displayText: z.string().min(1, "Texto é obrigatório"),
  id: z.string().optional(),
  copyCode: z.string().optional(),
  url: z.string().url("URL inválida").optional(),
  phoneNumber: z.string().optional(),
  currency: z.string().optional(),
  name: z.string().optional(),
  keyType: z.enum(["phone", "email", "cpf", "cnpj", "random"]).optional(),
  key: z.string().optional(),
});

const listRowSchema = z.object({
  title: z.string().min(1, "Título é obrigatório"),
  description: z.string().optional(),
  rowId: z.string().min(1, "ID é obrigatório"),
});

const listSectionSchema = z.object({
  title: z.string().min(1, "Título da seção é obrigatório"),
  rows: z.array(listRowSchema).min(1, "Pelo menos uma linha é obrigatória"),
});

const templateSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  description: z.string().optional(),
  type: z.enum(["text", "image", "document", "video", "audio", "button", "list"]),
  category: z.string().min(1, "Categoria é obrigatória"),
  content: z.string().min(1, "Conteúdo é obrigatório"),
  mediaUrl: z.string().optional(),
  requiredVariables: z.array(z.string()).optional(),
  tags: z.string().optional(),
  title: z.string().optional(),
  footer: z.string().optional(),
  buttons: z.array(buttonSchema).optional(),
  buttonText: z.string().optional(),
  footerText: z.string().optional(),
  sections: z.array(listSectionSchema).optional(),
});

type TemplateFormData = z.infer<typeof templateSchema>;

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

interface EditTemplateModalProps {
  template: Template;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTemplateUpdated: (template: Template) => void;
}

export function EditTemplateModal({
  template,
  open,
  onOpenChange,
  onTemplateUpdated
}: EditTemplateModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const router = useRouter();

  const form = useForm<TemplateFormData>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      type: "text",
      category: "general",
      content: "",
      buttons: [{ type: "reply", displayText: "", id: "" }],
      sections: [{ title: "", rows: [{ title: "", description: "", rowId: "" }] }],
    },
  });

  const { fields: buttonFields, append: appendButton, remove: removeButton } = useFieldArray({
    control: form.control,
    name: "buttons",
  });

  const { fields: sectionFields, append: appendSection, remove: removeSection } = useFieldArray({
    control: form.control,
    name: "sections",
  });

  // Mapear tipos da interface Template para o schema
  const mapTemplateType = (category: Template['category']) => {
    const typeMap = {
      'texto': 'text',
      'midia': 'image',
      'documento': 'document',
      'botoes': 'button',
      'lista': 'list',
      'video': 'video',
      'audio': 'audio'
    } as const;
    return typeMap[category] || 'text';
  };

  // Preencher form com dados do template
  useEffect(() => {
    if (template && open) {
      form.reset({
        name: template.name,
        description: template.description,
        type: mapTemplateType(template.category),
        category: template.type,
        content: template.content,
        mediaUrl: template.mediaUrl,
        tags: template.tags?.join(', ') || '',
        title: template.title,
        footer: template.footer,
        buttonText: template.buttonText,
        footerText: template.footerText,
        buttons: template.buttons && template.buttons.length > 0
          ? template.buttons
          : [{ type: "reply", displayText: "", id: "" }],
        sections: template.sections && template.sections.length > 0
          ? template.sections
          : [{ title: "", rows: [{ title: "", description: "", rowId: "" }] }],
      });
    }
  }, [template, open, form]);

  const watchedType = form.watch("type");
  const content = form.watch("content");
  const extractedVariables = content ? SpintexProcessor.extractVariables(content) : [];
  const previewText = content ? SpintexProcessor.generatePreview(content) : "";

  const addButton = () => {
    appendButton({ type: "reply", displayText: "", id: "" });
  };

  const addSection = () => {
    appendSection({ title: "", rows: [{ title: "", description: "", rowId: "" }] });
  };

  const addRowToSection = (sectionIndex: number) => {
    const currentSections = form.getValues("sections") || [];
    const updatedSections = [...currentSections];
    updatedSections[sectionIndex].rows.push({ title: "", description: "", rowId: "" });
    form.setValue("sections", updatedSections);
  };

  const removeRowFromSection = (sectionIndex: number, rowIndex: number) => {
    const currentSections = form.getValues("sections") || [];
    const updatedSections = [...currentSections];
    updatedSections[sectionIndex].rows.splice(rowIndex, 1);
    form.setValue("sections", updatedSections);
  };

  const onSubmit = async (data: TemplateFormData) => {
    setIsLoading(true);
    try {
      const payload = {
        ...data,
        tags: data.tags ? data.tags.split(",").map(tag => tag.trim()) : [],
        requiredVariables: data.requiredVariables || extractedVariables,
      };

      const response = await fetch(`/api/templates/${template.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Erro ao atualizar template");
      }

      const updatedTemplate = await response.json();
      toast.success("Template atualizado com sucesso!");
      onTemplateUpdated(updatedTemplate);
      onOpenChange(false);
      router.refresh();
    } catch (error) {
      toast.error("Erro ao atualizar template");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Template</DialogTitle>
          <DialogDescription>
            Atualize as informações do template
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Informações básicas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do Template</FormLabel>
                    <FormControl>
                      <Input placeholder="Nome do template" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="text">Texto</SelectItem>
                        <SelectItem value="image">Imagem</SelectItem>
                        <SelectItem value="document">Documento</SelectItem>
                        <SelectItem value="video">Vídeo</SelectItem>
                        <SelectItem value="audio">Áudio</SelectItem>
                        <SelectItem value="button">Botões</SelectItem>
                        <SelectItem value="list">Lista</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoria</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a categoria" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="promotional">Promocional</SelectItem>
                        <SelectItem value="informational">Informativo</SelectItem>
                        <SelectItem value="reminder">Lembrete</SelectItem>
                        <SelectItem value="transactional">Transacional</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tags"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tags</FormLabel>
                    <FormControl>
                      <Input placeholder="Tag1, Tag2, Tag3" {...field} />
                    </FormControl>
                    <FormDescription>
                      Separe as tags por vírgula
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Descrição do template"
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Campos específicos por tipo */}
            {watchedType === "image" && (
              <FormField
                control={form.control}
                name="mediaUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL da Imagem</FormLabel>
                    <FormControl>
                      <Input placeholder="https://exemplo.com/imagem.jpg" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {watchedType === "button" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <FormLabel>Botões</FormLabel>
                  <Button type="button" variant="outline" size="sm" onClick={addButton}>
                    <Plus className="h-4 w-4 mr-1" />
                    Adicionar Botão
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Título</FormLabel>
                        <FormControl>
                          <Input placeholder="Título dos botões" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="footer"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rodapé</FormLabel>
                        <FormControl>
                          <Input placeholder="Rodapé dos botões" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-4">
                  {buttonFields.map((field, index) => (
                    <Card key={field.id}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm">Botão {index + 1}</CardTitle>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeButton(index)}
                            disabled={buttonFields.length === 1}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <FormField
                            control={form.control}
                            name={`buttons.${index}.type`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Tipo</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Tipo do botão" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="reply">Resposta</SelectItem>
                                    <SelectItem value="copy">Copiar</SelectItem>
                                    <SelectItem value="url">URL</SelectItem>
                                    <SelectItem value="call">Ligar</SelectItem>
                                    <SelectItem value="pix">PIX</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name={`buttons.${index}.displayText`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Texto</FormLabel>
                                <FormControl>
                                  <Input placeholder="Texto do botão" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        {form.watch(`buttons.${index}.type`) === "reply" && (
                          <FormField
                            control={form.control}
                            name={`buttons.${index}.id`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>ID</FormLabel>
                                <FormControl>
                                  <Input placeholder="ID único" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        )}

                        {form.watch(`buttons.${index}.type`) === "url" && (
                          <FormField
                            control={form.control}
                            name={`buttons.${index}.url`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>URL</FormLabel>
                                <FormControl>
                                  <Input placeholder="https://exemplo.com" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {watchedType === "list" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <FormLabel>Lista Interativa</FormLabel>
                  <Button type="button" variant="outline" size="sm" onClick={addSection}>
                    <Plus className="h-4 w-4 mr-1" />
                    Adicionar Seção
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Título da Lista</FormLabel>
                        <FormControl>
                          <Input placeholder="Título" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="buttonText"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Texto do Botão</FormLabel>
                        <FormControl>
                          <Input placeholder="Clique aqui" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="footerText"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rodapé</FormLabel>
                        <FormControl>
                          <Input placeholder="Rodapé da lista" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-4">
                  {sectionFields.map((section, sectionIndex) => (
                    <Card key={section.id}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm">Seção {sectionIndex + 1}</CardTitle>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => addRowToSection(sectionIndex)}
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Linha
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeSection(sectionIndex)}
                              disabled={sectionFields.length === 1}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <FormField
                          control={form.control}
                          name={`sections.${sectionIndex}.title`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Título da Seção</FormLabel>
                              <FormControl>
                                <Input placeholder="Título da seção" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        {form.watch(`sections.${sectionIndex}.rows`)?.map((row, rowIndex) => (
                          <div key={rowIndex} className="border rounded-lg p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">Linha {rowIndex + 1}</span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeRowFromSection(sectionIndex, rowIndex)}
                                disabled={form.watch(`sections.${sectionIndex}.rows`)?.length === 1}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <FormField
                                control={form.control}
                                name={`sections.${sectionIndex}.rows.${rowIndex}.title`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Título</FormLabel>
                                    <FormControl>
                                      <Input placeholder="Título da linha" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name={`sections.${sectionIndex}.rows.${rowIndex}.rowId`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>ID</FormLabel>
                                    <FormControl>
                                      <Input placeholder="ID único" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>
                            <FormField
                              control={form.control}
                              name={`sections.${sectionIndex}.rows.${rowIndex}.description`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Descrição</FormLabel>
                                  <FormControl>
                                    <Textarea placeholder="Descrição da linha" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Campo de conteúdo principal */}
            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Conteúdo do Template
                    {watchedType === "button" && " (Descrição)"}
                    {watchedType === "list" && " (Descrição)"}
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={`Digite o conteúdo com spintex: {Olá|Oi|Bom dia} {{nome}}!`}
                      rows={6}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Use spintex {`{opção1|opção2}`} para variações e {`{{variavel}}`} para substituições
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Variáveis detectadas */}
            {extractedVariables.length > 0 && (
              <div className="space-y-2">
                <FormLabel>Variáveis Detectadas</FormLabel>
                <div className="flex flex-wrap gap-2">
                  {extractedVariables.map((variable) => (
                    <Badge key={variable} variant="secondary">
                      {`{{${variable}}}`}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Preview */}
            {content && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <FormLabel>Preview</FormLabel>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowPreview(!showPreview)}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    {showPreview ? "Ocultar" : "Mostrar"}
                  </Button>
                </div>
                {showPreview && (
                  <div className="p-3 bg-muted rounded-md text-sm whitespace-pre-wrap">
                    {previewText}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Atualizar Template
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
