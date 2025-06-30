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
  Video,
  X,
  Download, // Added Download icon for PreviewModal
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"; // Added Tabs for PreviewModal
import { SpintexProcessor } from "@/lib/spintex";

// Define Zod schemas for validation
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
    category: z.string().min(1, "Categoria é obrigatória"), // This seems to be the classification (promotional, etc.) based on the Select options below
    content: z.string().optional(), // Optional initially, validated based on type
    mediaUrl: z.string().optional(), // Optional initially, validated based on type
    fileName: z.string().optional(),
    fileType: z.string().optional(),
    fileSize: z.number().optional(),
    tags: z.string().optional(),
    title: z.string().optional(), // Used for button/list title
    footer: z.string().optional(), // Used for button footer
    buttons: z.array(buttonSchema).optional(), // Used for button type
    buttonText: z.string().optional(), // Used for list button text
    footerText: z.string().optional(), // Used for list footer text
    sections: z.array(listSectionSchema).optional(), // Used for list type
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
      // For media types, mediaUrl is required
      if (!data.mediaUrl || data.mediaUrl.length < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "O upload do arquivo de mídia é obrigatório para este tipo",
          path: ["mediaUrl"],
        });
      }
    } else if (data.type === "button") {
      // For button type, title and buttons array are required
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
        // Validate each button
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
                message: `Moeda do botão PIX ${index + 1} é obrigatória`,
                path: ["buttons", index, "currency"],
              });
            }
            if (!button.name || button.name.length < 1) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `Nome do recebedor PIX ${index + 1} é obrigatório`,
                path: ["buttons", index, "name"],
              });
            }
            if (!button.keyType || button.keyType.length < 1) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `Tipo de chave PIX ${index + 1} é obrigatório`,
                path: ["buttons", index, "keyType"],
              });
            }
            if (!button.key || button.key.length < 1) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `Chave PIX ${index + 1} é obrigatória`,
                path: ["buttons", index, "key"],
              });
            }
          }
        });
      }
    } else if (data.type === "list") {
      // For list type, title, buttonText, and sections array are required
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
        // Validate each section and its rows
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
              message: `Pelo menos uma linha é obrigatória na seção ${
                sectionIndex + 1
              }`,
              path: ["sections", sectionIndex, "rows"],
            });
          } else {
            section.rows.forEach((row, rowIndex) => {
              if (!row.title || row.title.length < 1) {
                ctx.addIssue({
                  code: z.ZodIssueCode.custom,
                  message: `Título da linha ${rowIndex + 1} na seção ${
                    sectionIndex + 1
                  } é obrigatório`,
                  path: ["sections", sectionIndex, "rows", rowIndex, "title"],
                });
              }
              if (!row.rowId || row.rowId.length < 1) {
                ctx.addIssue({
                  code: z.ZodIssueCode.custom,
                  message: `ID da linha ${rowIndex + 1} na seção ${
                    sectionIndex + 1
                  } é obrigatório`,
                  path: ["sections", sectionIndex, "rows", rowIndex, "rowId"],
                });
              }
            });
          }
        });
      }
    }
  });

// Type definition for the form data
type TemplateFormData = z.infer<typeof templateSchema>;

// Interface for the template data received from the API
// This interface should match the structure returned by your backend API
interface Template {
  id: string;
  // Note: The API seems to use 'type' for classification and 'category' for message type.
  // We will map this to the schema where 'type' is message type and 'category' is classification.
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
  usage?: number;
  lastUsed?: string;
  createdAt: string;
  mediaUrl?: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  buttons?: any[]; // Structure needs to match buttonSchema
  listConfig?: {
    // Assuming list config is nested in API response
    title?: string;
    buttonText?: string;
    footerText?: string;
    sections?: any[]; // Structure needs to match listSectionSchema
  };
  spintexEnabled?: boolean;
  variations?: string[];
  description?: string;
  tags?: string[];
  // API might also return these top-level for button/list types, need clarification
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

// Mapping functions to convert between frontend schema and assumed API structure
const mapApiCategoryToSchemaType = (
  apiCategory: Template["category"],
): TemplateFormData["type"] => {
  const typeMap: Record<Template["category"], TemplateFormData["type"]> = {
    texto: "text",
    midia: "image",
    documento: "document",
    botoes: "button",
    lista: "list",
    video: "video",
    audio: "audio",
    sticker: "sticker",
  };
  return typeMap[apiCategory] || "text";
};

const mapApiTypeToSchemaCategory = (
  apiType: Template["type"],
): TemplateFormData["category"] => {
  // Assuming API types match schema categories directly
  return apiType as TemplateFormData["category"];
};

const mapSchemaTypeToApiCategory = (
  schemaType: TemplateFormData["type"],
): Template["category"] => {
  const categoryMap: Record<TemplateFormData["type"], Template["category"]> = {
    text: "texto",
    image: "midia",
    document: "documento",
    video: "video",
    audio: "audio",
    sticker: "sticker",
    button: "botoes",
    list: "lista",
  };
  return categoryMap[schemaType] || "texto";
};

const mapSchemaCategoryToApiType = (
  schemaCategory: TemplateFormData["category"],
): Template["type"] => {
  // Assuming schema categories match API types directly
  const typeMap: Record<TemplateFormData["category"], Template["type"]> = {
    promotional: "promotional",
    informational: "informational",
    reminder: "reminder",
    transactional: "transactional",
    // Add other potential categories if needed
  };
  return typeMap[schemaCategory] || "informational";
};

export function EditTemplateModal({
  template,
  open,
  onOpenChange,
  onTemplateUpdated,
}: EditTemplateModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const router = useRouter();

  // State for file upload
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<TemplateFormData>({
    resolver: zodResolver(templateSchema),
    // Default values are just placeholders; useEffect will populate
    defaultValues: {
      name: "",
      description: "",
      type: "text",
      category: "promotional",
      content: "",
      mediaUrl: "",
      fileName: "",
      fileType: "",
      fileSize: 0,
      tags: "",
      title: "",
      footer: "",
      buttons: [], // Default to empty array for editing
      buttonText: "",
      footerText: "",
      sections: [], // Default to empty array for editing
    },
  });

  // Use useFormState to get submission state and form validity
  const { isSubmitting, isValid } = useFormState({ control: form.control });

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

  // Populate form with template data when modal opens or template changes
  useEffect(() => {
    if (template && open) {
      // Map API data structure to frontend form structure
      const mappedData: TemplateFormData = {
        name: template.name || "",
        description: template.description || "",
        // Map API fields to schema fields
        type: mapApiCategoryToSchemaType(template.category), // API category is schema type
        category: mapApiTypeToSchemaCategory(template.type), // API type is schema category
        content: template.content || "",
        mediaUrl: template.mediaUrl || "",
        fileName: template.fileName || "",
        fileType: template.fileType || "",
        fileSize: template.fileSize || 0,
        tags: template.tags?.join(", ") || "",
        // Handle button/list specific fields, potentially coming from listConfig or top-level
        title: template.listConfig?.title || template.title || "",
        footer: template.footer || "", // Assuming footer is always top-level for buttons
        buttons: Array.isArray(template.buttons) ? template.buttons : [],
        buttonText:
          template.listConfig?.buttonText || template.buttonText || "",
        footerText:
          template.listConfig?.footerText || template.footerText || "",
        sections: Array.isArray(template.listConfig?.sections)
          ? template.listConfig.sections
          : Array.isArray(template.sections)
            ? template.sections
            : [],
      };

      form.reset(mappedData);

      // Reset upload state when modal opens
      setUploadProgress(0);
      setUploadError(null);
      setIsUploading(false);
    }
  }, [template, open, form]);

  // Watch form values for dynamic fields and preview
  const watchedType = form.watch("type");
  const watchedContent = form.watch("content");
  const watchedMediaUrl = form.watch("mediaUrl");

  // Extract variables and generate preview text
  const extractedVariables = watchedContent
    ? SpintexProcessor.extractVariables(watchedContent)
    : [];
  const previewText = watchedContent
    ? SpintexProcessor.generatePreview(watchedContent)
    : "";

  // Handle file selection
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Reset previous upload state
      setUploadProgress(0);
      setUploadError(null);
      // Set file details in form state immediately
      form.setValue("fileName", file.name);
      form.setValue("fileType", file.type);
      form.setValue("fileSize", file.size);
      // Clear mediaUrl until upload is successful
      form.setValue("mediaUrl", ""); // Clear existing URL when a new file is selected

      // You might want to trigger upload automatically or wait for form submit
      // For this example, upload happens on form submit.
    } else {
      // If file selection is cancelled, clear file info and potentially revert mediaUrl
      form.setValue("fileName", "");
      form.setValue("fileType", "");
      form.setValue("fileSize", 0);
      // Decide whether to clear mediaUrl or revert to the original template's mediaUrl
      // For now, let's clear it, assuming a cancelled selection means no media.
      form.setValue("mediaUrl", "");
    }
  };

  // Simulate file upload (replace with actual API call)
  const uploadFile = async (file: File): Promise<string> => {
    setIsUploading(true);
    setUploadProgress(0);
    setUploadError(null);

    console.log("Attempting file upload:", file.name);

    const formData = new FormData();
    formData.append("file", file);

    try {
      // Replace with your actual file upload endpoint
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
        // You might need headers like 'Authorization'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Erro no upload do arquivo");
      }

      const result = await response.json();
      // Assuming the API returns the URL of the uploaded file
      const uploadedUrl = result.url; // Adjust based on your API response

      // Simulate progress (remove in real implementation if not needed)
      for (let i = 0; i <= 100; i += 10) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        setUploadProgress(i);
      }

      setUploadProgress(100);
      setIsUploading(false);
      toast.success("Arquivo enviado com sucesso!");
      return uploadedUrl;
    } catch (error: any) {
      console.error("Upload failed:", error);
      setUploadError(error.message || "Falha no upload");
      setIsUploading(false);
      toast.error("Falha no upload do arquivo.");
      throw error; // Re-throw to prevent form submission
    }
  };

  // Button array helpers
  const addButton = () => {
    appendButton({ type: "reply", displayText: "", id: "" });
  };

  // Section array helpers
  const addSection = () => {
    appendSection({
      title: "",
      rows: [{ title: "", description: "", rowId: "" }],
    });
  };

  const addRowToSection = (sectionIndex: number) => {
    const currentSections = form.getValues("sections") || [];
    const updatedSections = [...currentSections];
    // Ensure rows array exists before pushing
    if (!updatedSections[sectionIndex].rows) {
      updatedSections[sectionIndex].rows = [];
    }
    updatedSections[sectionIndex].rows.push({
      title: "",
      description: "",
      rowId: "",
    });
    form.setValue("sections", updatedSections);
  };

  const removeRowFromSection = (sectionIndex: number, rowIndex: number) => {
    const currentSections = form.getValues("sections") || [];
    const updatedSections = [...currentSections];
    // Ensure rows array exists before splicing
    if (updatedSections[sectionIndex].rows) {
      updatedSections[sectionIndex].rows.splice(rowIndex, 1);
      form.setValue("sections", updatedSections);
    }
  };

  const onSubmit = async (data: TemplateFormData) => {
    setIsLoading(true);
    setUploadError(null); // Clear previous upload errors

    let finalMediaUrl = data.mediaUrl; // Start with existing URL

    // Check if a new file was selected
    const selectedFile = fileInputRef.current?.files?.[0];

    if (selectedFile) {
      // If a new file is selected, upload it first
      try {
        finalMediaUrl = await uploadFile(selectedFile);
        // Update form state with the new URL after successful upload
        form.setValue("mediaUrl", finalMediaUrl); // This updates the form state, but not the 'data' object used below
      } catch (uploadErr) {
        // If upload fails, stop submission and show error
        setIsLoading(false);
        console.error("Upload failed during submission:", uploadErr);
        return; // Stop the onSubmit process
      }
    } else if (template.mediaUrl && !data.mediaUrl) {
      // Case where the template originally had a mediaUrl but it was cleared in the form
      // This means the user wants to remove the media. Send null or empty string to API.
      finalMediaUrl = null; // Or undefined, depending on API expectation
      form.setValue("mediaUrl", null); // Update form state
    }
    // If no new file and data.mediaUrl exists (and wasn't cleared), use data.mediaUrl (which is the original template.mediaUrl)

    try {
      // Construct the payload for the API
      // Map frontend schema data to assumed backend API structure
      const apiPayload: any = {
        name: data.name,
        description: data.description,
        // Map schema type back to API category and schema category back to API type
        type: mapSchemaCategoryToApiType(data.category), // Schema category is API type (e.g., promotional)
        category: mapSchemaTypeToApiCategory(data.type), // Schema type is API category (e.g., texto, midia)
        tags:
          data.tags
            ?.split(",")
            .map((tag) => tag.trim())
            .filter((tag) => tag) || [],
        spintexEnabled: template.spintexEnabled, // Assuming spintexEnabled comes from original template
        variations: template.variations, // Assuming variations come from original template

        // Include content/media based on the selected type
        content: ["text", "button", "list"].includes(data.type)
          ? data.content
          : undefined,
        mediaUrl: ["image", "document", "video", "audio", "sticker"].includes(
          data.type,
        )
          ? finalMediaUrl
          : undefined,
        fileName: ["image", "document", "video", "audio", "sticker"].includes(
          data.type,
        )
          ? data.fileName
          : undefined,
        fileType: ["image", "document", "video", "audio", "sticker"].includes(
          data.type,
        )
          ? data.fileType
          : undefined,
        fileSize: ["image", "document", "video", "audio", "sticker"].includes(
          data.type,
        )
          ? data.fileSize
          : undefined,

        // Include button/list specific fields based on the selected type
        title: ["button", "list"].includes(data.type) ? data.title : undefined,
        footer: data.type === "button" ? data.footer : undefined,
        buttons: data.type === "button" ? data.buttons : undefined,

        // Assuming list config is nested under listConfig for API
        listConfig:
          data.type === "list"
            ? {
                title: data.title, // List title might be here or top level, assuming here for listConfig
                buttonText: data.buttonText,
                footerText: data.footerText,
                sections: data.sections,
              }
            : undefined,

        // Ensure fields specific to other types are not sent if not applicable
        buttonText: data.type !== "list" ? undefined : data.buttonText, // Only send if type is list (and maybe also in listConfig)
        footerText: data.type !== "list" ? undefined : data.footerText, // Only send if type is list (and maybe also in listConfig)
        sections: data.type !== "list" ? undefined : data.sections, // Only send if type is list (and maybe also in listConfig)
      };

      console.log("Sending payload to API:", apiPayload); // Log payload for debugging

      // Make the PUT request to update the template
      const response = await fetch(`/api/templates/${template.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(apiPayload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message ||
            `Erro ao atualizar template (Status: ${response.status})`,
        );
      }

      const updatedTemplate: Template = await response.json(); // Assuming API returns the updated template

      toast.success("Template atualizado com sucesso!");
      onTemplateUpdated(updatedTemplate); // Call the callback with the updated template
      onOpenChange(false); // Close the modal
    } catch (error: any) {
      console.error("Failed to update template:", error);
      toast.error(error.message || "Falha ao atualizar template.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-screen-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Template</DialogTitle>
          <DialogDescription>
            Edite os detalhes do template existente.
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
                        placeholder="Ex: Template de Boas-Vindas"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="category" // This maps to API 'type' (classification)
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoria (Classificação)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a categoria" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="promotional">Promocional</SelectItem>
                        <SelectItem value="informational">
                          Informativo
                        </SelectItem>
                        <SelectItem value="reminder">Lembrete</SelectItem>
                        <SelectItem value="transactional">
                          Transacional
                        </SelectItem>
                        {/* Add other categories as needed */}
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
                  <FormLabel>Descrição (Opcional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Uma breve descrição do template"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="type" // This maps to API 'category' (message type)
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Mensagem</FormLabel>
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
                      <SelectItem value="sticker">Sticker</SelectItem>
                      <SelectItem value="button">Botões</SelectItem>
                      <SelectItem value="list">Lista</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Dynamic Fields based on Type */}
            {watchedType === "text" && (
              <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Conteúdo do Texto</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Digite o conteúdo do seu template. Use {{variavel}} para placeholders."
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Variáveis detectadas:{" "}
                      {extractedVariables.length > 0
                        ? extractedVariables.map((v) => `{{${v}}}`).join(", ")
                        : "Nenhuma"}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {["image", "document", "video", "audio", "sticker"].includes(
              watchedType,
            ) && (
              <FormItem>
                <FormLabel>Arquivo de Mídia</FormLabel>
                <FormControl>
                  <Input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept={
                      watchedType === "image"
                        ? "image/*"
                        : watchedType === "document"
                          ? ".pdf,.doc,.docx,.txt"
                          : watchedType === "video"
                            ? "video/*"
                            : watchedType === "audio"
                              ? "audio/*"
                              : watchedType === "sticker"
                                ? "image/webp"
                                : "*/*"
                    }
                  />
                </FormControl>
                {isUploading && (
                  <div>
                    <Progress value={uploadProgress} className="w-full" />
                    <span className="text-muted-foreground text-sm">
                      Enviando... {uploadProgress}%
                    </span>
                  </div>
                )}
                {uploadError && (
                  <p className="text-destructive text-sm">{uploadError}</p>
                )}
                {watchedMediaUrl && !isUploading && !uploadError && (
                  <p className="text-sm text-green-600">
                    Arquivo atual:{" "}
                    <a
                      href={watchedMediaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      {form.getValues("fileName") || watchedMediaUrl}
                    </a>
                  </p>
                )}
                <FormDescription>
                  {watchedType === "image" && "Formatos: JPG, PNG, etc."}
                  {watchedType === "document" &&
                    "Formatos: PDF, DOC, TXT, etc."}
                  {watchedType === "video" && "Formatos: MP4, etc."}
                  {watchedType === "audio" && "Formatos: MP3, OGG, etc."}
                  {watchedType === "sticker" && "Formato: WebP"}
                </FormDescription>
                <FormMessage />
                {/* Add a hidden field to keep track of mediaUrl for validation */}
                <FormField
                  control={form.control}
                  name="mediaUrl"
                  render={({ field }) => (
                    <FormItem className="hidden">
                      <FormControl>
                        <Input type="hidden" {...field} />
                      </FormControl>
                      <FormMessage />{" "}
                      {/* Message will still show if mediaUrl is missing */}
                    </FormItem>
                  )}
                />
              </FormItem>
            )}

            {watchedType === "button" && (
              <>
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Título da Mensagem</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Escolha uma opção" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="content"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Conteúdo do Texto (Opcional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Texto que acompanha os botões"
                          {...field}
                        />
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
                      <FormLabel>Rodapé (Opcional)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Ex: Powered by MyCompany"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div>
                  <FormLabel>Botões</FormLabel>
                  {buttonFields.map((item, index) => (
                    <Card key={item.id} className="mt-2">
                      <CardContent className="space-y-3 p-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-md font-medium">
                            Botão {index + 1}
                          </h4>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => removeButton(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        <FormField
                          control={form.control}
                          name={`buttons.${index}.type`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Tipo do Botão</FormLabel>
                              <Select
                                onValueChange={field.onChange}
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
                                  <SelectItem value="url">
                                    Link (URL)
                                  </SelectItem>
                                  <SelectItem value="call">
                                    Chamar Telefone
                                  </SelectItem>
                                  <SelectItem value="copy">
                                    Copiar Código
                                  </SelectItem>
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
                              <FormLabel>Texto no Botão</FormLabel>
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
                                <FormLabel>ID de Resposta</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="ID único para identificar a resposta"
                                    {...field}
                                  />
                                </FormControl>
                                <FormDescription>
                                  Usado para identificar qual botão foi clicado.
                                </FormDescription>
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
                                    placeholder="https://seusite.com"
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
                                    placeholder="+5511987654321"
                                    {...field}
                                  />
                                </FormControl>
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
                                  <Input
                                    placeholder="Ex: CUPOM123"
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
                                    <Input placeholder="BRL" {...field} />
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
                                      placeholder="Seu Nome/Empresa"
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
                                  <FormLabel>Tipo de Chave PIX</FormLabel>
                                  <Select
                                    onValueChange={field.onChange}
                                    value={field.value}
                                  >
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Selecione o tipo" />
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
                                        Chave Aleatória
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
                                    <Input
                                      placeholder="Sua chave PIX"
                                      {...field}
                                    />
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
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addButton}
                    className="mt-2 gap-2"
                    disabled={buttonFields.length >= 3} // Limit to 3 buttons
                  >
                    <Plus className="h-4 w-4" /> Adicionar Botão
                  </Button>
                  {buttonFields.length >= 3 && (
                    <p className="text-muted-foreground mt-1 text-sm">
                      Máximo de 3 botões.
                    </p>
                  )}
                  <FormMessage>
                    {form.formState.errors.buttons?.message}
                  </FormMessage>
                </div>
              </>
            )}

            {watchedType === "list" && (
              <>
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Título da Lista</FormLabel>
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
                <FormField
                  control={form.control}
                  name="content"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Conteúdo do Texto (Opcional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Texto que acompanha a lista"
                          {...field}
                        />
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
                      <FormLabel>Texto do Botão da Lista</FormLabel>
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
                      <FormLabel>Rodapé (Opcional)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Ex: Powered by MyCompany"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div>
                  <FormLabel>Seções da Lista</FormLabel>
                  {sectionFields.map((sectionItem, sectionIndex) => (
                    <Card key={sectionItem.id} className="mt-2">
                      <CardContent className="space-y-3 p-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-md font-medium">
                            Seção {sectionIndex + 1}
                          </h4>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => removeSection(sectionIndex)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        <FormField
                          control={form.control}
                          name={`sections.${sectionIndex}.title`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Título da Seção</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="Ex: Produtos Populares"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div>
                          <FormLabel>Linhas da Seção</FormLabel>
                          {(
                            form.watch(`sections.${sectionIndex}.rows`) || []
                          ).map((rowItem, rowIndex) => (
                            <Card key={rowItem.id} className="mt-2">
                              <CardContent className="space-y-2 p-4">
                                <div className="flex items-center justify-between">
                                  <h5 className="text-sm font-medium">
                                    Linha {rowIndex + 1}
                                  </h5>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      removeRowFromSection(
                                        sectionIndex,
                                        rowIndex,
                                      )
                                    }
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                                <FormField
                                  control={form.control}
                                  name={`sections.${sectionIndex}.rows.${rowIndex}.title`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Título da Linha</FormLabel>
                                      <FormControl>
                                        <Input
                                          placeholder="Ex: Camiseta Azul"
                                          {...field}
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                                <FormField
                                  control={form.control}
                                  name={`sections.${sectionIndex}.rows.${rowIndex}.description`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>
                                        Descrição (Opcional)
                                      </FormLabel>
                                      <FormControl>
                                        <Input
                                          placeholder="Detalhes do item"
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
                                      <FormLabel>ID da Linha</FormLabel>
                                      <FormControl>
                                        <Input
                                          placeholder="ID único para a linha"
                                          {...field}
                                        />
                                      </FormControl>
                                      <FormDescription>
                                        Usado para identificar qual item da
                                        lista foi selecionado.
                                      </FormDescription>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </CardContent>
                            </Card>
                          ))}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => addRowToSection(sectionIndex)}
                            className="mt-2 gap-2"
                            disabled={
                              (
                                form.watch(`sections.${sectionIndex}.rows`) ||
                                []
                              ).length >= 10
                            } // Limit rows per section
                          >
                            <Plus className="h-4 w-4" /> Adicionar Linha
                          </Button>
                          {(form.watch(`sections.${sectionIndex}.rows`) || [])
                            .length >= 10 && (
                            <p className="text-muted-foreground mt-1 text-sm">
                              Máximo de 10 linhas por seção.
                            </p>
                          )}
                          <FormMessage>
                            {
                              form.formState.errors.sections?.[sectionIndex]
                                ?.rows?.message
                            }
                          </FormMessage>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addSection}
                    className="mt-2 gap-2"
                    disabled={sectionFields.length >= 10} // Limit sections
                  >
                    <Plus className="h-4 w-4" /> Adicionar Seção
                  </Button>
                  {sectionFields.length >= 10 && (
                    <p className="text-muted-foreground mt-1 text-sm">
                      Máximo de 10 seções.
                    </p>
                  )}
                  <FormMessage>
                    {form.formState.errors.sections?.message}
                  </FormMessage>
                </div>
              </>
            )}

            <FormField
              control={form.control}
              name="tags"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tags (Opcional)</FormLabel>
                  <FormControl>
                    <Input placeholder="tag1, tag2, tag3" {...field} />
                  </FormControl>
                  <FormDescription>Separar tags por vírgula.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading || isUploading}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !isValid || isLoading || isUploading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  "Salvar Alterações"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// --- PreviewTemplateModal Component (Included as it was in the original input) ---
// Ideally, this should be in its own file: src/app/(protected)/campaigns/templates/_components/preview-template-modal.tsx

interface PreviewTemplateModalProps {
  template: Template;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PreviewTemplateModal({
  template,
  open,
  onOpenChange,
}: PreviewTemplateModalProps) {
  const [previewText, setPreviewText] = useState("");

  useEffect(() => {
    if (template?.content) {
      // Assuming SpintexProcessor is available and works with template.content
      setPreviewText(SpintexProcessor.generatePreview(template.content));
    } else {
      setPreviewText("");
    }
  }, [template]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        toast.success("Conteúdo copiado para a área de transferência!");
      })
      .catch((err) => {
        console.error("Failed to copy:", err);
        toast.error("Falha ao copiar conteúdo.");
      });
  };

  // Function to create a simplified message payload for preview/export
  const createMessagePayload = () => {
    const basePayload: any = {
      id: template.id,
      type: mapSchemaTypeToApiCategory(
        mapApiCategoryToSchemaType(template.category),
      ), // Map back to API category
      category: mapSchemaCategoryToApiType(
        mapApiTypeToSchemaCategory(template.type),
      ), // Map back to API type
      name: template.name,
      content: template.content,
      mediaUrl: template.mediaUrl,
      fileName: template.fileName,
      fileType: template.fileType,
      fileSize: template.fileSize,
      // Include button/list specific fields based on template's original API structure
      title: template.title,
      footer: template.footer,
      buttons: template.buttons,
      listConfig: template.listConfig, // Use listConfig if available
      buttonText: template.buttonText, // Include top-level list fields if listConfig wasn't used
      footerText: template.footerText,
      sections: template.sections,
      tags: template.tags,
      variables: template.variables,
      spintexEnabled: template.spintexEnabled,
      variations: template.variations,
      description: template.description,
    };

    // Clean up undefined fields
    Object.keys(basePayload).forEach(
      (key) => basePayload[key] === undefined && delete basePayload[key],
    );

    return basePayload;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Visualizar Template: {template?.name}</DialogTitle>
          <DialogDescription>Prévia e detalhes do template.</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="preview" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="preview">Prévia</TabsTrigger>
            <TabsTrigger value="details">Detalhes</TabsTrigger>
          </TabsList>
          <TabsContent value="preview" className="space-y-4">
            {template?.mediaUrl && (
              <div className="bg-muted flex aspect-video items-center justify-center overflow-hidden rounded-md">
                {/* Basic preview - ideally render actual media */}
                {template.category === "video" ? (
                  <Video className="text-muted-foreground h-12 w-12" />
                ) : template.category === "audio" ? (
                  <Music className="text-muted-foreground h-12 w-12" />
                ) : template.category === "midia" ||
                  template.category === "sticker" ? (
                  // Attempt to show image preview if it's an image type
                  template.mediaUrl.match(/\.(jpeg|jpg|gif|png|webp)$/i) ? (
                    <img
                      src={template.mediaUrl}
                      alt="Preview"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <ImageIcon className="text-muted-foreground h-12 w-12" />
                  )
                ) : template.category === "documento" ? (
                  <FileText className="text-muted-foreground h-12 w-12" />
                ) : (
                  <ImageIcon className="text-muted-foreground h-12 w-12" />
                )}
              </div>
            )}
            {template?.content && (
              <div>
                <h4 className="font-medium">Conteúdo:</h4>
                <p className="text-muted-foreground text-sm whitespace-pre-wrap">
                  {previewText}
                </p>
              </div>
            )}
            {template?.buttons && template.buttons.length > 0 && (
              <div>
                <h4 className="font-medium">Botões:</h4>
                <div className="mt-1 flex flex-wrap gap-2">
                  {template.buttons.map((button: any, index: number) => (
                    <Badge key={index} variant="secondary">
                      {button.displayText}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {template?.listConfig?.sections &&
              template.listConfig.sections.length > 0 && (
                <div>
                  <h4 className="font-medium">Lista:</h4>
                  <p className="text-muted-foreground text-sm">
                    Botão: {template.listConfig.buttonText}
                  </p>
                  {template.listConfig.sections.map(
                    (section: any, sIndex: number) => (
                      <div key={sIndex} className="mt-2">
                        <p className="text-sm font-medium">{section.title}</p>
                        <ul className="text-muted-foreground list-inside list-disc text-sm">
                          {section.rows.map((row: any, rIndex: number) => (
                            <li key={rIndex}>
                              {row.title} ({row.rowId})
                            </li>
                          ))}
                        </ul>
                      </div>
                    ),
                  )}
                </div>
              )}
          </TabsContent>
          <TabsContent
            value="details"
            className="text-muted-foreground space-y-4 text-sm"
          >
            <div>
              <span className="font-medium">ID: </span>
              <code>{template?.id}</code>
            </div>
            <div>
              <span className="font-medium">Nome: </span>
              {template?.name}
            </div>
            <div>
              <span className="font-medium">Descrição: </span>
              {template?.description || "N/A"}
            </div>
            <div>
              <span className="font-medium">Categoria (Classificação): </span>
              <Badge
                className={getTypeColor(template?.type || "informational")}
              >
                {template?.type}
              </Badge>
            </div>
            <div>
              <span className="font-medium">Tipo de Mensagem: </span>
              <Badge variant="outline">{template?.category}</Badge>
            </div>
            {template?.mediaUrl && (
              <div>
                <span className="font-medium">URL da Mídia: </span>
                <a
                  href={template.mediaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  {template.mediaUrl}
                </a>
              </div>
            )}
            {template?.fileName && (
              <div>
                <span className="font-medium">Nome do Arquivo: </span>
                {template.fileName}
              </div>
            )}
            {template?.fileType && (
              <div>
                <span className="font-medium">Tipo do Arquivo: </span>
                {template.fileType}
              </div>
            )}
            {template?.fileSize && (
              <div>
                <span className="font-medium">Tamanho do Arquivo: </span>
                {(template.fileSize / 1024 / 1024).toFixed(2)} MB
              </div>
            )}
            {template?.tags && template.tags.length > 0 && (
              <div>
                <span className="font-medium">Tags: </span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {template.tags.map((tag, index) => (
                    <Badge key={index} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {template?.variables && template.variables.length > 0 && (
              <div>
                <span className="font-medium">Variáveis: </span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {template.variables.map((variable, index) => (
                    <Badge
                      key={index}
                      variant="secondary"
                    >{`{{${variable}}}`}</Badge>
                  ))}
                </div>
              </div>
            )}
            <div>
              <span className="font-medium">Criado em: </span>
              {template?.createdAt
                ? new Date(template.createdAt).toLocaleDateString()
                : "N/A"}
            </div>
            <div>
              <span className="font-medium">Último Uso: </span>
              {template?.lastUsed
                ? new Date(template.lastUsed).toLocaleDateString()
                : "N/A"}
            </div>
            <div>
              <span className="font-medium">Uso Total: </span>
              {template?.usage || 0}
            </div>
            {template?.spintexEnabled && (
              <div>
                <span className="font-medium">Spintex Habilitado: </span> Sim
              </div>
            )}
            {template?.variations && template.variations.length > 0 && (
              <div>
                <span className="font-medium">Variações (Spintex): </span>
                <ul className="mt-1 list-inside list-disc">
                  {template.variations.map((variation, index) => (
                    <li key={index} className="truncate">
                      {variation}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <Separator className="my-4" />
            <div>
              <h4 className="mb-2 font-medium">
                Exemplo de Payload para API de Envio:
              </h4>
              <div className="bg-muted max-h-40 overflow-y-auto rounded-md p-3 font-mono text-xs break-all whitespace-pre-wrap">
                {JSON.stringify(createMessagePayload(), null, 2)}
              </div>
            </div>
            <Card className="mt-4">
                           {" "}
              <CardHeader className="pb-2">
                               {" "}
                <CardTitle className="text-sm">
                  Endpoint Sugerido para Envio
                </CardTitle>
                             {" "}
              </CardHeader>
                           {" "}
              <CardContent className="space-y-2 text-xs">
                               {" "}
                <div>
                                   {" "}
                  <span className="font-medium">Método: </span>                 {" "}
                  <code className="bg-muted rounded px-2 py-1 text-sm">
                    POST
                  </code>
                                 {" "}
                </div>
                               {" "}
                <div>
                                    <span className="font-medium">URL: </span> 
                                 {" "}
                  <code className="bg-muted rounded px-2 py-1 text-sm">
                                       {" "}
                    {(template.category === "texto" ||
                      template.category === "botoes" ||
                      template.category === "lista") &&
                      "https://api.domain.com/message/sendWhatsAppText/instance"}
                                       {" "}
                    {template.category === "midia" &&
                      "https://api.domain.com/message/sendWhatsAppImage/instance"}
                                       {" "}
                    {template.category === "audio" &&
                      "https://api.domain.com/message/sendWhatsAppAudio/instance"}
                                       {" "}
                    {(template.category === "video" ||
                      template.category === "documento") &&
                      "https://api.domain.com/message/sendMedia/instance"}
                                     {" "}
                  </code>
                                 {" "}
                </div>
                               {" "}
                <div>
                                   {" "}
                  <span className="font-medium">Headers: </span>               
                   {" "}
                  <code className="bg-muted rounded px-2 py-1 text-sm">
                                        Authorization: API_KEY                
                     {" "}
                  </code>
                                 {" "}
                </div>
                             {" "}
              </CardContent>
                         {" "}
            </Card>
                     {" "}
          </TabsContent>
                 {" "}
        </Tabs>
               {" "}
        <div className="flex justify-end gap-3">
                   {" "}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Fechar          {" "}
          </Button>
                   {" "}
          <Button
            onClick={() =>
              copyToClipboard(JSON.stringify(createMessagePayload(), null, 2))
            }
          >
                        <Download className="mr-2 h-4 w-4" />           
            Exportar JSON          {" "}
          </Button>
                 {" "}
        </div>
             {" "}
      </DialogContent>
         {" "}
    </Dialog>
  );
}
