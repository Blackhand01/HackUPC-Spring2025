# OnlyFly: Documento di Descrizione Applicativa

## 1. Introduzione

OnlyFly è la prima piattaforma di scambio casa potenziata dall'intelligenza artificiale che permette di viaggiare in tutto il mondo spendendo il meno possibile.  Il nostro obiettivo è semplice: eliminare tutte le spese di viaggio eccetto quella del volo, offrendo esperienze autentiche e personalizzate.

Come funziona?
Registrati e aggiungi la tua casa:
Metti a disposizione la tua abitazione indicando destinazioni e date di preferenza.
Matching intelligente:
L'app utilizza un avanzato sistema di matching , che analizza le preferenze, personalità e interessi degli utenti per trovare il match perfetto per lo scambio casa.

Prenota il volo più economico:
Integrando le API di Skyscanner, OnlyFly suggerisce i voli più convenienti nelle date selezionate, ottimizzando i costi.

Pagamenti sicuri e facili:
Grazie alle API Revolut, gestisci i pagamenti direttamente dalla piattaforma, con possibilità di caparre, carte virtuali e payout automatizzati per una sicurezza totale.

Feedback e Ranking:
Lascia recensioni e ricevi feedback, costruendo così una community sicura e affidabile.


## 2. Scopo e stakeholder

* **Utente viaggiatore:** desidera semplicità nella creazione di gruppi e nella scelta delle destinazioni.
* **Amministratore di sistema:** monitora metriche di performance e gestisce integrazioni.
* **Sponsor API (Skyscanner, Revolut, OpenAI/Gemini, Grafana):** richiedono flussi di integrazione ben definiti.

## 3. Challenge Sponsor

* **Pianificazione di gruppo - SkyScanner**: The Perfect Reunion Finding the Best Destination for friends around the world. Imagine a group of friends who live in different locations and want to meet in the perfect destination. But where should they go? Your challenge is to design a user-friendly travel planner that helps a group of friends easily find a great meeting destination. The focus is on creating a fun, collaborative experience where everyone has a say in the final decision. Some criteria examples to agree on the best destination: - Green Travel – optimizing for the most eco-friendly that reduce carbon footprints - Interests-Based Recommendation – factoring in each traveler’s preferences, such as art, culture, food, weather, or outdoor adventures. - Events - concerts, football matches, etc - Cheapest Destination – considering flights and trains data
* **Wallet e budgeting AI-powered - Revolut**: AI in Financial Applications Build an AI-powered solution for the financial world. Whether it’s a chatbot that helps users budget better or a generative model that designs unique bank cards — anything goes. From practical tools to wild prototypes, we’re looking for innovation, impact, and creativity. Your project must use tools currently regarded as AI. These can include not only LLMs but also other deep learning algorithms. Note that we will not provide access to any APIs, so you must either use your own accounts or run models locally. Where to start: Think about the pain you experience in day-to-day interactions with financial apps. If AI can solve one of those pains, it’s a great idea for the hackathon. Also, many startups are already applying AI in finance — don’t hesitate to draw inspiration from them. Other ideas that aren’t necessarily solving a pain but are still cool are also welcome.One thing to note: avoid making just another finance chatbot. We’re looking for originality, not a sea of the same. What do we expect? We expect you to build a working prototype. A cool presentation alone isn’t enough — we want to see a technological solution. Open-sourcing your work is also encouraged.
* **Comunicazione critica offline - Vueling**: Watch out, Blackout! Develop a super minimal application for travellers about to take a flight that allows for the sharing of critical flight information in case of a blackout. -Ad hoc communication network between users; -Prioritise critical and flight information; -Super minimal app, low battery consumption; -Objective: keep information flowing and spirits up; -Bonus points on gamification and creating a memorable experience from the disaste
* **Dashboard di sostenibilità -Grafana**:  Green Grafana Join Grafana Labs in driving impact for the UN Sustainable Development Goals (SDGs - https://sdgs.un.org/goals)! This challenge invites you to leverage Grafana's power to raise awareness and provide insights into these critical global issues, with a particular interest in environmental sustainability. You have the flexibility to approach this challenge in two exciting ways (or a combination of both!): 1. Data Visualization Powerhouse: Ingest open data from one or more sources into Grafana. Transform this data to reveal meaningful trends and create compelling dashboards that effectively communicate the challenges and potential solutions for your chosen SDG(s). Explore various visualization types to craft impactful narratives (panels, canvas, etc). 2. Grafana App Innovator: Go beyond traditional dashboards and develop a Grafana App plugin (panel, dashboard, scenes, the sky is the limit!) that provides unique insights or functionalities related to your chosen SDG(s). Get inspired by the Grafana plugin examples: https://grafana.com/developers/plugin-tools/plugin-examples/. Your app could offer interactive visualizations, custom data displays, or even integrate external tools and APIs. We encourage you to focus on environmental SDGs (e.g., Climate Action, Life Below Water, Life on Land), though all SDGs are valid and welcome. Here are some starting points for open data (feel free to explore others!), and mix them: * UN SDG Data (https://unstats.un.org/sdgs/indicators/database/) * World Bank Open Data (https://data.worldbank.org/) * Our World in Data (https://ourworldindata.org/) * Open Sustainable Technology (https://opensustain.tech/) * etc. During our 30-minute introductory talk, we'll teach you the basics of ingesting data into Grafana, understanding metrics and logs, and even guiding you through the initial steps of creating your own Grafana plugin app. We can't wait to see your innovative solutions!

## 4. Vision e obiettivi

* **Esperienza utente fluida:** join one-click, interfacce intuitive.
* **Sostenibilità:** evidenziare impatto CO₂ e punteggi green.
* **Collaborazione finanziaria:** wallet condiviso e splitting automatico delle spese.
* **Sicurezza operativa:** comunicazioni critiche anche offline.
* **Data-driven:** dashboard e alert per performance e sostenibilità.

## 5. Caratteristiche principali

1. **Registrazione & Profilo:** OAuth/email, verifica, dettagli alloggio, OCR identità, conto per pagamenti.
2. **Gruppi di viaggio:** creazione link one-click, selezione mood/attività/durata.
3. **Selezione destinazioni:** cards con costo volo, stima CO₂, date consigliate.
4. **Matching & Smart Swap:** mappe interattive e notifiche real-time.
5. **Prenotazioni & Wallet:** voli via Skyscanner, wallet Revolut, splitting e cauzioni.
6. **Comunicazioni critiche:** chat multilingue, Panic Button, fallback P2P.
7. **Follow-up & valutazioni:** reminder calendario, feedback, gestione dispute.
8. **Analytics & Dashboard:** metriche host, alert Grafana, esportazione dati.

## 6. Requisiti stakeholder (SR)

**SR1. Accesso e autenticazione**

* SR1.1: Registrazione via OAuth (Facebook/Google).
* SR1.2: Registrazione via email/SMS con verifica codice.
* SR1.3: Verifica email e telefono.
* SR1.4: Supporto MFA opzionale.
* SR1.5: Upload documento e verifica identità con OCR.
* SR1.6: Apertura istantanea del conto Revolout di gruppo e pagamento volo al termine della prenotazione.

**SR2. Gestione profilo e alloggi**

* SR2.1: CRUD profilo utente.
* SR2.2: CRUD dettagli alloggio (foto, descrizione, servizi, regole casa).
* SR2.3: Calcolo e visualizzazione punteggio green.

**SR3. Creazione e gestione gruppi**

* SR3.1: Generazione e condivisione link di invito one-click via WhatsApp/Telegram.
* SR3.2: Join semplificato tramite link senza ulteriori credenziali.

**SR4. Pianificazione emotiva e destinazioni**

* SR4.1: Selezione mood, attività e durata vacanza tramite slider.
* SR4.2: Visualizzazione di cards destinazioni con foto evocativa, costo volo stimato, stima CO₂, posizione e data consigliata.

**SR5. Matching avanzato e Smart Swap**

* SR5.1: Visualizzazione delle soluzioni di viaggio su mappa interattiva con metriche di costi e score green.
* SR5.2: Notifiche push real-time per nuovi possibili match (Smart Swap).
* SR5.3: Supporto algoritmo ibrido (ML + regole vincolistiche su date, budget e preferenze).

**SR6. Prenotazioni, wallet condiviso e finanza**

* SR6.1: Integrazione con API Skyscanner per ricerca e prenotazione voli.
* SR6.2: Apertura automatica di un wallet di gruppo su Revolut.
* SR6.3: Splitting automatico delle spese e gestione cauzioni.
* SR6.4: Pagamento del volo al termine della prenotazione tramite Revolut.

**SR7. Comunicazioni critiche e sicurezza soggiorno**

* SR7.1: Chat multilingue con traduzione automatica.
* SR7.2: Panic Button per emergenze con invio SMS/WhatsApp.
* SR7.3: Fallback P2P per condivisione dati GPS.

**SR8. Ritorno e follow-up**

* SR8.1: Reminder automatici su Google/Outlook Calendar a 24 h, 3 h e 1 h dal ritorno.
* SR8.2: Valutazione post-viaggio con upload di foto/video come prova.
* SR8.3: Automazione del blocco/sblocco cauzioni in base agli esiti delle dispute.

**SR9. Analytics e dashboard**

* SR9.1: Dashboard Grafana per host con metriche su occupazione, revenue, trend stagionali e emissioni CO₂.
* SR9.2: Configurazione di alert su occupazione bassa, punteggi di pulizia e cancellazioni last-minute.

## 7. Flussi di alto livello

1. **Onboarding:** registrazione, verifica, upload casa.
2. **Gruppo e destinazioni:** link invito, scelta mood, proposte di viaggio.
3. **Match e booking:** mappe, prenotazione voli, setup wallet.
4. **Soggiorno:** chat, car-share, emergenze.
5. **Chiusura:** reminder, feedback, cauzioni.

## 8. Workflow esteso

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
   * **Notifica match**: notifiche push per richiesta di swap.



4. **Gestione del soggiorno**

   * **Chat multilingue** con traduzione automatica (OpenAI/Gemini).
   * **Panic Button**: invio SMS/WhatsApp + fallback P2P con ultimi dati GPS.

5. **Ritorno e follow-up**

   * **Reminder ritorno**: integrazione calendario (Google/Outlook) con alert 24 h/3 h/1 h prima.
   * **Form valutazione**: punteggi pulizia, comunicazione, puntualità e sostenibilità; upload prove (foto/video).
   * **Gestione cauzione**: deposit blocco/sblocco via Revolut in base all’esito delle dispute.

6. **Analytics e dashboard**

   * **Host dashboard** (Grafana): occupazione, revenue, trend stagionali, emissioni CO₂, consigli eco.
   * **Alert Grafana**: occupazione bassa, punteggio pulizia scarso, cancellazioni last-minute.




