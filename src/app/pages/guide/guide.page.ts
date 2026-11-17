import { Component } from '@angular/core';

interface GuideSection {
  icon: string;
  title: string;
  items: { q: string; a: string }[];
}

@Component({
  selector: 'app-guide',
  templateUrl: './guide.page.html',
  styleUrls: ['./guide.page.scss'],
  standalone: false,
})
export class GuidePage {
  sections: GuideSection[] = [
    {
      icon: 'add-circle-outline',
      title: 'Registrare un movimento',
      items: [
        {
          q: 'Come aggiungo una spesa o un\'entrata?',
          a: 'Tocca il pulsante "+" al centro della barra in basso. Scegli Uscita o Entrata, inserisci importo, titolo, categoria, data e — se vuoi — metodo di pagamento e note. Salva per confermare.',
        },
        {
          q: 'A cosa serve il "suggerimento categoria"?',
          a: 'Mentre scrivi il titolo, l\'app propone automaticamente una categoria in base a parole chiave (es. "Esselunga" → Spesa). Puoi sempre cambiarla manualmente dal menu a tendina.',
        },
      ],
    },
    {
      icon: 'pricetags-outline',
      title: 'Categorie',
      items: [
        {
          q: 'Posso creare categorie personalizzate?',
          a: 'Sì. Vai in Altro → Gestisci categorie → "+" in basso a destra. Scegli nome, tipo (entrata/uscita), un\'emoji e un colore. Le categorie predefinite non si possono modificare o eliminare, solo quelle create da te.',
        },
      ],
    },
    {
      icon: 'wallet-outline',
      title: 'Budget mensili',
      items: [
        {
          q: 'Come imposto un budget?',
          a: 'Vai nella scheda Budget → "+" per creare un nuovo budget su una categoria di spesa, con un importo mensile e una soglia di allerta (es. 80%). La barra diventa gialla/rossa quando ti avvicini o superi il limite.',
        },
      ],
    },
    {
      icon: 'trophy-outline',
      title: 'Obiettivi di risparmio',
      items: [
        {
          q: 'Come funzionano gli obiettivi?',
          a: 'Da Home → Obiettivi puoi creare un obiettivo con nome, importo target ed eventuale scadenza. Usa "+ Aggiungi" sulla card per registrare un contributo e far avanzare la percentuale di completamento.',
        },
      ],
    },
    {
      icon: 'stats-chart-outline',
      title: 'Analisi e insight',
      items: [
        {
          q: 'Da dove vengono i suggerimenti e le previsioni?',
          a: 'La Home mostra un riepilogo del mese, l\'andamento degli ultimi 6 mesi e la ripartizione per categoria. Gli insight (es. transazioni ricorrenti, previsione di fine mese) sono calcolati interamente sul tuo dispositivo con semplici regole matematiche — nessun dato lascia mai il telefono.',
        },
      ],
    },
    {
      icon: 'shield-checkmark-outline',
      title: 'Dati e backup',
      items: [
        {
          q: 'Dove sono salvati i miei dati?',
          a: 'Senza account restano solo sul tuo dispositivo. Se crei un account (facoltativo, da Altro → Account) vengono sincronizzati in modo sicuro su server in UE, così li ritrovi su telefono e web. Nessuna pubblicità.',
        },
        {
          q: 'Come funzionano i wallet condivisi?',
          a: 'Da Condivisi → Wallet crei un wallet e lo condividi con un codice invito. Ogni spesa indica chi ha pagato e come si divide (parti uguali, percentuale o importi): FinanzAI calcola chi deve a chi. Quando qualcuno restituisce i soldi tocca "Saldato".',
        },
        {
          q: 'E le carte fedeltà?',
          a: 'Da Condivisi → Carte fedeltà aggiungi le carte (anche scansionandole) e le mostri alla cassa dal telefono. Puoi tenerle per te o condividerle con i membri di un wallet.',
        },
        {
          q: 'Ho dimenticato la password',
          a: 'Usa "Password dimenticata?" nella schermata di accesso con la tua email e il codice di recupero che hai salvato alla registrazione. Puoi generarne uno nuovo da Altro → Account.',
        },
        {
          q: 'Come faccio un backup?',
          a: 'Altro → Backup e dati → "Esporta backup completo" scarica un file JSON con tutti i tuoi dati. Per ripristinarlo su questo o un altro dispositivo, usa "Ripristina da backup" e seleziona il file: l\'app verifica automaticamente che non sia corrotto prima di importarlo.',
        },
        {
          q: 'Cosa succede se cancello tutti i dati?',
          a: 'L\'operazione in Altro → "Cancella tutti i dati" è irreversibile e cancella transazioni, budget, obiettivi e categorie personalizzate dal dispositivo. Fai sempre un backup prima, se vuoi conservare una copia.',
        },
      ],
    },
  ];
}
