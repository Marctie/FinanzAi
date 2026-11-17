import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { AuthError, createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import { TelemetryService } from './telemetry.service';

const LOCAL_DATA_PREFIX = 'finanzai_';
/** Chiavi locali da conservare anche dopo il logout (non sono dati personali dell'account). */
const KEEP_ON_LOGOUT = new Set([
  'finanzai_theme',
  'finanzai_onboarded',
  'finanzai_seeded',               // evita che tornino i dati di esempio
  'finanzai_demo_banner_dismissed',
]);

/**
 * Account utente (Supabase Auth) su web e Android.
 * Non c'è un server SMTP: la registrazione è attiva subito e la password si recupera con il
 * codice di recupero personale creato al primo accesso (vedi supabase/schema.sql e la funzione recover-password).
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private client: SupabaseClient | null = null;

  readonly user$ = new BehaviorSubject<User | null>(null);
  /** Nome visibile agli altri membri dei wallet (tabella profiles). */
  readonly displayName$ = new BehaviorSubject<string>('');

  constructor(private telemetry: TelemetryService) {}

  get enabled(): boolean {
    return !!environment.supabase.url && !!environment.supabase.publishableKey;
  }

  get user(): User | null {
    return this.user$.value;
  }

  get displayName(): string {
    return this.displayName$.value || (this.user?.email ?? '').split('@')[0].slice(0, 40);
  }

  get supabase(): SupabaseClient {
    if (!this.client) throw new Error('Account non configurato');
    return this.client;
  }

  async init(): Promise<User | null> {
    if (!this.enabled) return null;

    this.client = createClient(environment.supabase.url, environment.supabase.publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storageKey: 'sb-finanzai-auth',
      },
    });

    this.client.auth.onAuthStateChange((_event, session) => {
      this.telemetry.setSession(session?.user ?? null, session?.access_token ?? null);
      if ((session?.user?.id ?? null) !== (this.user?.id ?? null)) this.user$.next(session?.user ?? null);
    });

    const { data } = await this.client.auth.getSession();
    let session = data.session;

    // Sessione salvata ma account eliminato o revocato: si esce in modo pulito (solo se il server lo conferma).
    if (session && navigator.onLine) {
      const { error } = await this.client.auth.getUser();
      if (error && (error.status === 401 || error.status === 403 || error.code === 'user_not_found')) {
        await this.client.auth.signOut({ scope: 'local' }).catch(() => undefined);
        session = null;
      }
    }

    this.telemetry.setSession(session?.user ?? null, session?.access_token ?? null);
    this.user$.next(session?.user ?? null);
    if (session?.user) this.loadProfile().catch(() => undefined);
    return this.user;
  }

  async signIn(email: string, password: string): Promise<void> {
    const { data, error } = await this.supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      this.telemetry.track('login_fallito', { codice: error.code ?? 'sconosciuto' });
      throw new Error(this.translate(error));
    }
    this.telemetry.setSession(data.user, data.session?.access_token ?? null);
    this.telemetry.track('login');
    await this.loadProfile().catch(() => undefined);
  }

  /** Registra un nuovo account (attivo subito) e salva il nome visibile agli altri membri. */
  async signUp(email: string, password: string, displayName: string): Promise<void> {
    const { data, error } = await this.supabase.auth.signUp({ email: email.trim(), password });
    if (error) throw new Error(this.translate(error));
    if (data.user && data.user.identities?.length === 0) {
      throw new Error('Esiste già un account con questa email. Prova ad accedere.');
    }
    if (!data.session) throw new Error('Registrazione non completata, riprova');
    this.telemetry.setSession(data.user, data.session.access_token);
    this.telemetry.track('registrazione');
    await this.setDisplayName(displayName || email.split('@')[0]);
  }

  async setDisplayName(name: string): Promise<void> {
    const clean = name.trim().slice(0, 40);
    const { error } = await this.supabase.rpc('set_display_name', { p_name: clean });
    if (error) throw new Error('Non è stato possibile salvare il nome');
    this.displayName$.next(clean);
  }

  async updatePassword(password: string): Promise<void> {
    const { error } = await this.supabase.auth.updateUser({ password });
    if (error) throw new Error(this.translate(error));
    this.telemetry.track('password_cambiata');
  }

  // ── Codice di recupero (reimpostare la password senza email) ──────────────

  /** Genera un nuovo codice di recupero (il precedente smette di valere). */
  async createRecoveryCode(): Promise<string> {
    const { data, error } = await this.supabase.rpc('set_recovery_code');
    if (error || !data) throw new Error('Non è stato possibile creare il codice, riprova');
    this.telemetry.track('codice_recupero_creato');
    return data as string;
  }

  /** Data di creazione del codice di recupero, o null se l'utente non l'ha mai creato. */
  async recoveryCodeCreatedAt(): Promise<string | null> {
    const { data, error } = await this.supabase.rpc('recovery_code_created_at');
    if (error) throw error;
    return (data as string | null) ?? null;
  }

  /**
   * Reimposta la password con email + codice di recupero, poi accede.
   * @returns il nuovo codice di recupero (quello usato non vale più).
   */
  async recoverWithCode(email: string, code: string, password: string): Promise<string> {
    let res: Response;
    try {
      res = await fetch(`${environment.supabase.url}/functions/v1/recover-password`, {
        method: 'POST',
        headers: { apikey: environment.supabase.publishableKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), code, password }),
      });
    } catch {
      throw new Error('Nessuna connessione a internet');
    }
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.ok) {
      this.telemetry.track('recupero_password_fallito', { codice: String(body.error ?? res.status) });
      switch (body.error) {
        case 'invalid_code': throw new Error('Email o codice di recupero non corretti');
        case 'too_many_attempts': throw new Error('Troppi tentativi sbagliati: riprova tra un’ora');
        case 'weak_password': throw new Error('Password troppo debole: usa almeno 8 caratteri');
        default: throw new Error('Si è verificato un errore, riprova');
      }
    }
    await this.signIn(email, password);
    this.telemetry.track('password_recuperata_con_codice');     // dopo l'accesso: così l'evento ha l'utente
    return body.newCode as string;
  }

  /** Esce dall'account e cancella dal dispositivo i dati dell'account. */
  async signOut(): Promise<void> {
    try {
      this.telemetry.track('logout');
      await this.telemetry.flush(2000);
      await this.supabase.auth.signOut();
    } finally {
      this.clearLocalData();
      location.reload();
    }
  }

  /** Elimina definitivamente account e dati online (funzione SQL delete_my_account). */
  async deleteAccount(): Promise<void> {
    const { error } = await this.supabase.rpc('delete_my_account');
    if (error) throw new Error('Eliminazione non riuscita, riprova più tardi');
    this.telemetry.track('account_eliminato');
    await this.telemetry.flush(2000);
    await this.supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
    this.clearLocalData();
    location.reload();
  }

  clearLocalData(): void {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(LOCAL_DATA_PREFIX) && !KEEP_ON_LOGOUT.has(k)) keys.push(k);
    }
    keys.forEach(k => localStorage.removeItem(k));
  }

  private async loadProfile(): Promise<void> {
    const id = this.user?.id;
    if (!id) return;
    const { data } = await this.supabase.from('profiles').select('display_name').eq('user_id', id).maybeSingle();
    this.displayName$.next(data?.display_name ?? '');
  }

  private translate(error: AuthError): string {
    switch (error.code) {
      case 'invalid_credentials': return 'Email o password non corretti';
      case 'user_already_exists':
      case 'email_exists': return 'Esiste già un account con questa email. Prova ad accedere.';
      case 'weak_password': return 'Password troppo debole: usa almeno 8 caratteri con lettere e numeri';
      case 'same_password': return 'La nuova password deve essere diversa da quella attuale';
      case 'email_address_invalid':
      case 'validation_failed': return 'Indirizzo email non valido';
      case 'over_request_rate_limit': return 'Troppi tentativi: riprova tra qualche minuto';
      case 'signup_disabled': return 'Le nuove registrazioni sono disattivate';
    }
    if (!navigator.onLine) return 'Nessuna connessione a internet';
    return 'Si è verificato un errore, riprova';
  }
}
