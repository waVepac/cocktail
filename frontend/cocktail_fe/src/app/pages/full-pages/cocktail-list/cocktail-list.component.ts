import { AfterViewInit, Component, ElementRef, NgZone, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import gsap from 'gsap';
import { filter, firstValueFrom, skip, Subscription, timeout } from 'rxjs';
import { AuthService } from 'src/app/shared/auth/auth.service';
import { ApiService } from 'src/app/shared/service/api.service';
import { IntroService } from 'src/app/shared/service/intro/intro.service';
import { ToastService } from 'src/app/shared/service/toast/toast.service';
import { CocktailTransitionService } from 'src/app/shared/service/transition/cocktail-transition.service';
import { CocktailOpenEvent } from './components/cocktail-row/cocktail-row.component';
import { CocktailModel } from 'src/app/models/cocktail.model';
import { FavoritesService } from 'src/app/shared/service/favorites/favorites.service';
import { ENGLISH_ALPHABET } from './cocktail-list.constants';
import { CatalogSort, catalogQueryParams, readCatalogState } from 'src/app/shared/utils/catalog-state';

interface Category{
  strCategory:string
}

/*
 * Le righe si ingrandiscono mentre si avvicinano al punto di messa a fuoco (FOCUS_AT, in
 * frazione dell'altezza dello schermo) e si rimpiccioliscono e sbiadiscono allontanandosene.
 */
const FOCUS_AT = 0.56
const MIN_SCALE = 0.8
const MIN_OPACITY = 0.4

@Component({
  selector: 'app-cocktail-list',
  templateUrl: './cocktail-list.component.html',
  styleUrls: ['./cocktail-list.component.css']
})
export class CocktailListComponent implements OnInit, AfterViewInit, OnDestroy{

  // l'entrata del titolo si vede una volta per caricamento: tornando dal dettaglio non si ripete
  private static heroPlayed = false

  categories: Category[] = []
  cocktails:CocktailModel[] = []
  selectedCategory:string | undefined
  selectedLetter:string | undefined
  readonly englishAlphabet = ENGLISH_ALPHABET

  currentPage:number = 1
  pageSize:number = 10

  searchTerm:string = '';
  sortBy: CatalogSort = 'category-asc';
  onlyFavorites:boolean = false;
  filtersOpen = false;
  selectedGlass = '';
  selectedAlcoholic = '';
  glasses: string[] = [];
  alcoholicCategories: string[] = [];
  filterOptionsLoading = false;
  filterOptionsError = '';
  loading = false;
  catalogError = '';
  private routeSubscription?: Subscription;
  private lastQuery = '';
  private restoreVersion = 0;
  private categoryIds?: ReadonlySet<string>;
  private letterIds?: ReadonlySet<string>;
  private glassIds?: ReadonlySet<string>;
  private alcoholicIds?: ReadonlySet<string>;

  get activeFilterCount(): number {
    return Number(this.onlyFavorites) + Number(!!this.selectedGlass) + Number(!!this.selectedAlcoholic);
  }

  scrollCategoryTabs(event: WheelEvent): void {
    if (event.ctrlKey) return;
    event.preventDefault();
    const tabs = event.currentTarget as HTMLElement;
    const limit = Math.max(0, tabs.scrollWidth - tabs.clientWidth);
    const unit = event.deltaMode === 1 ? 32 : event.deltaMode === 2 ? tabs.clientWidth : 1;
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    tabs.scrollLeft = Math.max(0, Math.min(limit, tabs.scrollLeft + delta * unit));
  }

  alcoholicLabel(value: string): string {
    if (value === 'Alcoholic') return 'Alcolico';
    if (value === 'Non alcoholic') return 'Analcolico';
    if (value === 'Optional alcohol') return 'Alcol opzionale';
    return value;
  }
  filteredCocktails: CocktailModel[] = [];

  private restoring = true
  private pendingRestoredPage?: number
  private dataRequest = 0
  private favoritesSubscription?: Subscription

  private imagePreloadCache = new Map<string, Promise<void>>()

  get isAlphabeticalMode(): boolean {
    return this.sortBy === 'alphabet-asc' || this.sortBy === 'alphabet-desc'
  }

  get orderedCategories(): Category[] {
    return this.sortBy === 'category-desc' ? [...this.categories].reverse() : this.categories
  }

  get orderedAlphabet(): readonly string[] {
    return this.sortBy === 'alphabet-desc' ? [...this.englishAlphabet].reverse() : this.englishAlphabet
  }

  constructor(private http:ApiService, private toastService: ToastService, private transitionService: CocktailTransitionService,
    private intro: IntroService, private host: ElementRef<HTMLElement>, private zone: NgZone, private route: ActivatedRoute, private router: Router, public favorites: FavoritesService, public auth: AuthService){}

  private focusFrame = 0
  private listObserver?: MutationObserver
  private focusEnabled = !window.matchMedia('(prefers-reduced-motion: reduce)').matches

  private onScroll = () => {
    if (!this.focusEnabled || this.focusFrame){
      return
    }

    this.focusFrame = requestAnimationFrame(() => {
      this.focusFrame = 0
      this.applyFocus()
    })
  }

  ngAfterViewInit(): void {
    this.playHero()

    if (!this.focusEnabled){
      return
    }

    // fuori da Angular: lo scroll non deve far girare il change detection
    this.zone.runOutsideAngular(() => {
      window.addEventListener('scroll', this.onScroll, { passive: true })
      window.addEventListener('resize', this.onScroll)

      // cambiano le righe (categoria, pagina, filtri): si ricalcola
      this.listObserver = new MutationObserver(() => this.onScroll())
      this.listObserver.observe(this.host.nativeElement, { childList: true, subtree: true })
    })

    this.onScroll()
  }

  ngOnDestroy(): void {
    this.dataRequest++
    this.restoreVersion++
    this.routeSubscription?.unsubscribe()
    this.favoritesSubscription?.unsubscribe()
    window.removeEventListener('scroll', this.onScroll)
    window.removeEventListener('resize', this.onScroll)

    this.listObserver?.disconnect()
    cancelAnimationFrame(this.focusFrame)
  }

  private applyFocus(): void {
    const rows = Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>('app-cocktail-row'))

    const viewport = window.innerHeight
    const focus = viewport * FOCUS_AT

    // prima si legge tutto, poi si scrive: nessun layout forzato a ogni riga
    const distances = rows.map(row => {
      const rect = row.getBoundingClientRect()

      // il perno è a metà altezza: la scala non sposta il centro, quindi non si innesca da sola
      return Math.abs(rect.top + rect.height / 2 - focus) / (viewport * 0.55)
    })

    const nearestDistance = Math.min(...distances)

    rows.forEach((row, index) => {
      const distance = Math.min(1, Math.max(0, distances[index] - nearestDistance))

      row.style.transform = `scale(${(1 - (1 - MIN_SCALE) * Math.pow(distance, 1.2)).toFixed(3)})`
      row.style.opacity = (1 - (1 - MIN_OPACITY) * Math.pow(distance, 1.6)).toFixed(3)
    })
  }

  /*
   * Il testo del titolo sale da sotto il bordo della riga che lo maschera.
   * Nel css è già nella sua posizione finale: se qualcosa fallisce la pagina resta leggibile.
   */
  private async playHero(): Promise<void> {
    if (CocktailListComponent.heroPlayed || window.matchMedia('(prefers-reduced-motion: reduce)').matches){
      return
    }

    CocktailListComponent.heroPlayed = true

    const lines = this.host.nativeElement.querySelectorAll('.line-inner')

    // finché dura il rito d'apertura il titolo aspetta fuori scena
    gsap.set(lines, { yPercent: 110 })

    // il timeout evita che il titolo resti nascosto se il segnale non arriva
    await Promise.race([
      firstValueFrom(this.intro.done$.pipe(filter(done => done))),
      new Promise(resolve => setTimeout(resolve, 4000))
    ])

    gsap.to(lines, {
      yPercent: 0,
      duration: 0.9,
      ease: 'power4.out',
      stagger: 0.09,
      clearProps: 'transform'
    })
  }

  get totalPages():number {
    return Math.max(1, Math.ceil(this.filteredCocktails.length / this.pageSize))
  }

  get paginatedCocktails(): CocktailModel[] {
    const start = (this.currentPage - 1) * this.pageSize

    const end = start + this.pageSize

    return this.filteredCocktails.slice(start, end)
  }

  async ngOnInit() {
    this.loading = true;
    this.favoritesSubscription = this.favorites.favorites$.subscribe(() => this.applyFilters(false));
    try {
      const [data] = await Promise.all([firstValueFrom(this.http.getCategory().pipe(timeout(10000))), this.loadFilterOptions()]);
      this.categories = (data.drinks ?? []).sort((a: Category, b: Category) => a.strCategory.localeCompare(b.strCategory));
    } catch {
      this.toastService.error('Impossibile caricare le categorie.');
    } finally {
      this.loading = false;
    }
    await this.restoreCatalog(this.route.snapshot.queryParamMap);
    this.routeSubscription = this.route.queryParamMap.pipe(skip(1)).subscribe(params => {
      const signature = JSON.stringify(catalogQueryParams(readCatalogState(params)));
      if (signature !== this.lastQuery) void this.restoreCatalog(params);
    });
  }

  async loadFilterOptions(): Promise<void> {
    this.filterOptionsLoading = true;
    this.filterOptionsError = '';
    try {
      const results = await Promise.allSettled([
        firstValueFrom(this.http.getGlasses().pipe(timeout(10000))),
        firstValueFrom(this.http.getAlcoholicCategories().pipe(timeout(10000)))
      ]);
      if (results[0].status === 'fulfilled') {
        this.glasses = (results[0].value.drinks ?? []).map(item => item.strGlass).sort((a, b) => a.localeCompare(b));
      }
      if (results[1].status === 'fulfilled') {
        this.alcoholicCategories = (results[1].value.drinks ?? []).map(item => item.strAlcoholic);
      }
      if (results.some(result => result.status === 'rejected')) {
        this.filterOptionsError = 'Alcune opzioni non sono disponibili. Riprova.';
      }
    } catch {
      this.filterOptionsError = 'Alcune opzioni non sono disponibili. Riprova.';
    } finally {
      this.filterOptionsLoading = false;
    }
  }

  private async restoreCatalog(params: import('@angular/router').ParamMap): Promise<void> {
    const version = ++this.restoreVersion;
    const state = readCatalogState(params);
    this.restoring = true;
    this.sortBy = state.sortBy;
    const hasFilters = !!(state.glass || state.alcoholic || state.onlyFavorites);
    this.selectedCategory = this.categories.find(item => item.strCategory === state.categoryId)?.strCategory ?? (hasFilters ? undefined : this.categories[0]?.strCategory);
    this.selectedLetter = this.isAlphabeticalMode ? state.letter ?? (hasFilters ? undefined : this.orderedAlphabet[0]) : undefined;
    this.searchTerm = state.search;
    this.onlyFavorites = state.onlyFavorites;
    this.selectedGlass = state.glass || '';
    this.selectedAlcoholic = state.alcoholic || '';
    this.filtersOpen = this.activeFilterCount > 0;
    this.currentPage = state.page;
    this.pageSize = state.pageSize;
    this.pendingRestoredPage = state.page;
    await this.refreshCatalog(false);
    if (version !== this.restoreVersion) return;
    this.restoring = false;
    this.applyFilters(false);
  }

  private get catalogParams() {
    return catalogQueryParams({
      sortBy: this.sortBy,
      categoryId: this.selectedCategory,
      letter: this.selectedLetter,
      search: this.searchTerm,
      onlyFavorites: this.onlyFavorites,
      glass: this.selectedGlass,
      alcoholic: this.selectedAlcoholic,
      page: this.currentPage,
      pageSize: this.pageSize
    });
  }

  private saveCatalogState(): void {
    if (this.restoring) return;
    this.lastQuery = JSON.stringify(this.catalogParams);
    void this.router.navigate([], { relativeTo: this.route, queryParams: this.catalogParams, replaceUrl: true });
  }

  async openRandomCocktail(): Promise<void> {
    if (this.loading || this.filterOptionsLoading || this.favorites.busy) return;
    const request = ++this.dataRequest;
    this.loading = true;
    try {
      const response = await firstValueFrom(this.http.getRandomCocktail().pipe(timeout(10000)));
      const id = response.drinks?.[0]?.idDrink;
      if (!id) throw new Error('Cocktail casuale non disponibile');
      if (request !== this.dataRequest) return;
      await this.router.navigate(['/cocktail', id], { queryParams: {}, queryParamsHandling: '' });
    } catch {
      if (request === this.dataRequest) this.toastService.error('Impossibile caricare un cocktail casuale. Riprova.');
    } finally {
      if (request === this.dataRequest) this.loading = false;
    }
  }

  async reloadCatalog(): Promise<void> {
    if (this.loading || this.filterOptionsLoading || this.favorites.busy) return;
    this.http.clearCocktailCache();
    this.imagePreloadCache.clear();
    if (this.onlyFavorites) await this.favorites.retrySync();
    await this.refreshCatalog(false);
  }

  async refreshCatalog(resetPage = true): Promise<void> {
    if (resetPage) this.resetPage();
    const request = ++this.dataRequest;
    this.loading = true;
    this.catalogError = '';
    this.saveCatalogState();
    const search = this.searchTerm.trim();
    const category = this.selectedCategory;
    const letter = this.isAlphabeticalMode ? this.selectedLetter : undefined;
    const glass = this.selectedGlass;
    const alcoholic = this.selectedAlcoholic;
    const onlyFavorites = this.onlyFavorites;
    try {
      const glassRequest = glass ? firstValueFrom(this.http.getDrinksByGlass(glass).pipe(timeout(10000))) : Promise.resolve(undefined);
      const alcoholRequest = alcoholic ? firstValueFrom(this.http.getDrinksByAlcoholicCategory(alcoholic).pipe(timeout(10000))) : Promise.resolve(undefined);
      const categoryRequest = category && (onlyFavorites || (!search && !letter)) ? firstValueFrom(this.http.getDrinksByCategory(category).pipe(timeout(10000))) : Promise.resolve(undefined);
      const letterRequest = letter && (onlyFavorites || !search) ? firstValueFrom(this.http.getCocktailsByFirstLetter(letter).pipe(timeout(10000))) : Promise.resolve(undefined);
      let base: Promise<{ drinks: CocktailModel[] | null } | undefined> = Promise.resolve({ drinks: [] });
      if (!onlyFavorites) {
        if (search) base = firstValueFrom(this.http.getCocktailByName(search).pipe(timeout(10000)));
        else if (letter) base = letterRequest;
        else if (category) base = categoryRequest;
        else if (glass) base = glassRequest;
        else if (alcoholic) base = alcoholRequest;
      }
      // Un filtro senza categoria parte dal proprio elenco globale; gli altri criteri si sommano per id.
      const [data, glassData, alcoholData, categoryData, letterData] = await Promise.all([base, glassRequest, alcoholRequest, categoryRequest, letterRequest]);
      if (request !== this.dataRequest) return;
      this.cocktails = data?.drinks ?? [];
      this.glassIds = glass ? new Set((glassData?.drinks ?? []).map(drink => drink.idDrink)) : undefined;
      this.alcoholicIds = alcoholic ? new Set((alcoholData?.drinks ?? []).map(drink => drink.idDrink)) : undefined;
      this.categoryIds = onlyFavorites && category ? new Set((categoryData?.drinks ?? []).map(drink => drink.idDrink)) : undefined;
      this.letterIds = onlyFavorites && letter ? new Set((letterData?.drinks ?? []).map(drink => drink.idDrink)) : undefined;
    } catch {
      if (request !== this.dataRequest) return;
      this.cocktails = [];
      this.glassIds = glass ? new Set() : undefined;
      this.alcoholicIds = alcoholic ? new Set() : undefined;
      this.categoryIds = onlyFavorites && category ? new Set() : undefined;
      this.letterIds = onlyFavorites && letter ? new Set() : undefined;
      this.catalogError = 'Impossibile aggiornare il catalogo. Riprova.';
    } finally {
      if (request === this.dataRequest) {
        this.loading = false;
        this.applyFilters(false);
      }
    }
  }

  async selectCategory(category: string | undefined): Promise<void> {
    this.selectedCategory = category;
    this.selectedLetter = undefined;
    this.searchTerm = '';
    await this.refreshCatalog();
  }

  onPageChange(page: number): void {
    this.currentPage = Math.max(1, Math.min(page, this.totalPages));
    this.saveCatalogState();
  }

  resetPage(): void {
    if (this.restoring) return;
    this.pendingRestoredPage = undefined;
    this.currentPage = 1;
  }

  isFavorite(id: string): boolean {
    return this.favorites.isFavorite(id);
  }

  toggleFavorite(id: string): void {
    const cocktail = this.filteredCocktails.find(item => item.idDrink === id);
    if (cocktail) void this.favorites.toggle(cocktail);
  }

  onFiltersChange(): void {
    this.selectedCategory = this.activeFilterCount ? undefined : this.categories[0]?.strCategory;
    this.selectedLetter = this.isAlphabeticalMode && !this.activeFilterCount ? this.orderedAlphabet[0] : undefined;
    void this.refreshCatalog();
  }

  clearFilters(): void {
    this.selectedGlass = '';
    this.selectedAlcoholic = '';
    this.onlyFavorites = false;
    if (!this.selectedCategory) this.selectedCategory = this.categories[0]?.strCategory;
    if (this.isAlphabeticalMode && !this.selectedLetter) this.selectedLetter = this.orderedAlphabet[0];
    void this.refreshCatalog();
  }

  onFavoritesChange(): void {
    this.onFiltersChange();
  }

  trackCocktail(index: number, cocktail: CocktailModel): string {
    return cocktail.idDrink
  }

  async openCocktailDetail(event: CocktailOpenEvent): Promise<void> {
    if (this.loading) return;

    const queryParams = this.catalogParams
    const imageUrl = this.getTransitionImageUrl(event.cocktail.strDrinkThumb)

    try{
      await this.preloadImage(imageUrl)
    }
    catch (error){

    }

    this.transitionService.startTransition(event.cocktail, event.imageRect, imageUrl, event.imageElement, undefined, queryParams)
  }

  applyFilters(resetPage = true): void {
    if (this.loading) return;
    let result = this.onlyFavorites ? this.favorites.cocktails : [...this.cocktails];
    if (this.categoryIds) result = result.filter(drink => this.categoryIds!.has(drink.idDrink));
    if (this.letterIds) result = result.filter(drink => this.letterIds!.has(drink.idDrink));
    if (this.glassIds) result = result.filter(drink => this.glassIds!.has(drink.idDrink));
    if (this.alcoholicIds) result = result.filter(drink => this.alcoholicIds!.has(drink.idDrink));
    if (this.onlyFavorites && this.searchTerm.trim()) {
      const search = this.searchTerm.trim().toLocaleLowerCase();
      result = result.filter(drink => drink.strDrink.toLocaleLowerCase().includes(search));
    }
    if (this.isAlphabeticalMode) {
      result.sort((a, b) => a.strDrink.localeCompare(b.strDrink));
      if (this.sortBy === 'alphabet-desc') result.reverse();
    }
    this.filteredCocktails = result;
    this.onScroll();
    if (!this.restoring) {
      if (resetPage) this.resetPage();
      if (!(this.onlyFavorites && !this.favorites.ready)) {
        this.currentPage = Math.min(this.pendingRestoredPage ?? this.currentPage, this.totalPages);
        this.pendingRestoredPage = undefined;
      }
      this.saveCatalogState();
    }
  }

  onSortChange(): void {
    this.searchTerm = '';
    this.selectedLetter = this.isAlphabeticalMode ? this.orderedAlphabet[0] : undefined;
    if (!this.selectedCategory && !this.activeFilterCount) this.selectedCategory = this.categories[0]?.strCategory;
    void this.refreshCatalog();
  }

  async searchCocktailsByLetter(letter: string): Promise<void> {
    this.selectedLetter = letter.toUpperCase() || undefined;
    this.searchTerm = '';
    await this.refreshCatalog();
  }

  async clearSearch(): Promise<void> {
    this.searchTerm = '';
    await this.refreshCatalog();
  }

  async searchCocktailByName(): Promise<void> {
    this.searchTerm = this.searchTerm.trim();
    await this.refreshCatalog();
  }

  // stesso URL (originale, 700px) per il preload in hover, per il click e per l'hero del dettaglio:
  // l'immagine è già in cache quando parte la transizione
  private getTransitionImageUrl(imageUrl:string){
    return imageUrl.replace(/\/(small|medium|large)\/?$/, '')
  }

  private preloadImage(url:string): Promise<void> {
    const cached = this.imagePreloadCache.get(url)

    if(cached) return cached

    const promise = new Promise<void>((resolve, reject) => {

      const image = new Image()
      image.onload = () => resolve()
      image.onerror = () => reject()

      image.src = url
    })

    this.imagePreloadCache.set(url, promise)

    return promise
  }

  preloadCocktailImage(cocktail:CocktailModel): void {
    if(!cocktail.strDrinkThumb) return

    const imageUrl = this.getTransitionImageUrl(cocktail.strDrinkThumb)

    this.preloadImage(imageUrl).catch(() => {

    })
  }

}
