import type { Metadata } from 'next';
import './globals.css';
import { AgendaProvider } from '@/components/agenda-provider';
import { LanguageProvider } from '@/components/language-provider';
export const metadata: Metadata = { title:'AgendaFlow | Tu agenda online, simple y efectiva', description:'Organiza servicios, horarios, clientes y reservas. Prueba AgendaFlow gratis durante 7 días y luego continúa por $9.990 CLP al mes.' };
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="es"><body><LanguageProvider><AgendaProvider>{children}</AgendaProvider></LanguageProvider></body></html>}
