// src/app/(protected)/_components/app-sidebar.tsx
"use client"

import {
  Bot,
  LayoutDashboard,
  MessageSquareText,
  Settings2
} from "lucide-react"
import { useRouter } from "next/navigation"
import * as React from "react"
import { FaWhatsapp } from "react-icons/fa"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import { TeamSwitcher } from "@/components/team-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"
import { authClient } from "@/lib/auth-client"

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const router = useRouter()
  const session = authClient.useSession()

  const handleSignOut = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push("/authentication")
        },
      },
    })
  }

  // Dados da organização/empresa
  const teams = [
    {
      name: session.data?.user?.clinic?.name || "Minha Empresa",
      logo: "/logo.svg",
      plan: "Professional",
    },
  ]

  // Navegação principal
  const navMain = [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: LayoutDashboard,
      // items: [
      //   {
      //     title: "Visão Geral",
      //     url: "/dashboard",
      //   },
      //   {
      //     title: "Relatórios",
      //     url: "/dashboard/reports",
      //   },
      // ],
    },
    {
      title: "WhatsApp",
      url: "/whatsapp",
      icon: FaWhatsapp,
      items: [
        {
          title: "Instâncias",
          url: "/whatsapp",
        },
        {
          title: "Contatos",
          url: "/whatsapp/contacts",
        },
      ],
    },
    {
      title: "Campanhas",
      url: "/campaigns",
      icon: MessageSquareText,
      items: [
        {
          title: "Todas as Campanhas",
          url: "/campaigns",
        },
        {
          title: "Agendadas",
          url: "/campaigns/scheduled",
        },
        {
          title: "Templates",
          url: "/campaigns/templates",
        },
      ],
    },
    {
      title: "Agentes IA",
      url: "/agents",
      icon: Bot,
      items: [
        {
          title: "Meus Agentes",
          url: "/agents",
        },
        {
          title: "Criar Agente",
          url: "/agents/create",
        },
        {
          title: "chat",
          url: "/agents/chat",
        },
      ],
    },

    {
      title: "Configurações",
      url: "/settings",
      icon: Settings2,
      items: [
        {
          title: "Geral",
          url: "/settings",
        },
        {
          title: "Integrações",
          url: "/settings/integrations",
        },
        {
          title: "API",
          url: "/settings/api",
        },
        {
          title: "Webhooks",
          url: "/settings/webhooks",
        },
      ],
    },
  ]



  const userData = {
    name: session.data?.user?.name || session.data?.user?.name || "Usuário",
    email: session.data?.user?.email || "",
    avatar: session.data?.user?.image || "",
  }

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={teams} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} />

      </SidebarContent>
      <SidebarFooter>
        <NavUser user={userData} onSignOut={handleSignOut} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
