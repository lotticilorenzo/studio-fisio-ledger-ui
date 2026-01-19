'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { humanError } from '@/lib/humanError';

type Service = { id: string; name: string };

export default function OpNewAppointmentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [services, setServices] = useState<Service[]>([]);

  // form
  const [startsAt, setStartsAt] = useState<string>(() => {
    const d = new Date(Date.now() + 60 * 60 * 1000);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
      d.getHours()
    )}:${pad(d.getMinutes())}`;
  });

  const [serviceId, setServiceId] = useState<string>('');
  const [patientName, setPatientName] = useState<string>('');
  const [grossEuro, setGrossEuro] = useState<string>('80');
  const [notes, setNotes] = useState<string>('');

  const grossCents = useMemo(() => {
    const n = Number(String(grossEuro).replace(',', '.'));
    return Number.isFinite(n) ? Math.round(n * 100) : 0;
  }, [grossEuro]);

  useEffect(() => {
    (async () => {
      setErr(null);

      const { data: u } = await supabase.auth.getUser();
      if (!u?.user) {
        router.replace('/login');
        return;
      }

      // Carica solo i servizi dell'operatore corrente
      const { data, error } = await supabase.rpc('get_my_services_op');

      if (error) setErr(humanError(error.message));
      else setServices((data ?? []) as Service[]);
    })();
  }, [router]);


  async function save() {
    setLoading(true);
    setErr(null);

    const { data: u } = await supabase.auth.getUser();
    if (!u?.user) {
      router.replace('/login');
      return;
    }

    if (!patientName.trim()) {
      setErr('Inserisci almeno il nome del paziente.');
      setLoading(false);
      return;
    }
    if (!serviceId) {
      setErr('Seleziona un servizio.');
      setLoading(false);
      return;
    }
    if (grossCents <= 0) {
      setErr('Inserisci un importo valido.');
      setLoading(false);
      return;
    }
    // Validazione: data non può essere nel passato
    const appointmentDate = new Date(startsAt);
    if (appointmentDate < new Date()) {
      setErr('Non puoi creare un appuntamento nel passato.');
      setLoading(false);
      return;
    }

    // ✅ QUI: niente insert su patients dal frontend
    const { data, error } = await supabase.rpc('op_create_appointment', {
      p_service_id: serviceId,
      p_starts_at: new Date(startsAt).toISOString(),
      p_patient_full_name: patientName.trim(),
      p_gross_amount_cents: grossCents,
      p_notes: notes || null,
    });

    if (error) {
      setErr(humanError(error.message));
      setLoading(false);
      return;
    }

    // data = uuid dell'appuntamento
    router.replace('/op/appointments');
  }

  return (
    <main className="p-6 max-w-xl">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Nuovo appuntamento</h1>
        <button className="border rounded px-3 py-2" onClick={() => router.back()}>
          Indietro
        </button>
      </div>

      {err && (
        <div className="mt-4 border border-red-500 rounded p-3 text-red-200">
          Errore: {err}
        </div>
      )}

      <div className="mt-6 space-y-4">
        <div>
          <label className="block text-sm mb-1">Data e ora</label>
          <input
            type="datetime-local"
            className="w-full border rounded px-3 py-2 bg-transparent"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm mb-1">Servizio</label>
          <select
            className="w-full border rounded px-3 py-2 bg-transparent"
            value={serviceId}
            onChange={(e) => setServiceId(e.target.value)}
          >
            <option value="">Seleziona…</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm mb-1">Paziente (nome)</label>
          <input
            className="w-full border rounded px-3 py-2 bg-transparent"
            value={patientName}
            onChange={(e) => setPatientName(e.target.value)}
            placeholder="Es. Maria Rossi"
          />
        </div>

        <div>
          <label className="block text-sm mb-1">Importo lordo (€)</label>
          <input
            className="w-full border rounded px-3 py-2 bg-transparent"
            value={grossEuro}
            onChange={(e) => setGrossEuro(e.target.value)}
            inputMode="decimal"
            placeholder="80"
          />
        </div>

        <div>
          <label className="block text-sm mb-1">Note (opzionale)</label>
          <textarea
            className="w-full border rounded px-3 py-2 bg-transparent"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </div>

        <button
          onClick={save}
          disabled={loading}
          className="w-full border rounded px-3 py-2"
        >
          {loading ? 'Salvo…' : 'Salva appuntamento'}
        </button>
      </div>
    </main>
  );
}
