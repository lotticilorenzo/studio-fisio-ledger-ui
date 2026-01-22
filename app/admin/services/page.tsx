'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { humanError } from '@/lib/humanError';
import { EmptyState, emptyStates } from '@/components/EmptyState';
import { LoadingState, Spinner } from '@/components/ui/Loading';

interface Service {
    id: string;
    name: string;
    duration_minutes: number;
    default_price_cents: number;
    created_at: string;
    assigned_operators: string[];
}

export default function AdminServicesPage() {
    const [services, setServices] = useState<Service[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [showForm, setShowForm] = useState(false);
    const [newName, setNewName] = useState('');
    const [newDuration, setNewDuration] = useState(60);
    const [newPrice, setNewPrice] = useState('');
    const [saving, setSaving] = useState(false);

    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [editDuration, setEditDuration] = useState(60);
    const [editPrice, setEditPrice] = useState('');

    const loadServices = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase.rpc('admin_get_services');

        if (error) {
            setError(humanError(error.message));
        } else {
            setServices(data || []);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        loadServices();
    }, [loadServices]);

    async function handleCreate(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);
        setError(null);

        const priceCents = Math.round(parseFloat(newPrice) * 100);

        const { error } = await supabase.rpc('admin_create_service', {
            p_name: newName.trim(),
            p_duration_minutes: newDuration,
            p_default_price_cents: priceCents,
        });

        if (error) {
            setError(humanError(error.message));
        } else {
            setNewName('');
            setNewDuration(60);
            setNewPrice('');
            setShowForm(false);
            loadServices();
        }
        setSaving(false);
    }

    function startEdit(service: Service) {
        setEditingId(service.id);
        setEditName(service.name);
        setEditDuration(service.duration_minutes);
        setEditPrice((service.default_price_cents / 100).toFixed(2));
    }

    function cancelEdit() {
        setEditingId(null);
    }

    async function saveEdit() {
        if (!editingId) return;
        setSaving(true);
        setError(null);

        const priceCents = Math.round(parseFloat(editPrice) * 100);

        const { error } = await supabase.rpc('admin_update_service', {
            p_service_id: editingId,
            p_name: editName.trim(),
            p_duration_minutes: editDuration,
            p_default_price_cents: priceCents,
        });

        if (error) {
            setError(humanError(error.message));
        } else {
            setEditingId(null);
            loadServices();
        }
        setSaving(false);
    }

    async function handleDelete(id: string) {
        if (!confirm('Eliminare questo servizio?')) return;
        setError(null);

        const { error } = await supabase.rpc('admin_delete_service', { p_service_id: id });

        if (error) {
            setError(humanError(error.message));
        } else {
            loadServices();
        }
    }

    const formatPrice = (cents: number) => `€${(cents / 100).toFixed(2)}`;

    // Styles removed in favor of Tailwind classes

    if (loading) {
        return <div className="p-4"><LoadingState /></div>;
    }

    return (
        <div className="p-4">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-slate-900 font-[Poppins]">Gestione Servizi</h1>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className={showForm
                        ? "px-4 py-2 border border-slate-200 rounded-lg font-medium text-slate-600 bg-white hover:bg-slate-50 transition-colors"
                        : "px-4 py-2 bg-gradient-to-br from-yellow-300 to-orange-400 text-slate-900 font-semibold rounded-lg shadow-sm hover:shadow-md transition-all active:scale-95"
                    }
                >
                    {showForm ? '✕ Annulla' : '+ Nuovo'}
                </button>
            </div>

            {error && (
                <div className="mb-6 p-3 bg-red-50 border border-red-100 rounded-lg text-red-700 text-sm animate-in fade-in">
                    ⚠️ {error}
                </div>
            )}

            {/* New Service Form */}
            {showForm && (
                <form onSubmit={handleCreate} className="mb-8 bg-white border border-slate-200 rounded-xl p-6 shadow-sm animate-in slide-in-from-top-2">
                    <h2 className="text-lg font-semibold text-slate-900 mb-4">Nuovo Servizio</h2>

                    <label className="block text-sm font-medium text-slate-600 mb-2">Nome</label>
                    <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        className="w-full px-4 py-3 border border-slate-200 rounded-lg text-base mb-4 focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none"
                        placeholder="Es: Massaggio terapeutico"
                        required
                    />

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-2">Durata (min)</label>
                            <input
                                type="number"
                                value={newDuration}
                                onChange={(e) => setNewDuration(parseInt(e.target.value) || 0)}
                                className="w-full px-4 py-3 border border-slate-200 rounded-lg text-base focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none"
                                min={5}
                                step={5}
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-2">Prezzo (€)</label>
                            <input
                                type="number"
                                value={newPrice}
                                onChange={(e) => setNewPrice(e.target.value)}
                                className="w-full px-4 py-3 border border-slate-200 rounded-lg text-base focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none"
                                placeholder="50.00"
                                step="0.01"
                                min="0"
                                required
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={saving}
                        className="w-full mt-6 px-4 py-3 bg-gradient-to-br from-yellow-300 to-orange-400 text-slate-900 font-bold rounded-lg shadow-sm hover:shadow-md disabled:opacity-70 disabled:cursor-not-allowed transition-all flex justify-center items-center gap-2"
                    >
                        {saving ? <><Spinner size="sm" /> Salvataggio...</> : '✓ Crea Servizio'}
                    </button>
                </form>
            )}

            {/* Services List */}
            {services.length === 0 ? (
                <EmptyState
                    {...emptyStates.noServices}
                    action={
                        <button
                            onClick={() => setShowForm(true)}
                            className="px-6 py-3 bg-gradient-to-br from-yellow-300 to-orange-400 text-slate-900 font-bold rounded-lg shadow-sm hover:shadow-md transition-all active:scale-95"
                        >
                            + Crea Servizio
                        </button>
                    }
                />
            ) : (
                <div className="space-y-4">
                    {/* Header Desktop */}
                    <div className="hidden md:grid md:grid-cols-12 md:gap-4 px-4 py-2 font-semibold text-slate-500 border-b border-slate-200 bg-slate-50 rounded-t-lg">
                        <div className="md:col-span-4 pl-2">Nome</div>
                        <div className="md:col-span-3">Operatori</div>
                        <div className="md:col-span-2 text-center">Durata</div>
                        <div className="md:col-span-1 text-right">Prezzo</div>
                        <div className="md:col-span-2 text-right pr-2">Azioni</div>
                    </div>

                    {services.map((service) => (
                        <div key={service.id} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                            <div className="p-4 flex flex-col gap-3 md:grid md:grid-cols-12 md:gap-4 md:items-center">
                                {editingId === service.id ? (
                                    <>
                                        {/* EDIT MODE */}
                                        <div className="md:col-span-4 w-full">
                                            <label className="block text-xs text-slate-400 mb-1 md:hidden">Nome</label>
                                            <input
                                                type="text"
                                                value={editName}
                                                onChange={(e) => setEditName(e.target.value)}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-1 focus:ring-yellow-400 outline-none"
                                            />
                                        </div>
                                        <div className="md:col-span-3 hidden md:block text-sm text-slate-400 italic">
                                            (Gestisci operatori dalla pagina Operatori)
                                        </div>
                                        <div className="md:col-span-2 flex items-center justify-between md:justify-center">
                                            <label className="text-sm text-slate-500 md:hidden">Durata:</label>
                                            <div className="flex items-center gap-1">
                                                <input
                                                    type="number"
                                                    value={editDuration}
                                                    onChange={(e) => setEditDuration(parseInt(e.target.value) || 0)}
                                                    className="w-20 px-2 py-1 text-center border border-slate-300 rounded-lg text-sm focus:ring-1 focus:ring-yellow-400 outline-none"
                                                    min={5}
                                                    step={5}
                                                />
                                                <span className="text-slate-500 text-sm">min</span>
                                            </div>
                                        </div>
                                        <div className="md:col-span-1 flex items-center justify-between md:justify-end">
                                            <label className="text-sm text-slate-500 md:hidden">Prezzo:</label>
                                            <div className="flex items-center gap-1">
                                                <span className="text-slate-500 text-sm">€</span>
                                                <input
                                                    type="number"
                                                    value={editPrice}
                                                    onChange={(e) => setEditPrice(e.target.value)}
                                                    className="w-24 px-2 py-1 text-right border border-slate-300 rounded-lg text-sm focus:ring-1 focus:ring-yellow-400 outline-none"
                                                    step="0.01"
                                                    min="0"
                                                />
                                            </div>
                                        </div>
                                        <div className="md:col-span-2 text-right flex gap-2 justify-end mt-2 md:mt-0">
                                            <button onClick={saveEdit} disabled={saving} className="bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-emerald-600 transition-colors shadow-sm">✓ Salva</button>
                                            <button onClick={cancelEdit} className="bg-slate-400 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-slate-500 transition-colors shadow-sm">✗</button>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        {/* READ MODE */}
                                        <div className="md:col-span-4 flex justify-between items-start w-full">
                                            <span className="font-semibold text-slate-800 text-lg md:text-base">{service.name}</span>
                                        </div>

                                        <div className="md:col-span-3 w-full">
                                            <div className="flex flex-wrap gap-1">
                                                {service.assigned_operators && service.assigned_operators.length > 0 ? (
                                                    service.assigned_operators.map((op, idx) => (
                                                        <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                                                            {op}
                                                        </span>
                                                    ))
                                                ) : (
                                                    <span className="text-xs text-slate-400 italic">Nessun operatore</span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="md:col-span-2 flex justify-between items-center md:justify-center w-full">
                                            <span className="text-sm text-slate-500 md:hidden">Durata:</span>
                                            <span className="text-slate-600 bg-slate-100 px-2 py-1 rounded-md text-sm font-medium">
                                                {service.duration_minutes} min
                                            </span>
                                        </div>

                                        <div className="md:col-span-1 flex justify-between items-center md:justify-end w-full">
                                            <span className="text-sm text-slate-500 md:hidden">Prezzo:</span>
                                            <span className="font-bold text-orange-500">
                                                {formatPrice(service.default_price_cents)}
                                            </span>
                                        </div>

                                        <div className="md:col-span-2 flex justify-end gap-2 w-full mt-2 md:mt-0 pt-3 md:pt-0 border-t border-slate-100 md:border-0">
                                            <button onClick={() => startEdit(service)} className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors">
                                                ✏️ <span className="md:hidden">Modifica</span>
                                            </button>
                                            <button onClick={() => handleDelete(service.id)} className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors">
                                                🗑️ <span className="md:hidden">Elimina</span>
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
