# The Cocktail Collection

Applicazione per esplorare cocktail, consultarne ingredienti e preparazione e gestire i preferiti, anche come ospite.

**Il progetto attuale utilizza Angular 15 e un backend Node.js/Express. Non sono necessari Python, FastAPI, MongoDB, Docker o un file `.env`.** La migrazione a FastAPI e MongoDB è stata discussa, ma non è stata implementata.

## Struttura

```text
backend/cocktail_be/       Backend Express, autenticazione e preferiti
frontend/cocktail_fe/     Frontend Angular
CHAT-PROGETTO.md          Riepilogo delle richieste e delle decisioni
```

Il catalogo viene recuperato direttamente da [TheCocktailDB](https://www.thecocktaildb.com/documentation). Utenti e preferiti vengono salvati dal backend in `backend/cocktail_be/data/db.json`.

## Prerequisiti

- Node.js e npm disponibili nel terminale.
- Un browser moderno.
- Connessione Internet per installare le dipendenze e recuperare catalogo, immagini e font esterni.
- Porte **3000** e **4200** disponibili.

L'ultima compilazione del frontend è stata verificata nell'ambiente locale con **Node.js 22.20.0 e npm 10.9.3**. Questo è l'ambiente osservato, non una garanzia di compatibilità con ogni versione di Node.js: Angular 15 è una versione legacy e la sua [matrice ufficiale di compatibilità](https://angular.dev/reference/versions) indica storicamente Node.js 14, 16 e 18, secondo gli intervalli riportati nella tabella.

Controllare l'ambiente prima di iniziare:

```sh
node --version
npm --version
```

**Non serve installare Angular CLI globalmente:** `npm start` usa la CLI presente nelle dipendenze del progetto.

## Avvio del backend

Scaricare o clonare la repository e aprire un terminale nella sua cartella principale. Su Windows, nel progetto locale, questa cartella è `C:\CocktailDB`.

```sh
cd backend/cocktail_be
npm ci
npm start
```

Il backend ascolta su **http://localhost:3000**. Lasciare questo terminale aperto.

Per verificare che sia raggiungibile, aprire **http://localhost:3000/api/health/** nel browser. La risposta attesa è:

```json
{"status":"ok"}
```

Per lo sviluppo è disponibile anche il riavvio automatico alle modifiche:

```sh
npm run dev
```

Questo comando usa `node --watch`; richiede una versione di Node.js che supporti tale opzione.

## Avvio del frontend

Aprire **un secondo terminale nella cartella principale della repository**:

```sh
cd frontend/cocktail_fe
npm ci
npm start
```

Attendere la compilazione e aprire **http://localhost:4200/cocktails**.

**Backend e frontend devono restare entrambi in esecuzione** per usare registrazione, login e preferiti dell'account. Il catalogo pubblico proviene invece da TheCocktailDB.

Per arrestare ciascun servizio, premere `Ctrl+C` nel relativo terminale.

## Configurazione e persistenza

| Impostazione | Valore attuale | File |
| --- | --- | --- |
| Porta del backend | `3000` | `backend/cocktail_be/server.js` |
| Indirizzo backend usato dal frontend | `http://localhost:3000` | `frontend/cocktail_fe/src/environments/environment.ts` e `environment.prod.ts` |
| API pubblica | `https://www.thecocktaildb.com` | Gli stessi file di ambiente |
| Database locale | `data/db.json` | `backend/cocktail_be/services/database.service.js` |

Il backend attuale non legge variabili da `.env`. Se si cambia la porta del backend, aggiornare anche `apiUrl` nei due file di ambiente del frontend.

**Il file `backend/cocktail_be/data/db.json` deve esistere ed essere scrivibile.** È utilizzato sia per gli utenti sia per i preferiti: non eliminarlo o sostituirlo se contiene dati da conservare. Solo in una nuova installazione priva del file, crearlo nella cartella `data` con questa struttura iniziale:

```json
{
  "users": [],
  "favorites": []
}
```

L'autenticazione usa **token opachi Bearer**, non JWT. Il frontend conserva la sessione in localStorage e verifica il token tramite la richiesta protetta ai preferiti. Il backend non espone attualmente `/api/auth/me` o `/api/auth/logout`: il logout chiude la sessione locale.

Le immagini e i dati del catalogo richiedono Internet anche dopo l'installazione. I preferiti salvati come ospite sono locali al browser; dopo il login vengono sincronizzati con il backend.

## Verifica manuale

1. Aprire `/cocktails` e verificare che il catalogo sia accessibile senza autenticazione.
2. Aprire il login dall'icona utente; passare alla registrazione e creare un account nuovo. La registrazione deve autenticare subito l'utente.
3. Aggiungere un cocktail ai preferiti e ricaricare la pagina: sessione e preferiti devono essere ripristinati con il backend attivo.
4. Aprire il menu utente e selezionare **I miei preferiti** oppure **Logout**.
5. Come ospite, aggiungere un preferito e scegliere il salvataggio locale; accedere successivamente e verificarne la sincronizzazione.
6. Provare ricerca, ordinamento, categorie, filtri per bicchiere e tipologia, paginazione e pulsante **Aggiorna**.
7. Aprire un dettaglio e verificare preparazione nelle lingue disponibili e ingrandimento dell'immagine.
8. Usare **Cocktail casuale** e verificare l'apertura diretta del dettaglio senza query parameter.

## Compilazione del frontend

Dalla cartella `frontend/cocktail_fe`:

```sh
npm run build
```

La build production viene generata in `dist/cocktail-fe`. Il comando compila il frontend: non avvia il backend e non pubblica il sito. La configurazione production punta attualmente al backend locale.

L'ultima build è riuscita con avvisi sui budget di dimensione del bundle iniziale e dei CSS del catalogo e del dettaglio. Questi avvisi non hanno impedito la compilazione.

Non sono presenti file `.spec.ts`; il comando frontend `npm test` conserva la configurazione Karma, ma non costituisce una suite di test pronta. Il comando `npm test` del backend è ancora il segnaposto iniziale.

## Problemi comuni

| Problema | Controllo |
| --- | --- |
| `node` o `npm` non riconosciuto | Verificare l'installazione di Node.js e riaprire il terminale. |
| `npm ci` segnala un lockfile assente o incoerente | Verificare di avere scaricato anche `package-lock.json` e di usare la cartella corretta. |
| Login o preferiti non rispondono | Controllare il terminale backend, `/api/health/` e `apiUrl`. |
| Errore `EADDRINUSE` | La porta 3000 è occupata: liberarla oppure modificare porta e configurazione frontend. |
| Angular propone una porta diversa | Liberare la 4200 oppure aprire l'indirizzo effettivamente indicato nel terminale. |
| Catalogo, immagini o font non si caricano | Verificare Internet e la raggiungibilità di TheCocktailDB e dei servizi esterni. |
| Errore di lettura o scrittura del database | Verificare esistenza, JSON valido e permessi di `data/db.json`. |

