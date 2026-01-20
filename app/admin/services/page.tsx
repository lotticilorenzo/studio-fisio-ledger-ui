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

    // Styles
    const pageStyle: React.CSSProperties = { padding: '16px' };
    const headerStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' };
    const titleStyle: React.CSSProperties = { fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Poppins, sans-serif' };
    const btnPrimary: React.CSSProperties = { background: 'linear-gradient(135deg, #f4f119 0%, #ff9900 100%)', color: '#0f172a', border: 'none', borderRadius: '8px', padding: '10px 16px', fontWeight: 600, cursor: 'pointer' };
    const btnSecondary: React.CSSProperties = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 16px', fontWeight: 500, cursor: 'pointer', color: '#475569' };
    const cardStyle: React.CSSProperties = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', marginBottom: '24px' };
    const cardTitleStyle: React.CSSProperties = { fontSize: '1rem', fontWeight: 600, color: '#0f172a', marginBottom: '16px' };
    const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#475569', marginBottom: '6px' };
    const inputStyle: React.CSSProperties = { width: '100%', padding: '12px 14px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '1rem', minHeight: '48px', marginBottom: '16px' };
    const gridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' };
    const errorBox: React.CSSProperties = { background: '#fee2e2', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '12px', color: '#991b1b', marginBottom: '16px', fontSize: '0.875rem' };
    const tableContainer: React.CSSProperties = { overflowX: 'auto', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px' };
    const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' };
    const thStyle: React.CSSProperties = { textAlign: 'left', padding: '12px', fontWeight: 600, color: '#475569', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' };
    const tdStyle: React.CSSProperties = { padding: '12px', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' };
    const editBtn: React.CSSProperties = { background: 'transparent', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer', fontSize: '0.8rem', marginRight: '6px' };
    const deleteBtn: React.CSSProperties = { background: '#fee2e2', border: 'none', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer', fontSize: '0.8rem', color: '#991b1b' };
    const saveBtn: React.CSSProperties = { background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer', marginRight: '6px' };
    const cancelBtn: React.CSSProperties = { background: '#94a3b8', color: 'white', border: 'none', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer' };
    const inlineInput: React.CSSProperties = { padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.875rem' };

    if (loading) {
        return <div style={pageStyle}><LoadingState /></div>;
    }

    return (
        <div style={pageStyle}>
            <div style={headerStyle}>
                <h1 style={titleStyle}>Gestione Servizi</h1>
                <button onClick={() => setShowForm(!showForm)} style={showForm ? btnSecondary : btnPrimary}>
                    {showForm ? '✕ Annulla' : '+ Nuovo'}
                </button>
            </div>

            {error && <div style={errorBox}>⚠️ {error}</div>}

            {/* New Service Form */}
            {showForm && (
                <form onSubmit={handleCreate} style={cardStyle}>
                    <h2 style={cardTitleStyle}>Nuovo Servizio</h2>

                    <label style={labelStyle}>Nome</label>
                    <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        style={inputStyle}
                        placeholder="Es: Massaggio terapeutico"
                        required
                    />

                    <div style={gridStyle}>
                        <div>
                            <label style={labelStyle}>Durata (min)</label>
                            <input
                                type="number"
                                value={newDuration}
                                onChange={(e) => setNewDuration(parseInt(e.target.value) || 0)}
                                style={{ ...inputStyle, marginBottom: 0 }}
                                min={5}
                                step={5}
                                required
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>Prezzo (€)</label>
                            <input
                                type="number"
                                value={newPrice}
                                onChange={(e) => setNewPrice(e.target.value)}
                                style={{ ...inputStyle, marginBottom: 0 }}
                                placeholder="50.00"
                                step="0.01"
                                min="0"
                                required
                            />
                        </div>
                    </div>

                    <button type="submit" disabled={saving} style={{ ...btnPrimary, width: '100%', marginTop: '16px', opacity: saving ? 0.7 : 1 }}>
                        {saving ? <><Spinner size="sm" /> Salvataggio...</> : '✓ Crea Servizio'}
                    </button>
                </form>
            )}

            {/* Services List */}
            {services.length === 0 ? (
                <EmptyState
                    {...emptyStates.noServices}
                    action={
                        <button onClick={() => setShowForm(true)} style={btnPrimary}>
                            + Crea Servizio
                        </button>
                    }
                />
            ) : (
                <div style={tableContainer}>
                    <table style={tableStyle}>
                        <thead>
                            <tr>
                                <th style={thStyle}>Nome</th>
                                <th style={{ ...thStyle, textAlign: 'center' }}>Durata</th>
                                <th style={{ ...thStyle, textAlign: 'right' }}>Prezzo</th>
                                <th style={{ ...thStyle, textAlign: 'center' }}>Azioni</th>
                            </tr>
                        </thead>
                        <tbody>
                            {services.map((service) => (
                                <tr key={service.id}>
                                    {editingId === service.id ? (
                                        <>
                                            <td style={tdStyle}>
                                                <input
                                                    type="text"
                                                    value={editName}
                                                    onChange={(e) => setEditName(e.target.value)}
                                                    style={{ ...inlineInput, width: '100%' }}
                                                />
                                            </td>
                                            <td style={{ ...tdStyle, textAlign: 'center' }}>
                                                <input
                                                    type="number"
                                                    value={editDuration}
                                                    onChange={(e) => setEditDuration(parseInt(e.target.value) || 0)}
                                                    style={{ ...inlineInput, width: '60px', textAlign: 'center' }}
                                                    min={5}
                                                    step={5}
                                                />
                                            </td>
                                            <td style={{ ...tdStyle, textAlign: 'right' }}>
                                                <input
                                                    type="number"
                                                    value={editPrice}
                                                    onChange={(e) => setEditPrice(e.target.value)}
                                                    style={{ ...inlineInput, width: '80px', textAlign: 'right' }}
                                                    step="0.01"
                                                    min="0"
                                                />
                                            </td>
                                            <td style={{ ...tdStyle, textAlign: 'center' }}>
                                                <button onClick={saveEdit} disabled={saving} style={saveBtn}>✓</button>
                                                <button onClick={cancelEdit} style={cancelBtn}>✗</button>
                                            </td>
                                        </>
                                    ) : (
                                        <>
                                            <td style={{ ...tdStyle, fontWeight: 500 }}>{service.name}</td>
                                            <td style={{ ...tdStyle, textAlign: 'center', color: '#64748b' }}>{service.duration_minutes} min</td>
                                            <td style={{ ...tdStyle, textAlign: 'right', color: '#ff9900', fontWeight: 600 }}>
                                                {formatPrice(service.default_price_cents)}
                                            </td>
                                            <td style={{ ...tdStyle, textAlign: 'center' }}>
                                                <button onClick={() => startEdit(service)} style={editBtn}>✏️</button>
                                                <button onClick={() => handleDelete(service.id)} style={deleteBtn}>🗑️</button>
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
