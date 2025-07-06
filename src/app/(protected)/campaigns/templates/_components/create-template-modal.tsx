// src/app/(protected)/campaigns/templates/_components/create-template-modal.tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Eye,
  FileText,
  Image as ImageIcon,
  Loader2,
  Music,
  Plus,
  Sticker,
  Upload,
  Video,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useFieldArray, useForm, useFormState } from "react-hook-form";
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
  DialogTrigger,
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
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
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

const templateSchema = z
  .object({
    name: z.string().min(1, "Nome é obrigatório"),
    description: z.string().optional(),
    type: z.enum([
      "text",
      "image",
      "document",
      "video",
      "audio",
      "sticker",
      "button",
      "list",
    ]),
    category: z.string().min(1, "Categoria é obrigatória"),
    content: z.string().optional(),
    mediaUrl: z.string().optional(),
    fileName: z.string().optional(),
    fileType: z.string().optional(),
    fileSize: z.number().optional(),
    tags: z.string().optional(),
    title: z.string().optional(),
    footer: z.string().optional(),
    buttons: z.array(buttonSchema).optional(),
    buttonText: z.string().optional(),
    footerText: z.string().optional(),
    sections: z.array(listSectionSchema).optional(),
  })
  .superRefine((data, ctx) => {
    const mediaTypes = ["image", "document", "video", "audio", "sticker"];

    if (data.type === "text") {
      if (!data.content || data.content.length < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Conteúdo do template é obrigatório para o tipo Texto",
          path: ["content"],
        });
      }
    } else if (mediaTypes.includes(data.type)) {
      if (!data.mediaUrl || data.mediaUrl.length < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "O upload do arquivo de mídia é obrigatório para este tipo",
          path: ["mediaUrl"],
        });
      }
    } else if (data.type === "button") {
      if (!data.title || data.title.length < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Título da mensagem é obrigatório para o tipo Botões",
          path: ["title"],
        });
      }
      if (!data.buttons || data.buttons.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Pelo menos um botão é obrigatório para o tipo Botões",
          path: ["buttons"],
        });
      } else {
        data.buttons.forEach((button, index) => {
          if (!button.displayText || button.displayText.length < 1) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Texto do botão ${index + 1} é obrigatório`,
              path: ["buttons", index, "displayText"],
            });
          }
          if (button.type === "reply" && (!button.id || button.id.length < 1)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `ID do botão de resposta ${index + 1} é obrigatório`,
              path: ["buttons", index, "id"],
            });
          }
          if (
            button.type === "copy" &&
            (!button.copyCode || button.copyCode.length < 1)
          ) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Código para copiar do botão ${index + 1} é obrigatório`,
              path: ["buttons", index, "copyCode"],
            });
          }
          if (
            button.type === "url" &&
            (!button.url || !z.string().url().safeParse(button.url).success)
          ) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `URL do botão ${index + 1} inválida ou obrigatória`,
              path: ["buttons", index, "url"],
            });
          }
          if (
            button.type === "call" &&
            (!button.phoneNumber || button.phoneNumber.length < 1)
          ) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Número de telefone do botão ${index + 1} é obrigatório`,
              path: ["buttons", index, "phoneNumber"],
            });
          }
          if (button.type === "pix") {
            if (!button.currency || button.currency.length < 1) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `Moeda do PIX do botão ${index + 1} é obrigatória`,
                path: ["buttons", index, "currency"],
              });
            }
            if (!button.name || button.name.length < 1) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `Nome do recebedor do PIX do botão ${index + 1} é obrigatório`,
                path: ["buttons", index, "name"],
              });
            }
            if (!button.keyType) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `Tipo de chave PIX do botão ${index + 1} é obrigatório`,
                path: ["buttons", index, "keyType"],
              });
            }
            if (!button.key || button.key.length < 1) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `Chave PIX do botão ${index + 1} é obrigatória`,
                path: ["buttons", index, "key"],
              });
            }
          }
        });
      }
    } else if (data.type === "list") {
      if (!data.title || data.title.length < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Título da lista é obrigatório para o tipo Lista",
          path: ["title"],
        });
      }
      if (!data.buttonText || data.buttonText.length < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Texto do botão da lista é obrigatório para o tipo Lista",
          path: ["buttonText"],
        });
      }
      if (!data.sections || data.sections.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Pelo menos uma seção é obrigatória para o tipo Lista",
          path: ["sections"],
        });
      } else {
        data.sections.forEach((section, sectionIndex) => {
          if (!section.title || section.title.length < 1) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Título da seção ${sectionIndex + 1} é obrigatório`,
              path: ["sections", sectionIndex, "title"],
            });
          }
          if (!section.rows || section.rows.length === 0) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Pelo menos uma linha é obrigatória na seção ${sectionIndex + 1}`,
              path: ["sections", sectionIndex, "rows"],
            });
          } else {
            section.rows.forEach((row, rowIndex) => {
              if (!row.title || row.title.length < 1) {
                ctx.addIssue({
                  code: z.ZodIssueCode.custom,
                  message: `Título da linha ${rowIndex + 1} na seção ${sectionIndex + 1} é obrigatório`,
                  path: ["sections", sectionIndex, "rows", rowIndex, "title"],
                });
              }
              if (!row.rowId || row.rowId.length < 1) {
                ctx.addIssue({
                  code: z.ZodIssueCode.custom,
                  message: `ID da linha ${rowIndex + 1} na seção ${sectionIndex + 1} é obrigatório`,
                  path: ["sections", sectionIndex, "rows", rowIndex, "rowId"],
                });
              }
            });
          }
        });
      }
    }
  });

type TemplateFormData = z.infer<typeof templateSchema>;

interface UploadedFile {
  url: string;
  name: string;
  type: string;
  size: number;
}

export function CreateTemplateModal() {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const mediaTypes = ["image", "document", "video", "audio", "sticker"];

  const form = useForm<TemplateFormData>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      name: "",
      description: "",
      type: "text",
      category: "general",
      content: "",
      mediaUrl: "",
      fileName: "",
      fileType: "",
      fileSize: 0,
      tags: "",
      title: "",
      footer: "",
      buttons: [],
      buttonText: "",
      footerText: "",
      sections: [],
    },
    mode: "onChange",
  });

  const {
    fields: buttonFields,
    append: appendButton,
    remove: removeButton,
  } = useFieldArray({
    control: form.control,
    name: "buttons",
  });

  const {
    fields: sectionFields,
    append: appendSection,
    remove: removeSection,
  } = useFieldArray({
    control: form.control,
    name: "sections",
  });

  const {
    isSubmitting,
    isValid,
    errors: validationErrors,
  } = useFormState({
    control: form.control,
  });

  const watchedType = form.watch("type");
  const watchedContentForVariables =
    watchedType === "text" ||
    watchedType === "button" ||
    watchedType === "list" ||
    mediaTypes.includes(watchedType)
      ? form.watch("content")
      : "";

  const extractedVariables = watchedContentForVariables
    ? SpintexProcessor.extractVariables(watchedContentForVariables)
    : [];

  const previewText = watchedContentForVariables
    ? SpintexProcessor.generatePreview(watchedContentForVariables)
    : "";

  const validateFileType = (file: File, templateType: string): boolean => {
    const allowedTypes: Record<string, string[]> = {
      image: [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/gif",
        "image/webp",
      ],
      video: ["video/mp4", "video/avi", "video/mov", "video/mkv", "video/webm"],
      audio: ["audio/mp3", "audio/wav", "audio/ogg", "audio/m4a", "audio/aac"],
      document: [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/plain",
      ],
      sticker: ["image/webp", "image/png"],
    };
    return allowedTypes[templateType]?.includes(file.type) || false;
  };

  const handleFileUpload = async (file: File) => {
    if (!validateFileType(file, watchedType)) {
      toast.error(`Tipo de arquivo não suportado para ${watchedType}`);
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo 50MB");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("fileType", watchedType);

      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/upload");

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentCompleted = Math.round(
            (event.loaded * 100) / event.total,
          );
          setUploadProgress(percentCompleted);
        }
      };

      xhr.onload = () => {
        setIsUploading(false);
        setUploadProgress(0);
        if (xhr.status >= 200 && xhr.status < 300) {
          const data = JSON.parse(xhr.responseText);
          const uploadedFileData: UploadedFile = {
            url: data.url,
            name: file.name,
            type: file.type,
            size: file.size,
          };
          setUploadedFile(uploadedFileData);
          form.setValue("mediaUrl", data.url, { shouldValidate: true });
          form.setValue("fileName", file.name, { shouldValidate: true });
          form.setValue("fileType", file.type, { shouldValidate: true });
          form.setValue("fileSize", file.size, { shouldValidate: true });
          toast.success("Arquivo enviado com sucesso!");
        } else {
          const errorData = JSON.parse(xhr.responseText);
          toast.error(
            `Erro ao enviar arquivo: ${errorData.error || "Erro desconhecido"}`,
          );
          removeUploadedFile();
        }
      };

      xhr.onerror = () => {
        setIsUploading(false);
        setUploadProgress(0);
        toast.error("Erro de rede ao enviar arquivo.");
        removeUploadedFile();
      };

      xhr.send(formData);
    } catch (error: any) {
      setIsUploading(false);
      setUploadProgress(0);
      toast.error(`Erro ao enviar arquivo: ${error.message}`);
      removeUploadedFile();
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeUploadedFile = () => {
    setUploadedFile(null);
    form.setValue("mediaUrl", "", { shouldValidate: true });
    form.setValue("fileName", "", { shouldValidate: true });
    form.setValue("fileType", "", { shouldValidate: true });
    form.setValue("fileSize", 0, { shouldValidate: true });
  };

  const addSection = () => {
    appendSection({
      title: "",
      rows: [{ title: "", description: "", rowId: "" }],
    });
  };

  const addRowToSection = (sectionIndex: number) => {
    const currentSections = form.getValues("sections");
    const currentRows = currentSections?.[sectionIndex]?.rows || [];
    const newRows = [...currentRows, { title: "", description: "", rowId: "" }];
    form.setValue(`sections.${sectionIndex}.rows`, newRows, {
      shouldValidate: true,
    });
  };

  const removeRowFromSection = (sectionIndex: number, rowIndex: number) => {
    const currentSections = form.getValues("sections");
    const currentRows = currentSections?.[sectionIndex]?.rows || [];

    if (currentRows.length === 1 && sectionFields.length === 1) {
      toast.error(
        "A lista deve ter pelo menos uma seção com pelo menos uma linha.",
      );
      return;
    }

    const newRows = currentRows.filter((_, i) => i !== rowIndex);
    form.setValue(`sections.${sectionIndex}.rows`, newRows, {
      shouldValidate: true,
    });

    if (newRows.length === 0 && sectionFields.length > 1) {
      removeSection(sectionIndex);
    }
  };

  const onSubmit = async (data: TemplateFormData) => {
    setIsLoading(true);
    try {
      const payload = {
        ...data,
        // Ensure correct fields are sent based on type
        content:
          data.type === "text" ||
          data.type === "button" ||
          data.type === "list" ||
          mediaTypes.includes(data.type)
            ? data.content
            : undefined, // Use content as description for non-text types
        mediaUrl: mediaTypes.includes(data.type) ? data.mediaUrl : undefined,
        fileName: mediaTypes.includes(data.type) ? data.fileName : undefined,
        fileType: mediaTypes.includes(data.type) ? data.fileType : undefined,
        fileSize: mediaTypes.includes(data.type) ? data.fileSize : undefined,
        title:
          data.type === "button" || data.type === "list"
            ? data.title
            : undefined,
        footer: data.type === "button" ? data.footer : undefined,
        buttons: data.type === "button" ? data.buttons : undefined,
        buttonText: data.type === "list" ? data.buttonText : undefined,
        footerText: data.type === "list" ? data.footerText : undefined,
        sections: data.type === "list" ? data.sections : undefined,
        // requiredVariables: extractedVariables, // Add extracted variables to payload
      };

      const response = await fetch("/api/templates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erro ao criar template");
      }

      toast.success("Template criado com sucesso!");
      form.reset();
      setUploadedFile(null);
      setOpen(false);
      router.refresh();
    } catch (error: any) {
      toast.error(`Erro ao criar template: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const renderMediaPreview = (file: UploadedFile) => {
    const { url, type, name } = file;
    const sizeInMB = (file.size / (1024 * 1024)).toFixed(2);

    if (type.startsWith("image/")) {
      return (
        <div className="flex flex-col items-center space-y-2">
          <ImageIcon className="text-muted-foreground h-10 w-10" />
          <img src={url} alt="Preview" className="max-h-40 object-contain" />
          <p className="text-muted-foreground text-sm">
            {name} ({sizeInMB} MB)
          </p>
        </div>
      );
    } else if (type.startsWith("video/")) {
      return (
        <div className="flex flex-col items-center space-y-2">
          <Video className="text-muted-foreground h-10 w-10" />
          <video src={url} controls className="max-h-40"></video>
          <p className="text-muted-foreground text-sm">
            {name} ({sizeInMB} MB)
          </p>
        </div>
      );
    } else if (type.startsWith("audio/")) {
      return (
        <div className="flex flex-col items-center space-y-2">
          <Music className="text-muted-foreground h-10 w-10" />
          <audio src={url} controls className="w-full"></audio>
          <p className="text-muted-foreground text-sm">
            {name} ({sizeInMB} MB)
          </p>
        </div>
      );
    } else if (
      type === "application/pdf" ||
      type === "text/plain" ||
      type.includes("document")
    ) {
      return (
        <div className="flex flex-col items-center space-y-2">
          <FileText className="text-muted-foreground h-10 w-10" />
          <p className="text-muted-foreground text-sm">
            {name} ({sizeInMB} MB)
          </p>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:underline"
          >
            Visualizar Documento
          </a>
        </div>
      );
    } else if (type.startsWith("image/webp") && watchedType === "sticker") {
      return (
        <div className="flex flex-col items-center space-y-2">
          <Sticker className="text-muted-foreground h-10 w-10" />
          <img src={url} alt="Preview" className="max-h-40 object-contain" />
          <p className="text-muted-foreground text-sm">
            {name} ({sizeInMB} MB)
          </p>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center space-y-2">
        <FileText className="text-muted-foreground h-10 w-10" />
        <p className="text-muted-foreground text-sm">
          Prévia não disponível para este tipo de arquivo.
        </p>
        <p className="text-muted-foreground text-sm">
          {name} ({sizeInMB} MB)
        </p>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-blue-600 hover:underline"
        >
          Abrir Arquivo
        </a>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="magic" >
          <Plus className="mr-2 h-4 w-4" />
          Criar Novo Template
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Criar Novo Template</DialogTitle>
          <DialogDescription>
            Crie um novo template para enviar mensagens.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do Template</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Nome interno do template"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoria</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione uma categoria" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="general">Geral</SelectItem>
                        <SelectItem value="sales">Vendas</SelectItem>
                        <SelectItem value="support">Suporte</SelectItem>
                        <SelectItem value="marketing">Marketing</SelectItem>
                        <SelectItem value="notification">
                          Notificação
                        </SelectItem>
                      </SelectContent>
                    </Select>
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
                  <FormLabel>Descrição Interna (Opcional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Uma breve descrição para identificar o template"
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tags"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tags (Opcional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Separe as tags por vírgula (ex: promo, natal, 2023)"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Ajuda a organizar e encontrar templates.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator />

            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Template</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      field.onChange(value);
                      // Reset type-specific fields when type changes
                      form.setValue("content", "");
                      form.setValue("mediaUrl", "");
                      form.setValue("fileName", "");
                      form.setValue("fileType", "");
                      form.setValue("fileSize", 0);
                      setUploadedFile(null);
                      form.setValue("title", "");
                      form.setValue("footer", "");
                      form.setValue("buttons", []);
                      form.setValue("buttonText", "");
                      form.setValue("footerText", "");
                      form.setValue("sections", []);
                    }}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo de template" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="text">Texto</SelectItem>
                      <SelectItem value="image">Imagem</SelectItem>
                      <SelectItem value="document">Documento</SelectItem>
                      <SelectItem value="video">Vídeo</SelectItem>
                      <SelectItem value="audio">Áudio</SelectItem>
                      <SelectItem value="sticker">Sticker</SelectItem>
                      <SelectItem value="button">Botões</SelectItem>
                      <SelectItem value="list">Lista</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Campo de upload de mídia (condicional) */}
            {mediaTypes.includes(watchedType) && (
              <div className="space-y-4">
                <FormItem>
                  <FormLabel>Arquivo de Mídia</FormLabel>
                  <FormControl>
                    <div>
                      <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        onChange={handleFileSelect}
                        disabled={isUploading}
                        accept={
                          watchedType === "image"
                            ? "image/*"
                            : watchedType === "video"
                              ? "video/*"
                              : watchedType === "audio"
                                ? "audio/*"
                                : watchedType === "document"
                                  ? ".pdf,.doc,.docx,.txt"
                                  : watchedType === "sticker"
                                    ? "image/webp,image/png"
                                    : ""
                        }
                      />
                      <Button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="w-full"
                        variant="outline"
                      >
                        {isUploading ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Upload className="mr-2 h-4 w-4" />
                        )}
                        {isUploading
                          ? `Enviando (${uploadProgress}%)`
                          : "Selecionar Arquivo"}
                      </Button>
                    </div>
                  </FormControl>
                  <FormDescription>
                    {watchedType === "image" &&
                      "Formatos: JPG, PNG, GIF, WEBP. Máx: 50MB."}
                    {watchedType === "video" &&
                      "Formatos: MP4, AVI, MOV, MKV, WEBM. Máx: 50MB."}
                    {watchedType === "audio" &&
                      "Formatos: MP3, WAV, OGG, M4A, AAC. Máx: 50MB."}
                    {watchedType === "document" &&
                      "Formatos: PDF, DOC, DOCX, TXT. Máx: 50MB."}
                    {watchedType === "sticker" &&
                      "Formatos: WEBP, PNG. Máx: 50MB."}
                  </FormDescription>
                  <FormMessage />
                </FormItem>

                {isUploading && (
                  <Progress value={uploadProgress} className="w-full" />
                )}

                {uploadedFile && (
                  <div className="relative flex flex-col items-center space-y-3 rounded-md border p-4">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={removeUploadedFile}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                    {renderMediaPreview(uploadedFile)}
                  </div>
                )}
              </div>
            )}

            {/* Campos específicos para Botões */}
            {watchedType === "button" && (
              <div className="space-y-4">
                <Separator />
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">
                    Configuração de Botões
                  </h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      appendButton({ type: "reply", displayText: "", id: "" })
                    }
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Adicionar Botão
                  </Button>
                </div>
                {buttonFields.length === 0 && (
                  <p className="text-muted-foreground text-sm">
                    Clique em "Adicionar Botão" para começar.
                  </p>
                )}
                <div className="space-y-4">
                  {buttonFields.map((field, index) => (
                    <Card key={field.id}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm">
                            Botão {index + 1}
                          </CardTitle>
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
                      <CardContent className="space-y-3">
                        <FormField
                          control={form.control}
                          name={`buttons.${index}.type`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Tipo de Botão</FormLabel>
                              <Select
                                onValueChange={(value: any) => {
                                  field.onChange(value);
                                  // Reset fields specific to other types when type changes
                                  form.setValue(`buttons.${index}.id`, "");
                                  form.setValue(
                                    `buttons.${index}.copyCode`,
                                    "",
                                  );
                                  form.setValue(`buttons.${index}.url`, "");
                                  form.setValue(
                                    `buttons.${index}.phoneNumber`,
                                    "",
                                  );
                                  form.setValue(
                                    `buttons.${index}.currency`,
                                    "",
                                  );
                                  form.setValue(`buttons.${index}.name`, "");
                                  form.setValue(
                                    `buttons.${index}.keyType`,
                                    undefined,
                                  );
                                  form.setValue(`buttons.${index}.key`, "");
                                }}
                                value={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Selecione o tipo" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="reply">
                                    Resposta Rápida
                                  </SelectItem>
                                  <SelectItem value="copy">
                                    Copiar Código
                                  </SelectItem>
                                  <SelectItem value="url">Link/URL</SelectItem>
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
                              <FormLabel>Texto Exibido</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="Ex: Sim, quero!"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        {form.watch(`buttons.${index}.type`) === "reply" && (
                          <FormField
                            control={form.control}
                            name={`buttons.${index}.id`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>ID do Botão (Payload)</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="Ex: reply_yes"
                                    {...field}
                                  />
                                </FormControl>
                                <FormDescription>
                                  Este ID será enviado de volta quando o usuário
                                  clicar.
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        )}
                        {form.watch(`buttons.${index}.type`) === "copy" && (
                          <FormField
                            control={form.control}
                            name={`buttons.${index}.copyCode`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Código para Copiar</FormLabel>
                                <FormControl>
                                  <Input placeholder="Ex: ABC-123" {...field} />
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
                                  <Input
                                    placeholder="Ex: https://seusite.com"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        )}
                        {form.watch(`buttons.${index}.type`) === "call" && (
                          <FormField
                            control={form.control}
                            name={`buttons.${index}.phoneNumber`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Número de Telefone</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="Ex: 5511999999999"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        )}
                        {form.watch(`buttons.${index}.type`) === "pix" && (
                          <>
                            <FormField
                              control={form.control}
                              name={`buttons.${index}.currency`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Moeda</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Ex: BRL" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`buttons.${index}.name`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Nome do Recebedor</FormLabel>
                                  <FormControl>
                                    <Input
                                      placeholder="Nome Completo"
                                      {...field}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`buttons.${index}.keyType`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Tipo de Chave</FormLabel>
                                  <Select
                                    onValueChange={field.onChange}
                                    value={field.value}
                                  >
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Tipo" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="phone">
                                        Telefone
                                      </SelectItem>
                                      <SelectItem value="email">
                                        Email
                                      </SelectItem>
                                      <SelectItem value="cpf">CPF</SelectItem>
                                      <SelectItem value="cnpj">CNPJ</SelectItem>
                                      <SelectItem value="random">
                                        Aleatória
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`buttons.${index}.key`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Chave PIX</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Chave PIX" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Campos específicos para Lista */}
            {watchedType === "list" && (
              <div className="space-y-4">
                <Separator />
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">
                    Configuração de Lista
                  </h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addSection}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Adicionar Seção
                  </Button>
                </div>
                {sectionFields.length === 0 && (
                  <p className="text-muted-foreground text-sm">
                    Clique em "Adicionar Seção" para começar.
                  </p>
                )}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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
                        <FormLabel>Texto do Botão Principal</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Ver Opções" {...field} />
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
                        <FormLabel>Rodapé da Lista (Opcional)</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Ex: Selecione uma opção"
                            {...field}
                          />
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
                          <CardTitle className="text-sm">
                            Seção {sectionIndex + 1}
                          </CardTitle>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => addRowToSection(sectionIndex)}
                            >
                              <Plus className="mr-1 h-4 w-4" />
                              Adicionar Linha
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
                                <Input
                                  placeholder="Ex: Produtos Disponíveis"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="space-y-3">
                          {form
                            .watch(`sections.${sectionIndex}.rows`)
                            ?.map((row, rowIndex) => (
                              <div
                                key={rowIndex}
                                className="space-y-3 rounded-lg border p-4"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium">
                                    Linha {rowIndex + 1}
                                  </span>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      removeRowFromSection(
                                        sectionIndex,
                                        rowIndex,
                                      )
                                    }
                                    disabled={
                                      form.watch(
                                        `sections.${sectionIndex}.rows`,
                                      )?.length === 1 &&
                                      sectionFields.length === 1
                                    }
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                  <FormField
                                    control={form.control}
                                    name={`sections.${sectionIndex}.rows.${rowIndex}.title`}
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>Título da Linha</FormLabel>
                                        <FormControl>
                                          <Input
                                            placeholder="Ex: Opção 1"
                                            {...field}
                                          />
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
                                        <FormLabel>
                                          ID da Linha (Payload)
                                        </FormLabel>
                                        <FormControl>
                                          <Input
                                            placeholder="Ex: id_opcao_1"
                                            {...field}
                                          />
                                        </FormControl>
                                        <FormDescription>
                                          Este ID será enviado de volta quando o
                                          usuário selecionar esta linha.
                                        </FormDescription>
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
                                      <FormLabel>
                                        Descrição da Linha (Opcional)
                                      </FormLabel>
                                      <FormControl>
                                        <Textarea
                                          placeholder="Ex: Detalhes sobre a opção 1"
                                          {...field}
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>
                            ))}
                          {form.watch(`sections.${sectionIndex}.rows`)
                            ?.length === 0 && (
                            <p className="text-muted-foreground text-sm">
                              Clique em "Adicionar Linha" para adicionar itens a
                              esta seção.
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Campo de conteúdo principal (Apenas para texto) */}
            {watchedType === "text" && (
              <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Conteúdo do Template</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={`Digite o conteúdo com spintex: {Olá|Oi|Bom dia} {{nome}}!`}
                        rows={6}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Use spintex {`{opção1|opção2}`} para variações e{" "}
                      {`{{variavel}}`} para substituições
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Campo de conteúdo como descrição para botões, listas e Mídia */}
            {(watchedType === "button" ||
              watchedType === "list" ||
              mediaTypes.includes(watchedType)) && (
              <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição (Opcional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={`Digite uma descrição opcional com spintex: {Olá|Oi|Bom dia} {{nome}}!`}
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Use spintex {`{opção1|opção2}`} para variações e{" "}
                      {`{{variavel}}`} para substituições
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

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
            {watchedContentForVariables && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <FormLabel>Preview</FormLabel>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowPreview(!showPreview)}
                  >
                    <Eye className="mr-1 h-4 w-4" />
                    {showPreview ? "Ocultar" : "Mostrar"}
                  </Button>
                </div>
                {showPreview && (
                  <div className="bg-muted rounded-md p-3 text-sm whitespace-pre-wrap">
                    {previewText}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isLoading || isSubmitting || isUploading}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isLoading || isSubmitting || !isValid || isUploading}
              >
                {isLoading || isSubmitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Criar Template
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
