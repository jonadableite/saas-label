// src/app/(protected)/whatsapp/page.tsx

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { instancesTables } from "@/db/schema";
import { auth } from "@/lib/auth";

// Importe o novo componente Client
import { WhatsappClientPage } from "./components/whatsapp-client-page";

// Remova o import de useState, Button, Dialog, etc., pois agora estão no componente Client
// import { useState } from "react"; // REMOVA
// import { Plus } from "lucide-react"; // REMOVA
// import { Button } from "@/components/ui/button"; // REMOVA
// import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"; // REMOVA

// Remova o import de CreateInstanceForm e InstanceList, pois agora estão no componente Client
// import { CreateInstanceForm } from "./components/create-instance-form"; // REMOVA
// import { InstanceList } from "./components/instance-list"; // REMOVA

export default async function WhatsappPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  // Remova o uso de useState aqui
  // const [isModalOpen, setIsModalOpen] = useState(false); // REMOVA

  if (!session?.user) {
    redirect("/authentication");
  }

  const userId = session.user.id;

  // Buscar as instâncias do usuário logado no banco de dados (isso continua no Server Component)
  const userInstances = await db.query.instancesTables.findMany({
    where: eq(instancesTables.userId, userId),
    orderBy: instancesTables.createdAt,
  });

  // Renderize o componente Client, passando os dados buscados
  return <WhatsappClientPage initialInstances={userInstances} />;
}
