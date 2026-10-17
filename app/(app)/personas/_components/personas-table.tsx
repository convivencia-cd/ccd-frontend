"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Check, Edit2, Eye, Link2, Loader2, Printer } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import PersonaDetailModal from "./persona-detail-modal"
import ExportButton from "./export-button"
import SortableHeader from "@/components/ui/sortable-header"
import { apellidoNombreConApodo } from "@/lib/personas/nombre"
import { ordenarModos } from "@/lib/personas/modos"

type Persona = {
  id: string
  nombre: string
  apellido: string
  apodo?: string | null
  email: string | null
  telefono: string | null
  localidad?: string | null
  estado?: string | null
  estado_eclesial?: string | null
  confraternidad: string | null
  fraternidad: string | null
  modo_participacion: string[]
}

type Props = {
  personas: Persona[]
  canUpdate: boolean
  canViewDetails: boolean
  canExport: boolean
  exportSearch: string
  initialPersonaId: string | null
  sortBy: string
  sortDir: 'asc' | 'desc' | ''
  totalCount?: number
}

export default function PersonasTable({
  personas,
  canUpdate,
  canViewDetails,
  canExport,
  exportSearch,
  initialPersonaId,
  sortBy,
  sortDir,
  totalCount,
}: Props) {
  // Deep-link modal (URL-based, kept for backwards compat with ?persona=UUID)
  const [selectedId, setSelectedId] = useState<string | null>(initialPersonaId)
  const [copied, setCopied] = useState(false)
  const [exporting, setExporting] = useState(false)
  const pathname = usePathname()
  const selected = selectedId ? personas.find((p) => p.id === selectedId) : null
  const printRef = useRef<HTMLDivElement>(null)

  // Hover preview modal
  const HOVER_DELAY = 1500
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const hoveredPersona = hoveredId ? personas.find((p) => p.id === hoveredId) : null
  const [hoverActive, setHoverActive] = useState<string | null>(null)
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const modoLabels: Record<string, string> = {
    convivente: "Convivente",
    colaborador: "Colaborador",
    servidor: "Servidor",
    asesor: "Asesor",
    familiar: "Familiar",
    orante: "Orante",
    intercesor: "Intercesor",
    otro: "Otro",
  }

  function handleHoverEnter(id: string) {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
    setHoverActive(id)
    hoverTimerRef.current = setTimeout(() => {
      setHoveredId(id)
      setHoverActive(null)
    }, HOVER_DELAY)
  }

  function handleHoverLeave() {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
    setHoverActive(null)
  }

  function handleClose() {
    setSelectedId(null)
    const params = new URLSearchParams(window.location.search)
    params.delete("persona")
    const search = params.toString()
    window.history.replaceState(
      null,
      "",
      search ? `${pathname}?${search}` : pathname,
    )
  }

  async function handleCopyLink() {
    await navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleExportPdf() {
    if (!printRef.current || !selected) return
    setExporting(true)
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import("html2canvas-pro"),
        import("jspdf"),
      ])

      const element = printRef.current
      const dialogContent = element.closest(
        '[data-slot="dialog-content"]',
      ) as HTMLElement | null
      const prevMaxHeight = dialogContent?.style.maxHeight ?? ""
      const prevOverflow = dialogContent?.style.overflow ?? ""
      if (dialogContent) {
        dialogContent.style.maxHeight = "none"
        dialogContent.style.overflow = "visible"
      }

      element.classList.add("is-exporting")

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
      })

      if (dialogContent) {
        dialogContent.style.maxHeight = prevMaxHeight
        dialogContent.style.overflow = prevOverflow
      }

      const imgData = canvas.toDataURL("image/png")
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      })
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const margin = 10
      const contentWidth = pageWidth - margin * 2
      const imgHeight = (canvas.height * contentWidth) / canvas.width

      let yOffset = margin
      let remainingHeight = imgHeight

      while (remainingHeight > 0) {
        const sliceHeight = Math.min(remainingHeight, pageHeight - margin * 2)
        const sourceY =
          (imgHeight - remainingHeight) * (canvas.height / imgHeight)
        const sourceHeight = sliceHeight * (canvas.height / imgHeight)

        const sliceCanvas = document.createElement("canvas")
        sliceCanvas.width = canvas.width
        sliceCanvas.height = sourceHeight
        const ctx = sliceCanvas.getContext("2d")!
        ctx.drawImage(
          canvas,
          0,
          sourceY,
          canvas.width,
          sourceHeight,
          0,
          0,
          canvas.width,
          sourceHeight,
        )

        if (yOffset > margin) {
          pdf.addPage()
          yOffset = margin
        }

        pdf.addImage(
          sliceCanvas.toDataURL("image/png"),
          "PNG",
          margin,
          yOffset,
          contentWidth,
          sliceHeight,
        )
        remainingHeight -= sliceHeight
      }

      const blob = pdf.output("blob")
      const url = URL.createObjectURL(blob)
      const win = window.open(url, "_blank")
      if (win) {
        win.addEventListener("load", () => URL.revokeObjectURL(url), { once: true })
      }
    } finally {
      printRef.current?.classList.remove("is-exporting")
      setExporting(false)
    }
  }

  return (
    <>
      {canViewDetails && (
        <style>{`
          @keyframes hover-progress {
            from { stroke-dashoffset: 37.7; }
            to   { stroke-dashoffset: 0; }
          }
        `}</style>
      )}
      {personas.length > 0 && (
        <>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">
              {(totalCount ?? personas.length)} persona{(totalCount ?? personas.length) !== 1 ? "s" : ""} en total
            </span>
            {canExport && <ExportButton searchString={exportSearch} />}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <SortableHeader column="apellido" label="Nombre" currentSort={sortBy} currentDir={sortDir} />
                  <SortableHeader column="email" label="Email" currentSort={sortBy} currentDir={sortDir} />
                  <th className="text-left py-3 px-4 font-semibold text-foreground">Teléfono</th>
                  {canViewDetails ? (
                    <>
                      <SortableHeader column="localidad" label="Localidad" currentSort={sortBy} currentDir={sortDir} />
                      <SortableHeader column="estado_eclesial" label="Estado ecl." currentSort={sortBy} currentDir={sortDir} />
                      <SortableHeader column="estado" label="Estado" currentSort={sortBy} currentDir={sortDir} />
                      <th className="text-center py-3 px-4 font-semibold text-foreground">Acciones</th>
                    </>
                  ) : (
                    <>
                      <th className="text-left py-3 px-4 font-semibold text-foreground">Confraternidad</th>
                      <th className="text-left py-3 px-4 font-semibold text-foreground">Fraternidad</th>
                      <th className="text-left py-3 px-4 font-semibold text-foreground">Modo de participación</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {personas.map((persona) => (
                  <tr
                    key={persona.id}
                    className="border-b border-border hover:bg-muted/50 transition-colors"
                  >
                    <td
                      className="py-3 px-4 font-medium"
                      onMouseEnter={canViewDetails ? () => handleHoverEnter(persona.id) : undefined}
                      onMouseLeave={canViewDetails ? handleHoverLeave : undefined}
                    >
                      <div className="flex items-center gap-2">
                        {canViewDetails ? (
                          <Link
                            href={`/personas/${persona.id}`}
                            className="text-foreground hover:text-primary hover:underline"
                          >
                            {apellidoNombreConApodo(persona)}
                          </Link>
                        ) : (
                          <span className="text-foreground">
                            {apellidoNombreConApodo(persona)}
                          </span>
                        )}
                        {canViewDetails && hoverActive === persona.id && (
                          <svg className="h-4 w-4 text-primary shrink-0" viewBox="0 0 16 16" fill="none">
                            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2" />
                            <circle
                              cx="8" cy="8" r="6"
                              stroke="currentColor" strokeWidth="2"
                              strokeLinecap="round"
                              strokeDasharray="37.7"
                              strokeDashoffset="37.7"
                              style={{
                                animation: `hover-progress ${HOVER_DELAY}ms linear forwards`,
                                transformOrigin: 'center',
                                transform: 'rotate(-90deg)',
                              }}
                            />
                          </svg>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">
                      {persona.email ?? "—"}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">
                      {persona.telefono ?? "—"}
                    </td>
                    {canViewDetails ? (
                      <>
                        <td className="py-3 px-4 text-muted-foreground">
                          {persona.localidad ?? "—"}
                        </td>
                        <td className="py-3 px-4 text-muted-foreground capitalize">
                          {persona.estado_eclesial ?? "laico"}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                              persona.estado === "activo"
                                ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {persona.estado}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-center gap-1">
                            <Link href={`/personas/${persona.id}`} title="Ver detalle">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>
                            {canUpdate && (
                              <Link href={`/personas/${persona.id}/editar`}>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0"
                                  title="Editar"
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                              </Link>
                            )}
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="py-3 px-4 text-muted-foreground">
                          {persona.confraternidad ?? "—"}
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">
                          {persona.fraternidad ?? "—"}
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">
                          {persona.modo_participacion.length
                            ? ordenarModos(persona.modo_participacion).map(modo => modoLabels[modo] ?? modo).join(' + ')
                            : "—"}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Hover preview modal */}
      {canViewDetails && <Dialog open={!!hoveredId} onOpenChange={(open) => { if (!open) setHoveredId(null) }}>
        <DialogContent
          className="sm:max-w-2xl max-h-[80vh] overflow-y-auto"
        >
          {hoveredPersona && (
            <DialogHeader>
              <div className="flex items-center gap-3">
                <DialogTitle>
                  {apellidoNombreConApodo(hoveredPersona)}
                </DialogTitle>
                <DialogDescription asChild>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      hoveredPersona.estado === "activo"
                        ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {hoveredPersona.estado}
                  </span>
                </DialogDescription>
              </div>
            </DialogHeader>
          )}
          {hoveredId && <PersonaDetailModal personaId={hoveredId} />}
        </DialogContent>
      </Dialog>}

      {/* Deep-link modal (?persona=UUID) */}
      {canViewDetails && <Dialog
        open={!!selectedId}
        onOpenChange={(open) => {
          if (!open) handleClose()
        }}
      >
        <DialogContent className="sm:max-w-3xl max-h-[80vh] overflow-y-auto">
          <div ref={printRef}>
            {selected && (
              <DialogHeader>
                <div className="flex items-start justify-between gap-4 pr-8">
                  <div className="flex flex-col gap-1.5">
                    <DialogTitle>
                      {apellidoNombreConApodo(selected)}
                    </DialogTitle>
                    <DialogDescription asChild>
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            selected.estado === "activo"
                              ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {selected.estado}
                        </span>
                      </div>
                    </DialogDescription>
                  </div>
                  <div className="flex items-center gap-1 shrink-0" data-export-hide>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1.5 text-xs"
                      onClick={handleCopyLink}
                    >
                      {copied ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <Link2 className="h-3.5 w-3.5" />
                      )}
                      {copied ? "Copiado" : "Copiar enlace"}
                    </Button>
                    {canExport && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1.5 text-xs"
                        onClick={handleExportPdf}
                        disabled={exporting}
                      >
                        {exporting ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Printer className="h-3.5 w-3.5" />
                        )}
                        {exporting ? "Generando..." : "Exportar PDF"}
                      </Button>
                    )}
                  </div>
                </div>
              </DialogHeader>
            )}
            {selectedId && <PersonaDetailModal personaId={selectedId} />}
          </div>
        </DialogContent>
      </Dialog>}
    </>
  )
}
