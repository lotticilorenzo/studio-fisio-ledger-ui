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

    if (loading) {
        return <LoadingState />;
    }

    return (
        <div className="fade-in">
            <div className="page-header">
                <h1 className="page-title">Gestione Servizi</h1>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="btn btn-primary btn-sm"
                >
                    {showForm ? '✕ Annulla' : '+ Nuovo'}
                </button>
            </div>

            {error && (
                <div className="error-box mb-4">
                    ⚠️ {error}
                </div>
            )}

            {/* New Service Form */}
            {showForm && (
                <form onSubmit={handleCreate} className="card card-body mb-6">
                    <h2 className="section-title">Nuovo Servizio</h2>
                    <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
                        <div className="form-group">
                            <label className="form-label">Nome</label>
                            <input
                                type="text"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                className="form-input"
                                placeholder="Es: Massaggio terapeutico"
                                required
                            />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                            <div className="form-group">
                                <label className="form-label">Durata (min)</label>
                                <input
                                    type="number"
                                    value={newDuration}
                                    onChange={(e) => setNewDuration(parseInt(e.target.value) || 0)}
                                    className="form-input"
                                    min={5}
                                    step={5}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Prezzo (€)</label>
                                <input
                                    type="number"
                                    value={newPrice}
                                    onChange={(e) => setNewPrice(e.target.value)}
                                    className="form-input"
                                    placeholder="50.00"
                                    step="0.01"
                                    min="0"
                                    required
                                />
                            </div>
                        </div>
                    </div>
                    <button
                        type="submit"
                        disabled={saving}
                        className="btn btn-primary btn-full mt-4"
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
                        <button onClick={() => setShowForm(true)} className="btn btn-primary">
                            + Crea Servizio
                        </button>
                    }
                />
            ) : (
                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Nome</th>
                                <th>Durata</th>
                                <th style={{ textAlign: 'right' }}>Prezzo</th>
                                <th style={{ textAlign: 'right' }}>Azioni</th>
                            </tr>
                        </thead>
                        <tbody>
                            {services.map((service) => (
                                <tr key={service.id}>
                                    {editingId === service.id ? (
                                        <>
                                            <td>
                                                <input
                                                    type="text"
                                                    value={editName}
                                                    onChange={(e) => setEditName(e.target.value)}
                                                    className="form-input"
                                                    style={{ minHeight: '36px', padding: 'var(--space-2)' }}
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="number"
                                                    value={editDuration}
                                                    onChange={(e) => setEditDuration(parseInt(e.target.value) || 0)}
                                                    className="form-input"
                                                    style={{ width: '80px', minHeight: '36px', padding: 'var(--space-2)' }}
                                                    min={5}
                                                    step={5}
                                                />
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                <input
                                                    type="number"
                                                    value={editPrice}
                                                    onChange={(e) => setEditPrice(e.target.value)}
                                                    className="form-input"
                                                    style={{ width: '100px', minHeight: '36px', padding: 'var(--space-2)' }}
                                                    step="0.01"
                                                    min="0"
                                                />
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                <button onClick={saveEdit} disabled={saving} className="btn btn-sm" style={{ background: 'var(--success)', color: 'white', marginRight: 'var(--space-2)' }}>
                                                    ✓
                                                </button>
                                                <button onClick={cancelEdit} className="btn btn-ghost btn-sm">
                                                    ✕
                                                </button>
                                            </td>
                                        </>
                                    ) : (
                                        <>
                                            <td className="font-medium">{service.name}</td>
                                            <td className="text-muted">{service.duration_minutes} min</td>
                                            <td style={{ textAlign: 'right', color: 'var(--accent)', fontWeight: '600' }}>
                                                {formatPrice(service.default_price_cents)}
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                <button onClick={() => startEdit(service)} className="btn btn-ghost btn-sm" style={{ marginRight: 'var(--space-2)' }}>
                                                    ✏️
                                                </button>
                                                <button onClick={() => handleDelete(service.id)} className="btn btn-sm" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>
                                                    🗑️
                                                </button>
                                            </td>
                                        </>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
