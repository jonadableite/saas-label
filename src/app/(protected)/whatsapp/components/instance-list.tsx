// src/app/(protected)/whatsapp/components/instance-list.tsx
"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  Bot,
  CheckCircle,
  Clock,
  Loader2,
  LogOut,
  MessageCircle,
  PowerOff,
  QrCode,
  RefreshCcw,
  Search,
  Settings,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react"; // Importe useRef
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { instancesTables } from "@/db/schema";
import { cn } from "@/lib/utils";

import { getInstanceStatus } from "../actions";

export type Instance = typeof instancesTables.$inferSelect;

interface InstanceListProps {
  initialInstances: Instance[];
}

const StatusIcon = ({ status }: { status: string | null }) => {
  switch (status) {
    case "open":
    case "online":
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case "connecting":
    case "qrcode":
    case "start": // Adicionado 'start' como estado de conexão/QR
      return <Clock className="h-4 w-4 animate-pulse text-yellow-500" />;
    case "close":
    case "offline":
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    default:
      return <AlertCircle className="h-4 w-4 text-gray-500" />;
  }
};

const getStatusText = (status: string | null) => {
  switch (status) {
    case "open":
    case "online": // Adicionado 'online'
      return "Conectado";
    case "connecting":
    case "start":
      return "Conectando";
    case "qrcode":
      return "Aguardando QR";
    case "close":
    case "offline": // Adicionado 'offline'
      return "Desconectado";
    case "unknown":
      return "Desconhecido";
    default:
      return "Carregando...";
  }
};

const ProfileAvatar = ({ instance }: { instance: Instance }) => {
  const isOnline = instance.status === "open" || instance.status === "online";
  const profileImageUrl = instance.profilePicUrl;
  return (
    <div className="relative">
      <Avatar className="h-12 w-12 border-2 border-white shadow-md md:h-16 md:w-16 dark:border-[#091E3B]">
        <AvatarImage
          src={profileImageUrl || undefined}
          alt={instance.profileName || instance.instanceName}
          className="object-cover"
        />
        <AvatarFallback className="bg-gradient-to-br from-green-800 to-emerald-500 text-lg font-bold text-white">
          {instance.profileName ? (
            instance.profileName.charAt(0).toUpperCase()
          ) : instance.instanceName ? (
            instance.instanceName.charAt(0).toUpperCase()
          ) : (
            <MessageCircle className="h-6 w-6 md:h-8 md:w-8" />
          )}
        </AvatarFallback>
      </Avatar>
      <div
        className={cn(
          "absolute -right-1 -bottom-1 h-4 w-4 rounded-full border-2 border-white md:h-5 md:w-5 dark:border-[#091E3B]",
          isOnline ? "bg-green-500" : "bg-gray-400",
        )}
      />
    </div>
  );
};

export function InstanceList({ initialInstances }: InstanceListProps) {
  const [instances, setInstances] = useState<Instance[]>(initialInstances);
  const [loadingStatus, setLoadingStatus] = useState<Record<string, boolean>>(
    {},
  );
  const [search, setSearch] = useState("");

  // Use useRef para armazenar a versão mais recente do estado 'instances'
  const instancesRef = useRef(instances);

  // Efeito para manter a ref atualizada sempre que o estado 'instances' mudar
  useEffect(() => {
    instancesRef.current = instances;
  }, [instances]); // Este efeito roda sempre que 'instances' muda

  const fetchStatus = useCallback(async (instanceName: string) => {
    setLoadingStatus((prev) => ({ ...prev, [instanceName]: true }));
    const result = await getInstanceStatus(instanceName);
    setLoadingStatus((prev) => ({ ...prev, [instanceName]: false }));

    // Use a atualização funcional do estado para garantir que você está trabalhando com o estado mais recente
    setInstances((prev) =>
      prev.map((inst) => {
        if (inst.instanceName === instanceName) {
          // Atualiza o status apenas se a chamada foi bem-sucedida e retornou um status
          if (result.success && result.status !== undefined) {
            return { ...inst, status: result.status };
          } else if (result.error) {
            // Define como 'unknown' ou mantém o status anterior em caso de erro
            toast.error(
              `Erro ao obter status de ${instanceName}: ${result.error}`,
            );
            return { ...inst, status: inst.status || "unknown" }; // Mantém o status anterior ou define como unknown
          }
        }
        return inst;
      }),
    );
  }, []); // fetchStatus não depende de 'instances' ou 'setInstances' diretamente graças à atualização funcional e useCallback

  // Efeito para a busca inicial e configuração do intervalo
  useEffect(() => {
    // Busca inicial de status para todas as instâncias fornecidas
    initialInstances.forEach((instance) => {
      // Opcional: Você pode adicionar uma condição aqui se não quiser buscar o status
      // de instâncias que já vêm com um status final conhecido do servidor.
      // Por exemplo: if (instance.status !== "open" && instance.status !== "close") { ... }
      // No entanto, buscar o status de todos inicialmente garante que você tem o status mais recente.
      fetchStatus(instance.instanceName);
    });

    // Configura o intervalo para verificar o status periodicamente
    const intervalId = setInterval(() => {
      // Use a ref para acessar a lista de instâncias mais recente dentro do intervalo
      instancesRef.current.forEach((instance) => {
        // Verifica o status apenas para instâncias que não estão em estado final
        // Adicionei 'unknown' para garantir que instâncias com erro também sejam re-verificadas
        if (
          instance.status !== "open" &&
          instance.status !== "close" &&
          instance.status !== "unknown" &&
          instance.status !== "offline"
        ) {
          fetchStatus(instance.instanceName);
        }
      });
    }, 30000); // Verifica a cada 30 segundos

    // Função de limpeza: limpa o intervalo quando o componente desmonta ou as dependências mudam
    return () => clearInterval(intervalId);
  }, [initialInstances, fetchStatus]); // Dependências: initialInstances (se mudar) e fetchStatus (estável via useCallback)
  // Removendo 'instances' daqui, o intervalo não será reiniciado a cada atualização de status.

  const filteredInstances = instances.filter(
    (instance) =>
      instance.instanceName.toLowerCase().includes(search.toLowerCase()) ||
      instance.number?.toLowerCase().includes(search.toLowerCase()) ||
      instance.profileName?.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <div className="relative mb-6 w-full md:w-1/3">
        <Search className="text-muted-foreground absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 transform" />
        <Input
          placeholder="Buscar instâncias por nome, número ou perfil..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-md border py-2 pr-4 pl-10"
        />
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence>
          {filteredInstances.length === 0 ? (
            <motion.p
              key="no-instances"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-muted-foreground col-span-full text-center"
            >
              {instances.length === 0
                ? "Nenhuma instância encontrada. Crie uma para começar!"
                : "Nenhuma instância encontrada com este termo de busca."}
            </motion.p>
          ) : (
            filteredInstances.map((instance) => (
              <motion.div
                key={instance.instanceId}
                layout
                initial={{ opacity: 0, y: 50, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                transition={{ duration: 0.3 }}
              >
                <Card className="flex h-full flex-col">
                  <CardHeader className="flex flex-wrap items-center justify-between gap-2 space-y-0 pb-2">
                    <div className="flex min-w-0 items-center gap-4">
                      <ProfileAvatar instance={instance} />
                      <div className="min-w-0">
                        <CardTitle className="truncate text-lg font-semibold">
                          {instance.profileName || instance.instanceName}
                        </CardTitle>
                        {instance.profileName &&
                          instance.profileName !== instance.instanceName && (
                            <p className="text-muted-foreground truncate text-sm">
                              {instance.instanceName}
                            </p>
                          )}
                      </div>
                    </div>
                    {/* Indicador de Status */}
                    <div
                      className={`flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
                        instance.status === "open" ||
                        instance.status === "online"
                          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                          : instance.status === "connecting" ||
                              instance.status === "qrcode" ||
                              instance.status === "start"
                            ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                            : instance.status === "close" ||
                                instance.status === "offline"
                              ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                              : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                      }`}
                    >
                      <StatusIcon status={instance.status} />
                      {getStatusText(instance.status)}
                    </div>
                  </CardHeader>
                  <CardContent className="text-muted-foreground flex-grow space-y-2 pt-4 text-sm">
                    {/* Detalhes da Instância */}
                    {instance.ownerJid && (
                      <p>
                        Número:{" "}
                        <span className="font-mono break-all">
                          {instance.ownerJid}
                        </span>{" "}
                      </p>
                    )}
                    <p className="flex items-center gap-1">
                      <Bot className="h-4 w-4 text-emerald-500" /> Agentes AI:{" "}
                      <span className="text-foreground font-semibold">0</span>
                    </p>
                    <div className="border-border mt-4 flex flex-wrap gap-2 border-t pt-4">
                      <Button
                        variant="outline"
                        size="icon"
                        title="Atualizar Status"
                        onClick={() => fetchStatus(instance.instanceName)}
                        disabled={loadingStatus[instance.instanceName]}
                        className="shrink-0"
                      >
                        {loadingStatus[instance.instanceName] ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCcw className="h-4 w-4" />
                        )}
                        <span className="sr-only">Atualizar Status</span>
                      </Button>
                      {(instance.status === "qrcode" ||
                        instance.status === "connecting" ||
                        instance.status === "start") && (
                        <Button
                          variant="outline"
                          size="icon"
                          title="Ver QR Code"
                          className="shrink-0"
                        >
                          <QrCode className="h-4 w-4" />
                          <span className="sr-only">Ver QR Code</span>
                        </Button>
                      )}
                      {instance.status === "open" && (
                        <Button
                          variant="outline"
                          size="icon"
                          title="Configurações da Instância"
                          className="shrink-0"
                        >
                          <Settings className="h-4 w-4" />
                          <span className="sr-only">
                            Configurações da Instância
                          </span>
                        </Button>
                      )}
                      {instance.status === "open" && (
                        <Button
                          variant="outline"
                          size="icon"
                          title="Gerenciar Agentes AI"
                          className="shrink-0"
                        >
                          <Bot className="h-4 w-4" />
                          <span className="sr-only">Gerenciar Agentes AI</span>
                        </Button>
                      )}
                      {instance.status !== "close" &&
                        instance.status !== "offline" && (
                          <Button
                            variant="outline"
                            size="icon"
                            title="Desconectar"
                            className="shrink-0"
                          >
                            <PowerOff className="h-4 w-4 text-yellow-600" />
                            <span className="sr-only">Desconectar</span>
                          </Button>
                        )}
                      {instance.status === "open" && (
                        <Button
                          variant="outline"
                          size="icon"
                          title="Logout (Limpar Sessão)"
                          className="shrink-0"
                        >
                          <LogOut className="h-4 w-4 text-orange-600" />
                          <span className="sr-only">
                            Logout (Limpar Sessão)
                          </span>
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="icon"
                        title="Deletar Instância"
                        className="shrink-0"
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                        <span className="sr-only">Deletar Instância</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
