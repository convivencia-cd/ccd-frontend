export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, Lock } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getUserContext } from '@/lib/auth/context'
import { ROLES_SERVIDORES } from '@/lib/eventos/cierre'
import {
  canEditarInformeEconomico,
  canVerInformeEconomico,
  type BecaOtorgada,
  type Movimiento,
  type SaldosIniciales,
} from '@/lib/eventos/informe-economico'
import { formatDateAR } from '@/lib/utils'
import InformeEconomicoPanel from './informe-economico-panel'

// Pantalla dedicada al Informe Económico del evento (Caja / Banco / MP).
// Se entra desde el botón "Informe económico" del detalle del evento.
export default async function InformeEconomicoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [supabase, ctx] = await Promise.all([createClient(), getUserContext()])

  if (!ctx) redirect('/auth/login')

  const { data: evento } = await supabase
    .from('eventos')
    .select(`
      id, nombre, estado, fecha_inicio, fecha_fin, precio, ciudad, provincia_evento,
      organizacion_id, fraternidad_id,
      centralizador_1_persona_id, centralizador_2_persona_id, centralizador_3_persona_id,
      centralizador_1_nombre, centralizador_2_nombre, centralizador_3_nombre,
      confraternidad:organizaciones!organizacion_id(nombre),
      fraternidad:organizaciones!fraternidad_id(nombre),
      casa_retiro:casas_retiro!casa_retiro_id(nombre)
    `)
    .eq('id', id)
    .single()

  if (!evento) notFound()
  if (!canVerInformeEconomico(ctx, evento)) notFound()

  const canEditar = canEditarInformeEconomico(ctx, evento)

  // Las columnas ie_* se piden aparte para que un fallo (migración 081 sin
  // correr) no tire abajo la pantalla entera.
  const [{ data: movs }, { data: cabecera }, { data: parts }] = await Promise.all([
    supabase
      .from('evento_movimientos')
      .select('*')
      .eq('evento_id', id)
      .order('fecha', { ascending: true })
      .order('created_at', { ascending: true }),
    supabase
      .from('eventos')
      .select('ie_saldo_inicial_caja, ie_saldo_inicial_banco, ie_saldo_inicial_mp, ie_observaciones')
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('evento_participantes')
      .select('rol_en_evento, beca_pension, persona:personas!persona_id(nombre, apellido)')
      .eq('evento_id', id)
      .neq('estado_participacion', 'cancelado'),
  ])

  const saldosIniciales: SaldosIniciales = {
    caja: Number(cabecera?.ie_saldo_inicial_caja ?? 0),
    banco: Number(cabecera?.ie_saldo_inicial_banco ?? 0),
    mp: Number(cabecera?.ie_saldo_inicial_mp ?? 0),
  }

  const conteo = { asistentes: 0, servidores: 0, auxiliares: 0 }
  const becas: BecaOtorgada[] = []
  type Part = { rol_en_evento: string; beca_pension: number | null; persona: { nombre: string; apellido: string } | null }
  for (const p of (parts ?? []) as unknown as Part[]) {
    if (p.rol_en_evento === 'convivente') {
      conteo.asistentes++
      if (Number(p.beca_pension ?? 0) > 0) {
        becas.push({
          nombre: p.persona ? `${p.persona.apellido}, ${p.persona.nombre}` : '—',
          importe: Number(p.beca_pension),
        })
      }
    } else if (p.rol_en_evento === 'equipo_auxiliar') conteo.auxiliares++
    else if ((ROLES_SERVIDORES as readonly string[]).includes(p.rol_en_evento)) conteo.servidores++
  }
  becas.sort((a, b) => a.nombre.localeCompare(b.nombre))

  const confraternidad = evento.confraternidad as unknown as { nombre: string } | null
  const fraternidad = evento.fraternidad as unknown as { nombre: string } | null
  const casaRetiro = evento.casa_retiro as unknown as { nombre: string } | null
  const fechas = [evento.fecha_inicio, evento.fecha_fin]
    .filter(Boolean)
    .map(f => formatDateAR(String(f).split('T')[0]))
    .join(' al ')

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/eventos/${id}`} className="inline-flex items-center gap-2 text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" />
          Volver al evento
        </Link>
        <h1 className="mt-3 text-2xl font-bold text-foreground md:text-3xl">Informe Económico</h1>
        <p className="mt-1 text-muted-foreground">
          {evento.nombre}
          {fechas ? ` · ${fechas}` : ''}
          {confraternidad?.nombre ? ` · ${confraternidad.nombre}` : ''}
        </p>
      </div>

      {!canEditar && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          <Lock className="h-4 w-4 shrink-0" />
          {evento.estado === 'cerrado'
            ? 'El evento está cerrado: el informe es de solo lectura.'
            : 'Vista de solo lectura. El informe lo cargan el/los Centralizador(es) del evento y el Tesorero.'}
        </div>
      )}

      <InformeEconomicoPanel
        eventoId={id}
        info={{
          nombre: evento.nombre,
          fecha_inicio: evento.fecha_inicio ?? null,
          fecha_fin: evento.fecha_fin ?? null,
          lugar: casaRetiro?.nombre ?? ([evento.ciudad, evento.provincia_evento].filter(Boolean).join(', ') || null),
          confraternidad: confraternidad?.nombre ?? null,
          fraternidad: fraternidad?.nombre ?? null,
          centralizadores: [evento.centralizador_1_nombre, evento.centralizador_2_nombre, evento.centralizador_3_nombre]
            .filter((n): n is string => !!n),
          ...conteo,
          valor_inscripcion: evento.precio != null ? Number(evento.precio) : null,
        }}
        movimientosIniciales={(movs ?? []) as Movimiento[]}
        saldosIniciales={saldosIniciales}
        becas={becas}
        observaciones={cabecera?.ie_observaciones ?? null}
        canEditar={canEditar}
      />
    </div>
  )
}
