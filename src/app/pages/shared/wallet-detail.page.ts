import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController, ModalController, ToastController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { WalletService } from '../../services/wallet.service';
import { CategoryService } from '../../services/category.service';
import { MemberBalance, Settlement, SharedExpense, Wallet } from '../../models/wallet.model';
import { LoyaltyCard } from '../../models/loyalty-card.model';
import { ExpenseFormComponent } from '../../components/expense-form/expense-form.component';
import { LoyaltyCardFormComponent } from '../../components/loyalty-card-form/loyalty-card-form.component';
import { LoyaltyCardViewComponent } from '../../components/loyalty-card-view/loyalty-card-view.component';

@Component({
  selector: 'app-wallet-detail',
  templateUrl: './wallet-detail.page.html',
  standalone: false,
})
export class WalletDetailPage implements OnInit, OnDestroy {
  wallet?: Wallet;
  segment: 'expenses' | 'balances' | 'cards' | 'members' = 'expenses';
  expenses: SharedExpense[] = [];
  balances: MemberBalance[] = [];
  settlements: Settlement[] = [];
  myId = '';
  private id = '';
  private sub?: Subscription;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private auth: AuthService,
    private walletSvc: WalletService,
    private categories: CategoryService,
    private modal: ModalController,
    private alert: AlertController,
    private toast: ToastController,
  ) {}

  ngOnInit(): void {
    this.id = this.route.snapshot.paramMap.get('id') ?? '';
    this.myId = this.auth.user?.id ?? '';
    this.sub = this.walletSvc.wallets$.subscribe(list => {
      this.wallet = list.find(w => w.id === this.id);
      if (!this.wallet) return;
      this.expenses = [...this.wallet.data.expenses].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
      const r = this.walletSvc.balances(this.id);
      this.balances = r.balances;
      this.settlements = r.settlements;
    });
    if (this.route.snapshot.queryParamMap.get('invite')) setTimeout(() => this.shareInvite(), 400);
  }

  ngOnDestroy(): void { this.sub?.unsubscribe(); }

  name(userId: string | undefined): string {
    const m = this.wallet?.members.find(x => x.userId === userId);
    return m ? (m.isMe ? 'Tu' : m.displayName) : 'Ex membro';
  }

  emoji(categoryId: string): string {
    return this.categories.getCategoryById(categoryId)?.emoji ?? '💸';
  }

  fmtDate(day: string): string {
    const [y, m, d] = day.split('-').map(Number);
    return new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(y, m - 1, d));
  }

  get total(): number {
    return this.expenses.filter(e => !e.isSettlement).reduce((a, e) => a + e.amount, 0);
  }

  async addExpense(expense?: SharedExpense): Promise<void> {
    if (!this.wallet) return;
    const m = await this.modal.create({
      component: ExpenseFormComponent,
      componentProps: { wallet: this.wallet, expense, myUserId: this.myId },
    });
    await m.present();
    const { data } = await m.onDidDismiss();
    if (data?.expense) this.walletSvc.saveExpense(this.id, data.expense);
    if (data?.delete && expense) {
      if (await this.confirm('Eliminare la spesa?', 'Verrà eliminata per tutti i membri del wallet.')) {
        this.walletSvc.deleteExpense(this.id, expense.id);
      }
    }
  }

  /** Registra un rimborso: chi doveva dei soldi li ha restituiti. */
  async settle(s: Settlement): Promise<void> {
    if (!this.wallet) return;
    const cur = this.wallet.currency;
    const a = await this.alert.create({
      header: 'Registrare il rimborso?',
      message: `${this.name(s.from)} → ${this.name(s.to)}: ${new Intl.NumberFormat('it-IT', { style: 'currency', currency: cur }).format(s.amount)}`,
      buttons: [{ text: 'Annulla', role: 'cancel' }, { text: 'Registra', role: 'confirm' }],
    });
    await a.present();
    if ((await a.onDidDismiss()).role !== 'confirm') return;
    const now = new Date().toISOString();
    this.walletSvc.saveExpense(this.id, {
      id: crypto.randomUUID(), title: 'Rimborso', amount: s.amount, date: now.slice(0, 10), category: 'altro-uscita',
      paidBy: s.from, splitMode: 'amount', shares: [{ userId: s.to, value: s.amount }], isSettlement: true,
      createdBy: this.myId, createdAt: now, updatedAt: now,
    });
  }

  async shareInvite(): Promise<void> {
    if (!this.wallet) return;
    const text = `Unisciti al mio wallet "${this.wallet.name}" su FinanzAI con il codice ${this.wallet.inviteCode}\nhttps://marctie.github.io/FinanzAi/`;
    try {
      if ((navigator as any).share) { await (navigator as any).share({ title: 'Invito FinanzAI', text }); return; }
    } catch { return; }
    const a = await this.alert.create({
      header: 'Codice invito',
      message: `Condividi questo codice con chi vuoi invitare: ${this.wallet.inviteCode}`,
      buttons: [
        { text: 'Copia', handler: () => { navigator.clipboard?.writeText(this.wallet!.inviteCode).catch(() => undefined); } },
        { text: 'Chiudi', role: 'cancel' },
      ],
    });
    await a.present();
  }

  async regenerateInvite(): Promise<void> {
    if (!await this.confirm('Nuovo codice invito?', 'Il codice attuale smetterà di funzionare.', 'Cambia')) return;
    try { await this.walletSvc.regenerateInvite(this.id); } catch (e) { this.showToast((e as Error).message); }
  }

  async removeMember(userId: string): Promise<void> {
    if (!await this.confirm(`Rimuovere ${this.name(userId)}?`, 'Le spese già registrate restano nel wallet.', 'Rimuovi')) return;
    try { await this.walletSvc.removeMember(this.id, userId); } catch (e) { this.showToast((e as Error).message); }
  }

  async rename(): Promise<void> {
    if (!this.wallet) return;
    const a = await this.alert.create({
      header: 'Modifica wallet',
      inputs: [
        { name: 'name', value: this.wallet.name, attributes: { maxlength: 60 } },
        { name: 'emoji', value: this.wallet.emoji, attributes: { maxlength: 4 } },
      ],
      buttons: [{ text: 'Annulla', role: 'cancel' }, { text: 'Salva', role: 'confirm' }],
    });
    await a.present();
    const { role, data } = await a.onDidDismiss();
    if (role !== 'confirm' || !data?.values?.name?.trim()) return;
    try { await this.walletSvc.rename(this.id, data.values.name, data.values.emoji || '👛'); } catch (e) { this.showToast((e as Error).message); }
  }

  async leave(): Promise<void> {
    const last = (this.wallet?.members.length ?? 0) <= 1;
    if (!await this.confirm('Uscire dal wallet?', last ? 'Sei l’ultimo membro: il wallet e tutte le sue spese verranno eliminati.' : 'Potrai rientrare solo con un nuovo invito.', 'Esci')) return;
    try {
      await this.walletSvc.leave(this.id);
      this.router.navigateByUrl('/tabs/shared');
    } catch (e) { this.showToast((e as Error).message); }
  }

  // ── Carte del wallet ──────────────────────────────────────────────────────

  async addCard(): Promise<void> {
    if (!this.wallet) return;
    const m = await this.modal.create({
      component: LoyaltyCardFormComponent, componentProps: { wallets: [this.wallet], destination: this.id, lockDestination: true },
    });
    await m.present();
    const { data } = await m.onDidDismiss();
    if (data?.card) this.walletSvc.saveCard(this.id, { ...data.card, createdBy: this.myId });
  }

  async openCard(card: LoyaltyCard): Promise<void> {
    const v = await this.modal.create({ component: LoyaltyCardViewComponent, componentProps: { card, walletName: this.wallet?.name } });
    await v.present();
    if (!(await v.onDidDismiss()).data?.edit) return;
    const f = await this.modal.create({
      component: LoyaltyCardFormComponent, componentProps: { card, wallets: [this.wallet], destination: this.id, lockDestination: true },
    });
    await f.present();
    const res = (await f.onDidDismiss()).data;
    if (res?.card) this.walletSvc.saveCard(this.id, res.card);
    if (res?.delete && await this.confirm('Eliminare la carta?', 'Verrà eliminata per tutti i membri.')) this.walletSvc.deleteCard(this.id, card.id);
  }

  trackById = (_: number, x: { id: string }) => x.id;

  private async confirm(header: string, message: string, ok = 'Elimina'): Promise<boolean> {
    const a = await this.alert.create({ header, message, buttons: [{ text: 'Annulla', role: 'cancel' }, { text: ok, role: 'destructive' }] });
    await a.present();
    return (await a.onDidDismiss()).role === 'destructive';
  }

  private async showToast(message: string): Promise<void> {
    (await this.toast.create({ message, duration: 2500, position: 'top' })).present();
  }
}
