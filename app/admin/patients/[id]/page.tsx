'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { humanError } from '@/lib/humanError';
import { LoadingState } from '@/components/ui/Loading';
import { eur } from '@/lib/format';

interface PatientDetails {
    p_id: string;
    p_full_name: string;
    p_email: string | null;
    p_phone: string | null;
    p_total_revenue: number; // cents
    p_total_appointments: number;
    p_last_visit: string | null;
}

interface HistoryItem {
    h_id: string;
    h_starts_at: string;
    h_service_name: string;
    h_operator_name: string;
    h_status: string;
    h_gross_amount_cents: number;
    h_notes: string | null;
}

export default function AdminPatientDetailPage() {
    const params = useParams();
    const router = useRouter();
    const patientId = params?.id as string;

    const [details, setDetails] = useState<PatientDetails | null>(null);
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!patientId) return;

        async function loadData() {
            setLoading(true);
            setError(null);

            // 1. Load Details
            const detailsPromise = supabase.rpc('admin_get_patient_details', { p_patient_id: patientId });
            // 2. Load History
            const historyPromise = supabase.rpc('admin_get_patient_history', { p_patient_id: patientId });

            const [detailsRes, historyRes] = await Promise.all([detailsPromise, historyPromise]);

            if (detailsRes.error) {
                setError(humanError(detailsRes.error.message));
                setLoading(false);
                return;
            }

            if (historyRes.error) {
                console.warn("Error loading history:", historyRes.error);
                // Non-blocking error for history
            }

            // Handle potential empty details (shouldn't happen if ID is valid)
            if (!detailsRes.data || detailsRes.data.length === 0) {
                setError('Paziente non trovato.');
            } else {
                setDetails(detailsRes.data[0]);
                setHistory(historyRes.data || []);
            }
            setLoading(false);
        }

        loadData();
    }, [patientId]);

    // Styles
    const cardStyle = "bg-white p-4 rounded-xl border border-slate-200 shadow-sm";
    const labelStyle = "text-xs font-bold text-slate-400 uppercase tracking-wider mb-1";
    const valueStyle = "text-lg font-bold text-slate-900";

    if (loading) return <div className="p-6"><LoadingState /></div>;
    if (error) return (
        <div className="p-6">
            <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-100 text-sm mb-4">
                ⚠️ {error}
            </div>
            <button onClick={() => router.back()} className="text-slate-500 underline">← Torna alla lista</button>
        </div>
    );
    if (!details) return null;

    return (
        <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto pb-24">
            {/* Creates space for fixed header if present, or just top padding */}

            {/* Header */}
            <div className="flex items-center gap-4">
                <button
                    onClick={() => router.back()}
                    className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors"
                >
                    ← Indietro
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 font-[Poppins]">{details.p_full_name}</h1>
                    <div className="flex gap-4 text-xs text-slate-500 mt-1">
                        {details.p_email && <span>📧 {details.p_email}</span>}
                        {details.p_phone && <span>📱 {details.p_phone}</span>}
                        {/* Fallback if no contact info */}
                        {!details.p_email && !details.p_phone && <span className="italic">Nessun contatto registrato</span>}
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className={cardStyle}>
                    <p className={labelStyle}>Spesa Totale</p>
                    <p className={`${valueStyle} text-emerald-600`}>{eur(details.p_total_revenue)}</p>
                </div>
                <div className={cardStyle}>
                    <p className={labelStyle}>Appuntamenti</p>
                    <p className={valueStyle}>{details.p_total_appointments}</p>
                </div>
                <div className={`${cardStyle} col-span-2 md:col-span-1`}>
                    <p className={labelStyle}>Ultima Visita</p>
                    <p className={valueStyle}>
                        {details.p_last_visit
                            ? new Date(details.p_last_visit).toLocaleDateString('it-IT')
                            : 'Mai'}
                    </p>
                </div>
            </div>

            {/* History Section */}
            <div>
                <h2 className="text-lg font-bold text-slate-800 mb-4 font-[Poppins]">Storico Appuntamenti</h2>

                <div className="space-y-3">
                    {history.map(item => (
                        <div key={item.h_id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:border-indigo-300 transition-colors">
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <p className="font-bold text-slate-800">{item.h_service_name}</p>
                                    <p className="text-xs text-slate-500">
                                        con <span className="font-semibold text-indigo-600">{item.h_operator_name || 'Sconosciuto'}</span>
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold text-slate-900">{eur(item.h_gross_amount_cents)}</p>
                                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${item.h_status === 'completed' ? 'bg-emerald-50 text-emerald-600' :
                                            item.h_status === 'cancelled' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
                                        }`}>
                                        {item.h_status === 'completed' ? 'Completato' :
                                            item.h_status === 'cancelled' ? 'Cancellato' : 'Programmato'}
                                    </span>
                                </div>
                            </div>

                            <div className="flex justify-between items-end mt-2">
                                <p className="text-xs text-slate-400 font-medium">
                                    {new Date(item.h_starts_at).toLocaleDateString('it-IT', {
                                        weekday: 'short', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
                                    })}
                                </p>
                            </div>

                            {item.h_notes && (
                                <div className="mt-3 bg-slate-50 p-3 rounded-lg border border-slate-100 text-sm text-slate-600 italic">
                                    {item.h_notes}
                                </div>
                            )}
                        </div>
                    ))}

                    {history.length === 0 && (
                        <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                            <p className="text-slate-400 italic">Nessun appuntamento nello storico.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
