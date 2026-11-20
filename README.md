# AgendaFlow — Microapp de agenda

AgendaFlow organiza las reservas de un emprendimiento sin complicaciones.

## Funciones
- Agenda diaria y semanal.
- Crear, editar, confirmar, completar y cancelar reservas.
- Servicios con precio y duración.
- Horarios semanales y bloqueos.
- Enlace público para solicitar una hora.
- Contacto manual por WhatsApp.
- Registro e inicio de sesión con Supabase Auth.
- Selección de rubro al registrarse.
- Demo interactiva con cambio de rubro, días, creación y administración de reservas ficticias.

## Estado de esta entrega
El registro y login se conectan a Supabase Auth; la migración 0002 crea un perfil de negocio con su rubro. Los nuevos registros guardan la fecha de inicio y vencimiento de una prueba de 7 días. La demo interactiva usa datos ficticios en el navegador y no modifica cuentas reales. La agenda autenticada todavía funciona con localStorage: reservas, servicios, horarios y clientes aún no se sincronizan entre dispositivos.

## Configuración
1. Crea un proyecto Supabase.
2. Copia `.env.example` a `.env.local` y completa `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` con los datos de tu proyecto.
3. Ejecuta las migraciones `0001_agendaflow_schema.sql`, `0002_business_sector_signup.sql` y `0003_business_trial_period.sql` en orden desde Supabase SQL Editor.
4. En Authentication > URL Configuration configura la URL local y la de producción.
5. Ejecuta `npm install` y `npm run dev`.

## Rutas
- `/` landing.
- `/demo` ejemplos de solo lectura.
- `/registro` alta de cuenta con rubro.
- `/login` inicio de sesión.
- `/dashboard` agenda.
- `/dashboard/servicios`, `/dashboard/horarios`, `/dashboard/clientes`.
- `/reservar/[slug]` formulario público de demostración local.

## Antes de ofrecerlo como servicio
Completar la conexión de todas las operaciones de agenda a Supabase, probar RLS con dos cuentas distintas y verificar reservas públicas desde otro dispositivo. No exponer claves `service_role` en el navegador.
