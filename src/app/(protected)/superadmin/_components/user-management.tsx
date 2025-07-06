// src/app/(protected)/superadmin/_components/user-management.tsx
"use client";

import { ColumnDef } from "@tanstack/react-table"; // Assumindo que DataTable usa ColumnDef do TanStack Table
import { Edit, PlusCircle, Search, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/ui/table";
import { authClient } from "@/lib/auth-client"; // Importa o cliente de autenticação

// Define o tipo de usuário com base na estrutura do Better Auth
// O objeto de usuário do Better Auth tipicamente inclui id, email, name, role, createdAt, updatedAt.
// Campos personalizados estariam aninhados sob uma propriedade 'data' se configurados.
interface User {
  id: string;
  name: string;
  email: string;
  role: string | string[]; // A função pode ser uma única string ou um array de strings
  createdAt: string;
  updatedAt: string;
  // Se você tiver campos personalizados como 'plan' ou 'status' em sua configuração Better Auth,
  // eles normalmente estariam dentro de um objeto 'data' no usuário:
  // data?: {
  //   plan?: string;
  //   status?: string;
  // }
}

// Define as colunas para a tabela de usuários
// Essas colunas correspondem à estrutura de dados esperada de authClient.admin.listUsers
const userColumns: ColumnDef<User>[] = [
  {
    accessorKey: "name",
    header: "Nome",
  },
  {
    accessorKey: "email",
    header: "Email",
  },
  {
    accessorKey: "role",
    header: "Função",
    cell: ({ row }) => {
      // Lida com casos em que a função pode ser uma única string ou um array
      const roles = Array.isArray(row.original.role)
        ? row.original.role.join(", ")
        : row.original.role;
      return <span className="capitalize">{roles}</span>;
    },
  },
  {
    accessorKey: "createdAt",
    header: "Criado Em",
    cell: ({ row }) => {
      const date = new Date(row.original.createdAt);
      return date.toLocaleDateString(); // Formata a data de forma amigável
    },
  },
  {
    id: "actions",
    header: () => <div className="text-right">Ações</div>,
    cell: ({ row }) => (
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          className="mr-2"
          onClick={() => console.log("Editar usuário:", row.original.id)}
        >
          <Edit className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => console.log("Excluir usuário:", row.original.id)}
        >
          <Trash2 className="h-4 w-4 text-red-500" />
        </Button>
      </div>
    ),
  },
];

export function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [limit, setLimit] = useState(10); // Número de usuários por página
  const [offset, setOffset] = useState(0); // Offset atual para paginação
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: apiError } = await authClient.admin.listUsers({
        query: {
          limit,
          offset,
          ...(searchQuery && {
            searchField: "email", // Pesquisa por email
            searchOperator: "contains",
            searchValue: searchQuery,
          }),
          sortBy: "createdAt", // Ordena por data de criação
          sortDirection: "desc", // Usuários mais novos primeiro
        },
      });

      if (apiError) {
        setError(apiError.message);
        setUsers([]);
        setTotalUsers(0);
      } else if (data) {
        // Garante que data.users corresponda à interface User
        setUsers(data.users as User[]);
        setTotalUsers(data.total);
      }
    } catch (err: any) {
      // Captura erros de rede ou outros problemas inesperados
      setError(err.message || "Falha ao buscar usuários.");
      setUsers([]);
      setTotalUsers(0);
    } finally {
      setLoading(false);
    }
  }, [limit, offset, searchQuery]); // Dependências para useCallback

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]); // Reexecuta fetchUsers quando suas dependências mudam

  const totalPages = Math.ceil(totalUsers / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  const handleNextPage = () => {
    if (offset + limit < totalUsers) {
      setOffset((prev) => prev + limit);
    }
  };

  const handlePreviousPage = () => {
    if (offset > 0) {
      setOffset((prev) => Math.max(0, prev - limit));
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setOffset(0); // Redefine para a primeira página em uma nova pesquisa
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gerenciamento de Usuários</CardTitle>
        <CardDescription>
          Visualize, edite e gerencie todos os usuários da plataforma.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-col items-center justify-between gap-2 md:flex-row">
          <div className="relative w-full md:max-w-sm">
            <Input
              type="text"
              placeholder="Pesquisar usuários por email..."
              className="pl-8"
              value={searchQuery}
              onChange={handleSearchChange}
            />
            <Search className="text-muted-foreground absolute top-1/2 left-2 h-4 w-4 -translate-y-1/2" />
          </div>
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Usuário
          </Button>
        </div>

        {loading && <p>Carregando usuários...</p>}
        {error && <p className="text-red-500">Erro: {error}</p>}

        {!loading && !error && users.length === 0 && (
          <p>Nenhum usuário encontrado.</p>
        )}

        {!loading && !error && users.length > 0 && (
          <div className="overflow-hidden rounded-md border">
            <DataTable columns={userColumns} data={users} />
          </div>
        )}

        {/* Controles de Paginação */}
        {!loading && !error && totalUsers > 0 && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-muted-foreground text-sm">
              Exibindo {Math.min(offset + 1, totalUsers)}-{Math.min(offset + limit, totalUsers)} de {totalUsers} usuários.
            </p>
            <div className="space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePreviousPage}
                disabled={currentPage === 1}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextPage}
                disabled={currentPage === totalPages || totalUsers === 0}
              >
                Próximo
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
