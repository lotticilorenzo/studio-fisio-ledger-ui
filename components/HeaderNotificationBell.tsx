'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

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

export function HeaderNotificationBell() {
    const [status, setStatus] = useState<'supported' | 'unsupported' | 'denied' | 'granted' | 'loading'>('loading');
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

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
        try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();
            setIsSubscribed(!!subscription);
        } catch (err) {
            console.error('Error checking subscription:', err);
        }
    }

    async function toggleSubscription() {
        if (isLoading) return;
        setIsLoading(true);

        try {
            const registration = await navigator.serviceWorker.ready;

            if (isSubscribed) {
                // Unsubscribe
                const subscription = await registration.pushManager.getSubscription();
                if (subscription) {
                    await subscription.unsubscribe();

                    // Remove from Supabase
                    const { data: { user } } = await supabase.auth.getUser();
                    if (user) {
                        await supabase
                            .from('push_subscriptions')
                            .delete()
                            .eq('endpoint', subscription.endpoint)
                            .eq('user_id', user.id);
                    }
                }
                setIsSubscribed(false);
                alert('🔕 Notifiche disattivate.');
            } else {
                // Subscribe
                const permission = await Notification.requestPermission();
                if (permission !== 'granted') {
                    setStatus('denied');
                    alert('⚠️ Devi consentire le notifiche nel browser per attivarle.');
                    setIsLoading(false);
                    return;
                }

                setStatus('granted');

                const subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
                });

                // Save to Supabase
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) {
                    setIsLoading(false);
                    return;
                }

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
                alert('🔔 Notifiche attivate! Riceverai un promemoria per i tuoi appuntamenti.');
            }
        } catch (err) {
            console.error('Subscription error:', err);
            alert('❌ Errore durante la modifica delle notifiche.');
        } finally {
            setIsLoading(false);
        }
    }

    if (status === 'unsupported') return null;

    return (
        <button
            onClick={toggleSubscription}
            disabled={isLoading || status === 'denied'}
            className={`
                relative p-2 rounded-lg transition-all
                ${isSubscribed
                    ? 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100'
                    : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}
                ${status === 'denied' ? 'opacity-50 cursor-not-allowed' : ''}
            `}
            title={isSubscribed ? "Disattiva notifiche" : "Attiva notifiche"}
            aria-label={isSubscribed ? "Disattiva notifiche" : "Attiva notifiche"}
        >
            {isLoading ? (
                <div className="w-5 h-5 flex items-center justify-center">
                    <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                </div>
            ) : isSubscribed ? (
                // Bell with sound waves (Filled/Active)
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                    <path d="M12.02 2.909c-.486-.689-1.554-.689-2.04 0C8.75 4.675 4.5 9.07 4.5 14.5c0 2.21-1.352 4.14-2.887 5.213a.589.589 0 0 0 .339 1.054c7.684.004 12.43.004 20.117 0a.589.589 0 0 0 .339-1.054c-1.535-1.072-2.887-3.002-2.887-5.213 0-5.43-4.25-9.825-5.48-11.591zM14 20.301c0 1.103-.897 2-2 2s-2-.897-2-2h4z" />
                </svg>
            ) : (
                // Bell Outline (Inactive)
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                    {status === 'denied' && (
                        <line x1="2" y1="2" x2="22" y2="22" className="text-red-500" />
                    )}
                </svg>
            )}

            {/* Status Dot */}
            <span className={`absolute top-2 right-2 w-2 h-2 rounded-full border-2 border-white
                ${isSubscribed ? 'bg-emerald-500' : 'bg-transparent'}
            `} />
        </button>
    );
}
