// Promemoria giornalieri (pagamenti ricorrenti, budget superati, obiettivi in scadenza) via Web Push.
// Chiamata ogni 15 minuti da pg_cron (supabase/cron.sql) con l'intestazione x-cron-secret (segreto nel Vault).
// Ogni utente li riceve una volta al giorno, all'orario scelto, nel proprio fuso orario.
import { DEFAULT_NOTIFICATION_PREFS, notificationsForDay, parseTime } from '../_shared/planner.ts';
import { CATEGORY_NAMES } from '../_shared/category-names.ts';
import { admin, json, sendToUsers } from '../_shared/push.ts';

const MAX_PER_USER = 4;

function localNow(timeZone: string): { day: string; minutes: number } {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-CA', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date());
  } catch {
    return localNow('Europe/Rome');
  }
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? '00';
  return { day: `${get('year')}-${get('month')}-${get('day')}`, minutes: Number(get('hour')) * 60 + Number(get('minute')) };
}

Deno.serve(async req => {
  const secret = Deno.env.get('CRON_SECRET');
  if (!secret || req.headers.get('x-cron-secret') !== secret) return json({ error: 'unauthorized' }, 401);

  const { data: subs } = await admin.from('push_subscriptions').select('user_id');
  const userIds = [...new Set((subs ?? []).map(s => s.user_id))];
  if (!userIds.length) return json({ users: 0, sent: 0 });

  const { data: settings } = await admin.from('user_settings')
    .select('user_id, prefs, timezone, last_daily_push').in('user_id', userIds);
  const byUser = new Map((settings ?? []).map(s => [s.user_id, s]));

  let sent = 0, processed = 0;
  for (const userId of userIds) {
    const s = byUser.get(userId);
    const prefs = { ...DEFAULT_NOTIFICATION_PREFS, ...(s?.prefs ?? {}) };
    if (!prefs.notificationsEnabled) continue;
    const { day, minutes } = localNow(s?.timezone ?? 'Europe/Rome');
    const { hour, minute } = parseTime(prefs.notifyTime);
    if (s?.last_daily_push === day || minutes < hour * 60 + minute) continue;

    const { data: personal } = await admin.from('personal_data').select('data').eq('user_id', userId).maybeSingle();
    const d = personal?.data ?? {};
    const custom = new Map(((d.customCategories ?? []) as { id: string; name: string }[]).map(c => [c.id, c.name]));
    const list = notificationsForDay({
      transactions: d.transactions ?? [], budgets: d.budgets ?? [], goals: d.goals ?? [],
      categoryName: id => custom.get(id) ?? CATEGORY_NAMES[id] ?? id,
    }, prefs, day).slice(0, MAX_PER_USER);

    for (const n of list) {
      const route = n.kind === 'budget' ? 'tabs/budgets' : n.kind === 'goal' ? 'tabs/goals' : 'tabs/transactions';
      sent += await sendToUsers([userId], { title: n.title, body: n.body, tag: `daily-${day}-${n.id}`, route });
    }
    await admin.from('user_settings').upsert({ user_id: userId, last_daily_push: day }, { onConflict: 'user_id' });
    processed++;
  }
  return json({ users: processed, sent });
});
