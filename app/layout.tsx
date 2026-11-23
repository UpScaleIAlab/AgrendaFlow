import type { Metadata } from 'next';
import './globals.css';
import { AgendaProvider } from '@/components/agenda-provider';
import { LanguageProvider } from '@/components/language-provider';
export const metadata: Metadata = { title:'FlowAgenda | Tu agenda online, simple y efectiva', description:'FlowAgenda by FM Digital: organiza servicios, horarios, clientes y reservas. Prueba gratis durante 15 días; luego $9.990 CLP al mes.' };
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="es"><body><LanguageProvider><AgendaProvider>{children}</AgendaProvider></LanguageProvider></body></html>}
