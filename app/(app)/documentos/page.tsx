'use client'

export const dynamic = 'force-dynamic'


import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FileText, Plus } from 'lucide-react'

export default function DocumentosPage() {
  const documentos: any[] = []

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          <FileText className="h-8 w-8 text-primary" />
          Gestión de Documentos
        </h1>
        <p className="mt-2 text-muted-foreground">
          Administra documentos de retiros y participantes
        </p>
      </div>

      <Card className="border-border bg-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-foreground">Documentos</CardTitle>
            <CardDescription>Todos los documentos en el sistema</CardDescription>
          </div>
          <Link href="/documentos/nuevo">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Nuevo Documento
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {documentos.length > 0 ? (
            <div className="space-y-4">
              {/* Documents will go here */}
            </div>
          ) : (
            <div className="py-12 text-center">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold text-foreground">No hay documentos</h3>
              <p className="mt-2 text-muted-foreground">Comienza agregando el primer documento al sistema</p>
              <Link href="/documentos/nuevo" className="mt-4 inline-block">
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Nuevo Documento
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
