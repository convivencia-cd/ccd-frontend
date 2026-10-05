import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserContext } from '@/lib/auth/context'
import { canEditarCierre, canEditarInformesConfidenciales, ROLES_CARISMAS } from '@/lib/eventos/cierre'
import { guardarCarismas, guardarInformeCcd } from '@/lib/eventos/informes-cierre'

// Guarda los datos del cierre: materiales/manuales (en `eventos`) y los
// informes confidenciales (en evento_informes_cierre, ver lib/eventos/informes-cierre.ts).
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const ctx = await getUserContext()
  if (!ctx) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const supabase = await createClient()

  const { data: evento, error: eventoError } = await supabase
    .from('eventos')
    .select('id, estado, organizacion_id, fraternidad_id, coordinador_asignado_id, asesor_asignado_id, centralizador_1_persona_id, centralizador_2_persona_id, centralizador_3_persona_id')
    .eq('id', id)
    .single()

  if (eventoError || !evento) {
    return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 })
  }

  if (!canEditarCierre(ctx, evento)) {
    return NextResponse.json(
      { error: 'No tenés permiso para editar el cierre (o el evento ya está cerrado)' },
      { status: 403 }
    )
  }

  const body = await request.json()
  const update: Record<string, unknown> = {}

  // Campos no confidenciales — cualquiera que pueda editar el cierre
  if ('cierre_bolso_manuales_completo' in body) update.cierre_bolso_manuales_completo = body.cierre_bolso_manuales_completo
  if ('cierre_manuales_saldo_final' in body) update.cierre_manuales_saldo_final = body.cierre_manuales_saldo_final === '' || body.cierre_manuales_saldo_final == null ? null : Number(body.cierre_manuales_saldo_final)
  if ('cierre_manuales_recibidos_de' in body) update.cierre_manuales_recibidos_de = body.cierre_manuales_recibidos_de || null
  if ('cierre_manuales_entrego_a' in body) update.cierre_manuales_entrego_a = body.cierre_manuales_entrego_a || null
  if ('cierre_manuales_notas' in body) update.cierre_manuales_notas = body.cierre_manuales_notas || null

  // Informes confidenciales (6 y 7) — solo el coordinador del evento. Van a
  // evento_informes_cierre (RLS cerrada, service role), no a `eventos`.
  const tocaEqt = 'informe_eqt_respuestas' in body
  const tocaResponsables = 'informe_responsables_respuestas' in body
  const tocaCarismas = 'informe_carismas' in body
  const tocaConfidenciales = tocaEqt || tocaResponsables || tocaCarismas
  if (tocaConfidenciales && !canEditarInformesConfidenciales(ctx, evento)) {
    return NextResponse.json({ error: 'Solo el coordinador del evento completa los informes confidenciales' }, { status: 403 })
  }

  if (Object.keys(update).length === 0 && !tocaConfidenciales) {
    return NextResponse.json({ error: 'Nada para actualizar' }, { status: 400 })
  }

  try {
    if (tocaEqt) {
      await guardarInformeCcd(id, 'eqt', body.informe_eqt_respuestas ?? {}, ctx.persona_id)
    }
    if (tocaResponsables) {
      await guardarInformeCcd(id, 'responsables', body.informe_responsables_respuestas ?? {}, ctx.persona_id)
    }
    if (tocaCarismas) {
      const { data: equipo, error: equipoError } = await supabase
        .from('evento_participantes')
        .select('persona_id')
        .eq('evento_id', id)
        .in('rol_en_evento', ROLES_CARISMAS as unknown as string[])
        .neq('estado_participacion', 'cancelado')
      if (equipoError) throw equipoError
      const servidores = new Set((equipo ?? []).map(p => p.persona_id as string))
      // El asesor y el coordinador asignados viven en columnas de `eventos`.
      if (evento.coordinador_asignado_id) servidores.add(evento.coordinador_asignado_id)
      if (evento.asesor_asignado_id) servidores.add(evento.asesor_asignado_id)
      await guardarCarismas(id, Array.isArray(body.informe_carismas) ? body.informe_carismas : [], servidores, ctx.persona_id)
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : (e as { message?: string })?.message ?? 'Error al guardar el informe'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  if (Object.keys(update).length > 0) {
    const { error: updateError } = await supabase.from('eventos').update(update).eq('id', id)
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
