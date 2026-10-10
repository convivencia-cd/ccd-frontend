import Link from 'next/link'
import { Users } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface Asignacion {
  id: string
  fecha_inicio: string
  fecha_fin: string | null
  estado: string
  persona: { id: string; nombre: string; apellido: string; email: string | null } | null
  organizacion: { nombre: string } | null
  evento: { nombre: string } | null
}

interface Props {
  asignaciones: Asignacion[]
  ministerioId: string
}

export function AsignacionesDelRol({ asignaciones, ministerioId }: Props) {
  const activos = asignaciones.filter(a => a.estado === 'activo').length

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="text-foreground flex items-center gap-2">
          <Users className="h-5 w-5" />
          Personas con este Rol
          {activos > 0 && (
            <span className="ml-1 text-sm font-normal text-muted-foreground">
              ({activos} activa{activos !== 1 ? 's' : ''})
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {asignaciones.length === 0 ? (
          <div className="py-8 text-center">
            <Users className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">No hay asignaciones registradas para este rol</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 font-semibold text-foreground text-sm">Persona</th>
                  <th className="text-left py-3 px-4 font-semibold text-foreground text-sm">Organización</th>
                  <th className="text-left py-3 px-4 font-semibold text-foreground text-sm">Retiro</th>
                  <th className="text-left py-3 px-4 font-semibold text-foreground text-sm">Estado</th>
                  <th className="text-left py-3 px-4 font-semibold text-foreground text-sm">Inicio</th>
                  <th className="text-left py-3 px-4 font-semibold text-foreground text-sm">Fin</th>
                </tr>
              </thead>
              <tbody>
                {asignaciones.map(a => (
                  <tr key={a.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                    <td className="py-3 px-4">
                      {a.persona ? (
                        <div>
                          <Link
                            href={`/personas?persona=${a.persona.id}`}
                            className="font-medium text-foreground hover:text-primary text-sm"
                          >
                            {a.persona.nombre} {a.persona.apellido}
                          </Link>
                          {a.persona.email && (
                            <div className="text-xs text-muted-foreground">{a.persona.email}</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">
                      {a.organizacion?.nombre ?? '—'}
                    </td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">
                      {a.evento?.nombre ?? '—'}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        a.estado === 'activo'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {a.estado === 'activo' ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">
                      {a.fecha_inicio}
                    </td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">
                      {a.fecha_fin ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
