// Recupero password con codice personale (non richiede l'invio di email).
// Corpo: { email, code, password }. Risposta: { ok: true, newCode } oppure { error }.
// La verifica del codice (hash bcrypt) e il limite di tentativi sono nel database (supabase/recovery.sql).
import { admin, cors, json } from '../_shared/push.ts';

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  let email = '', code = '', password = '';
  try {
    const body = await req.json();
    email = String(body?.email ?? '').trim().slice(0, 200);
    code = String(body?.code ?? '').slice(0, 40);
    password = String(body?.password ?? '');
  } catch { /* corpo non valido */ }

  if (!email || !code) return json({ error: 'missing_fields' }, 400);
  if (password.length < 8 || password.length > 72) return json({ error: 'weak_password' }, 400);

  const { data: userId, error } = await admin.rpc('verify_recovery_code', { p_email: email, p_code: code });
  if (error) {
    if (error.message.includes('too_many_attempts')) return json({ error: 'too_many_attempts' }, 429);
    console.error('verify_recovery_code', error.message);
    return json({ error: 'server_error' }, 500);
  }
  // Stessa risposta se l'email non esiste o il codice è sbagliato: non si rivela chi è registrato.
  if (!userId) return json({ error: 'invalid_code' }, 400);

  const { error: updError } = await admin.auth.admin.updateUserById(userId as string, { password });
  if (updError) {
    console.error('updateUserById', updError.message);
    return json({ error: updError.message.toLowerCase().includes('weak') ? 'weak_password' : 'server_error' }, 400);
  }

  const { data: newCode } = await admin.rpc('rotate_recovery_code', { p_user_id: userId });
  return json({ ok: true, newCode });
});
