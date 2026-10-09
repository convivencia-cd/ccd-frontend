export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tag, Plus, Edit2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getUserContext } from '@/lib/auth/context'
import { canPerform } from '@/lib/auth/permissions'

const categoriaLabel: Record<string, string> = {
  convivencia: 'Convivencia',
  retiro: 'Retiro corto',
  taller: 'Taller',
  encuentro: 'Encuentro',
  otro: 'Otro',
}

const alcanceLabel: Record<string, string> = {
  interno: 'Interno',
  abierto: 'Abierto',
  mixto: 'Mixto',
}

export default async function TiposEventosPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string
    categoria?: string
    alcance?: string
    req_confra?: string
    req_eqt?: string
    activo?: string
  }>
}) {
  const [params, ctx, supabase] = await Promise.all([searchParams, getUserContext(), createClient()])

  const q = params.q ?? ''
  const categoria = params.categoria ?? ''
  const alcance = params.alcance ?? ''
  const reqConfra = params.req_confra ?? ''
  const reqEqt = params.req_eqt ?? ''
  const activo = params.activo ?? ''
  const hasFilters = !!(q || categoria || alcance || reqConfra || reqEqt || activo)

  let query = supabase
    .from('tipos_eventos')
    .select('id, nombre, categoria, alcance, requiere_discernimiento_confra, requiere_discernimiento_eqt, requisitos, activo, tipo_evento_roles_solicitantes(ministerios(nombre))')
    .order('nombre')

  if (q) query = query.ilike('nombre', `%${q}%`)
  if (categoria) query = query.eq('categoria', categoria)
  if (alcance) query = query.eq('alcance', alcance)
  if (reqConfra === 'true') query = query.eq('requiere_discernimiento_confra', true)
  if (reqConfra === 'false') query = query.eq('requiere_discernimiento_confra', false)
  if (reqEqt === 'true') query = query.eq('requiere_discernimiento_eqt', true)
  if (reqEqt === 'false') query = query.eq('requiere_discernimiento_eqt', false)
  if (activo === 'true') query = query.eq('activo', true)
  if (activo === 'false') query = query.eq('activo', false)

  const { data: tipos } = await query

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Tag className="h-7 w-7 text-primary" />
        <h1 className="text-2xl font-bold">Tipos de Eventos</h1>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-base font-semibold">Catálogo de tipos</CardTitle>
          {ctx && canPerform(ctx, 'tipos_eventos.create') && (
            <Button asChild size="sm">
              <Link href="/tipos-eventos/nuevo">
                <Plus className="h-4 w-4 mr-1" />
                Nuevo tipo
              </Link>
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          {/* Filtros */}
          <form method="GET" className="flex flex-wrap items-end gap-2 px-6 pt-4">
            <div className="relative min-w-48 flex-1">
              <input
                name="q"
                defaultValue={q}
                placeholder="Buscar por nombre..."
                className="w-full rounded-md border border-border bg-background px-3 py-2 pl-8 text-sm text-foreground placeholder:text-muted-foreground"
              />
              <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <select name="categoria" defaultValue={categoria} className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground">
              <option value="">Todas las categorías</option>
              <option value="convivencia">Convivencia</option>
              <option value="retiro">Retiro corto</option>
              <option value="taller">Taller</option>
              <option value="encuentro">Encuentro</option>
              <option value="otro">Otro</option>
            </select>
            <select name="alcance" defaultValue={alcance} className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground">
              <option value="">Todos los alcances</option>
              <option value="interno">Interno</option>
              <option value="abierto">Abierto</option>
              <option value="mixto">Mixto</option>
            </select>
            <select name="req_confra" defaultValue={reqConfra} className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground">
              <option value="">Req. Confraternidad</option>
              <option value="true">Sí</option>
              <option value="false">No</option>
            </select>
            <select name="req_eqt" defaultValue={reqEqt} className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground">
              <option value="">Req. Equipo Timón</option>
              <option value="true">Sí</option>
              <option value="false">No</option>
            </select>
            <select name="activo" defaultValue={activo} className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground">
              <option value="">Todos</option>
              <option value="true">Solo activos</option>
              <option value="false">Solo inactivos</option>
            </select>
            <button type="submit" className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              Filtrar
            </button>
            {hasFilters && (
              <Link href="/tipos-eventos" className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted">
                Limpiar
              </Link>
            )}
          </form>

          {!tipos || tipos.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">
              {hasFilters ? 'No se encontraron tipos con esos filtros.' : 'No hay tipos de eventos registrados.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/40">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Nombre</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Categoría</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Alcance</th>
                    <th className="px-4 py-3 text-center font-medium text-muted-foreground">Req. Confraternidad</th>
                    <th className="px-4 py-3 text-center font-medium text-muted-foreground">Req. Equipo Timón</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Roles solicitantes</th>
                    <th className="px-4 py-3 text-center font-medium text-muted-foreground">Estado</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {tipos.map((tipo) => {
                    const roles = (tipo.tipo_evento_roles_solicitantes ?? [])
                      .map((r: any) => r.ministerios?.nombre)
                      .filter(Boolean) as string[]

                    return (
                      <tr key={tipo.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                        <td className="px-4 py-3 font-medium">
                          <Link href={`/tipos-eventos/${tipo.id}/editar`} className="hover:underline text-foreground">
                            {tipo.nombre}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {categoriaLabel[tipo.categoria] ?? tipo.categoria}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            tipo.alcance === 'abierto'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                              : tipo.alcance === 'mixto'
                                ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400'
                                : 'bg-muted text-muted-foreground'
                          }`}>
                            {alcanceLabel[tipo.alcance] ?? tipo.alcance}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {tipo.requiere_discernimiento_confra ? (
                            <span className="text-green-600 font-medium">Sí</span>
                          ) : (
                            <span className="text-muted-foreground">No</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {tipo.requiere_discernimiento_eqt ? (
                            <span className="text-green-600 font-medium">Sí</span>
                          ) : (
                            <span className="text-muted-foreground">No</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {roles.length === 0 ? (
                            <span className="text-xs text-muted-foreground italic">Sin configurar</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {roles.map((nombre) => (
                                <span
                                  key={nombre}
                                  className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                                >
                                  {nombre}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            tipo.activo
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                              : 'bg-muted text-muted-foreground'
                          }`}>
                            {tipo.activo ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {ctx && canPerform(ctx, 'tipos_eventos.update') && (
                            <Button asChild variant="ghost" size="sm">
                              <Link href={`/tipos-eventos/${tipo.id}/editar`}>
                                <Edit2 className="h-4 w-4" />
                              </Link>
                            </Button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
