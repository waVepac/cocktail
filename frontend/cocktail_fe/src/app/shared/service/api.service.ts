import { Injectable } from '@angular/core';
import { environment } from 'src/environments/environment';
import { AppHttpClient } from './app-http-client.service';
import { AuthSession } from '../../models/auth.model';
import { Observable, defer, shareReplay, tap, timeout } from 'rxjs';
import { CocktailModel } from '../../models/cocktail.model';
import { FavoriteDrink, FavoriteModel, FavoriteToggleResponse } from '../../models/favorite.model';

interface CocktailListResponse {
  drinks: CocktailModel[] | null;
}

interface CocktailListCacheEntry {
  expiresAt: number;
  response$: Observable<CocktailListResponse>;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  readonly base_url = environment.apiUrl.replace(/\/$/, '') + '/api/';
  readonly cocktail_Url = environment.cockatilUrl + '/api/json/v1/1/';

  private readonly cocktailListCacheDuration = 5 * 60 * 1000;
  private readonly cocktailListCache = new Map<string, CocktailListCacheEntry>();

  constructor(private httpClient: AppHttpClient) { }

  clearCocktailCache(): void {
    this.cocktailListCache.clear();
  }

  private cachedCocktailList(url: string): Observable<CocktailListResponse> {
    // Controlla la scadenza a ogni sottoscrizione, anche se l'observable viene riutilizzato.
    return defer(() => {
      const now = Date.now();
      for (const [key, cached] of this.cocktailListCache) {
        if (cached.expiresAt <= now) this.cocktailListCache.delete(key);
      }
      const cached = this.cocktailListCache.get(url);
      if (cached) return cached.response$;
      const entry: CocktailListCacheEntry = {
        expiresAt: Infinity,
        response$: this.httpClient.getExternal<CocktailListResponse>(url).pipe(
          timeout(10000),
          tap({
            next: () => entry.expiresAt = Date.now() + this.cocktailListCacheDuration,
            error: () => {
              if (this.cocktailListCache.get(url) === entry) this.cocktailListCache.delete(url);
            }
          }),
          shareReplay({ bufferSize: 1, refCount: false })
        )
      };
      this.cocktailListCache.set(url, entry);
      return entry.response$;
    });
  }

  login(username: string, password: string): Observable<AuthSession> {
    return this.httpClient.post<AuthSession>(this.base_url + 'auth/login', { username, password });
  }

  register(username: string, password: string): Observable<AuthSession> {
    return this.httpClient.post<AuthSession>(this.base_url + 'auth/register', { username, password });
  }

  importFavorites(favorites: FavoriteDrink[]): Observable<FavoriteModel[]> {
    return this.httpClient.post<FavoriteModel[]>(this.base_url + 'favorites/import', { favorites });
  }

  getFavorites() {
    return this.httpClient.get<FavoriteModel[]>(this.base_url + 'favorites/');
  }

  toggleFavorite(userId: number, favorite: FavoriteDrink): Observable<FavoriteToggleResponse> {
    return this.httpClient.post<FavoriteToggleResponse>(
      this.base_url + 'favorites/' + encodeURIComponent(String(userId)) + '/toggle',
      { favorite }
    );
  }

  getGlasses(): Observable<{ drinks: { strGlass: string }[] | null }> {
    return this.httpClient.getExternal(this.cocktail_Url + 'list.php?g=list');
  }

  getAlcoholicCategories(): Observable<{ drinks: { strAlcoholic: string }[] | null }> {
    return this.httpClient.getExternal(this.cocktail_Url + 'list.php?a=list');
  }

  getDrinksByGlass(glass: string) {
    return this.cachedCocktailList(this.cocktail_Url + 'filter.php?g=' + encodeURIComponent(glass));
  }

  getDrinksByAlcoholicCategory(alcoholic: string) {
    return this.cachedCocktailList(this.cocktail_Url + 'filter.php?a=' + encodeURIComponent(alcoholic));
  }

  getCategory() {
    return this.httpClient.getExternal(this.cocktail_Url + 'list.php?c=list');
  }

  getDrinksByCategory(category: string) {
    return this.cachedCocktailList(this.cocktail_Url + 'filter.php?c=' + encodeURIComponent(category));
  }

  // tipo, descrizione e gradazione di un ingrediente (chiamata pubblica: niente token)
  getIngredientByName(name:string){
    const url = this.cocktail_Url + 'search.php?i=' + encodeURIComponent(name.trim())

    return this.httpClient.getExternal(url)
  }

  getCocktailByName(name: string) {
    return this.cachedCocktailList(this.cocktail_Url + 'search.php?s=' + encodeURIComponent(name));
  }

  getCocktailsByFirstLetter(letter: string) {
    const initial = encodeURIComponent(letter.trim().charAt(0).toLowerCase());

    return this.cachedCocktailList(this.cocktail_Url + 'search.php?f=' + initial);
  }
  getRandomCocktail(): Observable<CocktailListResponse> {
    return this.httpClient.getExternal<CocktailListResponse>(this.cocktail_Url + 'random.php');
  }

  getCocktailById(id: string) {
    return this.httpClient.getExternal(this.cocktail_Url + 'lookup.php?i=' + encodeURIComponent(id));
  }
}
