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
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  deleteInstance,
  getInstanceQrCode,
  getInstanceStatus,
  logoutInstance,
  restartInstance,
} from "@/actions/instance";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { instancesTables } from "@/db/schema";
import { cn } from "@/lib/utils";

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
    case "start":
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
    case "online":
      return "Conectado";
    case "connecting":
    case "start":
      return "Conectando";
    case "qrcode":
      return "Aguardando QR";
    case "close":
    case "offline":
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

  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [currentQrCodeData, setCurrentQrCodeData] = useState<{
    qrCode?: string;
    pairingCode?: string;
  } | null>(null);
  const [loadingQrCode, setLoadingQrCode] = useState(false);

  const instancesRef = useRef(instances);

  useEffect(() => {
    instancesRef.current = instances;
    console.log("[instancesRef] instances state updated:", instances);
  }, [instances]);

  const fetchStatus = useCallback(async (instanceName: string) => {
    console.log(
      `[fetchStatus] Attempting to fetch status for: ${instanceName}`,
    );
    setLoadingStatus((prev) => ({ ...prev, [instanceName]: true }));
    const result = await getInstanceStatus({ instanceName });
    console.log(`[fetchStatus] Received result for ${instanceName}:`, result);
    setLoadingStatus((prev) => ({ ...prev, [instanceName]: false }));

    setInstances((prev) =>
      prev.map((inst) => {
        if (inst.instanceName === instanceName) {
          if (
            "success" in result &&
            result.success &&
            "status" in result &&
            result.status !== undefined
          ) {
            console.log(
              `[fetchStatus] Updating state for ${instanceName} to status: ${result.status}`,
            );
            return { ...inst, status: result.status };
          } else if ("error" in result && result.error) {
            console.error(
              `[fetchStatus] Error for ${instanceName}: ${result.error}`,
            );
            toast.error(
              `Erro ao obter status de ${instanceName}: ${result.error}`,
            );
            const newStatusOnError = inst.status || "unknown";
            console.log(
              `[fetchStatus] Setting state for ${instanceName} to status on error: ${newStatusOnError}`,
            );
            return { ...inst, status: newStatusOnError };
          }
        }
        return inst;
      }),
    );
  }, []);

  const handleOpenQrModal = useCallback(async (instanceName: string) => {
    setLoadingQrCode(true);
    setIsQrModalOpen(true);
    setCurrentQrCodeData(null);

    const result = await getInstanceQrCode({ instanceName });

    if (result.success) {
      setCurrentQrCodeData({
        qrCode: result.qrCode,
        pairingCode: result.pairingCode,
      });
    } else {
      toast.error(result.error || "Erro ao carregar QR Code.");
      setIsQrModalOpen(false);
    }
    setLoadingQrCode(false);
  }, []);

  const handleCloseQrModal = useCallback(() => {
    setIsQrModalOpen(false);
    setCurrentQrCodeData(null);
  }, []);

  useEffect(() => {
    console.log("[useEffect] Component mounted or initialInstances changed.");

    initialInstances.forEach((instance) => {
      console.log(`[useEffect] Initial fetch for: ${instance.instanceName}`);
      fetchStatus(instance.instanceName);
    });

    const intervalId = setInterval(() => {
      console.log("[useEffect] Interval triggered. Checking instances...");

      instancesRef.current.forEach((instance) => {
        console.log(
          `[useEffect] Checking instance ${instance.instanceName}, current status: ${instance.status}`,
        );

        if (
          instance.status === "connecting" ||
          instance.status === "qrcode" ||
          instance.status === "start" ||
          instance.status === "unknown"
        ) {
          console.log(
            `[useEffect] Status is '${instance.status}'. Fetching status for ${instance.instanceName}.`,
          );
          fetchStatus(instance.instanceName);
        } else {
          console.log(
            `[useEffect] Status is '${instance.status}'. Skipping status fetch for ${instance.instanceName}.`,
          );
        }
      });
    }, 90000);

    return () => {
      console.log("[useEffect] Cleaning up interval.");
      clearInterval(intervalId);
    };
  }, [initialInstances, fetchStatus]);

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
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.2 }}
                className="col-span-1 flex"
              >
                <Card className="flex w-full flex-col">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <div className="flex items-center gap-3">
                      <ProfileAvatar instance={instance} />
                      <div>
                        <CardTitle className="text-lg font-semibold">
                          {instance.instanceName}
                        </CardTitle>
                        {instance.profileName && (
                          <p className="text-muted-foreground text-sm">
                            {instance.profileName}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-sm">
                      <StatusIcon status={instance.status} />
                      {getStatusText(instance.status)}
                    </div>
                  </CardHeader>
                  <CardContent className="text-muted-foreground flex-grow space-y-2 pt-4 text-sm">
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
                      {/* Ver QR Code */}
                      {(instance.status === "qrcode" ||
                        instance.status === "connecting" ||
                        instance.status === "start") && (
                        <Button
                          variant="outline"
                          size="icon"
                          title="Ver QR Code"
                          className="shrink-0"
                          onClick={() =>
                            handleOpenQrModal(instance.instanceName)
                          }
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
                          // TODO: Add onClick handler for settings
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
                          // TODO: Add onClick handler for AI agents
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
                            title="Reiniciar Instância (Desconectar)"
                            className="shrink-0"
                            onClick={async () => {
                              const result = await restartInstance({
                                instanceName: instance.instanceName,
                              });
                              if (result.success) {
                                toast.success(result.success);

                                fetchStatus(instance.instanceName);
                              } else {
                                toast.error(
                                  result.error ||
                                    "Erro ao reiniciar instância.",
                                );
                              }
                            }}
                          >
                            <PowerOff className="h-4 w-4 text-yellow-600" />
                            <span className="sr-only">Reiniciar Instância</span>
                          </Button>
                        )}

                      {instance.status === "open" && (
                        <Button
                          variant="outline"
                          size="icon"
                          title="Logout (Limpar Sessão)"
                          className="shrink-0"
                          onClick={async () => {
                            const result = await logoutInstance({
                              instanceName: instance.instanceName,
                            });
                            if (result.success) {
                              toast.success(result.success);

                              fetchStatus(instance.instanceName);
                            } else {
                              toast.error(
                                result.error || "Erro ao fazer logout.",
                              );
                            }
                          }}
                        >
                          <LogOut className="h-4 w-4 text-orange-600" />
                          <span className="sr-only">
                            Logout (Limpar Sessão)
                          </span>
                        </Button>
                      )}
                      {/* Botão Deletar Instância */}
                      <Button
                        variant="outline"
                        size="icon"
                        title="Deletar Instância"
                        className="shrink-0"
                        onClick={async () => {
                          const result = await deleteInstance({
                            instanceName: instance.instanceName,
                          });
                          if (result.success) {
                            toast.success(result.success);

                            setInstances((prev) =>
                              prev.filter(
                                (inst) =>
                                  inst.instanceName !== instance.instanceName,
                              ),
                            );
                          } else {
                            toast.error(
                              result.error || "Erro ao deletar instância.",
                            );
                          }
                        }}
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

      {/* Modal do QR Code */}
      {isQrModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={handleCloseQrModal} // Fecha o modal ao clicar fora
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl dark:bg-[#091E3B]"
            onClick={(e) => e.stopPropagation()} // Previne que o clique dentro feche o modal
          >
            <h2 className="mb-4 text-center text-2xl font-bold text-gray-800 dark:text-white">
              Conectar Instância
            </h2>
            <div className="flex flex-col items-center justify-center space-y-4">
              {loadingQrCode ? (
                <div className="flex flex-col items-center">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400" />
                  <p className="text-muted-foreground mt-2 text-sm">
                    Carregando QR Code...
                  </p>
                </div>
              ) : currentQrCodeData?.qrCode ? (
                <>
                  <img
                    src={`data:image/png;base64,${currentQrCodeData.qrCode}`}
                    alt="QR Code"
                    className="h-48 w-48 object-contain"
                  />
                  <p className="text-muted-foreground mt-2 text-center text-sm">
                    Escaneie com o WhatsApp no seu celular.
                  </p>
                </>
              ) : currentQrCodeData?.pairingCode ? (
                <>
                  <p className="text-center text-lg font-semibold">
                    Código de Pareamento:
                  </p>
                  <p className="mt-2 text-center text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {currentQrCodeData.pairingCode}
                  </p>
                  <p className="text-muted-foreground mt-4 text-center text-sm">
                    Use este código para conectar seu celular.
                  </p>
                </>
              ) : (
                <p className="text-center text-red-500">
                  Não foi possível carregar o QR Code ou código de pareamento.
                </p>
              )}
            </div>
            <Button onClick={handleCloseQrModal} className="mt-6 w-full">
              Fechar
            </Button>
          </motion.div>
        </div>
      )}
    </div>
  );
}
