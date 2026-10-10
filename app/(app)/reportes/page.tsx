'use client'

export const dynamic = 'force-dynamic'


import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart, Download, Filter, TrendingUp } from 'lucide-react'
import Link from 'next/link'

export default function ReportesPage() {
  const [dateRange, setDateRange] = useState('month')

  const reportes = [
    {
      nombre: 'Inscripciones por Retiro',
      descripcion: 'Número de inscripciones y tasa de ocupación por retiro',
      icono: '📊',
    },
    {
      nombre: 'Ingresos Mensuales',
      descripcion: 'Detalles de ingresos y pagos procesados',
      icono: '💰',
    },
    {
      nombre: 'Asistencia a Retiros',
      descripcion: 'Tasa de asistencia y no-shows por retiro',
      icono: '👥',
    },
    {
      nombre: 'Participación por Organización',
      descripcion: 'Número de personas inscritas por organización',
      icono: '🏢',
    },
    {
      nombre: 'Actividad de Usuarios',
      descripcion: 'Reportes de actividad de administradores',
      icono: '📈',
    },
    {
      nombre: 'Datos Exportados',
      descripcion: 'Descarga datos en formato CSV o Excel',
      icono: '📥',
    },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          <BarChart className="h-8 w-8 text-primary" />
          Reportes y Estadísticas
        </h1>
        <p className="mt-2 text-muted-foreground">
          Consulta reportes detallados sobre retiros, inscripciones y pagos
        </p>
      </div>

      {/* Date Range Filter */}
      <Card className="border-border bg-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-primary" />
            <CardTitle className="text-foreground">Filtros</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="flex gap-4 flex-wrap">
          {['semana', 'mes', 'trimestre', 'año'].map(periodo => (
            <Button
              key={periodo}
              variant={dateRange === periodo ? 'default' : 'outline'}
              onClick={() => setDateRange(periodo)}
              className={dateRange !== periodo ? 'bg-transparent' : ''}
            >
              {periodo.charAt(0).toUpperCase() + periodo.slice(1)}
            </Button>
          ))}
        </CardContent>
      </Card>

      {/* Reports Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {reportes.map((reporte, idx) => (
          <Link key={idx} href={`/reportes/${reporte.nombre.toLowerCase().replace(/ /g, '-')}`}>
            <Card className="border-border bg-card hover:border-primary/50 transition-colors cursor-pointer h-full">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-foreground">{reporte.nombre}</CardTitle>
                    <CardDescription>{reporte.descripcion}</CardDescription>
                  </div>
                  <div className="text-3xl">{reporte.icono}</div>
                </div>
              </CardHeader>
              <CardContent>
                <Button variant="outline" size="sm" className="w-full gap-2 bg-transparent">
                  <Download className="h-4 w-4" />
                  Ver Reporte
                </Button>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Key Metrics */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <TrendingUp className="h-5 w-5 text-primary" />
            Métricas Clave
          </CardTitle>
          <CardDescription>Principales indicadores de desempeño</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Tasa de Ocupación Promedio</p>
              <p className="text-2xl font-bold text-foreground">78%</p>
              <p className="text-xs text-green-600">↑ 5% vs mes anterior</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Tasa de Asistencia</p>
              <p className="text-2xl font-bold text-foreground">85%</p>
              <p className="text-xs text-green-600">↑ 3% vs mes anterior</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Ingreso Promedio por Retiro</p>
              <p className="text-2xl font-bold text-foreground">€2,450</p>
              <p className="text-xs text-green-600">↑ 12% vs mes anterior</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Nuevas Personas/Mes</p>
              <p className="text-2xl font-bold text-foreground">47</p>
              <p className="text-xs text-green-600">↑ 8% vs mes anterior</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
