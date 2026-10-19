"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export interface ComboboxOption {
  label: string
  value: string
  /** Términos alternativos de búsqueda (ej. "Holanda" para Países Bajos). */
  keywords?: string[]
}

/** Minúsculas y sin tildes, para que "italia" encuentre "Italia" y "espana" encuentre "España". */
function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}

/**
 * Filtro accent-insensitive que además considera los `keywords` de cada opción.
 * Busca por palabras en cualquier orden: "diego pascualini" encuentra "Pascualini, Diego".
 */
export function fuzzyFilter(value: string, search: string, keywords?: string[]): number {
  const q = normalize(search)
  if (!q) return 1
  const haystack = [value, ...(keywords ?? [])].map(normalize)
  if (haystack.some((h) => h.startsWith(q))) return 1
  if (haystack.some((h) => h.includes(q))) return 0.75
  const tokens = q.split(/[\s,]+/).filter(Boolean)
  if (tokens.every((t) => haystack.some((h) => h.includes(t)))) return 0.5
  return 0
}

interface ComboboxProps {
  /** Se aplica al botón que abre el popover, para poder asociarle un <Label htmlFor>. */
  id?: string
  value: string
  onSelect: (value: string) => void
  options: ComboboxOption[]
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  onSearch?: (query: string) => void
  loading?: boolean
  disabled?: boolean
  className?: string
}

export function Combobox({
  id,
  value,
  onSelect,
  options,
  placeholder = "Seleccionar...",
  searchPlaceholder = "Buscar...",
  emptyText = "No se encontraron resultados.",
  onSearch,
  loading = false,
  disabled = false,
  className,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")

  const selectedLabel = options.find((o) => o.value === value)?.label ?? value

  function handleSearch(query: string) {
    setSearch(query)
    onSearch?.(query)
  }

  function handleSelect(selectedLabel: string) {
    const option = options.find((o) => o.label === selectedLabel)
    if (!option) return
    onSelect(option.value === value ? "" : option.value)
    setOpen(false)
    setSearch("")
    // Avisa también al buscador remoto, para que la próxima apertura no quede filtrada.
    onSearch?.("")
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between font-normal", !value && "text-muted-foreground", className)}
        >
          <span className="truncate">{value ? selectedLabel : placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command shouldFilter={!onSearch} filter={fuzzyFilter}>
          <CommandInput
            placeholder={searchPlaceholder}
            value={search}
            onValueChange={handleSearch}
          />
          <CommandList>
            {loading ? (
              <div className="py-6 text-center text-sm text-muted-foreground">Cargando...</div>
            ) : (
              <>
                <CommandEmpty>{emptyText}</CommandEmpty>
                <CommandGroup>
                  {options.map((option) => (
                    <CommandItem
                      key={option.value}
                      value={option.label}
                      keywords={option.keywords}
                      onSelect={handleSelect}
                      className="data-[selected=true]:bg-muted data-[selected=true]:text-foreground"
                    >
                      <Check
                        className={cn("mr-2 h-4 w-4", value === option.value ? "opacity-100" : "opacity-0")}
                      />
                      {option.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
