import Link from 'next/link';

export default function PaymentResultPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#F5F7F4] p-5">
      <section className="panel w-full max-w-md p-8 text-center">
        <div className="brand-mark mx-auto mb-5">AF</div>
        <p className="eyebrow">Mercado Pago</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Estamos confirmando tu suscripción</h1>
        <p className="mt-3 text-sm leading-6 text-[#718087]">
          Mercado Pago está procesando la información. FlowAgenda habilitará tu cuenta cuando reciba y valide la confirmación del pago.
        </p>
        <p className="mt-4 text-xs text-[#718087]">
          Si tu agenda aún aparece pausada, espera unos segundos y vuelve a comprobar el acceso.
        </p>
        <Link href="/dashboard" className="btn-primary mt-6 w-full">Comprobar acceso</Link>
        <Link href="/cuenta-expirada" className="mt-4 inline-block text-xs text-[#718087] underline">Volver a suscripción</Link>
      </section>
    </main>
  );
}
