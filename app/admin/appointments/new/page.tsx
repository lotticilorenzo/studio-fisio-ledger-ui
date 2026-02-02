"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabaseClient";

type OperatorRow = { id: string; display_name: string; commission_rate: number };
type ServiceRow = { id: string; name: string; default_price_cents: number };

export default function NewAppointmentPage() {
  const router = useRouter();
  const [operators, setOperators] = useState<OperatorRow[]>([]);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [operatorServices, setOperatorServices] = useState<{ operator_id: string, service_id: string }[]>([]);

  // Restored State Variables
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [minDate, setMinDate] = useState("");

  const [operatorId, setOperatorId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [startsAt, setStartsAt] = useState(""); // datetime-local
  const [status, setStatus] = useState<"scheduled" | "completed" | "cancelled" | "no_show">("scheduled");
  const [patientName, setPatientName] = useState("");
  const [patientEmail, setPatientEmail] = useState("");
  const [patientPhone, setPatientPhone] = useState("");
  const [grossEur, setGrossEur] = useState("0.00");
  const [notes, setNotes] = useState("");
  const [marketingConsent, setMarketingConsent] = useState(false);

  useEffect(() => {
    (async () => {
      setError(null);

      const { data: opData, error: opErr } = await supabase
        .from("operators")
        .select("id,display_name,commission_rate")
        .order("display_name", { ascending: true });

      const { data: srvData, error: srvErr } = await supabase
        .from("services")
        .select("id,name,default_price_cents")
        .order("name", { ascending: true });

      const { data: opSrvData, error: opSrvErr } = await supabase
        .from("operator_services")
        .select("operator_id, service_id");

      if (opErr) return setError(opErr.message);
      if (srvErr) return setError(srvErr.message);
      if (opSrvErr) console.error("Error fetching operator services:", opSrvErr); // Non-blocking

      setOperators((opData ?? []) as OperatorRow[]);
      setServices((srvData ?? []) as ServiceRow[]);
      setOperatorServices((opSrvData ?? []) as { operator_id: string, service_id: string }[]);

      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, '0');
      const localIso = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
      setMinDate(localIso);
    })();
  }, []);

  // Filter services based on selected operator
  const availableServices = useMemo(() => {
    if (!operatorId) return [];

    // Safety check: Operator ID must be valid
    if (!operators.find(o => o.id === operatorId)) return [];

    const allowedServiceIds = operatorServices
      .filter(os => os.operator_id === operatorId)
      .map(os => os.service_id);

    // If operator has no specific services assigned (legacy or catch-all), maybe show all?
    // Requirement says: "se mette lei stessa può leggere solamente i servizi [assegnati]".
    // If table is empty, this returns empty. This enforces strict assignment.
    if (allowedServiceIds.length === 0) return [];

    return services.filter(s => allowedServiceIds.includes(s.id));
  }, [services, operatorServices, operatorId, operators]);

  // autopopola prezzo quando scegli servizio -> Spostato in onChange
  // useEffect removed to avoid cascading render

  const selectedOperator = useMemo(
    () => operators.find((o) => o.id === operatorId) ?? null,
    [operators, operatorId]
  );

  const commissionPreview = useMemo(() => {
    const eur = Number(grossEur.replace(",", "."));
    const rate = selectedOperator?.commission_rate ?? 0;
    const comm = eur * rate;
    return {
      rate,
      comm: isFinite(comm) ? comm : 0,
      net: isFinite(eur - comm) ? eur - comm : 0,
    };
  }, [grossEur, selectedOperator]);

  const submit = async () => {
    setError(null);
    setOk(null);

    if (!operatorId) return setError("Seleziona un operatore.");
    if (!patientName.trim()) return setError("Inserisci il nome del paziente.");
    if (!startsAt) return setError("Seleziona data e ora.");
    if (!grossEur) return setError("Inserisci importo.");

    const eur = Number(grossEur.replace(",", "."));
    if (!isFinite(eur) || eur <= 0) return setError("Importo non valido.");

    const gross_amount_cents = Math.round(eur * 100);

    // datetime-local -> ISO
    const iso = startsAt.length === 16 ? `${startsAt}:00` : startsAt;
    const starts_at = new Date(iso).toISOString();

    // Usa RPC server-side per calcolo commissioni
    const { error } = await supabase.rpc('admin_create_appointment', {
      p_operator_id: operatorId,
      p_service_id: serviceId || null,
      p_patient_name: patientName.trim() || null,
      p_starts_at: starts_at,
      p_status: status,
      p_gross_amount_cents: gross_amount_cents,
      p_notes: notes || null,
      p_marketing_consent: marketingConsent,
      p_patient_email: patientEmail.trim() || null,
      p_patient_phone: patientPhone.trim() || null,
    });

    if (error) return setError(error.message);

    // Redirect alla lista appuntamenti
    router.push('/admin/appointments');
  };

  // No inline styles needed - using global design system classes

  return (
    <div className="app-content container">
      <div className="page-header">
        <h1 className="page-title">Nuovo appuntamento</h1>
        <button
          onClick={() => router.push('/admin/appointments')}
          className="btn btn-secondary"
        >
          ← Indietro
        </button>
      </div>

      {error && <div className="error-box mb-4">⚠️ {error}</div>}
      {ok && <div className="success-box mb-4">✅ {ok}</div>}

      <div className="card card-body">

        <div className="form-group">
          <label className="form-label">Operatore</label>
          <select
            className="form-input form-select"
            value={operatorId}
            onChange={(e) => setOperatorId(e.target.value)}
          >
            <option value="">Seleziona un operatore...</option>
            {operators.map((o) => (
              <option key={o.id} value={o.id}>
                {o.display_name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Servizio</label>
          <select
            className="form-input form-select"
            value={serviceId}
            onChange={(e) => {
              const val = e.target.value;
              setServiceId(val);
              const s = services.find((x) => x.id === val);
              if (s) {
                setGrossEur((s.default_price_cents / 100).toFixed(2));
              }
            }}
          >
            <option value="">(opzionale)</option>
            {availableServices.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>


        <div className="form-group">
          <label className="form-label">Paziente <span className="text-red-500">*</span></label>
          <input
            className="form-input"
            type="text"
            placeholder="Es. Mario Rossi"
            value={patientName}
            onChange={(e) => setPatientName(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="form-group">
            <label className="form-label">Email Paziente (opzionale)</label>
            <input
              className="form-input"
              type="email"
              placeholder="email@esempio.com"
              value={patientEmail}
              onChange={(e) => setPatientEmail(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Telefono Paziente (opzionale)</label>
            <input
              className="form-input"
              type="tel"
              placeholder="+39 333 1234567"
              value={patientPhone}
              onChange={(e) => setPatientPhone(e.target.value)}
            />
          </div>
        </div>

        <div className="form-group flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
          <input
            type="checkbox"
            id="marketingConsent"
            checked={marketingConsent}
            onChange={(e) => setMarketingConsent(e.target.checked)}
            className="form-checkbox"
          />
          <label htmlFor="marketingConsent" className="text-sm text-slate-600 cursor-pointer select-none">
            Consenso comunicazioni marketing (email/SMS)
          </label>
        </div>

        <div className="form-group">
          <label className="form-label">Data e ora</label>
          <input
            className="form-input"
            type="datetime-local"
            min={minDate}
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="form-group">
            <label className="form-label">Stato</label>
            <select
              className="form-input form-select"
              value={status}
              onChange={(e) => setStatus(e.target.value as "scheduled" | "completed" | "cancelled" | "no_show")}
            >
              <option value="scheduled">Programmato</option>
              <option value="completed">Completato</option>
              <option value="no_show">Non presentato</option>
              <option value="cancelled">Disdetto</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Importo (€)</label>
            <input
              className="form-input"
              value={grossEur}
              onChange={(e) => setGrossEur(e.target.value)}
              inputMode="decimal"
            />
          </div>
        </div>

        <div className="bg-slate-50 p-4 rounded-lg mb-4 text-sm text-slate-600 border border-slate-200">
          <div className="flex justify-between mb-1">
            <span>Commissione:</span>
            <span className="font-semibold text-slate-900">{(commissionPreview.rate * 100).toFixed(0)}%</span>
          </div>
          <div className="flex justify-between mb-1">
            <span>Commissione €:</span>
            <span className="font-semibold text-slate-900">{commissionPreview.comm.toFixed(2)}</span>
          </div>
          <div className="flex justify-between pt-2 mt-2 border-t border-slate-200 text-slate-900">
            <span>Netto operatore:</span>
            <span className="font-bold">€ {commissionPreview.net.toFixed(2)}</span>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Note (opzionale)</label>
          <textarea
            className="form-input min-h-[80px]"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Aggiungi note..."
          />
        </div>

        <button
          onClick={submit}
          className="btn btn-primary w-full mt-2"
        >
          ✓ Salva Appuntamento
        </button>
      </div>
    </div>
  );
}
