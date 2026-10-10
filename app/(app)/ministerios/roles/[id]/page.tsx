export const dynamic = 'force-dynamic'

import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { Shield, ArrowLeft, Users } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'
import { getUserContext, canPerform } from '@/lib/auth/context'
import { PermisosMatrix } from './_components/permisos-matrix'
import { EditRolForm } from './_components/edit-rol-form'

export default async function RolDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const ctx = await getUserContext()
  if (!ctx) redirect('/auth/login')
  if (!canPerform(ctx, 'roles.assign')) redirect('/dashboard')

  const supabase = await createClient()

  const [
    { data: rol },
    { data: todosPermisos },
    { data: rolPermisos },
    { count: numAsignados },
  ] = await Promise.all([
    supabase.from('roles_sistema').select('*').eq('id', id).single(),
    supabase
      .from('permisos')
      .select('id, clave, nombre, descripcion, categoria')
      .eq('activo', true)
      .order('categoria')
      .order('nombre'),
    supabase
      .from('rol_permisos')
      .select('permiso_id')
      .eq('rol_sistema_id', id)
      .eq('activo', true),
    supabase
      .from('usuario_roles')
      .select('*', { count: 'exact', head: true })
      .eq('rol_sistema_id', id)
      .eq('activo', true),
  ])

  if (!rol) notFound()

  const permisosActivosIds = (rolPermisos ?? []).map((rp: any) => rp.permiso_id)

  // Agrupar permisos por categoría
  const permisosPorCategoria: Record<string, any[]> = {}
  for (const p of todosPermisos ?? []) {
    if (!permisosPorCategoria[p.categoria]) {
      permisosPorCategoria[p.categoria] = []
    }
    permisosPorCategoria[p.categoria].push(p)
  }

  const categoriaLabel: Record<string, string> = {
    personas: 'Personas',
    organizaciones: 'Organizaciones',
    eventos: 'Retiros',
    roles: 'Roles del Sistema',
    sistema: 'Sistema',
  }

  return (
    <div className="space-y-8">
      <div>
        <Link href="/ministerios/roles" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="h-4 w-4" />
          Volver a Roles
        </Link>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          <Shield className="h-8 w-8 text-primary" />
          {rol.nombre}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {rol.descripcion ?? 'Sin descripción'}
        </p>
        <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
          <span>Nivel de acceso: <strong className="text-foreground">{rol.nivel_acceso}</strong></span>
          <span className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            {numAsignados ?? 0} usuario{numAsignados !== 1 ? 's' : ''} activo{numAsignados !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Datos del rol */}
        <div>
          <EditRolForm rol={rol} />
        </div>

        {/* Matriz de permisos */}
        <div className="lg:col-span-2">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-foreground">Permisos del Rol</CardTitle>
              <CardDescription>
                Activa o desactiva permisos. Los cambios se aplican inmediatamente.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PermisosMatrix
                rolId={id}
                permisosPorCategoria={permisosPorCategoria}
                categoriaLabel={categoriaLabel}
                permisosActivosIds={permisosActivosIds}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
