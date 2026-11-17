import { Component, OnDestroy, OnInit } from '@angular/core';
import { AlertController, ModalController, ToastController } from '@ionic/angular';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, combineLatest } from 'rxjs';
import { User } from '@supabase/supabase-js';
import { AuthService } from '../../services/auth.service';
import { StorageService } from '../../services/storage.service';
import { WalletService } from '../../services/wallet.service';
import { SyncService, SyncStatus } from '../../services/sync.service';
import { Wallet } from '../../models/wallet.model';
import { LoyaltyCard } from '../../models/loyalty-card.model';
import { AuthComponent } from '../../components/auth/auth.component';
import { LoyaltyCardFormComponent } from '../../components/loyalty-card-form/loyalty-card-form.component';
import { LoyaltyCardViewComponent } from '../../components/loyalty-card-view/loyalty-card-view.component';

interface CardItem { card: LoyaltyCard; walletId: string | null; walletName?: string }

/** Scheda "Condivisi": wallet di spese condivise e carte fedeltà (personali e condivise). */
@Component({
  selector: 'app-shared',
  templateUrl: './shared.page.html',
  standalone: false,
})
export class SharedPage implements OnInit, OnDestroy {
  segment: 'wallets' | 'cards' = 'wallets';
  user: User | null = null;
  wallets: Wallet[] = [];
  cards: CardItem[] = [];
  status: SyncStatus = 'idle';
  private subs: Subscription[] = [];

  constructor(
    public auth: AuthService,
    private storage: StorageService,
    private walletSvc: WalletService,
    private sync: SyncService,
    private modal: ModalController,
    private alert: AlertController,
    private toast: ToastController,
    private router: Router,
    private route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    this.subs.push(
      this.auth.user$.subscribe(u => this.user = u),
      this.sync.status$.subscribe(s => this.status = s),
      this.route.queryParamMap.subscribe(p => { if (p.get('tab') === 'cards') this.segment = 'cards'; }),
      combineLatest([this.walletSvc.wallets$, this.storage.loyaltyCards]).subscribe(([wallets, personal]) => {
        this.wallets = wallets;
        this.cards = [
          ...personal.map(card => ({ card, walletId: null })),
          ...wallets.flatMap(w => w.data.loyaltyCards.map(card => ({ card, walletId: w.id, walletName: w.name }))),
        ].sort((a, b) => a.card.store.localeCompare(b.card.store, 'it'));
      }),
    );
  }

  ngOnDestroy(): void { this.subs.forEach(s => s.unsubscribe()); }

  async refresh(ev: CustomEvent): Promise<void> {
    await this.sync.sync();
    await this.walletSvc.refreshList();
    (ev.target as HTMLIonRefresherElement).complete();
  }

  myBalance(w: Wallet): number {
    const me = w.members.find(m => m.isMe)?.userId;
    return this.walletSvc.balances(w.id).balances.find(b => b.userId === me)?.net ?? 0;
  }

  async openAuth(mode: 'login' | 'signup' = 'login'): Promise<void> {
    const m = await this.modal.create({ component: AuthComponent, componentProps: { mode } });
    await m.present();
  }

  async createWallet(): Promise<void> {
    const a = await this.alert.create({
      header: 'Nuovo wallet',
      message: 'Un wallet raccoglie le spese condivise con altre persone (casa, viaggio, coppia...).',
      inputs: [
        { name: 'name', placeholder: 'Nome (es. Casa, Vacanza 2027)', attributes: { maxlength: 60 } },
        { name: 'emoji', placeholder: 'Emoji (facoltativa)', value: '👛', attributes: { maxlength: 4 } },
      ],
      buttons: [{ text: 'Annulla', role: 'cancel' }, { text: 'Crea', role: 'confirm' }],
    });
    await a.present();
    const { role, data } = await a.onDidDismiss();
    const name = (data?.values?.name ?? '').trim();
    if (role !== 'confirm' || !name) return;
    try {
      const id = await this.walletSvc.create(name, this.storage.prefsSnapshot.defaultCurrency || 'EUR', (data.values.emoji || '👛').trim());
      this.router.navigate(['/tabs/shared/wallet', id], { queryParams: { invite: 1 } });
    } catch (e) {
      this.showToast((e as Error).message);
    }
  }

  async joinWallet(): Promise<void> {
    const a = await this.alert.create({
      header: 'Entra in un wallet',
      message: 'Inserisci il codice invito che ti ha mandato un membro del wallet.',
      inputs: [{ name: 'code', placeholder: 'Codice invito (8 caratteri)', attributes: { maxlength: 12, autocapitalize: 'characters' } }],
      buttons: [{ text: 'Annulla', role: 'cancel' }, { text: 'Entra', role: 'confirm' }],
    });
    await a.present();
    const { role, data } = await a.onDidDismiss();
    const code = (data?.values?.code ?? '').trim();
    if (role !== 'confirm' || !code) return;
    try {
      const id = await this.walletSvc.join(code);
      this.router.navigate(['/tabs/shared/wallet', id]);
    } catch (e) {
      this.showToast((e as Error).message);
    }
  }

  // ── Carte fedeltà ─────────────────────────────────────────────────────────

  async addCard(): Promise<void> {
    const m = await this.modal.create({
      component: LoyaltyCardFormComponent,
      componentProps: { wallets: this.user ? this.wallets : [], destination: 'personal' },
    });
    await m.present();
    const { data } = await m.onDidDismiss();
    if (!data?.card) return;
    const card: LoyaltyCard = { ...data.card, createdBy: this.user?.id };
    if (data.destination === 'personal') this.storage.saveLoyaltyCard(card);
    else this.walletSvc.saveCard(data.destination, card);
  }

  async openCard(item: CardItem): Promise<void> {
    const v = await this.modal.create({
      component: LoyaltyCardViewComponent,
      componentProps: { card: item.card, walletName: item.walletName },
      cssClass: 'card-view-modal',
    });
    await v.present();
    const { data } = await v.onDidDismiss();
    if (!data?.edit) return;
    const f = await this.modal.create({
      component: LoyaltyCardFormComponent,
      componentProps: { card: item.card, wallets: this.wallets, destination: item.walletId ?? 'personal', lockDestination: true },
    });
    await f.present();
    const res = (await f.onDidDismiss()).data;
    if (!res) return;
    if (res.delete) {
      const ok = await this.confirm('Eliminare la carta?', item.walletId ? 'Verrà eliminata anche per gli altri membri del wallet.' : '');
      if (!ok) return;
      if (item.walletId) this.walletSvc.deleteCard(item.walletId, item.card.id);
      else this.storage.deleteLoyaltyCard(item.card.id);
    } else if (res.card) {
      if (item.walletId) this.walletSvc.saveCard(item.walletId, res.card);
      else this.storage.saveLoyaltyCard(res.card);
    }
  }

  trackCard = (_: number, c: CardItem) => c.card.id;
  trackWallet = (_: number, w: Wallet) => w.id;

  private async confirm(header: string, message: string): Promise<boolean> {
    const a = await this.alert.create({ header, message, buttons: [{ text: 'Annulla', role: 'cancel' }, { text: 'Elimina', role: 'destructive' }] });
    await a.present();
    return (await a.onDidDismiss()).role === 'destructive';
  }

  private async showToast(message: string): Promise<void> {
    (await this.toast.create({ message, duration: 2500, position: 'top' })).present();
  }
}
