'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { humanError } from '@/lib/humanError';
import { LoadingState, Spinner } from '@/components/ui/Loading';
import { eur } from '@/lib/format';

interface RevenueTrend {
    month: string;
    year_month: string;
    revenue_cents: number;
    appointment_count: number;
}

interface ServiceMix {
    service_name: string;
    count: number;
    revenue_cents: number;
    percentage_count: number;
}

interface PatientStats {
    total_patients: number;
    new_patients: number;
}

export default function AdminStatsPage() {
    const [trend, setTrend] = useState<RevenueTrend[]>([]);
    const [mix, setMix] = useState<ServiceMix[]>([]);
    const [patients, setPatients] = useState<PatientStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function loadStats() {
            setLoading(true);
            setError(null);

            // Fetch Trend
            const trendRes = await supabase.rpc('admin_get_revenue_trend');

            // Fetch Mix (Last 90 days default)
            const today = new Date();
            const ninetyDaysAgo = new Date();
            ninetyDaysAgo.setDate(today.getDate() - 90);

            const mixRes = await supabase.rpc('admin_get_service_mix', {
                p_start_date: ninetyDaysAgo.toISOString(),
                p_end_date: today.toISOString()
            });

            // Fetch Patients
            const patientsRes = await supabase.rpc('admin_get_patient_stats', {
                p_start_date: ninetyDaysAgo.toISOString(),
                p_end_date: today.toISOString()
            });

            if (trendRes.error || mixRes.error || patientsRes.error) {
                const msg = trendRes.error?.message || mixRes.error?.message || patientsRes.error?.message;
                setError(humanError(msg || 'Errore neli caricamento statistiche'));
            } else {
                setTrend(trendRes.data || []);
                setMix(mixRes.data || []);
                setPatients(patientsRes.data?.[0] || null);
            }
            setLoading(false);
        }

        loadStats();
    }, []);

    // Calculate max value for charts scaling
    const maxRevenue = Math.max(...trend.map(t => t.revenue_cents), 1);

    if (loading) return <div className="p-8"><LoadingState /></div>;

    return (
        <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-8">
            <h1 className="text-2xl font-bold text-slate-900 font-[Poppins] mb-4">Statistiche & Analisi</h1>

            {error && (
                <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg">
                    ⚠️ {error}
                </div>
            )}

            {/* 1. REVENUE TREND CHART */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-800 mb-6 flex items-center gap-2">
                    📈 Andamento Fatturato <span className="text-xs font-normal text-slate-400 bg-slate-100 px-2 py-1 rounded-full">Ultimi 12 mesi</span>
                </h2>

                <div className="h-64 flex items-end gap-2 md:gap-4 w-full">
                    {trend.map((t) => {
                        // Max 80% height to leave room for label
                        const heightPercent = Math.max((t.revenue_cents / maxRevenue) * 80, 2);

                        // Localize month
                        const date = new Date(t.year_month + '-01');
                        const monthName = date.toLocaleString('it-IT', { month: 'short' });

                        return (
                            <div key={t.year_month} className="flex-1 h-full flex flex-col justify-end items-center group relative">
                                {/* Tooltip */}
                                <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-xs py-1 px-2 rounded pointer-events-none whitespace-nowrap z-10">
                                    {eur(t.revenue_cents)} ({t.appointment_count} appt)
                                </div>

                                {/* Bar */}
                                <div
                                    className="w-full bg-indigo-100 rounded-t-md relative hover:bg-indigo-200 transition-all cursor-pointer overflow-hidden"
                                    style={{ height: `${heightPercent}%` }}
                                >
                                    <div
                                        className="absolute bottom-0 left-0 w-full bg-indigo-500 opacity-80"
                                        style={{ height: '100%' }}
                                    ></div>
                                </div>

                                {/* Label */}
                                <span className="text-xs text-slate-500 mt-2 font-medium capitalize">{monthName}</span>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 2. SERVICES MIX */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                        🍩 Servizi Più Richiesti <span className="text-xs font-normal text-slate-400 bg-slate-100 px-2 py-1 rounded-full">90 gg</span>
                    </h2>

                    <div className="space-y-4">
                        {mix.map((item, idx) => (
                            <div key={idx}>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="font-medium text-slate-700">{item.service_name}</span>
                                    <span className="text-slate-500">{item.count} appt ({item.percentage_count}%)</span>
                                </div>
                                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                                    <div
                                        className="bg-amber-400 h-2.5 rounded-full"
                                        style={{ width: `${item.percentage_count}%` }}
                                    ></div>
                                </div>
                            </div>
                        ))}
                        {mix.length === 0 && <p className="text-slate-400 text-sm italic">Nessun dato disponibile.</p>}
                    </div>
                </div>

                {/* 3. PATIENT RETENTION */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                        👥 Fidelizzazione Pazienti <span className="text-xs font-normal text-slate-400 bg-slate-100 px-2 py-1 rounded-full">90 gg</span>
                    </h2>

                    {patients && patients.total_patients > 0 ? (
                        <div className="flex flex-col items-center justify-center py-4">
                            <div className="relative w-40 h-40">
                                <svg className="w-full h-full" viewBox="0 0 36 36">
                                    <path
                                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                        fill="none"
                                        stroke="#f1f5f9"
                                        strokeWidth="3.8"
                                    />
                                    <path
                                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                        fill="none"
                                        stroke="#10b981"
                                        strokeWidth="3.8"
                                        strokeDasharray={`${(patients.new_patients / patients.total_patients) * 100}, 100`}
                                        className="animate-[spin_1s_ease-out_reverse]"
                                    />
                                </svg>
                                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
                                    <span className="text-3xl font-bold text-emerald-600">
                                        {Math.round((patients.new_patients / patients.total_patients) * 100)}%
                                    </span>
                                    <span className="block text-xs text-slate-400 font-medium">NUOVI</span>
                                </div>
                            </div>

                            <div className="mt-6 flex justify-around w-full text-center">
                                <div>
                                    <div className="text-2xl font-bold text-slate-800">{patients.new_patients}</div>
                                    <div className="text-xs text-slate-500 uppercase tracking-wide">Nuovi</div>
                                </div>
                                <div>
                                    <div className="text-2xl font-bold text-slate-800">{patients.total_patients - patients.new_patients}</div>
                                    <div className="text-xs text-slate-500 uppercase tracking-wide">Di Ritorno</div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <p className="text-slate-400 text-sm italic">Dati non sufficienti nel periodo.</p>
                    )}
                </div>
            </div>
        </div>
    );
}
