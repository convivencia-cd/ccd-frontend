export const dynamic = 'force-dynamic'

import Link from "next/link"
import { Plus, Building2, MapPin, Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/server"

async function getConfraternidades() {
  const supabase = await createClient()
  const { data } = await supabase
    .from("organizaciones")
    .select(`
      id, nombre, localidad, provincia, notas,
      eventos:eventos!organizacion_id(id)
    `)
    .eq("tipo", "confraternidad")
    .is("fecha_baja", null)
    .order("nombre", { ascending: true })

  return data || []
}

export default async function AdminConfraternitiesPage() {
  const confraternidades = await getConfraternidades()

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground md:text-3xl">Confraternidades</h1>
          <p className="mt-1 text-muted-foreground">Gestiona las confraternidades registradas</p>
        </div>
        <Link href="/admin/cofradias/nueva">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Nueva Confraternidad
          </Button>
        </Link>
      </div>

      {confraternidades.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {confraternidades.map((conf: any) => (
            <Card key={conf.id} className="border-border">
              <CardHeader>
                <CardTitle className="text-foreground">{conf.nombre}</CardTitle>
                {(conf.localidad || conf.provincia) && (
                  <CardDescription className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {[conf.localidad, conf.provincia].filter(Boolean).join(", ")}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {conf.notas && (
                  <p className="line-clamp-2 text-sm text-muted-foreground">{conf.notas}</p>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    {conf.eventos?.length ?? 0} retiros
                  </span>
                  <Link href={`/admin/cofradias/${conf.id}`}>
                    <Button variant="outline" size="sm">Editar</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-border">
          <CardContent className="py-12 text-center">
            <Building2 className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 font-semibold text-foreground">Sin confraternidades</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Registra la primera confraternidad para comenzar
            </p>
            <Link href="/admin/cofradias/nueva" className="mt-4 inline-block">
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Crear Confraternidad
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
