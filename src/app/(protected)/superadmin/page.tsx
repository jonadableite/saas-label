// src/app/(protected)/superadmin/page.tsx
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  PageContainer,
  PageContent,
  PageDescription,
  PageHeader,
  PageHeaderContent,
  PageTitle,
} from "@/components/ui/page-container";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { auth } from "@/lib/auth";

// Importe os componentes de cada seção da administração
import { AdminOverview } from "./_components/admin-overview";
import { PlanManagement } from "./_components/plan-management";
import { SystemSettings } from "./_components/system-settings";
import { UserManagement } from "./_components/user-management";
// Adicione mais imports conforme você cria novas seções (ex: AuditLogs, Analytics)

const SuperadminPage = async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  // Verificação de autorização: Apenas usuários com a role 'superadmin' podem acessar.
    const userRoles = session?.user?.role || "";
  const isSuperAdmin = userRoles.split(",").includes("superadmin");

  if (!session || !isSuperAdmin) {
    redirect("/authentication");
  }

  return (
    <PageContainer>
      <PageHeader>
        <PageHeaderContent>
          <PageTitle>Painel Administrativo</PageTitle>
          <PageDescription>
            Gerencie a plataforma, seus usuários, planos e configurações
            globais.
          </PageDescription>
        </PageHeaderContent>
      </PageHeader>
      <PageContent>
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-2 md:w-fit md:grid-cols-4">
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="users">Usuários</TabsTrigger>
            <TabsTrigger value="plans">Planos</TabsTrigger>
            <TabsTrigger value="settings">Configurações</TabsTrigger>
            {/* Adicione mais TabsTrigger aqui para novas seções */}
          </TabsList>
          <TabsContent value="overview" className="mt-4">
            <AdminOverview />
          </TabsContent>
          <TabsContent value="users" className="mt-4">
            <UserManagement />
          </TabsContent>
          <TabsContent value="plans" className="mt-4">
            <PlanManagement />
          </TabsContent>
          <TabsContent value="settings" className="mt-4">
            <SystemSettings />
          </TabsContent>
          {/* Adicione mais TabsContent aqui para novas seções */}
        </Tabs>
      </PageContent>
    </PageContainer>
  );
};

export default SuperadminPage;
