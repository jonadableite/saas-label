// src/app/(protected)/_components/app-sidebar.tsx
"use client";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bot,
  LayoutDashboard,
  MessageSquareText,
  Settings2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { FaWhatsapp } from "react-icons/fa";

import Logo from "@/components/logo";
import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { authClient } from "@/lib/auth-client";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const router = useRouter();
  const session = authClient.useSession();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  console.log("Sidebar isCollapsed:", isCollapsed);

  const handleSignOut = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push("/authentication");
        },
      },
    });
  };

  const navMain = [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: LayoutDashboard,
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
  ];

  const userData = {
    name: session.data?.user?.name || "Usuário",
    email: session.data?.user?.email || "",
    avatar: session.data?.user?.image || "",
  };

  return (
    <Sidebar collapsible="icon" className="w-[260px]" {...props}>
      <SidebarHeader>
        <div
          className={`flex items-center ${isCollapsed ? "justify-center p-2" : "gap-3 p-2"}`}
        >
          <AnimatePresence mode="wait">
            {isCollapsed ? (
              <motion.div
                key="logo-collapsed"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.2 }}
              >
                <Logo variant="icon" className="h-8 w-8 min-w-[32px]" />
              </motion.div>
            ) : (
              <motion.div
                key="logo-expanded"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.2 }}
              >
                <Logo variant="icon" className="h-12 w-12 min-w-[48px]" />
              </motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence mode="wait">
            {!isCollapsed && (
              <motion.div
                key="text-content"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="flex flex-grow flex-col items-start overflow-hidden"
              >
                <span className="text-foreground text-2xl font-semibold whitespace-nowrap">
                  WhatLead
                </span>

                <span className="bg-primary/10 text-primary mt-1 self-start rounded-full px-2 py-0.5 text-xs font-bold whitespace-nowrap">
                  {session.data?.user?.plan || "Plano Gratuito"}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={userData} onSignOut={handleSignOut} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
