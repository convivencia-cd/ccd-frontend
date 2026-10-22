import { ClipboardList } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export type IntegranteEquipo = {
  id: string
  rol_en_evento: string
  /** Solo servidores: el grupo que tienen a cargo. */
  grupo: string | null
  persona: { nombre: string; apellido: string } | null
}

const SECCIONES = [
  { rol: 'servidor', titulo: 'Servidores' },
  { rol: 'musica', titulo: 'Ministerio de Música' },
  { rol: 'equipo_auxiliar', titulo: 'Equipo Auxiliar (Cocina)' },
] as const

/**
 * Equipo del retiro, solo lectura (card #99): lo que carga el coordinador.
 * Coordinador, asesor y centralizadores ya se ven en la ficha del retiro.
 */
export function EquipoRetiroCard({ integrantes }: { integrantes: IntegranteEquipo[] }) {
  const nombre = (i: IntegranteEquipo) => (i.persona ? `${i.persona.apellido}, ${i.persona.nombre}` : '—')

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <ClipboardList className="h-5 w-5 text-primary" />
          Equipo del retiro
        </CardTitle>
        <CardDescription>
          Servidores, música y equipo auxiliar cargados para este retiro. Coordinador, asesor y centralizadores
          figuran arriba.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {integrantes.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Todavía no se cargó el equipo.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            {SECCIONES.map(({ rol, titulo }) => {
              const lista = integrantes
                .filter(i => i.rol_en_evento === rol)
                .sort((a, b) => nombre(a).localeCompare(nombre(b), 'es'))
              if (lista.length === 0) return null
              return (
                <div key={rol} className="space-y-1.5 rounded-lg border border-border p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {titulo} ({lista.length})
                  </p>
                  {lista.map(i => (
                    <p key={i.id} className="text-sm text-foreground">
                      {nombre(i)}
                      {i.grupo && <span className="text-muted-foreground"> · {i.grupo}</span>}
                    </p>
                  ))}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
