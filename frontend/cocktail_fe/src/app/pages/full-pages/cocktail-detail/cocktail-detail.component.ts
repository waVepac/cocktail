import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import gsap from 'gsap';
import { catchError, filter, finalize, firstValueFrom, forkJoin, of, timeout } from 'rxjs';

import { FavoritesService } from 'src/app/shared/service/favorites/favorites.service';
import { AuthService } from 'src/app/shared/auth/auth.service';
import { ApiService } from 'src/app/shared/service/api.service';
import { CocktailTransitionService } from 'src/app/shared/service/transition/cocktail-transition.service';
import { ingredientImage, isLiquidAmount, layerColor, partsCount, volumeMl } from 'src/app/shared/utils/cocktail-measure';
import { catalogQueryParams, readCatalogState } from 'src/app/shared/utils/catalog-state';
import { GlassLayer } from './components/glass/glass.component';


/*
 * Solo dati dell'API TheCocktailDB: i campi della ricetta (lookup.php), tipo e gradazione di
 * ogni ingrediente (search.php?i=) e le foto degli ingredienti. Niente stime né conversioni.
 */
interface CocktailDetail {
  [key: string]: string | null;

  idDrink: string;
  strDrink: string;
  strDrinkAlternate: string | null;
  strTags: string | null;

  strCategory: string | null;
  strIBA: string | null;
  strAlcoholic: string | null;
  strGlass: string | null;

  strInstructions: string | null;
  strInstructionsIT: string | null;
  'strInstructionsZH-HANS': string | null;
  'strInstructionsZH-HANT': string | null;

  strDrinkThumb: string;
  strImageAttribution: string | null;
}


type InstructionLanguage = 'it' | 'en' | 'zh';

interface Ingredient {
  name: string;
  measure: string;

  // foto dell'ingrediente (dall'API immagini)
  image: string;
  imageBig: string;
  noImage: boolean;

  // dall'ingrediente, solo se l'API li fornisce
  type: string | null;
  abv: string | null;
}


@Component({
  selector: 'app-cocktail-detail',
  templateUrl: './cocktail-detail.component.html',
  styleUrls: ['./cocktail-detail.component.css']
})
export class CocktailDetailComponent implements OnInit, OnDestroy {
  @ViewChild('imageDialog', { static: true }) imageDialog!: ElementRef<HTMLDialogElement>;
  enlargedImageUrl = '';
  private imagePreviousOverflow?: string;
  private imagePreviousFocus: HTMLElement | null = null;

  openImageViewer(): void {
    if (!this.cocktail?.strDrinkThumb || this.imageDialog.nativeElement.open) return;
    this.enlargedImageUrl = this.cocktail.strDrinkThumb.replace(/\/(small|medium|large|big)\/?$/, '');
    this.imagePreviousOverflow = document.body.style.overflow;
    this.imagePreviousFocus = document.activeElement as HTMLElement | null;
    this.imageDialog.nativeElement.showModal();
    document.body.style.overflow = 'hidden';
    this.imageDialog.nativeElement.focus();
  }

  closeImageViewer(): void {
    this.imageDialog.nativeElement.close();
    this.restoreImageViewerState();
  }

  onImageBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.closeImageViewer();
  }

  onImageCancel(event: Event): void {
    event.preventDefault();
    this.closeImageViewer();
  }

  restoreImageViewerState(): void {
    if (this.imagePreviousOverflow === undefined) return;
    document.body.style.overflow = this.imagePreviousOverflow;
    this.imagePreviousOverflow = undefined;
    if (this.imagePreviousFocus?.isConnected) this.imagePreviousFocus.focus({ preventScroll: true });
    this.imagePreviousFocus = null;
  }

  ngOnDestroy(): void {
    if (this.imageDialog.nativeElement.open) this.imageDialog.nativeElement.close();
    this.restoreImageViewerState();
  }


  private cocktailId = ''
  private transitionNotified = false
  cocktail: CocktailDetail | null = null;
  ingredients: Ingredient[] = [];
  instructionLanguage: InstructionLanguage = 'en';
  readonly instructionLanguages: { value: InstructionLanguage; label: string }[] = [
    { value: 'it', label: 'IT' },
    { value: 'en', label: 'EN' },
    { value: 'zh', label: '中文' }
  ];

  // gli strati del bicchiere: solo gli ingredienti con un volume esplicito
  layers: GlassLayer[] = [];
  filled = false;

  // ingrediente evidenziato (passando sulla riga o sulla mensola)
  activeIndex: number | null = null;

  // vero finché la foto sta atterrando: la polaroid vera aspetta e poi prende il suo posto
  transitionActive$ = this.transitionService.active$;

  ingredientsLoading = false;
  loading = true;
  error = false;


  constructor( private route: ActivatedRoute, private router: Router, private http: ApiService,
    private transitionService: CocktailTransitionService, private host: ElementRef<HTMLElement>, public favorites: FavoritesService, public auth: AuthService
  ) {}

  ngOnInit(): void {

    const id = this.route.snapshot.paramMap.get('id');

    if (!id) {
      this.loading = false;
      this.error = true;
      return;
    }

    this.cocktailId = id

    this.loadCocktail(id);
  }


  get isFavorite(): boolean {
    return this.favorites.isFavorite(this.cocktail?.idDrink ?? '')
  }

  toggleFavorite(): void {
    if (this.cocktail) void this.favorites.toggle(this.cocktail)
  }

  private loadCocktail(id: string): void {

    this.loading = true;
    this.error = false;

    this.http.getCocktailById(id).pipe(timeout(10000), finalize(() => this.loading = false)).subscribe({
        next: (response: any) => {
          const cocktail = response?.drinks?.[0] ?? null;

          if (!cocktail) {
            this.error = true;
            this.loading = false;
            this.notifyTransitionReady()
            return;
          }

          this.cocktail = cocktail;
          this.instructionLanguage = this.hasInstructions('it') ? 'it' : 'en';

          this.ingredients = this.buildIngredients(cocktail);
          this.layers = this.buildLayers();

          this.loading = false;

          this.loadIngredientDetails();

          // le cose sulla mensola aspettano fuori scena finché il drink non comincia a riempirsi
          setTimeout(() => this.hideShelf());

          this.startFill();

          requestAnimationFrame(() => {
            this.notifyTransitionReady()
          })
        },
        error: () => {

          this.loading = false;
          this.error = true;
          this.notifyTransitionReady()
        }

      });

  }

  /*
   * Gli strati del bicchiere. Il primo ingrediente della ricetta sta in cima, così la legenda
   * accanto al bicchiere segue l'ordine della scheda.
   *  - misura in oz, cl, ml...: strato proporzionale al volume;
   *  - se la ricetta è tutta in "parts": strati proporzionali alle parti (rapporti esatti);
   *  - liquido senza volume ("1 splash", "Dash", "Juice of 1/2"): sottile strato-segnaposto;
   *  - non liquidi (sale, "1 slice", foglie): nessuno strato, restano nella scheda e sulla mensola.
   */
  private buildLayers(): GlassLayer[] {
    const entries = this.ingredients.map(ingredient => ({
      ingredient,
      ml: volumeMl(ingredient.measure),
      parts: partsCount(ingredient.measure),
      liquid: isLiquidAmount(ingredient.measure)
    }));

    const hasVolume = entries.some(entry => entry.ml !== null);

    // senza volumi assoluti, le parti danno comunque proporzioni esatte
    const useParts = !hasVolume && entries.some(entry => entry.parts !== null);

    const included = entries
      .map(entry => {
        const weight = entry.ml !== null ? entry.ml : useParts && entry.parts !== null ? entry.parts : null;

        return { entry, weight };
      })
      .filter(item => item.weight !== null || item.entry.liquid);

    return included
      .map((item, index) => ({
        name: item.entry.ingredient.name,
        color: layerColor(index, included.length),
        ml: item.weight ?? 0,
        measure: item.entry.ingredient.measure,
        marker: item.weight === null
      }))
      .reverse();
  }

  // tipo e gradazione di ogni ingrediente: chiamate in parallelo, la pagina non le aspetta
  private loadIngredientDetails(): void {
    this.ingredientsLoading = true;
    const requests = this.ingredients.map(ingredient =>
      this.http.getIngredientByName(ingredient.name).pipe(timeout(10000), catchError(() => of(null)))
    );

    forkJoin(requests).pipe(finalize(() => this.ingredientsLoading = false)).subscribe(responses => {
      responses.forEach((response: any, index) => {
        const info = response?.ingredients?.[0];

        if (!info) {
          return;
        }

        this.ingredients[index].type = info.strType || null;
        this.ingredients[index].abv = info.strABV || null;
      });
    });
  }

  /*
   * Il bicchiere si riempie quando il "sorso" ha scoperto la pagina:
   * aprendo il dettaglio da un link diretto parte subito.
   */
  private async startFill(): Promise<void> {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.filled = true;
      return;
    }

    await Promise.race([
      firstValueFrom(this.transitionService.active$.pipe(filter(active => !active))),
      new Promise(resolve => setTimeout(resolve, 2500))
    ]);

    await new Promise(resolve => setTimeout(resolve, 350));

    this.filled = true;
    this.dealShelf();
  }

  /* gli ingredienti sulla mensola: nascosti in attesa, poi si posano uno dopo l'altro mentre il bicchiere si riempie */
  private shelfItems(): HTMLElement[] {
    return Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>('.shelf-item'));
  }

  private hideShelf(): void {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    gsap.set(this.shelfItems(), { y: -34, opacity: 0 });
  }

  private dealShelf(): void {
    gsap.to(this.shelfItems(), {
      y: 0,
      opacity: 1,
      duration: 0.6,
      ease: 'power3.out',
      stagger: 0.08,
      clearProps: 'transform,opacity'
    });
  }

  private buildIngredients(
    cocktail: CocktailDetail
  ): Ingredient[] {

    const ingredients: Ingredient[] = [];

    for (let i = 1; i <= 15; i++) {

      const ingredient =
        cocktail[`strIngredient${i}`];

      const measure =
        cocktail[`strMeasure${i}`];

      if (
        !ingredient ||
        !ingredient.trim()
      ) {
        continue;
      }

      ingredients.push({
        name: ingredient.trim(),
        measure: measure?.trim() ?? '',
        image: ingredientImage(ingredient, 'Small'),
        imageBig: ingredientImage(ingredient, 'Medium'),
        noImage: false,
        type: null,
        abv: null
      });

    }

    return ingredients;
  }

  setActive(index: number | null): void {
    this.activeIndex = index;
  }

  private instructionsFor(language: InstructionLanguage): string {
    if (language === 'it') return this.cocktail?.strInstructionsIT?.trim() || '';
    if (language === 'en') return this.cocktail?.strInstructions?.trim() || '';
    return this.cocktail?.['strInstructionsZH-HANS']?.trim() || this.cocktail?.['strInstructionsZH-HANT']?.trim() || '';
  }

  hasInstructions(language: InstructionLanguage): boolean {
    return !!this.instructionsFor(language);
  }

  selectInstructionLanguage(language: InstructionLanguage): void {
    if (this.hasInstructions(language)) this.instructionLanguage = language;
  }

  instructionLanguageTitle(language: InstructionLanguage): string {
    const names = { it: 'italiano', en: 'inglese', zh: 'cinese' };
    return this.hasInstructions(language) ? 'Preparazione in ' + names[language] : 'Nessuna traduzione in ' + names[language] + ' per la preparazione del cocktail';
  }

  get instructions(): string {
    return this.instructionsFor(this.instructionLanguage) || this.instructionsFor('en');
  }

  get instructionsLang(): string {
    if (!this.hasInstructions(this.instructionLanguage)) return 'en';
    if (this.instructionLanguage !== 'zh') return this.instructionLanguage;
    return this.cocktail?.['strInstructionsZH-HANS']?.trim() ? 'zh-Hans' : 'zh-Hant';
  }

  get tags(): string[] {

    if (!this.cocktail?.strTags) {
      return [];
    }

    return this.cocktail.strTags
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => !!tag);
  }

  getMediumImg(src:string){
    return src + '/medium'
  }

  goBack(): void {
    const params = this.route.snapshot.queryParamMap
    const state = readCatalogState(params)
    const legacyCategory = this.route.snapshot.paramMap.get('categoryId')
    const hasSavedState = ['sortBy', 'letter', 'categoryId', 'search', 'onlyFavorites', 'glass', 'alcoholic', 'page'].some(key => params.has(key))
    if (!hasSavedState) {
      if (legacyCategory && /^[A-Za-z]$/.test(legacyCategory)) {
        state.sortBy = 'alphabet-asc'
        state.letter = legacyCategory.toUpperCase()
      } else {
        state.categoryId = legacyCategory || this.cocktail?.strCategory || undefined
      }
    }
    this.router.navigate(['/cocktails'], { queryParams: catalogQueryParams(state) })
  }

  private notifyTransitionReady():void {
    if(!this.cocktailId || this.transitionNotified) return

    this.transitionNotified = true

    this.transitionService.notifyDetailReady(this.cocktailId)
  }

}
