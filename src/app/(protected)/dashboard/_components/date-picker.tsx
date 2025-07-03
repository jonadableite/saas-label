// src/app/(protected)/dashboard/_components/date-picker.tsx
"use client";

import { endOfMonth, format, startOfMonth, subDays, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarIcon, X as ClearIcon } from "lucide-react";
import { parseAsIsoDate, useQueryState } from "nuqs";
import * as React from "react";
import { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export function DatePicker({
  className,
}: React.HTMLAttributes<HTMLDivElement>) {
  // Define o padrão para os últimos 30 dias
  const defaultFrom = subDays(new Date(), 30);
  const defaultTo = new Date();

  const [from, setFrom] = useQueryState(
    "from",
    parseAsIsoDate.withDefault(defaultFrom),
  );
  const [to, setTo] = useQueryState(
    "to",
    parseAsIsoDate.withDefault(defaultTo),
  );

  const handleDateSelect = (dateRange: DateRange | undefined) => {
    // Atualiza os parâmetros de consulta na URL
    setFrom(dateRange?.from || null, { shallow: false });
    setTo(dateRange?.to || null, { shallow: false });
  };

  const handleQuickSelect = (rangeName: string) => {
    let newFrom: Date | null = null;
    let newTo: Date | null = null;
    const today = new Date();

    switch (rangeName) {
      case "last7Days":
        newFrom = subDays(today, 7);
        newTo = today;
        break;
      case "last30Days":
        newFrom = subDays(today, 30);
        newTo = today;
        break;
      case "thisMonth":
        newFrom = startOfMonth(today);
        newTo = endOfMonth(today);
        break;
      case "lastMonth":
        newFrom = startOfMonth(subMonths(today, 1));
        newTo = endOfMonth(subMonths(today, 1));
        break;
      case "allTime": // Opção para limpar ou mostrar "todo o período"
        newFrom = null;
        newTo = null;
        break;
      default:
        break;
    }
    setFrom(newFrom, { shallow: false });
    setTo(newTo, { shallow: false });
  };

  const date = {
    from,
    to,
  };

  const hasSelectedRange = from && to;

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "w-[280px] justify-start text-left font-normal", // Largura fixa para consistência
              !hasSelectedRange && "text-muted-foreground",
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {hasSelectedRange ? (
              <>
                {format(date.from!, "LLL dd, y", { locale: ptBR })} -{" "}
                {format(date.to!, "LLL dd, y", { locale: ptBR })}
              </>
            ) : (
              <span>Selecione um período</span>
            )}
            {hasSelectedRange && ( // Adiciona um botão de limpar se um intervalo estiver selecionado
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto h-auto p-1"
                onClick={(e) => {
                  e.stopPropagation(); // Previne que o popover abra
                  handleQuickSelect("allTime"); // Usa "allTime" para limpar
                }}
              >
                <ClearIcon className="text-muted-foreground hover:text-foreground h-4 w-4" />
              </Button>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="flex w-auto p-0" align="end">
          <div className="flex flex-col border-r p-2">
            {" "}
            {/* Opções de seleção rápida */}
            <Button
              variant="ghost"
              className="justify-start"
              onClick={() => handleQuickSelect("last7Days")}
            >
              Últimos 7 dias
            </Button>
            <Button
              variant="ghost"
              className="justify-start"
              onClick={() => handleQuickSelect("last30Days")}
            >
              Últimos 30 dias
            </Button>
            <Button
              variant="ghost"
              className="justify-start"
              onClick={() => handleQuickSelect("thisMonth")}
            >
              Este mês
            </Button>
            <Button
              variant="ghost"
              className="justify-start"
              onClick={() => handleQuickSelect("lastMonth")}
            >
              Mês passado
            </Button>
            <Button
              variant="ghost"
              className="justify-start"
              onClick={() => handleQuickSelect("allTime")}
            >
              Todo o período
            </Button>
          </div>
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={date?.from || defaultFrom} // Usa defaultFrom se nenhuma data estiver selecionada
            selected={date}
            onSelect={handleDateSelect}
            numberOfMonths={2}
            locale={ptBR}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
