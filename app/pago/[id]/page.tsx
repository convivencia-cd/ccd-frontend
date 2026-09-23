import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { CheckCircle2, Clock, XCircle } from 'lucide-react'
import { PagoStepper, type DatosPago, type PersonaDatos } from './_components/pago-stepper'
import { hayCuentaCobroCentral } from '@/lib/mercadopago/org-account'

// El precio, los datos de la persona y el estado del pago cambian fuera de
// esta página (centralizador, webhook de Mercado Pago) — nunca cachear.
export const dynamic = 'force-dynamic'

const PAGO_BANNER: Record<
  string,
  { icon: typeof CheckCircle2; wrap: string; icono: string; titulo: string; mensaje: string }
> = {
  success: {
    icon: CheckCircle2,
    wrap: 'border-green-200 bg-green-50',
    icono: 'text-green-600',
    titulo: '¡Pago confirmado!',
    mensaje: 'Recibimos tu pago y tu lugar quedó reservado. ¡Te esperamos!',
  },
  pending: {
    icon: Clock,
    wrap: 'border-amber-200 bg-amber-50',
    icono: 'text-amber-600',
    titulo: 'Pago en proceso',
    mensaje: 'Tu pago está siendo procesado. En cuanto se acredite, vas a quedar inscripto.',
  },
  failure: {
    icon: XCircle,
    wrap: 'border-red-200 bg-red-50',
    icono: 'text-red-600',
    titulo: 'El pago no se completó',
    mensaje: 'Algo falló al procesar el pago. Podés volver a intentarlo desde acá abajo.',
  },
}

function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 border-b border-border bg-white/95 backdrop-blur supports-backdrop-filter:bg-white/80">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logoccd.jpeg" alt="Convivencia con Dios" width={32} height={32} className="rounded-md" priority />
            <span className="text-sm font-semibold text-foreground" translate="no">Convivencia con Dios</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 bg-background">
        <div className="mx-auto max-w-2xl px-4 py-8">{children}</div>
      </main>

      <footer className="px-4 py-8 text-center text-sm text-white/80" style={{ backgroundColor: '#1B3A4C' }}>
        <p className="font-medium text-white mb-1" translate="no">Convivencia con Dios</p>
        <p>© {new Date().getFullYear()} Todos los derechos reservados.</p>
      </footer>
    </div>
  )
}

export default async function PagoInscripcionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ pago?: string }>
}) {
  const { id } = await params
  const { pago } = await searchParams
  const banner = pago ? PAGO_BANNER[pago] : undefined

  // Página pública sin sesión: la credencial es el UUID del participante que
  // viajó en el mail. Cliente de servicio porque ni personas ni organizaciones
  // tienen lectura anónima.
  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: participante } = await supabase
    .from('evento_participantes')
    .select(`
      id, estado_participacion,
      persona:personas!persona_id(
        id, nombre, apellido, email, telefono, tipo_documento, documento,
        fecha_nacimiento, direccion, direccion_nro, localidad, codigo_postal, provincia, pais
      ),
      evento:eventos!evento_id(
        id, nombre, fecha_inicio, fecha_fin, precio, ciudad, provincia_evento,
        casa_retiro:casas_retiro!casa_retiro_id(nombre),
        organizacion:organizaciones!organizacion_id(pago_alias, pago_cbu, pago_titular, pago_banco, pago_instrucciones),
        fraternidad:organizaciones!fraternidad_id(pago_alias, pago_cbu, pago_titular, pago_banco, pago_instrucciones)
      )
    `)
    .eq('id', id)
    .maybeSingle()

  if (!participante) notFound()

  const persona = participante.persona as unknown as PersonaDatos | null
  const evento = participante.evento as unknown as {
    id: string
    nombre: string
    fecha_inicio: string | null
    fecha_fin: string | null
    precio: number | null
    ciudad: string | null
    provincia_evento: string | null
    casa_retiro: { nombre: string } | null
    organizacion: Record<string, string | null> | null
    fraternidad: Record<string, string | null> | null
  } | null

  if (!persona || !evento) notFound()

  const { data: pagoRow } = await supabase
    .from('pagos')
    .select('id, estado_pago, medio_pago')
    .eq('evento_participante_id', id)
    .eq('concepto', 'inscripcion')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const yaInscripto = participante.estado_participacion !== 'interesado'
  const yaPago = pagoRow?.estado_pago === 'confirmado'
  const comprobanteEnRevision = pagoRow?.estado_pago === 'pendiente' && pagoRow?.medio_pago === 'transferencia'

  const lugar = [evento.casa_retiro?.nombre, evento.ciudad, evento.provincia_evento].filter(Boolean).join(', ')

  if (yaInscripto || yaPago) {
    return (
      <PublicShell>
        <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-green-600" />
          <h1 className="mt-4 text-xl font-bold text-foreground">Tu inscripción ya está registrada</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Hola {persona.nombre}, ya tenemos tu lugar confirmado para <strong>{evento.nombre}</strong>. Si tenés
            dudas, escribinos y te ayudamos.
          </p>
        </div>
        <div className="mt-6 text-center">
          <Link href={`/e/${evento.id}`} className="text-sm text-[#F08020] hover:underline">
            Ver el detalle del evento
          </Link>
        </div>
      </PublicShell>
    )
  }

  const mpDisponible = await hayCuentaCobroCentral()

  // Transferencia: preferir los datos de la fraternidad si tiene alias; si no,
  // los de la confraternidad. Mismo criterio que /e/[id].
  const orgPago = evento.fraternidad?.pago_alias ? evento.fraternidad : evento.organizacion
  const datosPago: DatosPago | null = orgPago?.pago_alias
    ? {
        alias: orgPago.pago_alias,
        cbu: orgPago.pago_cbu ?? null,
        titular: orgPago.pago_titular ?? null,
        banco: orgPago.pago_banco ?? null,
        instrucciones: orgPago.pago_instrucciones ?? null,
      }
    : null

  const BannerIcon = banner?.icon

  return (
    <PublicShell>
      {banner && BannerIcon && (
        <div className={`mb-6 flex items-start gap-3 rounded-xl border p-4 ${banner.wrap}`}>
          <BannerIcon className={`mt-0.5 h-5 w-5 shrink-0 ${banner.icono}`} />
          <div>
            <p className="font-semibold text-foreground">{banner.titulo}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">{banner.mensaje}</p>
          </div>
        </div>
      )}

      <PagoStepper
        participanteId={id}
        persona={persona}
        evento={{
          id: evento.id,
          nombre: evento.nombre,
          fechaInicio: evento.fecha_inicio,
          fechaFin: evento.fecha_fin,
          lugar: lugar || null,
          monto: evento.precio != null ? Number(evento.precio) : null,
        }}
        mpDisponible={mpDisponible}
        datosPago={datosPago}
        comprobanteEnRevision={comprobanteEnRevision}
      />
    </PublicShell>
  )
}
