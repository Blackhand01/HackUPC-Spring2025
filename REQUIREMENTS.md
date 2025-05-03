# OnlyFly

## 1. Descrizione generale dell’app

**OnlyFly**: consente lo scambio di case tra utenti singoli o piccoli gruppi in tutto il mondo.

Le principali aree di innovazione sono:

* **Pianificazione di gruppo** (SkyScanner “Perfect Reunion”)
* **Wallet e budgeting AI-powered** (Revolut “AI in Financial Applications”)
* **Comunicazione critica offline** (Vueling “Watch out, Blackout!”)
* **Dashboard di sostenibilità** (Grafana “Green Grafana”)

---

## 2. Funzionalità chiave

| Area                     | Caratteristiche principali                                                                                                                                                                                           | Sponsor Challenge                      |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| **Onboarding & Profilo** | - Registrazione tramite email/social (Facebook/Google/Email) <br> - Creazione e personalizzazione profilo <br> - Upload foto della casa con titolo, descrizione, servizi e posizione geografica | —                                      |
| **Group Matching**       | - Creazione rapida di gruppi con link di invito <br> -   (date, budget, interessi, preferenze green) <br> - Votazione e ranking delle destinazioni (slider, commenti)                       | SkyScanner “Perfect Reunion”           |
| **Travel Planning**      | - “Group Flight Finder” per voli low-cost singoli o di gruppo via API Skyscanner <br> - Stima impatto CO₂ per ogni destinazione combinando dati Skyscanner + Grafana                                                 | SkyScanner                             |
| **Budget & Wallet**      | - Wallet virtuale condiviso con sottogruppi <br> - Chatbot AI (OpenAI Function Calling) per splitting spese, alert risparmio e proposte di ottimizzazione finanziaria                                                | Revolut “AI in Financial Applications” |
| **Critical Comms**       | - “Blackout Mode” fallback P2P via Bluetooth/Wi-Fi Direct <br> - Condivisione orari di volo e boarding pass senza connessione                                                                                        | Vueling “Watch out, Blackout!”         |
| **Cupra AR Experience**  | - Mini-gioco AR “Know Your Cupra”: esplora caratteristiche del veicolo locale e colleziona badge mentre aspetti il check-in                                                                                          | SEAT “Know Your Cupra”                 |
| **Green Analytics**      | - Dashboard Grafana con emissioni stimate, suggerimenti eco <br> - Classifica utenti per sostenibilità <br> - Recensioni basate su punteggi green                                                                    | Grafana “Green Grafana”                |

---

## 3. Workflow MVP

1. **Registrazione**

   * L’utente crea un account e carica una o più abitazioni (foto, servizi, descrizione, localizzazione).

2. **Pianificazione viaggio**

   * Scelta modalità: singolo, duo o gruppo.
   * Compilazione questionario “Perfect Reunion” (date, budget, sostenibilità).
   * Il motore propone fino a 3 destinazioni ottimali (costo volo + CO₂).

3. **Match e selezione casa**

   * Matching basato su disponibilità, budget e preferenze green.
   * I partecipanti valutano le case suggerite e scelgono quella da scambiare.

4. **Prenotazione e wallet**

   * Booking voli (individuo o gruppo) via API Skyscanner.
   * Creazione automatica del wallet di gruppo su Revolut: AI propone splitting e invia alert risparmio.

5. **Esperienza pre-viaggio**

   * Accesso all’AR mini-gioco Cupra per guadagnare badge in attesa della partenza.

6. **Demo “Blackout Mode”**

   * Live demo dello scambio P2P di dati di volo offline.

7. **Soggiorno e monitoraggio green**

   * Grafana dashboard per host: emissioni totali e consigli eco.
   * Guest caricano media; il sistema genera valutazioni e recensioni finali.

---

## 4. Workflow esteso

1. **Registrazione e gestione profilo**

   * **Social & verifica**: OAuth (Facebook/Google) + conferma email/telefono.
   * **Dettagli alloggio**: camere, servizi, regole casa, punteggio green.
   * **Verifica identità**: upload documento e OCR.
   * **Integrazione Revolut**: apertura istantanea del conto di gruppo e pagamento volo al termine della prenotazione.

2. **Pianificazione end-to-end**

   * **Creazione gruppo**: link di invito condivisibile via WhatsApp/Telegram, join one-click.
   * **Selezione emozionale**: mood (Relax, Avventura…), attività (Mare, Montagna…) e durata (slider “Weekend ↔ 2+ settimane”).
   * **Cards destinazioni**: foto evocativa, costo volo + stima CO₂, posizione, data consigliata.

3. **Matching avanzato**

   * **Visualizzazione match**: mappe interattive con costi, score green e ranking utenti.
   * **Algoritmo ibrido**: ML + regole vincolistiche su date, budget e preferenze.
   * **Smart swap**: notifiche push per nuovi possibili match in tempo reale.

4. **Gestione del soggiorno**

   * **Chat multilingue** con traduzione automatica (OpenAI).
   * **Car-share locale**: disponibilità auto, tariffe, info veicolo via API SEAT/High Mobility, splitting costi su Revolut.
   * **Panic Button**: invio SMS/WhatsApp + fallback P2P con ultimi dati GPS.

5. **Ritorno e follow-up**

   * **Reminder ritorno**: integrazione calendario (Google/Outlook) con alert 24 h/3 h/1 h prima.
   * **Form valutazione**: punteggi pulizia, comunicazione, puntualità e sostenibilità; upload prove (foto/video).
   * **Gestione cauzione**: deposit blocco/sblocco via Revolut in base all’esito delle dispute.

6. **Analytics e dashboard**

   * **Host dashboard** (Grafana): occupazione, revenue, trend stagionali, emissioni CO₂, consigli eco.
   * **Alert Grafana**: occupazione bassa, punteggio pulizia scarso, cancellazioni last-minute.
   * **Esportazione dati**: CSV/JSON via endpoint API per BI (PowerBI, Google Data Studio).

---

## 5. Punti di forza per i giudici

* **Originalità ibrida**: coniuga scambio alloggi, pianificazione di gruppo, finanza AI, gamification AR e sostenibilità.
* **Demo funzionanti**: utilizzo integrato di 5 API sponsor, ognuna presentata con una funzionalità live.
* **Architettura scalabile**: backend modulare (Node.js + Python/ML), frontend React Native + AR, Grafana per analytics in tempo reale.

Con **HomeSwap Connect** offri un’esperienza end-to-end chiara, innovativa e coinvolgente, perfettamente in linea con le sfide SkyScanner, Revolut, Vueling, SEAT e Grafana.
