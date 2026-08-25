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
          a: 'Esclusivamente sul tuo dispositivo. Nessun account, nessun server esterno, nessuna pubblicità.',
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
