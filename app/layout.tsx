import type { Metadata } from 'next';
import './globals.css';
import { AgendaProvider } from '@/components/agenda-provider';
import { LanguageProvider } from '@/components/language-provider';
export const metadata: Metadata = { title:'FM Digital Growth | Una agenda profesional para negocios que quieren crecer', description:'FM Digital Growth: una agenda profesional para negocios que quieren crecer. Organiza servicios, horarios, clientes y reservas. Prueba gratis durante 15 días; luego $9.990 CLP al mes.', icons:{icon:'/icon.svg',shortcut:'/icon.svg'} };
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="es"><body><LanguageProvider><AgendaProvider>{children}</AgendaProvider></LanguageProvider></body></html>}
