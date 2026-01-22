'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { humanError } from '@/lib/humanError';
import { LoadingState, Spinner } from '@/components/ui/Loading';

type Service = { id: string; name: string };

export default function OpNewAppointmentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [minDate, setMinDate] = useState('');

  const [startsAt, setStartsAt] = useState<string>(() => {
    const d = new Date(Date.now() + 60 * 60 * 1000);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });

  const [serviceId, setServiceId] = useState<string>('');
  const [patientName, setPatientName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [grossEuro, setGrossEuro] = useState<string>('80');
  const [notes, setNotes] = useState<string>('');
  const [marketingConsent, setMarketingConsent] = useState(false);

  const grossCents = useMemo(() => {
    const n = Number(String(grossEuro).replace(',', '.'));
    return Number.isFinite(n) ? Math.round(n * 100) : 0;
  }, [grossEuro]);

  const selectedService = services.find(s => s.id === serviceId);
  const isAltro = selectedService?.name?.toLowerCase().includes('altro') ?? false;

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        setErr(null);
        const { data, error } = await supabase.rpc('get_my_services_op');
        if (!isMounted) return;

        if (error) {
          setErr(humanError(error.message));
        } else {
          setServices((data ?? []) as Service[]);
        }
      } catch (e: any) {
        if (isMounted) setErr("Errore di connessione al server.");
      } finally {
        if (isMounted) setServicesLoading(false);
      }

      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, '0');
      const localIso = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
      if (isMounted) setMinDate(localIso);
    })();

    return () => { isMounted = false; };
  }, []);

  async function save() {
    setLoading(true);
    setErr(null);

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
    if (isAltro && !notes.trim()) {
      setErr('Per il servizio "Altro" è obbligatorio specificare nelle note.');
      setLoading(false);
      return;
    }
    if (grossCents <= 0) {
      setErr('Inserisci un importo valido.');
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.rpc('op_create_appointment', {
        p_starts_at: new Date(startsAt).toISOString(),
        p_service_id: serviceId,
        p_patient_name: patientName.trim(),
        p_gross_amount_cents: grossCents,
        p_notes: notes || null,
        p_marketing_consent: marketingConsent,
        p_email: email.trim() || null,
        p_phone: phone.trim() || null,
      });

      if (error) {
        if (error.message.includes('notes_required_for_altro')) {
          setErr('Per il servizio "Altro" è obbligatorio specificare nelle note.');
        } else if (error.message.includes('service_not_assigned')) {
          setErr('Questo servizio non è assegnato al tuo profilo.');
        } else {
          setErr(humanError(error.message));
        }
        setLoading(false);
        return;
      }

      router.replace('/op/appointments');
    } catch (e) {
      setErr("Errore durante il salvataggio. Riprova.");
      setLoading(false);
    }
  }

  if (servicesLoading) return <div className="p-4"><LoadingState /></div>;

  return (
    <div className="p-4 md:p-6 space-y-6 pb-24 max-w-md mx-auto">
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold text-slate-900 font-[Poppins]">Nuovo Appuntamento</h1>
        <button onClick={() => router.back()} className="text-slate-400 hover:text-slate-900 text-sm font-medium">← Indietro</button>
      </header>

      {err && (
        <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-100 text-sm animate-in fade-in slide-in-from-top-1">
          ⚠️ {err}
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-5">
        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">📅 Data e ora</label>
          <input
            type="datetime-local"
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-none transition-all font-medium text-slate-700"
            min={minDate}
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">🏷️ Servizio</label>
          <select
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-none transition-all font-medium text-slate-700 appearance-none bg-no-repeat bg-[right_1rem_center]"
            value={serviceId}
            onChange={(e) => setServiceId(e.target.value)}
          >
            <option value="">Seleziona un servizio...</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">👤 Nome paziente</label>
          <input
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-none transition-all font-medium text-slate-700 placeholder:text-slate-300"
            value={patientName}
            onChange={(e) => setPatientName(e.target.value)}
            placeholder="Es. Maria Rossi"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">📧 Email (opz.)</label>
            <input
              type="email"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-none transition-all text-sm text-slate-700"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="maria@ex.com"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">📱 Telefono (opz.)</label>
            <input
              type="tel"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-none transition-all text-sm text-slate-700"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="333 1234567"
            />
          </div>
        </div>

        <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
          <input
            type="checkbox"
            id="marketingConsentOp"
            className="mt-1 w-5 h-5 rounded border-slate-300 text-amber-500 focus:ring-amber-400"
            checked={marketingConsent}
            onChange={(e) => setMarketingConsent(e.target.checked)}
          />
          <label htmlFor="marketingConsentOp" className="text-xs text-slate-600 leading-relaxed cursor-pointer">
            Consenso comunicazioni marketing (email/WhatsApp).
            <span className="block text-[10px] text-slate-400 mt-1 italic">(Non serve per i promemoria automatici)</span>
          </label>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">💰 Importo (€)</label>
          <input
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-none transition-all font-bold text-slate-700"
            value={grossEuro}
            onChange={(e) => setGrossEuro(e.target.value)}
            inputMode="decimal"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">
            📝 Note {isAltro && <span className="text-red-500">*</span>}
          </label>
          <textarea
            className={`w-full px-4 py-3 bg-white border rounded-xl focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-none transition-all text-slate-700 min-h-[100px] ${isAltro && !notes.trim() ? 'border-amber-300 bg-amber-50/20' : 'border-slate-200'}`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={isAltro ? "Specifica il tipo di servizio qui..." : "Aggiungi note facoltative..."}
          />
        </div>

        <button
          onClick={save}
          disabled={loading}
          className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-slate-800 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? <Spinner size="sm" /> : '✓ Conferma Appuntamento'}
        </button>
      </div>
    </div>
  );
}
