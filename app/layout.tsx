import type { Metadata } from 'next';
import './globals.css';
import { AgendaProvider } from '@/components/agenda-provider';
import { LanguageProvider } from '@/components/language-provider';
import { ThemeProvider } from '@/components/theme-provider';
export const metadata: Metadata = { title:'FM Digital Growth | Tu agenda online, simple y efectiva', description:'FM Digital Growth by FM Digital: organiza servicios, horarios, clientes y reservas. Prueba gratis durante 15 días; luego $9.990 CLP al mes.', icons:{icon:'/icon.svg',shortcut:'/icon.svg'} };
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="es"><body><ThemeProvider><LanguageProvider><AgendaProvider>{children}</AgendaProvider></LanguageProvider></ThemeProvider></body></html>}
