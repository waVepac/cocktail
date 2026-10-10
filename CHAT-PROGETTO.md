# Progetto Cocktails — richieste e decisioni

**Stato del progetto:** frontend Angular 15 e backend Node.js/Express, con persistenza in `db.json`.

## 1. Criteri di lavoro

- **Esaminare i file reali prima di modificare il progetto:** routing, moduli, servizi HTTP, layout, modelli e endpoint, senza presumere nomi o percorsi.
- Adattare inizialmente il frontend al backend Node.js esistente. Le modifiche successive al backend devono seguire le richieste esplicite, come il token restituito dalla registrazione e il formato dei preferiti.
- **Non introdurre OAuth o JWT:** rispettare il sistema di token opachi Bearer del backend.
- **Non creare file `.spec` per i test.** Verificare con compilazione e controlli appropriati, senza introdurre tali file.
- Mantenere una operazione per riga e non spezzare inutilmente le istruzioni.
- Consultare la [documentazione di TheCocktailDB](https://www.thecocktaildb.com/documentation) per endpoint e formati delle API pubbliche.
- Conservare lo stile elegante dell'applicazione. Il colore `#17395c` era il riferimento iniziale; i componenti nuovi, incluso lo spinner, devono seguire i colori principali effettivamente usati nell'interfaccia.

## 2. Immagini del catalogo e transizioni

- Usare immagini `/small` nelle righe per contenere il peso del catalogo.
- Precaricare l'immagine originale o una variante di qualità superiore prima della transizione verso il dettaglio.
- Evitare cambi di sorgente a metà animazione che producano flash o scatti.
- Mantenere l'effetto a piramide delle righe durante lo scroll: le righe precedenti e successive si riducono rispetto a quella in evidenza.
- Rendere la larghezza massima delle righe coerente con quella dei filtri e della barra di ricerca e ordinamento.

## 3. Autenticazione e navigazione

**La pagina iniziale deve essere sempre `/cocktails`, sia per gli ospiti sia per gli utenti autenticati.** La richiesta iniziale di un overlay automatico per gli ospiti è stata successivamente sostituita dall'apertura su richiesta.

- Centralizzare in `ApiService` le chiamate sia a TheCocktailDB sia al backend.
- Creare un overlay globale di autenticazione sopra la pagina, mantenendo visibile il catalogo sottostante.
- Realizzare una modale responsive a due pannelli: inizialmente decorazione a sinistra e campi login a destra.
- Il pulsante **Sign up** scambia i lati con un'animazione fluida: campi di registrazione a sinistra e decorazione a destra. **Sign in** esegue il passaggio inverso.
- **Mantenere stabile l'altezza della modale:** i nuovi campi devono comparire durante il movimento, senza attendere la fine dell'animazione.
- Chiudere la modale al click sullo sfondo esterno, con Escape e con il comando di chiusura.
- Collegare login e registrazione al backend, mostrando caricamento ed errori e persistendo la sessione in localStorage.
- Per un ospite, l'icona utente apre direttamente il login. Per un utente autenticato, apre il menu con **I miei preferiti** e **Logout**.
- **La registrazione deve autenticare immediatamente l'utente:** restituire il token insieme all'utente, con una risposta coerente con il login.
- Allineare `UserModel` e `AuthUser` ai dati effettivamente restituiti dal backend: `id` e `username`.
- Correggere il tipo dell'evento nel gestore `closeOnEscape` e verificare la gestione dello stato utente.

Il backend attuale non offre `/api/auth/me` o `/api/auth/logout`. La sessione viene verificata tramite `GET /api/favorites/`; il logout elimina la sessione locale. Questa scelta segue gli endpoint realmente disponibili.

## 4. Preferiti autenticati e ospiti

**I preferiti devono comprendere tutti i cocktail salvati, senza essere limitati alla categoria selezionata.**

- Salvare il record completo necessario alla visualizzazione: identificativo, nome e thumbnail del cocktail, associati all'utente e al flag `active`.
- Usare una struttura equivalente a:

```text
userId
favorite: { id, name, thumbnail }
active: boolean
```

- Quando un ospite aggiunge un preferito, mostrare un dialog con login, registrazione e possibilità di continuare senza autenticazione.
- Se continua come ospite, salvare il preferito in localStorage.
- Se sceglie login o registrazione, aggiungere il preferito dopo l'autenticazione.
- **Dopo il login, sincronizzare automaticamente i preferiti locali nel database e cancellarli da localStorage soltanto dopo la conferma del salvataggio.**
- Realizzare `GuestFavoriteDialogComponent` con file TypeScript, HTML e CSS separati.
- Rendere disponibili **I miei preferiti** anche dal menu dell'utente autenticato.

## 5. Ricerca, ordinamento e ripristino dello stato

- Rendere stabile la larghezza della tabella/lista centrale, evitando scatti laterali quando cambia l'ordinamento.
- Quando si seleziona l'ordinamento alfabetico, selezionare automaticamente la prima lettera dell'ordine scelto.
- In modalità alfabetica, sostituire le categorie con le lettere.
- **Nel passaggio al dettaglio e nel ritorno al catalogo, conservare ordinamento, categoria o lettera, ricerca, filtri e paginazione.**
- Valutare `state` rispetto ai query parameter: per lo stato del catalogo sono stati adottati i query parameter, così da consentire ripristino al ricaricamento e tramite URL.
- Consentire lo scroll orizzontale delle categorie con la rotella del mouse.
- Quando il puntatore si trova sulle categorie, circoscrivere lo scroll alla loro area anche al raggiungimento dei limiti, evitando che prosegua verticalmente sulla pagina.
- Stabilizzare la paginazione: la freccia sinistra non deve cambiare posizione al variare dei numeri o delle ellissi.

## 6. Pannello filtri e aggiornamento

Sostituire il precedente pulsante dedicato ai preferiti con una sezione **Filtri**, che apre un pannello sottostante.

- Aggiungere una select dei bicchieri disponibili, usando le API pubbliche per l'elenco e per il filtro.
- Aggiungere il filtro per tipologia alcolica e la checkbox **Solo i miei preferiti**.
- **I filtri per bicchiere e tipologia devono inizialmente cercare in tutto il catalogo**, azzerando la categoria selezionata.
- Consentire successivamente di selezionare una categoria per restringere ulteriormente i risultati: filtri e categorie devono essere combinabili.
- Non mostrare la categoria sotto il nome del cocktail quando le risposte delle API di filtro non la contengono. Questa correzione sostituisce la richiesta iniziale di aggiungerla a ogni riga.
- Aggiungere **Aggiorna** accanto ai filtri: cancellare la cache dei risultati e ripetere il caricamento della selezione corrente.
- Ridurre quanto necessario la larghezza del campo ricerca per inserire tutti i comandi.
- **Allineare la barra di ricerca e ordinamento, il pannello filtri e la riga più larga del catalogo.**

## 7. Cache e caricamento

- Mettere in cache le chiamate che restituiscono gli elenchi dei cocktail.
- **Durata della cache: cinque minuti.**
- Creare un componente spinner riutilizzabile con i colori principali dell'applicazione.
- Richiamare lo spinner nell'HTML dei componenti interessati.
- Gestire una variabile `loading`: attivarla all'inizio della richiesta e disattivarla alla conclusione, anche in caso di errore, tramite `finally` o `finalize` secondo il flusso usato.
- Fornire un riscontro visivo durante le richieste API.

## 8. Dettaglio cocktail

- Al passaggio del mouse sulla thumbnail, mostrare un cursore di ingrandimento.
- Aprire un popup con la sola immagine in grandi dimensioni al click sulla thumbnail.
- La richiesta iniziale indicava `/big`; l'implementazione usa l'immagine originale disponibile, evitando un suffisso non documentato.
- Affiancare al titolo **Preparazione** un selettore di lingua **IT | EN | 中文**.
- **Se la preparazione italiana non esiste, selezionare l'inglese come lingua predefinita** e indicare sul pulsante IT: «Nessuna traduzione in italiano per la preparazione del cocktail».
- Tenere titolo e selettore sulla stessa linea e ampliare verso sinistra la colonna della preparazione.
- Chiarire come vengono calcolate le proporzioni degli ingredienti: sono quote relative delle quantità della ricetta, quando interpretabili, non la gradazione alcolica. Per quantità ambigue la rappresentazione è indicativa.

## 9. Cocktail casuale

- Aggiungere **Cocktail casuale** nel pannello dei filtri.
- Chiamare l'endpoint pubblico `random.php` e aprire direttamente il dettaglio del cocktail restituito.
- **Non trasferire filtri, categorie o altri query parameter nell'URL del dettaglio casuale.**

## 10. Configurazione TypeScript e pulizia

- Correggere i problemi segnalati in `tsconfig`, tra cui la deprecazione di `baseUrl` e la configurazione della directory sorgente.
- Analizzare il codice e individuare file inutilizzati, distinguendo risorse realmente superflue da file richiamati indirettamente dal routing o dalla build.
- In seguito all'analisi, eliminare tutti i PNG locali, `login.selector.ts` e `auth-guard.service.ts` e rimuoverne i riferimenti.
- Rimuovere le dipendenze inutilizzate: NgSelect, NgRx, NgxDatatable, Angular IMask, IMask, NgxMask, `serve` e Angular Animations.
- **Conservare gli altri file**, inclusi layout, configurazioni dei test e file del logout non coinvolti nella rimozione autorizzata.

## 11. Icona dell'applicazione

Usare come icona dell'app la foto indicata dall'utente:

[Foto cocktail](https://www.thecocktaildb.com/images/media/drink/vrwquq1478252802.jpg).

La modifica è stata applicata alla favicon della scheda del browser in `src/index.html`, utilizzando direttamente l'URL dell'immagine.
