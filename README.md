# FM Digital Growth — Agenda online profesional

FM Digital Growth tiene un objetivo: **organizar las reservas de un emprendimiento sin complicaciones**.

## Qué trae esta versión
- Agenda con vista diaria y semanal.
- Crear, editar, confirmar, completar y cancelar reservas.
- Servicios con precio, duración y opción de pausar disponibilidad.
- Horarios semanales de atención.
- Bloqueos de horarios por fecha (almuerzo, trámites, descanso, etc.).
- Página pública para solicitar una hora desde `/reservar/[slug]`.
- Validación de cruces de reservas y bloqueos en la experiencia local.
- Contacto y recordatorio manual por WhatsApp mediante enlace `wa.me`.
- Datos básicos del cliente guardados con su reserva.
- Diseño adaptable para computador y teléfono, con estética marfil, grafito y bronce.

## Importante sobre esta entrega
Esta versión funciona como **prototipo local** y guarda los datos en el almacenamiento del navegador (`localStorage`). Sirve para probar la experiencia y las funciones en el mismo navegador/dispositivo. No sincroniza todavía reservas entre dispositivos ni publica datos en internet. Para operar con clientes reales desde distintos teléfonos o computadores, el siguiente paso es conectar Supabase (autenticación, persistencia y RPC pública). La migración SQL incluida prepara las tablas y la función transaccional para crear reservas públicas; la interfaz todavía no está conectada a esa base de datos.

La reserva pública usa el mismo almacenamiento local de la demo, por lo que para probarla en esta etapa debe abrirse desde el mismo navegador donde está el panel.

## Tecnologías
- Next.js App Router + React + TypeScript
- Tailwind CSS v4
- Supabase SSR / PostgreSQL (cliente y esquema preparados para la siguiente etapa)
- Lucide React

## Requisitos e instalación
- Node.js 20.9+ (recomendado Node 22 LTS)
- npm

```bash
npm install
cp .env.example .env.local
npm run dev
```
Abre http://localhost:3000.

## Rutas
- `/` — presentación de FM Digital Growth.
- `/dashboard` — agenda diaria y semanal.
- `/dashboard/servicios` — servicios, duración y precio.
- `/dashboard/horarios` — jornada semanal, bloqueos y datos del negocio.
- `/dashboard/clientes` — datos básicos e historial de reservas por cliente.
- `/reservar/estudio-central` — formulario público de prueba (slug configurable desde datos del negocio en el siguiente paso).

## Próximo paso técnico
1. Crear el proyecto Supabase y configurar las variables de entorno.
2. Aplicar `supabase/migrations/0001_agendaflow_schema.sql`.
3. Conectar autenticación sencilla del dueño y persistencia de agenda.
4. Conectar el formulario público a `create_public_appointment` y consultar disponibilidad desde la base de datos.

No publiques esta versión como servicio real hasta completar la conexión con Supabase y las pruebas de seguridad. No expongas claves `service_role` en el navegador.
