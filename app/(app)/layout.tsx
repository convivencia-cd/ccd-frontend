import { redirect } from 'next/navigation'
import { getUserContext, canPerform } from '@/lib/auth/context'
import { createClient } from '@/lib/supabase/server'
import { eventoIdsComoCoordinadorOCentralizador } from '@/lib/eventos/roles'
import { Sidebar } from '@/components/layout/sidebar'
import type { SidebarPermissions } from '@/components/layout/sidebar'
import { Toaster } from '@/components/ui/sonner'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const ctx = await getUserContext()
  if (!ctx) redirect('/auth/login')

  // "Interesados" también lo ve quien es Coordinador/Centralizador de algún
  // evento puntual, aunque no tenga el permiso view.interesados de catálogo.
  let esCoordinadorOCentralizador = false
  if (!canPerform(ctx, 'view.interesados') && ctx.persona_id) {
    const supabase = await createClient()
    const eventoIds = await eventoIdsComoCoordinadorOCentralizador(supabase, ctx.persona_id)
    esCoordinadorOCentralizador = eventoIds.length > 0
  }

  const permissions: SidebarPermissions = {
    canCreatePerson:       canPerform(ctx, 'person.create'),
    canCreateOrganization: canPerform(ctx, 'organization.create'),
    canCreateEvent:        canPerform(ctx, 'event.create'),
    canViewRoles:          canPerform(ctx, 'roles.view') || canPerform(ctx, 'roles.assign'),
    canAssignRoles:        canPerform(ctx, 'roles.assign'),
    canViewPublicados:     canPerform(ctx, 'view.eventos_publicados'),
    canSuspendEvent:       canPerform(ctx, 'event.suspend'),
    canRequestSuspend:     canPerform(ctx, 'event.request_suspend'),
    canVerifyPayments:     canPerform(ctx, 'payment.verify'),
    canViewVotos:          canPerform(ctx, 'votos.list') || canPerform(ctx, 'votos.edit'),
    canViewCasasRetiro:    canPerform(ctx, 'view.casas_retiro'),
    canViewInteresados:    canPerform(ctx, 'view.interesados') || esCoordinadorOCentralizador,
    isAdmin:               ctx.is_admin,
    esInterno:             ctx.es_interno,
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar permissions={permissions} />
      <main className="flex-1 overflow-y-auto">
        <div className="p-8">
          {children}
        </div>
      </main>
      <Toaster />
    </div>
  )
}
