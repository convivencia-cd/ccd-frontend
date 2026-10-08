import { redirect } from 'next/navigation'
import { getUserContext, canPerform } from '@/lib/auth/context'

// Alta de casas de retiro: permiso propio casas_retiro.create (card #61, scripts/091).
// El layout padre ya exige view.casas_retiro.
export default async function NuevaCasaRetiroLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getUserContext()
  if (!ctx || !canPerform(ctx, 'casas_retiro.create')) redirect('/casas-retiro')

  return <>{children}</>
}
