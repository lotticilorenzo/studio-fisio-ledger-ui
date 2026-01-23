'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { humanError } from '@/lib/humanError';
import { LoadingState } from '@/components/ui/Loading';
import { eur } from '@/lib/format';
import { PushSubscriptionManager } from '@/components/PushSubscriptionManager';
import { KpiCard, KpiGrid } from '@/components/ui/KpiCard';

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
                    setError(humanError(msg || 'Errore nel caricamento'));
                } else {
                    // Normalize data types
                    setTrend((trendRes.data || []).map((t: any) => ({
                        ...t,
                        earnings_cents: Number(t.earnings_cents || 0),
                        appointment_count: Number(t.appointment_count || 0)
                    })));

                    setMix((mixRes.data || []).map((m: any) => ({
                        ...m,
                        count: Number(m.count || 0),
                        earnings_cents: Number(m.earnings_cents || 0),
                        percentage_count: Number(m.percentage_count || 0)
                    })));

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

            {/* KPI Grid using shared component */}
            <KpiGrid>
                <KpiCard
                    value={eur(currentMonthData?.earnings_cents || 0)}
                    label={`Fatturato ${currentMonthData?.month || 'Corrente'}`}
                    highlight
                    icon="💰"
                />
                <KpiCard
                    value={currentMonthData?.appointment_count || 0}
                    label="Appuntamenti"
                    icon="📅"
                />
                <KpiCard
                    value={eur(avgPerSession)}
                    label="Media/Seduta"
                    icon="📊"
                />
                <KpiCard
                    value={weekly?.total_appointments || 0}
                    label="Ultimi 7gg"
                    icon="⚡"
                />
            </KpiGrid>

            {/* Earnings Trend - Premium Design */}
            <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-xl overflow-hidden relative">
                <div className="flex justify-between items-center mb-8 relative z-10">
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest flex items-center gap-2">
                        <span className="flex h-2 w-2 rounded-full bg-indigo-500 animate-pulse"></span>
                        Andamento 12 Mesi
                    </h3>
                </div>

                <div className="h-56 flex items-end gap-2 w-full relative z-10">
                    {trend.map((t, idx) => {
                        const isLast = idx === trend.length - 1;
                        const hasEarnings = t.earnings_cents > 0;
                        const heightPercent = hasEarnings
                            ? Math.max((t.earnings_cents / maxEarnings) * 100, 8)
                            : (t.appointment_count > 0 ? 15 : 4);

                        const date = new Date(t.year_month + '-01');
                        const monthName = date.toLocaleString('it-IT', { month: 'short' }).toUpperCase();
                        const val = t.earnings_cents;

                        return (
                            <div key={t.year_month} className="flex-1 h-full flex flex-col justify-end items-center group relative">
                                {/* Tooltip */}
                                <div className="absolute bottom-full mb-3 opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-200 bg-slate-900/95 backdrop-blur-sm text-white py-3 px-4 rounded-2xl pointer-events-none whitespace-nowrap z-50 shadow-2xl border border-white/10 text-center">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{monthName} {date.getFullYear()}</p>
                                    <p className="text-lg font-black text-indigo-300">{eur(val)}</p>
                                    <div className="w-full h-px bg-white/10 my-2"></div>
                                    <p className="text-[10px] text-slate-300 font-bold uppercase">{t.appointment_count} appuntamenti</p>
                                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 transform rotate-45"></div>
                                </div>

                                {/* Main Bar */}
                                <div className="w-full h-full flex items-end justify-center cursor-pointer px-[2px]">
                                    <div
                                        className={`w-full rounded-t-xl transition-all duration-700 ease-out relative ${!hasEarnings && t.appointment_count > 0 ? 'bg-slate-100' : ''}`}
                                        style={{
                                            height: `${heightPercent}%`,
                                            transitionDelay: `${idx * 30}ms`
                                        }}
                                    >
                                        <div
                                            className={`w-full h-full rounded-t-xl overflow-hidden shadow-sm ${hasEarnings
                                                ? 'bg-indigo-500 shadow-[0_4px_20px_rgba(99,102,241,0.4)]'
                                                : (t.appointment_count > 0 ? 'bg-slate-100 border-2 border-dashed border-slate-300' : 'bg-slate-50')
                                                }`}
                                        >
                                            {/* Lighting effect */}
                                            {hasEarnings && (
                                                <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/30 to-transparent opacity-60"></div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <span className={`text-[9px] mt-3 font-black uppercase tracking-wider transition-colors duration-200 ${isLast ? 'text-indigo-600' : 'text-slate-300 group-hover:text-slate-500'
                                    }`}>
                                    {monthName.charAt(0)}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Top Services - Premium Design */}
            <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-xl overflow-hidden">
                <div className="flex justify-between items-center mb-8">
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest">🏆 Top Servizi</h3>
                    <span className="text-[10px] font-black text-slate-400 bg-slate-50 px-3 py-1 rounded-full ring-1 ring-slate-100 uppercase">90 GG</span>
                </div>

                <div className="space-y-6">
                    {mix.map((item, idx) => {
                        const gradients = [
                            'from-indigo-500 to-purple-500',
                            'from-purple-500 to-pink-500',
                            'from-pink-500 to-rose-500',
                            'from-orange-400 to-amber-500',
                            'from-teal-400 to-emerald-500'
                        ];
                        const grad = gradients[idx % gradients.length];

                        return (
                            <div key={idx} className="group cursor-default">
                                <div className="flex justify-between items-end mb-2">
                                    <div>
                                        <p className="text-xs font-black text-slate-700 uppercase tracking-tight mb-1">{item.service_name}</p>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded text-xs">{item.count}</span>
                                        </div>
                                    </div>
                                    <p className="text-sm font-black text-slate-900 font-mono tracking-tight">{eur(item.earnings_cents)}</p>
                                </div>

                                <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden shadow-inner">
                                    <div
                                        className={`bg-gradient-to-r ${grad} h-full rounded-full transition-all duration-1000 ease-out group-hover:brightness-110 shadow-lg`}
                                        style={{ width: `${item.percentage_count}%` }}
                                    >
                                        <div className="w-full h-full bg-gradient-to-b from-white/25 to-transparent"></div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {mix.length === 0 && (
                        <div className="py-12 flex flex-col items-center justify-center text-center">
                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                                <span className="text-3xl grayscale opacity-50">📊</span>
                            </div>
                            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Nessun dato disponibile</p>
                        </div>
                    )}
                </div>
            </div>

            <footer className="text-center pt-8 pb-4">
                <p className="text-[10px] text-slate-300 font-black uppercase tracking-[0.2em]">
                    Studio FISYO • Dashboard
                </p>
            </footer>
        </div>
    );
}
