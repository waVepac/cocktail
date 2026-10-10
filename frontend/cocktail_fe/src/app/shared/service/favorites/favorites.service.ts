import { Injectable } from '@angular/core';
import { FavoriteDrink, FavoriteModel } from '../../../models/favorite.model';
import { CocktailModel } from '../../../models/cocktail.model';
import { BehaviorSubject, distinctUntilChanged, firstValueFrom, timeout } from 'rxjs';
import { AuthService } from '../../auth/auth.service';
import { ApiService } from '../api.service';
import { ToastService } from '../toast/toast.service';

@Injectable({ providedIn: 'root' })
export class FavoritesService {
  readonly storageKey = 'favorites-ckt';
  private readonly records = new BehaviorSubject<FavoriteModel[]>([]);
  readonly favorites$ = this.records.asObservable();
  readonly guestChoice$ = new BehaviorSubject<CocktailModel | null>(null);
  readonly syncError$ = new BehaviorSubject(false);
  private sessionVersion = 0;
  private loaded = false;
  private loading = false;
  private saving = false;

  get cocktails(): CocktailModel[] {
    return this.records.value.map(item => ({ idDrink: item.favorite.id, strDrink: item.favorite.name, strDrinkThumb: item.favorite.thumbnail }));
  }

  get ready(): boolean {
    return this.loaded;
  }

  get busy(): boolean {
    return this.loading || this.saving;
  }

  constructor(private api: ApiService, private auth: AuthService, private toast: ToastService) {
    this.auth.currentUser$.pipe(distinctUntilChanged((previous, current) => previous?.id === current?.id)).subscribe(user => {
      const version = ++this.sessionVersion;
      this.loaded = !user;
      this.loading = false;
      this.saving = false;
      this.guestChoice$.next(null);
      this.syncError$.next(false);
      this.records.next(this.localRecords(user?.id ?? 0));
      if (user) void this.load(version);
    });
  }

  isFavorite(cocktailId: string): boolean {
    return this.records.value.some(item => item.favorite.id === cocktailId);
  }

  private readLocal(): FavoriteDrink[] {
    try {
      const value = JSON.parse(localStorage.getItem(this.storageKey) || '[]');
      if (!Array.isArray(value)) return [];
      const valid = value.filter(item => typeof item?.id === 'string' && /^\d+$/.test(item.id) && typeof item.name === 'string' && !!item.name.trim() && typeof item.thumbnail === 'string' && /^https?:\/\//.test(item.thumbnail));
      return Array.from(new Map<string, FavoriteDrink>(valid.map(item => [item.id, { id: item.id, name: item.name, thumbnail: item.thumbnail }])).values());
    } catch {
      return [];
    }
  }

  private writeLocal(favorites: FavoriteDrink[]): boolean {
    try {
      if (favorites.length) localStorage.setItem(this.storageKey, JSON.stringify(favorites));
      else localStorage.removeItem(this.storageKey);
      return true;
    } catch {
      this.toast.error('Impossibile salvare i preferiti sul dispositivo.');
      return false;
    }
  }

  private localRecords(userId: number): FavoriteModel[] {
    return this.readLocal().map(favorite => ({ userId, favorite, active: true }));
  }

  private async load(version: number): Promise<boolean> {
    this.loading = true;
    const userId = this.auth.currentUserValue?.id;
    const local = this.readLocal();
    try {
      const request = local.length ? this.api.importFavorites(local) : this.api.getFavorites();
      const favorites = await firstValueFrom(request.pipe(timeout(10000)));
      if (version !== this.sessionVersion) return false;
      // Elimina solo i record confermati dal server, preservando eventuali aggiunte di altre schede.
      const confirmed = new Set(favorites.filter(item => item.active).map(item => item.favorite.id));
      const imported = new Set(local.filter(item => confirmed.has(item.id)).map(item => item.id));
      const remaining = this.readLocal().filter(item => !imported.has(item.id));
      const cleared = !local.length || this.writeLocal(remaining);
      this.syncError$.next(!cleared || remaining.length > 0);
      this.loaded = true;
      this.records.next(favorites.filter(item => item.active));
      return !this.syncError$.value;
    } catch {
      if (version !== this.sessionVersion) return false;
      this.syncError$.next(local.length > 0);
      this.toast.error(local.length ? 'Preferiti locali conservati. Riprova la sincronizzazione.' : 'Impossibile caricare i preferiti. Riprova.');
      if (local.length) {
        try {
          const server = await firstValueFrom(this.api.getFavorites().pipe(timeout(10000)));
          if (version !== this.sessionVersion) return false;
          const combined = new Map(server.filter(item => item.active).map(item => [item.favorite.id, item]));
          this.localRecords(userId ?? 0).forEach(item => combined.set(item.favorite.id, item));
          this.records.next(Array.from(combined.values()));
          this.loaded = true;
        } catch {
          // I preferiti locali rimangono visibili e disponibili per un nuovo tentativo.
        }
      }
      return false;
    } finally {
      if (version === this.sessionVersion) this.loading = false;
    }
  }

  async retrySync(): Promise<void> {
    if (this.auth.currentUserValue && !this.busy) await this.load(this.sessionVersion);
  }

  chooseGuest(mode: 'local' | 'login' | 'register'): void {
    const cocktail = this.guestChoice$.value;
    if (!cocktail || this.auth.currentUserValue) return;
    const favorite = { id: cocktail.idDrink, name: cocktail.strDrink, thumbnail: cocktail.strDrinkThumb };
    const local = this.readLocal().filter(item => item.id !== favorite.id);
    local.push(favorite);
    if (!this.writeLocal(local)) return;
    this.records.next(this.localRecords(0));
    this.guestChoice$.next(null);
    if (mode === 'local') this.toast.success(cocktail.strDrink + ' salvato sul dispositivo.');
    else {
      // Chiude prima il dialog per ripristinare scroll e focus prima di aprire il login.
      setTimeout(() => {
        if (!this.auth.currentUserValue) this.auth.openLogin(mode);
      });
    }
  }

  async toggle(cocktail: CocktailModel): Promise<void> {
    if (!cocktail.idDrink || this.busy) return;
    const user = this.auth.currentUserValue;
    if (!user) {
      if (!this.isFavorite(cocktail.idDrink)) {
        this.guestChoice$.next(cocktail);
        return;
      }
      if (this.writeLocal(this.readLocal().filter(item => item.id !== cocktail.idDrink))) {
        this.records.next(this.localRecords(0));
        this.toast.success(cocktail.strDrink + ' rimosso dai preferiti.');
      }
      return;
    }
    const version = this.sessionVersion;
    if ((!this.loaded || this.syncError$.value) && !await this.load(version)) return;
    if (version !== this.sessionVersion) return;
    // Il backend salva in un unico file: serializziamo le scritture di questa sessione.
    this.saving = true;
    try {
      const result = await firstValueFrom(this.api.toggleFavorite(user.id, { id: cocktail.idDrink, name: cocktail.strDrink, thumbnail: cocktail.strDrinkThumb }).pipe(timeout(10000)));
      if (version !== this.sessionVersion) return;
      const records = this.records.value.filter(item => item.favorite.id !== result.favorite.id);
      if (result.active) records.push({ userId: result.userId, favorite: result.favorite, active: true });
      this.records.next(records);
      this.toast.success(cocktail.strDrink + (result.active ? ' aggiunto ai preferiti.' : ' rimosso dai preferiti.'));
    } catch {
      if (version === this.sessionVersion) {
        this.toast.error('Impossibile aggiornare i preferiti. Riprova.');
        this.loaded = false;
        await this.load(version);
      }
    } finally {
      if (version === this.sessionVersion) this.saving = false;
    }
  }
}
