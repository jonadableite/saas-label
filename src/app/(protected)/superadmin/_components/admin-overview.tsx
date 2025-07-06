// src/app/(protected)/superadmin/_components/admin-overview.tsx
"use client";

import {
  Activity,
  CreditCard,
  Gem,
  MessageSquareText,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { authClient } from "@/lib/auth-client";

export function AdminOverview() {
  const [totalUsers, setTotalUsers] = useState<number | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [errorUsers, setErrorUsers] = useState<string | null>(null);

  useEffect(() => {
    const fetchTotalUsers = async () => {
      setLoadingUsers(true);
      setErrorUsers(null);
      try {
        // Para obter o total de usuários, você pode chamar listUsers com limit: 0
        // O Better Auth retornará o campo 'total' com a contagem completa.
        const { data, error } = await authClient.admin.listUsers({
          query: {
            limit: 0, // Define limite para 0 para obter apenas o total
            offset: 0,
          },
        });
        if (error) {
          setErrorUsers(error.message || "Erro desconhecido");
          setTotalUsers(0); // Define como 0 em caso de erro
        } else if (data) {
          setTotalUsers(data.total);
        }
      } catch (err: any) {
        setErrorUsers(err.message || "Erro ao buscar total de usuários.");
        setTotalUsers(0);
      } finally {
        setLoadingUsers(false);
      }
    };

    fetchTotalUsers();
  }, []);

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Card: Total de Usuários */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Total de Usuários
          </CardTitle>
          <Users className="text-muted-foreground h-4 w-4" />
        </CardHeader>
        <CardContent>
          {loadingUsers ? (
            <div className="text-2xl font-bold">Carregando...</div>
          ) : errorUsers ? (
            <div className="text-sm text-red-500">Erro: {errorUsers}</div>
          ) : (
            <div className="text-2xl font-bold">{totalUsers?.toLocaleString() || "N/A"}</div>
          )}
          {/* A porcentagem de mudança exigiria dados históricos, que não vêm do Better Auth */}
          <p className="text-muted-foreground text-xs">
            +20.1% do mês passado (dados fictícios)
          </p>
        </CardContent>
      </Card>

      {/* Card: Assinaturas Ativas */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Assinaturas Ativas
          </CardTitle>
          <CreditCard className="text-muted-foreground h-4 w-4" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">+500</div>
          <p className="text-muted-foreground text-xs">
            +19% do mês passado (dados fictícios)
          </p>
          <p className="text-muted-foreground text-xs mt-1">
            (Requer API de gerenciamento de assinaturas)
          </p>
        </CardContent>
      </Card>

      {/* Card: Mensagens Enviadas */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Mensagens Enviadas
          </CardTitle>
          <MessageSquareText className="text-muted-foreground h-4 w-4" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">1.000.000</div>
          <p className="text-muted-foreground text-xs">
            +5% do mês passado (dados fictícios)
          </p>
          <p className="text-muted-foreground text-xs mt-1">
            (Requer API de serviço de mensagens)
          </p>
        </CardContent>
      </Card>

      {/* Card: Créditos Restantes (ou Receita Total) */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Créditos Restantes
          </CardTitle>
          <Gem className="text-muted-foreground h-4 w-4" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">500.000</div>
          <p className="text-muted-foreground text-xs">
            Média de uso: 1000/dia (dados fictícios)
          </p>
          <p className="text-muted-foreground text-xs mt-1">
            (Requer API de gerenciamento de créditos)
          </p>
        </CardContent>
      </Card>

      {/* Card: Atividade Recente (Exemplo de lista ou gráfico) */}
      <Card className="col-span-full">
        <CardHeader>
          <CardTitle>Atividade Recente</CardTitle>
          <CardDescription>
            Últimos logins, novas assinaturas e ações importantes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center">
              <Activity className="text-muted-foreground mr-2 h-4 w-4" />
              <p className="text-sm">
                Usuário "João Silva" fez login - 2 minutos atrás (dados fictícios)
              </p>
            </div>
            <div className="flex items-center">
              <Activity className="text-muted-foreground mr-2 h-4 w-4" />
              <p className="text-sm">
                Nova assinatura "Plano Pro" por "Maria Souza" - 1 hora atrás (dados fictícios)
              </p>
            </div>
            <div className="flex items-center">
              <Activity className="text-muted-foreground mr-2 h-4 w-4" />
              <p className="text-sm">
                Campanha "Promoção Verão" iniciada - 3 horas atrás (dados fictícios)
              </p>
            </div>
            {/* Mais itens de atividade */}
          </div>
          <p className="text-muted-foreground mt-4 text-sm">
            {/* Aqui você pode integrar um gráfico de atividades ou um link para logs completos */}
            <a href="#" className="underline">
              Ver todos os logs de auditoria
            </a>
            <p className="text-muted-foreground text-xs mt-1">
              (Requer API de logs de auditoria/atividade)
            </p>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
