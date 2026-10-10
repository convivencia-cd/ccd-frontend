export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Hotel, Plus, Edit2, MapPin } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getUserContext, canPerform } from '@/lib/auth/context'
import SortableHeader from '@/components/ui/sortable-header'

export default async function CasasRetiroPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string
    estado?: string
    provincia?: string
    tipo_propiedad?: string
    aforo_min?: string
    sortBy?: string
    sortDir?: string
  }>
}) {
  const [params, ctx] = await Promise.all([searchParams, getUserContext()])

  // Módulo fuera de la vista ordinaria: requiere el permiso view.casas_retiro
  // (lo asigna el Equipo Timón por rol/ministerio desde /ministerios/catalogo).
  if (!ctx || !canPerform(ctx, 'view.casas_retiro')) redirect('/dashboard')

  const q = params.q ?? ''
  const estado = params.estado ?? ''
  const provincia = params.provincia ?? ''
  const tipoPropiedad = params.tipo_propiedad ?? ''
  const aforoMin = params.aforo_min ?? ''
  const sortBy = params.sortBy ?? ''
  const sortDir = (params.sortDir === 'asc' || params.sortDir === 'desc') ? params.sortDir : 'asc'

  const canCreate = ctx ? canPerform(ctx, 'casas_retiro.create') : false
  const canUpdate = ctx ? canPerform(ctx, 'organization.update') : false
  const supabase = await createClient()

  const SORTABLE_CASAS = ['nombre', 'ciudad', 'provincia', 'tipo_propiedad', 'aforo', 'estado']
  const sortCol = (sortBy && SORTABLE_CASAS.includes(sortBy)) ? sortBy : 'nombre'
  const sortAsc = sortBy ? sortDir === 'asc' : true

  let query = supabase
    .from('casas_retiro')
    .select('id, nombre, ciudad, provincia, estado, tipo_propiedad, aforo, link_maps')
    .is('fecha_baja', null)
    .order(sortCol, { ascending: sortAsc })

  if (q) query = query.ilike('nombre', `%${q}%`)
  if (estado) query = query.eq('estado', estado)
  if (provincia) query = query.ilike('provincia', `%${provincia}%`)
  if (tipoPropiedad) query = query.eq('tipo_propiedad', tipoPropiedad)
  if (aforoMin) query = query.gte('aforo', parseInt(aforoMin))

  const { data: casas } = await query

  const hasFilters = !!(q || estado || provincia || tipoPropiedad || aforoMin)

  const tipoPropiedadLabel: Record<string, string> = {
    propia: 'Propia',
    terceros: 'De terceros',
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          <Hotel className="h-8 w-8 text-primary" />
          Casas de Retiro
        </h1>
        <p className="mt-2 text-muted-foreground">
          Administra las casas de retiro disponibles para retiros
        </p>
      </div>

      <Card className="border-border bg-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-foreground">Casas de Retiro Registradas</CardTitle>
            <CardDescription>Lista completa de casas de retiro en el sistema</CardDescription>
          </div>
          {canCreate && (
            <Link href="/casas-retiro/nueva">
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Nueva Casa de Retiro
              </Button>
            </Link>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filtros */}
          <form method="GET" className="flex flex-wrap items-end gap-2">
            <div className="relative min-w-50 flex-1">
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

            <select
              name="estado"
              defaultValue={estado}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              <option value="">Todos los estados</option>
              <option value="activa">Activa</option>
              <option value="inactiva">Inactiva</option>
            </select>

            <input
              name="provincia"
              defaultValue={provincia}
              placeholder="Provincia..."
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground w-32"
            />

            <select
              name="tipo_propiedad"
              defaultValue={tipoPropiedad}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              <option value="">Todas las propiedades</option>
              <option value="propia">Propia</option>
              <option value="terceros">De terceros</option>
            </select>

            <div className="flex items-center gap-1">
              <label className="text-xs text-muted-foreground whitespace-nowrap">Aforo mín.</label>
              <input
                name="aforo_min"
                type="number"
                min="0"
                defaultValue={aforoMin}
                placeholder="0"
                className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground w-20"
              />
            </div>

            <button
              type="submit"
              className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Filtrar
            </button>

            {hasFilters && (
              <Link href="/casas-retiro" className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted">
                Limpiar
              </Link>
            )}
          </form>

          {/* Tabla */}
          {casas && casas.length > 0 ? (
            <>
              <span className="text-sm text-muted-foreground">
                {casas.length} casa{casas.length !== 1 ? 's' : ''} de retiro
              </span>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <SortableHeader column="nombre" label="Nombre" currentSort={sortBy} currentDir={sortDir} />
                      <SortableHeader column="ciudad" label="Ciudad" currentSort={sortBy} currentDir={sortDir} />
                      <SortableHeader column="provincia" label="Provincia" currentSort={sortBy} currentDir={sortDir} />
                      <SortableHeader column="tipo_propiedad" label="Propiedad" currentSort={sortBy} currentDir={sortDir} />
                      <SortableHeader column="aforo" label="Aforo" currentSort={sortBy} currentDir={sortDir} />
                      <SortableHeader column="estado" label="Estado" currentSort={sortBy} currentDir={sortDir} />
                      <th className="text-center py-3 px-4 font-semibold text-foreground">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {casas.map((casa: any) => (
                      <tr key={casa.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                        <td className="py-3 px-4 font-medium">
                          <Link href={`/casas-retiro/${casa.id}`} className="text-foreground hover:text-primary">
                            {casa.nombre}
                          </Link>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">{casa.ciudad ?? '—'}</td>
                        <td className="py-3 px-4 text-muted-foreground">{casa.provincia ?? '—'}</td>
                        <td className="py-3 px-4 text-muted-foreground">{tipoPropiedadLabel[casa.tipo_propiedad] ?? casa.tipo_propiedad}</td>
                        <td className="py-3 px-4 text-muted-foreground">{casa.aforo ?? '—'}</td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            casa.estado === 'activa'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                              : 'bg-muted text-muted-foreground'
                          }`}>
                            {casa.estado}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {casa.link_maps && (
                              <a href={casa.link_maps} target="_blank" rel="noopener noreferrer">
                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-primary">
                                  <MapPin className="h-4 w-4" />
                                </Button>
                              </a>
                            )}
                            {canUpdate && (
                              <Link href={`/casas-retiro/${casa.id}/editar`}>
                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                              </Link>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="py-12 text-center">
              <Hotel className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold text-foreground">
                {hasFilters ? 'No se encontraron casas de retiro' : 'No hay casas de retiro registradas'}
              </h3>
              <p className="mt-2 text-muted-foreground">
                {hasFilters ? 'Probá con otros filtros' : 'Comenzá agregando la primera casa de retiro al sistema'}
              </p>
              {!hasFilters && canCreate && (
                <Link href="/casas-retiro/nueva" className="mt-4 inline-block">
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    Nueva Casa de Retiro
                  </Button>
                </Link>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
