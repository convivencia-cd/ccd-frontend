"use client"

import { useState } from "react"
import { Combobox, type ComboboxOption } from "@/components/ui/combobox"

type EventoOption = { id: string; nombre: string }

interface Props {
  eventos: EventoOption[]
  defaultValue: string
}

export function EventoFilter({ eventos, defaultValue }: Props) {
  const [value, setValue] = useState(defaultValue)

  const options: ComboboxOption[] = eventos.map((e) => ({ label: e.nombre, value: e.id }))

  return (
    <>
      <input type="hidden" name="evento_id" value={value} />
      <Combobox
        value={value}
        onSelect={setValue}
        options={options}
        placeholder="Todos los retiros"
        searchPlaceholder="Buscar retiro..."
        emptyText="No se encontraron retiros."
        className="h-9 text-sm"
      />
    </>
  )
}
