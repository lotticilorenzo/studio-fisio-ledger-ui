'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { humanError } from '@/lib/humanError';

interface Service {
    id: string;
    name: string;
    duration_minutes: number;
    default_price_cents: number;
    created_at: string;
}

export default function AdminServicesPage() {
    const [services, setServices] = useState<Service[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // New service form
    const [showForm, setShowForm] = useState(false);
    const [newName, setNewName] = useState('');
    const [newDuration, setNewDuration] = useState(60);
    const [newPrice, setNewPrice] = useState('');
    const [saving, setSaving] = useState(false);

    // Editing
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [editDuration, setEditDuration] = useState(60);
    const [editPrice, setEditPrice] = useState('');

    useEffect(() => {
        loadServices();
    }, []);

    async function loadServices() {
        setLoading(true);
        const { data, error } = await supabase
            .from('services')
            .select('*')
            .order('name');

        if (error) {
            setError(humanError(error.message));
        } else {
            setServices(data || []);
        }
        setLoading(false);
    }

    async function handleCreate(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);
        setError(null);

        const priceCents = Math.round(parseFloat(newPrice) * 100);

        const { error } = await supabase.from('services').insert({
            name: newName.trim(),
            duration_minutes: newDuration,
            default_price_cents: priceCents,
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

        const { error } = await supabase
            .from('services')
            .update({
                name: editName.trim(),
                duration_minutes: editDuration,
                default_price_cents: priceCents,
            })
            .eq('id', editingId);

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

        const { error } = await supabase.from('services').delete().eq('id', id);

        if (error) {
            setError(humanError(error.message));
        } else {
            loadServices();
        }
    }

    const formatPrice = (cents: number) => `€ ${(cents / 100).toFixed(2)}`;

    if (loading) {
        return (
            <main className="p-6">
                <div className="animate-pulse text-gray-400">Caricamento servizi...</div>
            </main>
        );
    }

    return (
        <main className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Gestione Servizi</h1>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="px-4 py-2 rounded-lg bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-semibold hover:from-yellow-300 hover:to-orange-400 transition-all"
                >
                    {showForm ? '✕ Annulla' : '➕ Nuovo Servizio'}
                </button>
            </div>

            {error && (
                <div className="mb-4 p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300">
                    ⚠️ {error}
                </div>
            )}

            {/* New Service Form */}
            {showForm && (
                <form
                    onSubmit={handleCreate}
                    className="mb-6 p-6 rounded-2xl border border-yellow-500/20 bg-neutral-900/80"
                >
                    <h2 className="text-lg font-semibold mb-4">Nuovo Servizio</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">Nome</label>
                            <input
                                type="text"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                className="w-full px-4 py-2 rounded-lg bg-black/50 border border-neutral-700 text-white"
                                placeholder="Es: Massaggio terapeutico"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">Durata (min)</label>
                            <input
                                type="number"
                                value={newDuration}
                                onChange={(e) => setNewDuration(parseInt(e.target.value) || 0)}
                                className="w-full px-4 py-2 rounded-lg bg-black/50 border border-neutral-700 text-white"
                                min={5}
                                step={5}
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">Prezzo (€)</label>
                            <input
                                type="number"
                                value={newPrice}
                                onChange={(e) => setNewPrice(e.target.value)}
                                className="w-full px-4 py-2 rounded-lg bg-black/50 border border-neutral-700 text-white"
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
                        className="mt-4 px-6 py-2 rounded-lg bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-semibold disabled:opacity-50"
                    >
                        {saving ? 'Salvataggio...' : 'Crea Servizio'}
                    </button>
                </form>
            )}

            {/* Services Table */}
            <div className="table-responsive">
                <table className="w-full">
                    <thead className="bg-neutral-800/50">
                        <tr>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Nome</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Durata</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Prezzo</th>
                            <th className="px-4 py-3 text-right text-sm font-medium text-gray-400">Azioni</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-700/50">
                        {services.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                                    Nessun servizio trovato. Crea il primo!
                                </td>
                            </tr>
                        ) : (
                            services.map((service) => (
                                <tr key={service.id} className="hover:bg-neutral-800/30">
                                    {editingId === service.id ? (
                                        <>
                                            <td className="px-4 py-3">
                                                <input
                                                    type="text"
                                                    value={editName}
                                                    onChange={(e) => setEditName(e.target.value)}
                                                    className="w-full px-3 py-1 rounded bg-black/50 border border-neutral-600 text-white"
                                                />
                                            </td>
                                            <td className="px-4 py-3">
                                                <input
                                                    type="number"
                                                    value={editDuration}
                                                    onChange={(e) => setEditDuration(parseInt(e.target.value) || 0)}
                                                    className="w-20 px-3 py-1 rounded bg-black/50 border border-neutral-600 text-white"
                                                    min={5}
                                                    step={5}
                                                />
                                                <span className="ml-1 text-gray-400">min</span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="text-gray-400">€</span>
                                                <input
                                                    type="number"
                                                    value={editPrice}
                                                    onChange={(e) => setEditPrice(e.target.value)}
                                                    className="w-24 ml-1 px-3 py-1 rounded bg-black/50 border border-neutral-600 text-white"
                                                    step="0.01"
                                                    min="0"
                                                />
                                            </td>
                                            <td className="px-4 py-3 text-right space-x-2">
                                                <button
                                                    onClick={saveEdit}
                                                    disabled={saving}
                                                    className="px-3 py-1 rounded bg-green-600 text-white text-sm hover:bg-green-500"
                                                >
                                                    ✓
                                                </button>
                                                <button
                                                    onClick={cancelEdit}
                                                    className="px-3 py-1 rounded bg-neutral-600 text-white text-sm hover:bg-neutral-500"
                                                >
                                                    ✕
                                                </button>
                                            </td>
                                        </>
                                    ) : (
                                        <>
                                            <td className="px-4 py-3 font-medium">{service.name}</td>
                                            <td className="px-4 py-3 text-gray-300">{service.duration_minutes} min</td>
                                            <td className="px-4 py-3 text-yellow-400 font-medium">
                                                {formatPrice(service.default_price_cents)}
                                            </td>
                                            <td className="px-4 py-3 text-right space-x-2">
                                                <button
                                                    onClick={() => startEdit(service)}
                                                    className="px-3 py-1 rounded bg-neutral-700 text-white text-sm hover:bg-neutral-600"
                                                >
                                                    ✏️ Modifica
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(service.id)}
                                                    className="px-3 py-1 rounded bg-red-600/20 text-red-400 text-sm hover:bg-red-600/40"
                                                >
                                                    🗑️
                                                </button>
                                            </td>
                                        </>
                                    )}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </main>
    );
}
