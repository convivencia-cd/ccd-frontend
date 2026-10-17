import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserContext, canPerform } from '@/lib/auth/context'

// "Socio Activo de la Asociación Civil": el propio cecista solo puede tildar
// este campo en su perfil si además ejerce un ministerio de conducción o
// tesorería (Enlace, Delegado, Responsable, Tesorero, Timonel) — ver
// scripts/068_socio_activo_permiso.sql. Se resuelve server-side porque la
// RLS de `personas` no restringe el update por columna/rol.

export async function GET() {
  const ctx = await getUserContext()
  if (!ctx || !ctx.persona_id) {
    return NextResponse.json({ canEdit: false })
  }
  return NextResponse.json({ canEdit: canPerform(ctx, 'person.edit_socio_activo') })
}

export async function PATCH(request: NextRequest) {
  const ctx = await getUserContext()
  if (!ctx || !ctx.persona_id) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }
  if (!canPerform(ctx, 'person.edit_socio_activo')) {
    return NextResponse.json(
      { error: 'No tenés permiso para editar este campo' },
      { status: 403 },
    )
  }

  const body = await request.json()
  if (typeof body.socio_asociacion !== 'boolean') {
    return NextResponse.json({ error: 'Valor inválido' }, { status: 400 })
  }

  const supabase = await createClient()

  // Defensa en profundidad: solo aplica a modo servidor/familiar, igual que
  // la visibilidad del campo en la pantalla de Configuración.
  const { data: modos } = await supabase
    .from('persona_modos')
    .select('modo')
    .eq('persona_id', ctx.persona_id)
    .in('modo', ['servidor', 'familiar'])
    .is('fecha_fin', null)

  if (!modos?.length) {
    return NextResponse.json(
      { error: 'Este campo no aplica al modo de participación actual' },
      { status: 400 },
    )
  }

  const { error } = await supabase
    .from('personas')
    .update({ socio_asociacion: body.socio_asociacion })
    .eq('id', ctx.persona_id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
