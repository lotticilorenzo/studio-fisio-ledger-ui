'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { humanError } from '@/lib/humanError';

type OperatorRow = { id: string; display_name: string; commission_rate: number };
type ServiceRow = { id: string; name: string };

export default function AdminEditAppointmentPage() {
    const router = useRouter();
    const params = useParams<{ id: string }>();
    const id = params?.id;

    const [operators, setOperators] = useState<OperatorRow[]>([]);
    const [services, setServices] = useState<ServiceRow[]>([]);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    // form
    const [operatorId, setOperatorId] = useState<string>('');
    const [serviceId, setServiceId] = useState<string>('');
    const [patientName, setPatientName] = useState<string>('');
    const [startsAt, setStartsAt] = useState<string>('');
    const [status, setStatus] = useState<'scheduled' | 'completed' | 'cancelled' | 'no_show'>('scheduled');
    const [grossEuro, setGrossEuro] = useState<string>('0');
    const [notes, setNotes] = useState<string>('');
    const [marketingConsent, setMarketingConsent] = useState(false);

    const grossCents = useMemo(() => {
        const n = Number(String(grossEuro).replace(',', '.'));
        return Number.isFinite(n) ? Math.round(n * 100) : 0;
    }, [grossEuro]);

    const selectedOperator = useMemo(
        () => operators.find((o) => o.id === operatorId) ?? null,
        [operators, operatorId]
    );

    const commissionPreview = useMemo(() => {
        const eur = Number(grossEuro.replace(',', '.'));
        const rate = selectedOperator?.commission_rate ?? 0;
        const comm = eur * rate;
        return {
            rate,
            comm: isFinite(comm) ? comm : 0,
            net: isFinite(eur - comm) ? eur - comm : 0,
        };
    }, [grossEuro, selectedOperator]);

    function toDatetimeLocal(iso: string) {
        const d = new Date(iso);
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
            d.getHours()
        )}:${pad(d.getMinutes())}`;
    }

    useEffect(() => {
        (async () => {
            setErr(null);

            // Carica operatori e servizi
            const [opRes, srvRes] = await Promise.all([
                supabase.from('operators').select('id,display_name,commission_rate').order('display_name'),
                supabase.from('services').select('id,name').order('name'),
            ]);

            if (opRes.error) {
                setErr(humanError(opRes.error.message));
                setLoading(false);
                return;
            }
            if (srvRes.error) {
                setErr(humanError(srvRes.error.message));
                setLoading(false);
                return;
            }

            setOperators((opRes.data ?? []) as OperatorRow[]);
            setServices((srvRes.data ?? []) as ServiceRow[]);

            // Carica appuntamento
            const { data, error } = await supabase.rpc('admin_get_appointment_by_id', { p_id: id });
            if (error) {
                setErr(humanError(error.message));
                setLoading(false);
                return;
            }

            const found = Array.isArray(data) && data.length > 0 ? data[0] : null;
            if (!found) {
                setErr('Appuntamento non trovato.');
                setLoading(false);
                return;
            }

            setOperatorId(found.operator_id ?? '');
            setServiceId(found.service_id ?? '');
            setPatientName(found.patient_name ?? '');
            setStartsAt(toDatetimeLocal(found.starts_at));
            setStatus(found.status ?? 'scheduled');
            setGrossEuro(((found.gross_amount_cents ?? 0) / 100).toFixed(2));
            setNotes(found.notes ?? '');
            setMarketingConsent(found.marketing_consent ?? false);

            setLoading(false);
        })();
    }, [id]);

    async function save() {
        setSaving(true);
        setErr(null);

        if (!operatorId) {
            setErr('Seleziona un operatore.');
            setSaving(false);
            return;
        }
        if (!startsAt) {
            setErr('Seleziona data e ora.');
            setSaving(false);
            return;
        }

        const iso = startsAt.length === 16 ? `${startsAt}:00` : startsAt;
        const starts_at = new Date(iso).toISOString();

        const { error } = await supabase.rpc('admin_update_appointment', {
            p_id: id,
            p_operator_id: operatorId,
            p_service_id: serviceId || null,
            p_patient_name: patientName.trim() || null,
            p_starts_at: starts_at,
            p_status: status,
            p_gross_amount_cents: grossCents,
            p_notes: notes || null,
            p_marketing_consent: marketingConsent,
        });

        if (error) {
            setErr(humanError(error.message));
            setSaving(false);
            return;
        }

        router.push('/admin/appointments');
    }

    if (loading) {
        return (
            <main className="p-6">
                <div className="animate-pulse">Caricamento...</div>
            </main>
        );
    }

    // No inline styles needed - using global design system classes

    return (
        <div className="app-content container">
            <div className="page-header">
                <h1 className="page-title">Modifica appuntamento</h1>
                <button
                    onClick={() => router.push('/admin/appointments')}
                    className="btn btn-secondary"
                >
                    ← Indietro
                </button>
            </div>

            {err && <div className="error-box mb-4">⚠️ {err}</div>}

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
                        onChange={(e) => setServiceId(e.target.value)}
                    >
                        <option value="">(opzionale)</option>
                        {services.map((s) => (
                            <option key={s.id} value={s.id}>
                                {s.name}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="form-group">
                    <label className="form-label">Paziente</label>
                    <input
                        className="form-input"
                        type="text"
                        placeholder="Es. Mario Rossi"
                        value={patientName}
                        onChange={(e) => setPatientName(e.target.value)}
                    />
                </div>

                <div className="form-group flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <input
                        type="checkbox"
                        id="marketingConsentEdit"
                        checked={marketingConsent}
                        onChange={(e) => setMarketingConsent(e.target.checked)}
                        className="form-checkbox"
                    />
                    <label htmlFor="marketingConsentEdit" className="text-sm text-slate-600 cursor-pointer select-none">
                        Consenso comunicazioni marketing (email/SMS)
                    </label>
                </div>

                <div className="form-group">
                    <label className="form-label">Data e ora</label>
                    <input
                        className="form-input"
                        type="datetime-local"
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
                            onChange={(e) => setStatus(e.target.value as 'scheduled' | 'completed' | 'cancelled' | 'no_show')}
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
                            value={grossEuro}
                            onChange={(e) => setGrossEuro(e.target.value)}
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
                    onClick={save}
                    disabled={saving}
                    className="btn btn-primary w-full mt-2 disabled:opacity-50"
                >
                    {saving ? 'Salvataggio...' : '✓ Salva Modifiche'}
                </button>
            </div>
        </div>
    );
}
