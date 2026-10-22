export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { Calendar, Church, Mail, User } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getUserContext, canPerform } from '@/lib/auth/context'
import { cargarMiPerfil } from '@/lib/personas/mi-perfil-server'
import {
  labelEstadoCivil,
  labelEstadoEclesial,
  labelNivelEstudios,
  labelRangoEclesial,
  labelSexo,
} from '@/lib/eventos/inscripcion-datos'
import { formatDateAR } from '@/lib/utils'

const ESTADO_LABEL: Record<string, string> = {
  interesado: 'Interesado',
  inscripto: 'Inscripto',
  en_curso: 'Convivente',
  completado: 'Completado',
  lista_espera: 'Lista de espera',
}

const unir = (partes: (string | null | undefined)[], sep: string) => partes.filter(p => p && p.trim()).join(sep)

function Dato({ label, valor }: { label: string; valor: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{valor?.trim() ? valor : '—'}</dd>
    </div>
  )
}

/**
 * Perfil de solo lectura (card #92), pensado para la cuenta de Participante,
 * que no entra a Configuración. Lo habilita el permiso de catálogo
 * `perfil.view_propio`.
 */
export default async function MiPerfilPage() {
  const ctx = await getUserContext()
  if (!ctx) redirect('/auth/login')
  if (!canPerform(ctx, 'perfil.view_propio') || !ctx.persona_id) redirect('/dashboard')

  const perfil = await cargarMiPerfil(ctx.persona_id)
  if (!perfil) redirect('/dashboard')
  const p = perfil.persona

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold text-foreground">
          <User className="h-8 w-8 text-primary" />
          Mi perfil
        </h1>
        <p className="mt-2 text-muted-foreground">
          Tus datos en la Comunidad. Si algo está mal, avisale al equipo del retiro.
        </p>
      </div>

      <Card className="border-border bg-card">
        <CardContent className="flex items-center gap-4 py-5">
          {p.foto_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.foto_url} alt="" className="h-16 w-16 rounded-full object-cover" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
              {`${p.nombre?.charAt(0) ?? ''}${p.apellido?.charAt(0) ?? ''}`}
            </div>
          )}
          <div>
            <p className="text-lg font-semibold leading-tight text-foreground">
              {unir([p.nombre, p.apellido], ' ')}
            </p>
            {p.apodo && <p className="text-sm text-muted-foreground">&ldquo;{p.apodo}&rdquo;</p>}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <User className="h-5 w-5 text-primary" />
            Datos personales
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            <Dato label="Documento" valor={unir([p.tipo_documento?.toUpperCase(), p.documento], ' ')} />
            <Dato label="Fecha de nacimiento" valor={p.fecha_nacimiento ? formatDateAR(p.fecha_nacimiento) : null} />
            <Dato label="Sexo" valor={labelSexo(p.sexo)} />
            <Dato label="Estado civil" valor={labelEstadoCivil(p.estado_vida)} />
            <Dato label="Nacionalidad" valor={p.nacionalidad} />
            <Dato label="Nivel de estudios" valor={labelNivelEstudios(p.nivel_estudios)} />
            <Dato label="Ocupación o profesión" valor={p.ocupacion} />
          </dl>
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Mail className="h-5 w-5 text-primary" />
            Contacto y domicilio
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            <Dato label="Teléfono" valor={p.telefono} />
            <Dato label="Email" valor={p.email} />
            <Dato label="Domicilio" valor={unir([p.direccion, p.direccion_nro], ' ')} />
            <Dato label="Localidad" valor={unir([p.localidad, p.provincia, p.pais], ', ')} />
            <Dato label="Código postal" valor={p.codigo_postal} />
          </dl>
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Church className="h-5 w-5 text-primary" />
            Vida de fe
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            <Dato
              label="Estado eclesial"
              valor={unir(
                [labelEstadoEclesial(p.estado_eclesial), labelRangoEclesial(p.estado_eclesial_rango), p.institucion_religiosa],
                ' — '
              )}
            />
            <Dato label="Diócesis" valor={p.diocesis} />
            <Dato label="Parroquia" valor={p.parroquia} />
            <Dato
              label="Convivencias, retiros y talleres realizados"
              valor={perfil.realizados.map(r => (r.anio ? `${r.nombre} (${r.anio})` : r.nombre)).join(', ')}
            />
          </dl>
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Calendar className="h-5 w-5 text-primary" />
            Mis retiros en la plataforma
          </CardTitle>
          <CardDescription>Retiros en los que te anotaste a través de la plataforma.</CardDescription>
        </CardHeader>
        <CardContent>
          {perfil.retiros.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Todavía no hay retiros.</p>
          ) : (
            <ul className="divide-y divide-border">
              {perfil.retiros.map(r => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium text-foreground">{r.nombre}</p>
                    {r.fecha_inicio && <p className="text-xs text-muted-foreground">{formatDateAR(r.fecha_inicio)}</p>}
                  </div>
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    {ESTADO_LABEL[r.estado] ?? r.estado}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
