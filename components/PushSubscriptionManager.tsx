'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

export function PushSubscriptionManager() {
    const [status, setStatus] = useState<'supported' | 'unsupported' | 'denied' | 'granted' | 'loading'>('loading');
    const [isSubscribed, setIsSubscribed] = useState(false);

    useEffect(() => {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            setStatus('unsupported');
            return;
        }

        if (Notification.permission === 'denied') {
            setStatus('denied');
        } else if (Notification.permission === 'granted') {
            setStatus('granted');
            checkSubscription();
        } else {
            setStatus('supported');
        }
    }, []);

    async function checkSubscription() {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        setIsSubscribed(!!subscription);
    }

    async function subscribe() {
        try {
            const registration = await navigator.serviceWorker.ready;

            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                setStatus('denied');
                return;
            }

            setStatus('granted');

            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
            });

            // Save to Supabase
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const p256dh = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(subscription.getKey('p256dh')!))));
            const auth = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(subscription.getKey('auth')!))));

            const { error } = await supabase
                .from('push_subscriptions')
                .upsert({
                    user_id: user.id,
                    endpoint: subscription.endpoint,
                    p256dh,
                    auth
                });

            if (error) throw error;
            setIsSubscribed(true);
            alert('✅ Notifiche attivate con successo!');
        } catch (err) {
            console.error('Subscription error:', err);
            alert('❌ Errore durante l\'attivazione delle notifiche. Assicurati che il VAPID_PUBLIC_KEY sia valido.');
        }
    }

    if (status === 'unsupported') return null;

    return (
        <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
                <div className="bg-amber-50 p-2 rounded-xl text-amber-500">
                    {isSubscribed ? '🔔' : '🔕'}
                </div>
                <div>
                    <h4 className="text-sm font-bold text-slate-900">Push Notifications</h4>
                    <p className="text-[10px] text-slate-500">{isSubscribed ? 'Notifiche attive per questo device' : 'Attivale per ricevere i promemoria'}</p>
                </div>
            </div>

            {!isSubscribed ? (
                <button
                    onClick={subscribe}
                    className="bg-slate-900 text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-slate-800 transition-colors"
                >
                    Attiva
                </button>
            ) : (
                <span className="text-emerald-500 text-[10px] font-bold bg-emerald-50 px-2 py-1 rounded-full uppercase">Attive</span>
            )}
        </div>
    );
}

function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}
