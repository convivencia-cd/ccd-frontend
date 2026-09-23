'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { fetchPersonas, type PersonaOption } from '@/components/persona-combobox'
import { ROLES_SERVIDOR_OPCIONES } from '@/lib/eventos/equipo'
import AsignacionesEventoCard, { type AsignacionesEvento } from './asignaciones-evento-card'
import ParticipantesEventoCard, { type ParticipanteEquipo } from './participantes-evento-card'

export type { AsignacionesEvento, ParticipanteEquipo }

type Props = {
  eventoId: string
  asignaciones: AsignacionesEvento
  /** Todas las filas de evento_participantes del evento, incluidas las canceladas. */
  participantes: ParticipanteEquipo[]
  /** event.update sobre el evento: puede reasignar coordinador, asesor y centralizadores. */
  canAsignaciones: boolean
  /** event.manage_participants o ser centralizador: puede tocar el padrón del evento. */
  canParticipantes: boolean
}

const ROLES_SERVIDOR = ROLES_SERVIDOR_OPCIONES.map(r => r.value) as string[]

/**
 * Equipo y padrón de un evento, editables después de la publicación.
 * Se usa igual en "Editar evento" (Equipo Timón) y en "Gestión" (donde además
 * entra el centralizador del evento, que no tiene event.update).
 */
export default function EquipoEventoPanel({
  eventoId,
  asignaciones,
  participantes,
  canAsignaciones,
  canParticipantes,
}: Props) {
  const router = useRouter()
  const [personas, setPersonas] = useState<PersonaOption[]>([])
  const [cargandoPersonas, setCargandoPersonas] = useState(true)

  // Una sola carga del padrón para todos los comboboxes del panel: cada
  // PersonaCombobox suelto se traería las ~2000 personas por su cuenta.
  useEffect(() => {
    let cancelado = false
    fetchPersonas().then(filas => {
      if (cancelado) return
      setPersonas(filas)
      setCargandoPersonas(false)
    })
    return () => {
      cancelado = true
    }
  }, [])

  const refrescar = () => router.refresh()

  const equipo = participantes.filter(p => ROLES_SERVIDOR.includes(p.rol_en_evento))
  const inscriptos = participantes.filter(p => p.rol_en_evento === 'convivente')

  return (
    <div className="space-y-6">
      {canAsignaciones && (
        <AsignacionesEventoCard
          eventoId={eventoId}
          inicial={asignaciones}
          personas={personas}
          cargandoPersonas={cargandoPersonas}
          onSaved={refrescar}
        />
      )}

      {canParticipantes && (
        <>
          <ParticipantesEventoCard
            eventoId={eventoId}
            modo="equipo"
            filas={equipo}
            personas={personas}
            cargandoPersonas={cargandoPersonas}
            onChanged={refrescar}
          />
          <ParticipantesEventoCard
            eventoId={eventoId}
            modo="inscriptos"
            filas={inscriptos}
            personas={personas}
            cargandoPersonas={cargandoPersonas}
            onChanged={refrescar}
          />
        </>
      )}
    </div>
  )
}
