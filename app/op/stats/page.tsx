'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { humanError } from '@/lib/humanError';
import { LoadingState } from '@/components/ui/Loading';
import { eur } from '@/lib/format';
import { PushSubscriptionManager } from '@/components/PushSubscriptionManager';

interface EarningsTrend {
    month: string;
    year_month: string;
    earnings_cents: number;
    appointment_count: number;
}

interface ServiceMix {
    service_name: string;
    count: number;
    earnings_cents: number;
    percentage_count: number;
}

interface PatientStats {
    total_patients: number;
    new_patients: number;
}

interface WeeklySummary {
    total_earnings_cents: number;
    total_appointments: number;
}

export default function OperatorStatsPage() {
    const [trend, setTrend] = useState<EarningsTrend[]>([]);
    const [mix, setMix] = useState<ServiceMix[]>([]);
    const [patients, setPatients] = useState<PatientStats | null>(null);
    const [weekly, setWeekly] = useState<WeeklySummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function loadStats() {
            setLoading(true);
            setError(null);

            const today = new Date();
            const ninetyDaysAgo = new Date();
            ninetyDaysAgo.setDate(today.getDate() - 90);

            try {
                // Parallel fetching
                const [trendRes, mixRes, patientsRes, weeklyRes] = await Promise.all([
                    supabase.rpc('op_get_revenue_trend'),
                    supabase.rpc('op_get_service_mix', {
                        p_start_date: ninetyDaysAgo.toISOString(),
                        p_end_date: today.toISOString()
                    }),
                    supabase.rpc('op_get_patient_stats', {
                        p_start_date: ninetyDaysAgo.toISOString(),
                        p_end_date: today.toISOString()
                    }),
                    supabase.rpc('op_get_weekly_summary')
                ]);

                if (trendRes.error || mixRes.error || patientsRes.error || weeklyRes.error) {
                    const msg = trendRes.error?.message || mixRes.error?.message || patientsRes.error?.message || weeklyRes.error?.message;
                    setError(humanError(msg || 'Errore neli caricamento'));
                } else {
                    setTrend(trendRes.data || []);
                    setMix(mixRes.data || []);
                    setPatients(patientsRes.data?.[0] || null);
                    setWeekly(weeklyRes.data?.[0] || null);
                }
            } catch (err: any) {
                setError(humanError(err.message));
            } finally {
                setLoading(false);
            }
        }

        loadStats();
    }, []);

    const maxEarnings = Math.max(...trend.map(t => t.earnings_cents), 1);
    const currentMonthData = trend[trend.length - 1];

    // Derived metrics
    const avgPerSession = currentMonthData && currentMonthData.appointment_count > 0
        ? currentMonthData.earnings_cents / currentMonthData.appointment_count
        : 0;

    const returningPatients = (patients?.total_patients || 0) - (patients?.new_patients || 0);

    if (loading) return <div className="p-8"><LoadingState /></div>;

    return (
        <div className="p-4 md:p-6 max-w-md mx-auto space-y-6 pb-24">
            <header>
                <h1 className="text-2xl font-bold text-slate-900 font-[Poppins]">Le mie Statistiche</h1>
                <p className="text-sm text-slate-500">I tuoi traguardi in tempo reale</p>
            </header>

            <PushSubscriptionManager />

            {error && (
                <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-xl text-sm animate-pulse">
                    ⚠️ {error}
                </div>
            )}

            {/* Main Earnings Card (High contrast white) */}
            <div className="bg-white p-6 rounded-3xl shadow-md border border-slate-100 relative overflow-hidden ring-1 ring-slate-900/5">
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-yellow-200 to-orange-300 opacity-20 rounded-full -mr-12 -mt-12"></div>

                <div className="flex justify-between items-start mb-4">
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Bilancio {currentMonthData?.month || 'Mese'}</p>
                        <h2 className="text-4xl font-extrabold text-slate-900">{eur(currentMonthData?.earnings_cents || 0)}</h2>
                    </div>
                    <div className="bg-amber-50 text-amber-600 p-2 rounded-xl border border-amber-100 shadow-sm">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                </div>

                <div className="flex gap-4 pt-4 border-t border-slate-50">
                    <div className="flex-1">
                        <p className="text-[10px] text-slate-400 font-bold uppercase mb-0.5">Media / Seduta</p>
                        <p className="text-sm font-bold text-slate-700">{eur(avgPerSession)}</p>
                    </div>
                    <div className="flex-1 text-right">
                        <p className="text-[10px] text-slate-400 font-bold uppercase mb-0.5">Appuntamenti</p>
                        <p className="text-sm font-bold text-slate-700">{currentMonthData?.appointment_count || 0}</p>
                    </div>
                </div>
            </div>

            {/* Summary Grid */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm transition-all hover:shadow-md">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-blue-500 bg-blue-50 p-1.5 rounded-lg">⚡</span>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Ultimi 7 gg</p>
                    </div>
                    <p className="text-xl font-bold text-slate-900">{eur(weekly?.total_earnings_cents || 0)}</p>
                    <p className="text-[10px] text-slate-400 mt-1 font-medium">{weekly?.total_appointments || 0} appuntamenti</p>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm transition-all hover:shadow-md">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-emerald-500 bg-emerald-50 p-1.5 rounded-lg">🔁</span>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Ritorno</p>
                    </div>
                    <p className="text-xl font-bold text-slate-900">{returningPatients}</p>
                    <p className="text-[10px] text-slate-400 mt-1 font-medium">Pazienti storici</p>
                </div>
            </div>

            {/* Earnings Trend */}
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                <div className="flex justify-between items-center mb-8">
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-tight">📈 Andamento Guadagni</h3>
                    <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-full ring-1 ring-slate-100">12 MESI</span>
                </div>

                <div className="h-44 flex items-end gap-2 w-full">
                    {trend.map((t) => {
                        const heightPercent = Math.max((t.earnings_cents / maxEarnings) * 90, 4);
                        const date = new Date(t.year_month + '-01');
                        const monthName = date.toLocaleString('it-IT', { month: 'short' });

                        return (
                            <div key={t.year_month} className="flex-1 h-full flex flex-col justify-end items-center group relative">
                                <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white text-[10px] py-1 px-2 rounded-lg pointer-events-none whitespace-nowrap z-10 shadow-lg">
                                    {eur(t.earnings_cents)}
                                </div>
                                <div
                                    className="w-full bg-slate-100 rounded-full relative hover:bg-slate-200 transition-all cursor-pointer overflow-hidden p-0.5"
                                    style={{ height: `${heightPercent}%` }}
                                >
                                    <div
                                        className="w-full h-full bg-gradient-to-t from-indigo-500 to-indigo-400 rounded-full shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]"
                                    ></div>
                                </div>
                                <span className="text-[9px] text-slate-400 mt-2 font-bold uppercase">{monthName}</span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Top Services */}
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-tight">🍩 Top Servizi</h3>
                    <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-full ring-1 ring-slate-100">ULTIMI 90 GG</span>
                </div>

                <div className="space-y-5">
                    {mix.map((item, idx) => (
                        <div key={idx}>
                            <div className="flex justify-between items-center text-xs mb-2">
                                <span className="font-bold text-slate-700">{item.service_name}</span>
                                <span className="text-slate-500 font-mono bg-slate-50 px-2 py-0.5 rounded border border-slate-100">{item.count} appt</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden shadow-inner">
                                <div
                                    className="bg-gradient-to-r from-yellow-300 via-orange-400 to-orange-500 h-full rounded-full transition-all duration-700 ease-out"
                                    style={{ width: `${item.percentage_count}%` }}
                                ></div>
                            </div>
                            <div className="flex justify-between mt-1.5 text-[10px]">
                                <span className="text-slate-400 font-medium">{item.percentage_count}% del volume</span>
                                <span className="text-slate-900 font-bold">{eur(item.earnings_cents)}</span>
                            </div>
                        </div>
                    ))}
                    {mix.length === 0 && (
                        <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                            <p className="text-slate-400 text-xs italic">Nessun dato disponibile nel periodo.</p>
                        </div>
                    )}
                </div>
            </div>

            <footer className="text-center pt-2">
                <p className="text-[10px] text-slate-400 leading-relaxed font-medium">
                    Le statistiche includono appuntamenti "Completati" e "Programmati".<br />
                    I dati sono aggiornati in tempo reale.
                </p>
            </footer>
        </div>
    );
}
