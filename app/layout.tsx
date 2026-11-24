import type { Metadata } from 'next';
import './globals.css';
import { AgendaProvider } from '@/components/agenda-provider';
export const metadata: Metadata = { title:'FM Digital Growth — Tu agenda, en orden', description:'Organiza tus reservas y horarios de forma simple.' };
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="es"><body><AgendaProvider>{children}</AgendaProvider></body></html>}
