# FM Digital Growth — Microapp de agenda

FM Digital Growth organiza las reservas de un emprendimiento sin complicaciones.

## Funciones
- Agenda diaria y semanal.
- Crear, editar, confirmar, completar y cancelar reservas.
- Servicios con precio y duración sincronizados con Supabase.
- Horarios semanales y bloqueos sincronizados con Supabase.
- Enlace público que consulta servicios y disponibilidad reales.
- Reservas públicas guardadas en Supabase junto con los datos del cliente.
- Validación transaccional para impedir dos reservas simultáneas en la misma franja.
- Contacto manual por WhatsApp.
- Registro e inicio de sesión con Supabase Auth.
- Selección de rubro al registrarse.
- Demo interactiva con datos ficticios.

## Estado de esta entrega
El registro y login se conectan a Supabase Auth. Los nuevos registros crean un negocio con rubro y fechas de prueba de 7 días. La agenda autenticada carga y sincroniza servicios, horarios, bloqueos y reservas con Supabase. El formulario público obtiene los servicios y la disponibilidad mediante una función RPC que no expone datos personales. La creación de reservas públicas utiliza una función transaccional que valida horarios, bloqueos y solapamientos, y guarda el cliente y la reserva. El panel actualiza las reservas periódicamente.

La demo interactiva usa datos ficticios en el navegador y no modifica cuentas reales. Antes de producción aún deben probarse RLS y el flujo completo con dos cuentas/dispositivos distintos, además de revisar el despliegue y la configuración de Auth.

## Configuración
1. Crea un proyecto Supabase.
2. Copia `.env.example` a `.env.local` y completa `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
3. Ejecuta las migraciones en orden desde Supabase SQL Editor:
   - `0001_agendaflow_schema.sql`
   - `0002_business_sector_signup.sql`
   - `0003_business_trial_period.sql`
   - `0004_public_booking_availability.sql`
   - `0005_appointment_integrity.sql`
   - `0006_booking_lock_consistency.sql`
   - `0007_authenticated_table_permissions.sql`
4. En Authentication > URL Configuration configura la URL local y la de producción.
5. Ejecuta `npm install` y `npm run dev`.

## Rutas
- `/` landing.
- `/demo` demo interactiva con datos ficticios.
- `/registro` alta de cuenta con rubro.
- `/login` inicio de sesión.
- `/dashboard` agenda.
- `/dashboard/servicios`, `/dashboard/horarios`, `/dashboard/clientes`.
- `/reservar/[slug]` formulario público conectado a Supabase.

No exponer claves `service_role` ni `secret` en el navegador.
