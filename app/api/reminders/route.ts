import { NextResponse } from 'next/server';
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

// Setup VAPID keys
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:lottici.lorenzo04@gmail.com';
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

// Use Service Role key for backend operations (to bypass RLS for checking reminders)
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
    try {
        // 1. Fetch upcoming appointments (10-20 mins from now) that haven't sent a reminder
        // Note: We use the view we created earlier or a direct query
        const { data: appts, error: apptsError } = await supabase
            .from('appointments')
            .select(`
        id,
        starts_at,
        p:patients(full_name),
        s:services(name),
        o:operators(user_id)
      `)
            .eq('status', 'scheduled')
            .eq('push_reminder_sent', false)
            .gte('starts_at', new Date(Date.now() + 5 * 60 * 1000).toISOString()) // starts in more than 5 mins
            .lte('starts_at', new Date(Date.now() + 25 * 60 * 1000).toISOString()); // starts in less than 25 mins

        if (apptsError) throw apptsError;
        if (!appts || appts.length === 0) {
            return NextResponse.json({ message: 'No upcoming appointments to notify.' });
        }

        const results = [];

        for (const appt of appts) {
            // 2. For each appointment, get the operator's push subscriptions
            const { data: subs, error: subsError } = await supabase
                .from('push_subscriptions')
                .select('*')
                .eq('user_id', (appt.o as any).user_id);

            if (subsError) continue;

            for (const sub of (subs || [])) {
                try {
                    const pushSubscription = {
                        endpoint: sub.endpoint,
                        keys: {
                            p256dh: sub.p256dh,
                            auth: sub.auth
                        }
                    };

                    const minutesUntil = Math.round((new Date(appt.starts_at).getTime() - Date.now()) / 60000);

                    const payload = JSON.stringify({
                        title: 'Studio FISYO',
                        body: `Paziente tra ${minutesUntil} min: ${(appt.p as any).full_name} (${(appt.s as any).name})`,
                        url: `/op/appointments`
                    });

                    await webpush.sendNotification(pushSubscription, payload);
                    results.push({ appt: appt.id, success: true });
                } catch (err: any) {
                    console.error('Push error for sub:', sub.id, err.statusCode);
                    // If subscription is expired/invalid, remove it
                    if (err.statusCode === 410 || err.statusCode === 404) {
                        await supabase.from('push_subscriptions').delete().eq('id', sub.id);
                    }
                    results.push({ appt: appt.id, success: false, error: err.message });
                }
            }

            // 3. Mark the appointment as notified
            await supabase.from('appointments').update({ push_reminder_sent: true }).eq('id', appt.id);
        }

        return NextResponse.json({ processed: appts.length, results });
    } catch (err: any) {
        console.error('CRON Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
