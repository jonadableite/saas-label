// src/app/(protected)/campaigns/_components/create-campaign-modal.tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Clock, Eye, FileUp, Loader2, MessageSquare, Plus, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

const campaignSchema = z.object({
  name: z.string().min(1, "Nome da campanha é obrigatório"),
  description: z.string().optional(),
  instanceId: z.string().min(1, "Instância é obrigatória"),
  templateId: z.string().optional(),
  messageContent: z.string().min(1, "Conteúdo da mensagem é obrigatório"),

  // Agendamento
  enableScheduling: z.boolean().default(false),
  scheduleDate: z.date().optional(),
  scheduleTime: z.string().optional(),

  // Configurações avançadas
  sendDelay: z.number().min(1000, "Delay mínimo é 1 segundo").default(2000),
  sendOnlyBusinessHours: z.boolean().default(false),
  businessHoursStart: z.string().default("09:00"),
  businessHoursEnd: z.string().default("18:00"),

  // Contatos e grupos
  contactIds: z.array(z.string()).default([]),
  groupIds: z.array(z.string()).default([]),
});

// Schemas para formulários auxiliares
const addContactSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  phoneNumber: z.string().min(10, "Número de telefone inválido"),
  email: z.string().email().optional().or(z.literal("")),
});

const addGroupSchema = z.object({
  name: z.string().min(1, "Nome do grupo é obrigatório"),
  description: z.string().optional(),
});

type CampaignFormData = z.infer<typeof campaignSchema>;
type AddContactFormData = z.infer<typeof addContactSchema>;
type AddGroupFormData = z.infer<typeof addGroupSchema>;

interface Instance {
  instanceId: string;
  instanceName: string;
  status: string;
  profileName?: string;
  phoneNumber?: string;
}

interface Template {
  id: string;
  name: string;
  content: string;
  type: string;
}

interface Contact {
  id: string;
  name: string;
  phoneNumber: string;
  isActive: boolean;
}

interface ContactGroup {
  id: string;
  name: string;
  totalContacts: number;
}

export function CreateCampaignModal() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [groups, setGroups] = useState<ContactGroup[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Estados para modais auxiliares
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [addContactModalOpen, setAddContactModalOpen] = useState(false);
  const [addGroupModalOpen, setAddGroupModalOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [importLoading, setImportLoading] = useState(false);

  const form = useForm<CampaignFormData>({
    resolver: zodResolver(campaignSchema),
    defaultValues: {
      name: "",
      description: "",
      instanceId: "",
      templateId: "",
      messageContent: "",
      enableScheduling: false,
      sendDelay: 2000,
      sendOnlyBusinessHours: false,
      businessHoursStart: "09:00",
      businessHoursEnd: "18:00",
      contactIds: [],
      groupIds: [],
    },
  });

  const addContactForm = useForm<AddContactFormData>({
    resolver: zodResolver(addContactSchema),
    defaultValues: {
      name: "",
      phoneNumber: "",
      email: "",
    },
  });

  const addGroupForm = useForm<AddGroupFormData>({
    resolver: zodResolver(addGroupSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  const selectedInstance = instances.find(i => i.instanceId === form.watch("instanceId"));
  const selectedTemplate = templates.find(t => t.id === form.watch("templateId"));
  const selectedContacts = contacts.filter(c => form.watch("contactIds").includes(c.id));
  const selectedGroups = groups.filter(g => form.watch("groupIds").includes(g.id));

  // Carregar dados iniciais
  useEffect(() => {
    if (open) {
      loadInitialData();
    }
  }, [open]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      console.log("🔄 Iniciando carregamento de dados...");

      const [instancesRes, templatesRes, contactsRes, groupsRes] = await Promise.all([
        fetch("/api/instances").catch(err => {
          console.error("❌ Erro ao buscar instâncias:", err);
          return { ok: false, status: 500, statusText: err.message };
        }),
        fetch("/api/templates").catch(err => {
          console.error("❌ Erro ao buscar templates:", err);
          return { ok: false, status: 500, statusText: err.message };
        }),
        fetch("/api/contacts?limit=100").catch(err => {
          console.error("❌ Erro ao buscar contatos:", err);
          return { ok: false, status: 500, statusText: err.message };
        }),
        fetch("/api/contact-groups").catch(err => {
          console.error("❌ Erro ao buscar grupos:", err);
          return { ok: false, status: 500, statusText: err.message };
        }),
      ]);

      console.log("📊 Status das requisições:", {
        instances: `${instancesRes.status} - ${instancesRes.statusText}`,
        templates: `${templatesRes.status} - ${templatesRes.statusText}`,
        contacts: `${contactsRes.status} - ${contactsRes.statusText}`,
        groups: `${groupsRes.status} - ${groupsRes.statusText}`,
      });

      if (instancesRes.ok && typeof (instancesRes as Response).json === "function") {
        const instancesData = await (instancesRes as Response).json();
        console.log("✅ Instâncias carregadas:", instancesData);
        setInstances(instancesData.instances || []);

        if (instancesData.instances?.length > 0) {
          toast.success(`${instancesData.instances.length} instância(s) carregada(s)`);
        } else {
          toast.info("Nenhuma instância encontrada. Crie uma instância primeiro.");
        }
      } else {
        console.error("❌ Erro ao carregar instâncias:", instancesRes.status);
        toast.error("Erro ao carregar instâncias");
      }

      if (templatesRes.ok && typeof (templatesRes as Response).json === "function") {
        const templatesData = await (templatesRes as Response).json();
        console.log("✅ Templates carregados:", templatesData);
        setTemplates(templatesData.templates || []);
      }

      if (contactsRes.ok && typeof (contactsRes as Response).json === "function") {
        const contactsData = await (contactsRes as Response).json();
        console.log("✅ Contatos carregados:", contactsData);
        setContacts(contactsData.contacts || []);
      }

      if (groupsRes.ok && typeof (groupsRes as Response).json === "function") {
        const groupsData = await (groupsRes as Response).json();
        console.log("✅ Grupos carregados:", groupsData);
        setGroups(groupsData.groups || []);
      }

      console.log("🎉 Carregamento concluído!");

    } catch (error) {
      console.error("💥 Erro geral ao carregar dados:", error);
      toast.error("Erro ao carregar dados necessários");
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: CampaignFormData) => {
  try {
    setLoading(true);

    // Preparar dados para envio
    const payload: any = {
      name: data.name,
      description: data.description,
      instanceId: data.instanceId,
      templateId: data.templateId,
      messageContent: data.messageContent,
      enableScheduling: data.enableScheduling,
      sendDelay: data.sendDelay,
      sendOnlyBusinessHours: data.sendOnlyBusinessHours,
      businessHoursStart: data.businessHoursStart,
      businessHoursEnd: data.businessHoursEnd,
      contactIds: data.contactIds,
      groupIds: data.groupIds,
    };

    // Só adicionar scheduleAt se o agendamento estiver habilitado E tiver data/hora
    if (data.enableScheduling && data.scheduleDate && data.scheduleTime) {
      payload.scheduleAt = new Date(`${format(data.scheduleDate, "yyyy-MM-dd")} ${data.scheduleTime}`);
    }

    const response = await fetch("/api/campaigns", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Erro ao criar campanha");
    }

    const campaign = await response.json();

    toast.success("Campanha criada com sucesso!");
    setOpen(false);
    form.reset();

    // Refresh da página
    window.location.reload();
  } catch (error) {
    console.error("Erro ao criar campanha:", error);
    toast.error(error instanceof Error ? error.message : "Erro ao criar campanha");
  } finally {
    setLoading(false);
  }
};


  const handleTemplateSelect = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      form.setValue("templateId", templateId);
      form.setValue("messageContent", template.content);
    }
  };

  const getTotalContacts = () => {
    const directContacts = selectedContacts.length;
    const groupContacts = selectedGroups.reduce((acc, group) => acc + group.totalContacts, 0);
    return directContacts + groupContacts;
  };

  // Função para importar contatos
const handleImportContacts = async () => {
  if (!uploadFile) {
    toast.error("Selecione um arquivo para importar");
    return;
  }

  try {
    setImportLoading(true);

    const formData = new FormData();
    formData.append("file", uploadFile);

    const response = await fetch("/api/contacts/import", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Erro ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();


    toast.success(typeof result.message === 'string' ? result.message : "Contatos importados com sucesso!");

    // Recarregar contatos
    await loadInitialData();
    setImportModalOpen(false);
    setUploadFile(null);

  } catch (error) {
    console.error("Erro ao importar:", error);

    const errorMessage = error instanceof Error ? error.message : "Erro ao importar contatos";
    toast.error(errorMessage);
  } finally {
    setImportLoading(false);
  }
};

// Função para processar CSV no frontend
const processCSVFile = async (file: File) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n');
        const headers = lines[0].toLowerCase().split(',').map(h => h.trim());

        // Verificar se tem as colunas necessárias
        const nameIndex = headers.findIndex(h => h.includes('nome') || h.includes('name'));
        const phoneIndex = headers.findIndex(h => h.includes('telefone') || h.includes('phone') || h.includes('celular'));
        const emailIndex = headers.findIndex(h => h.includes('email'));

        if (nameIndex === -1 || phoneIndex === -1) {
          throw new Error('Arquivo deve conter colunas "nome" e "telefone"');
        }

        const newContacts: typeof contacts = [];

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          const values = line.split(',').map(v => v.trim().replace(/"/g, ''));

          const name = values[nameIndex]?.trim();
          const phone = values[phoneIndex]?.trim().replace(/\D/g, ''); // Remove caracteres não numéricos
          const email = emailIndex >= 0 ? values[emailIndex]?.trim() : '';

          if (name && phone && phone.length >= 10) {
            newContacts.push({
              id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
              name,
              phoneNumber: phone,
              email: email || undefined,
              createdAt: new Date().toISOString(),
            });
          }
        }

        if (newContacts.length === 0) {
          throw new Error('Nenhum contato válido encontrado no arquivo');
        }

        setContacts(prev => [...prev, ...newContacts]);

        toast({
          title: "Contatos importados com sucesso!",
          description: `${newContacts.length} contatos foram adicionados.`,
        });

        setImportModalOpen(false);
        setUploadFile(null);
        resolve(newContacts);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error('Erro ao ler o arquivo'));
    reader.readAsText(file);
  });
};


  // Função para adicionar contato individual
  const handleAddContact = async (data: AddContactFormData) => {
    try {
      const response = await fetch("/api/contacts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao criar contato");
      }

      const newContact = await response.json();
      toast.success("Contato adicionado com sucesso!");

      // Adicionar o novo contato à lista
      setContacts(prev => [...prev, newContact]);

      // Selecionar automaticamente o novo contato
      const currentContactIds = form.getValues("contactIds");
      form.setValue("contactIds", [...currentContactIds, newContact.id]);

      setAddContactModalOpen(false);
      addContactForm.reset();

    } catch (error) {
      console.error("Erro ao adicionar contato:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao adicionar contato");
    }
  };

  // Função para adicionar grupo
  const handleAddGroup = async (data: AddGroupFormData) => {
    try {
      const response = await fetch("/api/contact-groups", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao criar grupo");
      }

      const newGroup = await response.json();
      toast.success("Grupo criado com sucesso!");

      // Adicionar o novo grupo à lista
      setGroups(prev => [...prev, newGroup]);

      // Selecionar automaticamente o novo grupo
      const currentGroupIds = form.getValues("groupIds");
      form.setValue("groupIds", [...currentGroupIds, newGroup.id]);

      setAddGroupModalOpen(false);
      addGroupForm.reset();

    } catch (error) {
      console.error("Erro ao criar grupo:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao criar grupo");
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="magic"  className="gap-2">
            <Plus className="h-4 w-4" />
            Nova Campanha
          </Button>
        </DialogTrigger>

        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Criar Nova Campanha</DialogTitle>
            <DialogDescription>
              Configure sua campanha de WhatsApp marketing
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <Tabs defaultValue="basic" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="basic">Básico</TabsTrigger>
                  <TabsTrigger value="message">Mensagem</TabsTrigger>
                  <TabsTrigger value="audience">Público</TabsTrigger>
                  <TabsTrigger value="schedule">Agendamento</TabsTrigger>
                </TabsList>

                {/* Aba Básico */}
                <TabsContent value="basic" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome da Campanha *</FormLabel>
                          <FormControl>
                            <Input placeholder="Ex: Black Friday 2025" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="instanceId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Instância WhatsApp *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione uma instância" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {instances.map((instance) => (
                                <SelectItem key={instance.instanceId} value={instance.instanceId}>
                                  <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${
                                      instance.status === 'open' ? 'bg-green-500' : 'bg-red-500'
                                    }`} />
                                    <span>{instance.instanceName}</span>
                                    {instance.phoneNumber && (
                                      <span className="text-muted-foreground text-xs">
                                        ({instance.phoneNumber})
                                      </span>
                                    )}
                                  </div>
                                </SelectItem>
                              ))}
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
                        <FormLabel>Descrição</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Descreva o objetivo desta campanha..."
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Configurações Avançadas */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Configurações de Envio</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="sendDelay"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Delay entre mensagens (ms)</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min="1000"
                                  step="500"
                                  {...field}
                                  onChange={(e) => field.onChange(parseInt(e.target.value))}
                                />
                              </FormControl>
                              <FormDescription>
                                Tempo de espera entre cada mensagem (mínimo 1 segundo)
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="sendOnlyBusinessHours"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                            <div className="space-y-0.5">
                              <FormLabel>Enviar apenas em horário comercial</FormLabel>
                              <FormDescription>
                                Mensagens serão enviadas apenas no horário definido
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      {form.watch("sendOnlyBusinessHours") && (
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="businessHoursStart"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Início do horário comercial</FormLabel>
                                <FormControl>
                                  <Input type="time" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="businessHoursEnd"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Fim do horário comercial</FormLabel>
                                <FormControl>
                                  <Input type="time" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Aba Mensagem */}
                <TabsContent value="message" className="space-y-4">
                  <div className="grid grid-cols-1 gap-4">
                    <FormField
                      control={form.control}
                      name="templateId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Template (Opcional)</FormLabel>
                          <Select onValueChange={handleTemplateSelect} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Escolha um template ou crie uma mensagem personalizada" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {templates.map((template) => (
                                <SelectItem key={template.id} value={template.id}>
                                  <div className="flex items-center gap-2">
                                    <MessageSquare className="h-4 w-4" />
                                    <span>{template.name}</span>
                                    <Badge variant="outline" className="text-xs">
                                      {template.type}
                                    </Badge>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            Selecione um template existente ou deixe em branco para criar uma mensagem personalizada
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="messageContent"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Conteúdo da Mensagem *</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder={`Digite sua mensagem aqui...

Você pode usar variáveis como:
\{\{nome\}\} - Nome do contato
\{\{telefone\}\} - Telefone do contato`}
                              rows={8}
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            Use variáveis como {`\{\{nome\}\}`} e {`\{\{telefone\}\}`} para personalizar as mensagens
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex justify-between items-center">
                      <p className="text-sm text-muted-foreground">
                        Caracteres: {form.watch("messageContent")?.length || 0}/4096
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setPreviewOpen(true)}
                        className="gap-2"
                      >
                        <Eye className="h-4 w-4" />
                        Preview
                      </Button>
                    </div>
                  </div>
                </TabsContent>

                {/* Aba Público */}
                <TabsContent value="audience" className="space-y-4">
                  {/* Ações de Público */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Gerenciar Público</CardTitle>
                      <CardDescription>
                        Importe ou adicione contatos e grupos para sua campanha
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setImportModalOpen(true)}
                          className="gap-2"
                        >
                          <FileUp className="h-4 w-4" />
                          Importar Contatos
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setAddContactModalOpen(true)}
                          className="gap-2"
                        >
                          <Plus className="h-4 w-4" />
                          Adicionar Contato
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setAddGroupModalOpen(true)}
                          className="gap-2"
                        >
                          <Users className="h-4 w-4" />
                          Criar Grupo
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="grid grid-cols-2 gap-6">
                    {/* Contatos Individuais */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          Contatos Individuais
                          <Badge variant="secondary">{contacts.length}</Badge>
                        </CardTitle>
                        <CardDescription>
                          Selecione contatos específicos
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        {contacts.length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground">
                            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>Nenhum contato cadastrado</p>
                            <p className="text-sm">Importe ou adicione contatos para continuar</p>
                          </div>
                        ) : (
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {contacts.map((contact) => (
                              <div
                                key={contact.id}
                                className="flex items-center space-x-2 p-2 rounded hover:bg-muted cursor-pointer"
                                onClick={() => {
                                  const current = form.getValues("contactIds");
                                  const isSelected = current.includes(contact.id);
                                  const updated = isSelected
                                    ? current.filter(id => id !== contact.id)
                                    : [...current, contact.id];
                                  form.setValue("contactIds", updated);
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={form.watch("contactIds").includes(contact.id)}
                                  onChange={() => {}} // Controlado pelo onClick acima
                                  className="rounded"
                                />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">
                                    {contact.name}
                                  </p>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {contact.phoneNumber}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {selectedContacts.length > 0 && (
                          <div className="mt-3 pt-3 border-t">
                            <p className="text-sm font-medium">
                              {selectedContacts.length} contato(s) selecionado(s)
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Grupos */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          Grupos de Contatos
                          <Badge variant="secondary">{groups.length}</Badge>
                        </CardTitle>
                        <CardDescription>
                          Selecione grupos inteiros
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {groups.map((group) => (
                            <div
                              key={group.id}
                              className="flex items-center space-x-2 p-2 rounded hover:bg-muted cursor-pointer"
                              onClick={() => {
                                const current = form.getValues("groupIds");
                                const isSelected = current.includes(group.id);
                                const updated = isSelected
                                  ? current.filter(id => id !== group.id)
                                  : [...current, group.id];
                                form.setValue("groupIds", updated);
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={form.watch("groupIds").includes(group.id)}
                                onChange={() => {}}
                                className="rounded"
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">
                                  {group.name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {group.totalContacts} contatos
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                        {selectedGroups.length > 0 && (
                          <div className="mt-3 pt-3 border-t">
                            <p className="text-sm font-medium">
                              {selectedGroups.length} grupo(s) selecionado(s)
                            </p>
                            <p className="text-xs text-muted-foreground">
                              ~{selectedGroups.reduce((acc, g) => acc + g.totalContacts, 0)} contatos
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Resumo do Público */}
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-semibold">Total de Destinatários</h4>
                          <p className="text-sm text-muted-foreground">
                            Contatos que receberão esta campanha
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold">{getTotalContacts()}</p>
                          <p className="text-xs text-muted-foreground">contatos</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Aba Agendamento */}
                <TabsContent value="schedule" className="space-y-4">
                  <FormField
                    control={form.control}
                    name="enableScheduling"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Agendar Campanha</FormLabel>
                          <FormDescription>
                            Defina uma data e hora específica para iniciar a campanha
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {form.watch("enableScheduling") && (
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="scheduleDate"
                        render={({ field }) => (
                          <FormItem className="flex flex-col">
                            <FormLabel>Data de Envio</FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant="outline"
                                    className={`w-full pl-3 text-left font-normal ${
                                      !field.value && "text-muted-foreground"
                                    }`}
                                  >
                                    {field.value ? (
                                      format(field.value, "PPP", { locale: ptBR })
                                    ) : (
                                      <span>Selecione uma data</span>
                                    )}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={field.value}
                                  onSelect={field.onChange}
                                  disabled={(date) => date < new Date()}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="scheduleTime"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Horário de Envio</FormLabel>
                            <FormControl>
                              <Input type="time" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}

                  {!form.watch("enableScheduling") && (
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-2 text-green-600">
                          <Clock className="h-4 w-4" />
                          <span className="text-sm font-medium">
                            A campanha será iniciada imediatamente após a criação
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
              </Tabs>

              {/* Footer com resumo e ações */}
              <div className="flex items-center justify-between pt-6 border-t">
                <div className="text-sm text-muted-foreground">
                  {getTotalContacts() > 0 && (
                    <span>
                      Pronto para enviar para {getTotalContacts()} contato(s)
                      {selectedInstance && ` via ${selectedInstance.instanceName}`}
                    </span>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={loading || getTotalContacts() === 0}
                    className="gap-2"
                  >
                    {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                    {form.watch("enableScheduling") ? "Agendar Campanha" : "Criar e Iniciar"}
                  </Button>
                </div>
              </div>
            </form>
          </Form>

          {/* Modal de Preview */}
          <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Preview da Mensagem</DialogTitle>
                <DialogDescription>
                  Veja como sua mensagem aparecerá para os destinatários
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="bg-muted/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white text-xs">
                      WA
                    </div>
                    <div>
                      <p className="text-sm font-medium">Sua Empresa</p>
                      <p className="text-xs text-muted-foreground">
                        {selectedInstance?.phoneNumber || "Número da instância"}
                      </p>
                    </div>
                  </div>
                  <div className="bg-white rounded-lg p-3 shadow-sm">
                    <p className="text-sm whitespace-pre-wrap">
                      {form.watch("messageContent")
                        ?.replace(/\{\{nome\}\}/g, "João Silva")
                        ?.replace(/\{\{telefone\}\}/g, "(11) 99999-9999")
                      }
                    </p>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  * Variáveis como {`\{\{nome\}\}`} e {`\{\{telefone\}\}`} serão substituídas pelos dados reais de cada contato
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </DialogContent>
      </Dialog>

      {/* Modal de Importar Contatos */}
      <Dialog open={importModalOpen} onOpenChange={setImportModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importar Contatos</DialogTitle>
            <DialogDescription>
              Importe contatos de um arquivo CSV ou Excel
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center">
              <FileUp className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <div className="mb-4">
                <p className="text-sm font-medium">Selecione um arquivo</p>
                <p className="text-xs text-muted-foreground">CSV, XLS ou XLSX até 10MB</p>
              </div>
              <Input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                className="max-w-xs mx-auto"
              />
            </div>

            {uploadFile && (
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-sm font-medium">Arquivo selecionado:</p>
                <p className="text-xs text-muted-foreground">{uploadFile.name}</p>
              </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm font-medium text-blue-900 mb-2">Formato esperado:</p>
              <div className="text-xs text-blue-800 space-y-1">
                <p>• <strong>nome</strong>: Nome do contato</p>
                <p>• <strong>telefone</strong>: Número com DDD (ex: 11999999999)</p>
                <p>• <strong>email</strong>: Email (opcional)</p>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setImportModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleImportContacts}
                disabled={!uploadFile || importLoading}
                className="gap-2"
              >
                {importLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                Importar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Adicionar Contato */}
      <Dialog open={addContactModalOpen} onOpenChange={setAddContactModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Contato</DialogTitle>
            <DialogDescription>
              Adicione um novo contato à sua lista
            </DialogDescription>
          </DialogHeader>
          <Form {...addContactForm}>
            <form onSubmit={addContactForm.handleSubmit(handleAddContact)} className="space-y-4">
              <FormField
                control={addContactForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome *</FormLabel>
                    <FormControl>
                      <Input placeholder="Nome do contato" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={addContactForm.control}
                name="phoneNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="11999999999"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Digite apenas números com DDD (ex: 11999999999)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={addContactForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="email@exemplo.com"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAddContactModalOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Adicionar
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Modal de Criar Grupo */}
      <Dialog open={addGroupModalOpen} onOpenChange={setAddGroupModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Grupo</DialogTitle>
            <DialogDescription>
              Crie um novo grupo de contatos
            </DialogDescription>
          </DialogHeader>
          <Form {...addGroupForm}>
            <form onSubmit={addGroupForm.handleSubmit(handleAddGroup)} className="space-y-4">
              <FormField
                control={addGroupForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do Grupo *</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Clientes VIP" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={addGroupForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Descreva o propósito deste grupo..."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAddGroupModalOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" className="gap-2">
                  <Users className="h-4 w-4" />
                  Criar Grupo
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
