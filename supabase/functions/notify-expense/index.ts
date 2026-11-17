// Avvisa gli ALTRI membri di un wallet quando qualcuno aggiunge/modifica spese o condivide carte fedeltà.
// Chiamata dall'app dopo un salvataggio riuscito: { walletId, added: id[], changed: id[], cards: id[] }.
// I testi si costruiscono dai dati salvati sul server (non da quelli inviati dal client) e rispettano
// le preferenze di ciascun destinatario (notifiche attive, spese, carte).
import { DEFAULT_NOTIFICATION_PREFS, walletChangeMessage } from '../_shared/planner.ts';
import { admin, cors, json, sendToUsers, userFromRequest } from '../_shared/push.ts';

const ids = (v: unknown): string[] => (Array.isArray(v) ? v : [])
  .filter((x: unknown): x is string => typeof x === 'string' && x.length <= 80).slice(0, 20);

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const me = await userFromRequest(req);
  if (!me) return json({ error: 'unauthorized' }, 401);

  let walletId = '', added: string[] = [], changed: string[] = [], cards: string[] = [];
  try {
    const b = await req.json();
    walletId = String(b?.walletId ?? '');
    added = ids(b?.added); changed = ids(b?.changed); cards = ids(b?.cards);
  } catch { /* corpo non valido */ }
  if (!walletId || (!added.length && !changed.length && !cards.length)) return json({ sent: 0 });

  // Solo un membro del wallet può far partire le notifiche.
  const { data: members } = await admin.from('wallet_members').select('user_id, display_name').eq('wallet_id', walletId);
  const mine = (members ?? []).find(m => m.user_id === me);
  if (!mine) return json({ error: 'forbidden' }, 403);
  const others = (members ?? []).filter(m => m.user_id !== me).map(m => m.user_id);
  if (!others.length) return json({ sent: 0 });

  const { data: wallet } = await admin.from('wallets').select('name, currency, data').eq('id', walletId).maybeSingle();
  if (!wallet) return json({ sent: 0 });
  const expenses = (wallet.data?.expenses ?? []) as { id: string; title: string; amount: number }[];
  const allCards = (wallet.data?.loyaltyCards ?? []) as { id: string; store: string }[];
  const pick = (list: string[]) => expenses.filter(e => list.includes(e.id)).map(e => ({ title: e.title, amount: e.amount }));
  const summary = {
    walletName: wallet.name, by: mine.display_name || 'Un membro', currency: wallet.currency,
    added: pick(added), changed: pick(changed),
    cards: allCards.filter(c => cards.includes(c.id)).map(c => ({ store: c.store })),
  };

  const { data: settings } = await admin.from('user_settings').select('user_id, prefs').in('user_id', others);
  const prefsOf = new Map((settings ?? []).map(s => [s.user_id, { ...DEFAULT_NOTIFICATION_PREFS, ...(s.prefs ?? {}) }]));
  let sent = 0;
  for (const uid of others) {
    const prefs = prefsOf.get(uid) ?? DEFAULT_NOTIFICATION_PREFS;
    if (!prefs.notificationsEnabled) continue;
    const msg = walletChangeMessage(summary, prefs);
    if (!msg) continue;
    sent += await sendToUsers([uid], { ...msg, tag: `wallet-${walletId}`, route: `tabs/shared/wallet/${walletId}` });
  }
  return json({ sent });
});
