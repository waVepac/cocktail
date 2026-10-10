import { ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import gsap from 'gsap';
import { catchError, filter, firstValueFrom, of, Subscription, take, timeout } from 'rxjs';
import { CocktailTransitionRequest, CocktailTransitionService } from 'src/app/shared/service/transition/cocktail-transition.service';

/*
 * Coreografia "il sorso"
 *
 *  1. il bicchiere viene sollevato dalla riga e portato davanti al viso,
 *     lungo un arco, mentre si inclina e si avvicina;
 *  2. il velo scuro copre il cambio pagina, che avviene a metà del gesto;
 *  3. la foto non svanisce: scende e si posa sul banco della scena, dove diventa la polaroid
 *     (il bersaglio è l'elemento con data-transition-target nel dettaglio), mentre il velo si alza.
 *     Solo dopo il bicchiere della scena comincia a riempirsi.
 */
const LIFT_DURATION = 0.65
const NAVIGATE_AT = 0.38
const LAND_DURATION = 0.7

const VEIL_OPACITY = 0.94
const SIP_SCALE = 1.15
const SIP_TILT = 22

@Component({
  selector: 'app-cocktail-transition',
  templateUrl: './cocktail-transition.component.html',
  styleUrls: ['./cocktail-transition.component.css']
})
export class CocktailTransitionComponent implements OnInit, OnDestroy{

  @ViewChild('overlay') overlay?: ElementRef<HTMLDivElement>
  @ViewChild('backdrop') backdrop?: ElementRef<HTMLDivElement>
  @ViewChild('glass') glass?: ElementRef<HTMLDivElement>
  @ViewChild('transitionImage') transitionImage?: ElementRef<HTMLImageElement>

  transition: CocktailTransitionRequest | null = null
  private subscription?:Subscription
  private running = false
  private previousBodyOverflow = ''

  private sway?: gsap.core.Tween
  private glassSize = 0
  private hiddenSource?: HTMLElement

  constructor(private router:Router, private transitionService:CocktailTransitionService, private changeDetector: ChangeDetectorRef){}

  ngOnInit(): void {

    this.subscription = this.transitionService.transition$.subscribe(request => {

      if (this.running){
        return
      }

      // chi chiede meno movimento va dritto al dettaglio, senza overlay
      if (this.prefersReducedMotion()){
        this.navigateToDetail(request)
        return
      }

      this.transition = request
      this.running = true

      this.transitionService.setActive(true)

      this.lockScroll()

      this.changeDetector.detectChanges()

      requestAnimationFrame(() => {
        this.runTransition(request)
      })
    })
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe()
    this.killTweens()
    this.restoreSource()
    this.unlockScroll()
  }

  private navigateToDetail(request: CocktailTransitionRequest): Promise<boolean> {
    const commands = ['/cocktail', request.cocktail.idDrink]
    if (request.categoryId) {
      commands.push(request.categoryId)
    }
    return this.router.navigate(commands, { queryParams: request.queryParams })
  }

  private async runTransition(request: CocktailTransitionRequest): Promise<void> {
    const cocktailId = request.cocktail.idDrink

    // ci si iscrive subito: detailReady$ non rimanda i valori già emessi
    const detailReady = this.waitForDetailReady(cocktailId)

    let navigation: Promise<boolean> | undefined

    const navigate = () => {
      navigation ??= this.navigateToDetail(request)
    }

    try{
      await this.decodeImage()

      await this.lift(request, navigate)

      // se l'animazione non è partita, il dettaglio va aperto comunque
      navigate()

      this.startSway()

      if(await navigation){
        await detailReady
        await this.nextFrame()
      }

      await this.land()
    }
    catch (error){
      console.error(error)

      await this.fadeAway()
    }
    finally{
      this.finishTransition()
    }
  }

  /*
   * Dalla miniatura alla bocca.
   * Il bicchiere ha già la dimensione finale e si anima solo con transform:
   * nessun layout per frame, e la GPU non deve rasterizzare di nuovo l'immagine.
   */
  private lift(request: CocktailTransitionRequest, onNavigate: () => void): Promise<void> {
    return new Promise(resolve => {

      const glass = this.glass?.nativeElement
      const image = this.transitionImage?.nativeElement
      const backdrop = this.backdrop?.nativeElement

      if(!glass || !image || !backdrop){
        resolve()
        return
      }

      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight

      const rect = request.imageRect

      const size = Math.min(viewportWidth * 0.6, viewportHeight * 0.42, 380)

      this.glassSize = size

      // il bicchiere parte esattamente sopra la miniatura
      gsap.set(glass, {
        width: size,
        height: size,

        x: rect.left + rect.width / 2 - size / 2,
        y: rect.top + rect.height / 2 - size / 2,

        scale: rect.width / size,

        visibility: 'visible'
      })

      gsap.set(image, { rotation: 0 })
      gsap.set(backdrop, { opacity: 0 })

      this.hideSource(request.sourceElement)

      const timeline = gsap.timeline({
        onComplete: () => resolve()
      })

      // il velo sale piano: nessun lampo scuro all'inizio, ma è pieno quando cambia la pagina
      timeline.to(backdrop, {
        opacity: VEIL_OPACITY,
        duration: 0.4,
        ease: 'power1.inOut'
      }, 0)

      // x e y con easing diversi: il percorso è un arco, non una retta
      timeline.to(glass, {
        x: (viewportWidth - size) / 2,
        duration: LIFT_DURATION,
        ease: 'power2.inOut'
      }, 0)

      timeline.to(glass, {
        y: viewportHeight * 0.46 - size / 2,
        duration: LIFT_DURATION,
        ease: 'power2.out'
      }, 0)

      // il bicchiere si avvicina al viso
      timeline.to(glass, {
        scale: SIP_SCALE,
        duration: LIFT_DURATION,
        ease: 'power2.inOut'
      }, 0)

      // l'inclinazione arriva dopo: prima si solleva, poi si inclina
      timeline.to(image, {
        rotation: SIP_TILT,
        duration: LIFT_DURATION * 0.85,
        ease: 'power2.inOut'
      }, LIFT_DURATION * 0.15)

      timeline.call(onNavigate, [], NAVIGATE_AT)
    })
  }

  /*
   * Il bicchiere resta vivo mentre il dettaglio si carica:
   * un'oscillazione minima, che land() interrompe.
   */
  private startSway(): void {
    const image = this.transitionImage?.nativeElement

    if(!image){
      return
    }

    this.sway = gsap.to(image, {
      rotation: '+=2.5',
      duration: 1.4,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: -1
    })
  }

  /*
   * Atterraggio: la foto scende lungo un arco fino alla polaroid del dettaglio, prende la sua
   * inclinazione e perde gli angoli arrotondati; il velo si alza e scopre la scena. Quando arriva,
   * la polaroid vera (identica, nello stesso punto) prende il suo posto e l'overlay sfuma.
   */
  private land(): Promise<void> {
    return new Promise(resolve => {

      this.sway?.kill()
      this.sway = undefined

      const glass = this.glass?.nativeElement
      const image = this.transitionImage?.nativeElement
      const backdrop = this.backdrop?.nativeElement
      const overlay = this.overlay?.nativeElement

      const target = document.querySelector<HTMLElement>('[data-transition-target]')
      const rect = target?.getBoundingClientRect()

      const onScreen = !!rect
        && rect.width > 0
        && rect.bottom > 0
        && rect.top < window.innerHeight
        && rect.right > 0
        && rect.left < window.innerWidth

      // senza un punto d'arrivo visibile (errore, schermo stretto) la foto si dissolve
      if(!glass || !image || !backdrop || !overlay || !target || !rect || !onScreen){
        this.fadeAway().then(resolve)
        return
      }

      // la polaroid è inclinata: dimensione e angolo veri, non quelli del rettangolo che la contiene
      const side = target.offsetWidth
      const angle = this.rotationOf(target.parentElement)

      const timeline = gsap.timeline({
        onComplete: () => {
          // la polaroid vera appare sotto, l'overlay sfuma: nessuno stacco
          this.transitionService.setActive(false)

          gsap.to(overlay, {
            opacity: 0,
            duration: 0.18,
            ease: 'power1.out',
            onComplete: () => resolve()
          })
        }
      })

      // x e y con easing diversi: scende lungo un arco e rallenta quando si posa
      timeline.to(glass, {
        x: rect.left + rect.width / 2 - this.glassSize / 2,
        duration: LAND_DURATION,
        ease: 'power3.inOut'
      }, 0)

      timeline.to(glass, {
        y: rect.top + rect.height / 2 - this.glassSize / 2,
        duration: LAND_DURATION,
        ease: 'power2.inOut'
      }, 0)

      timeline.to(glass, {
        scale: side / this.glassSize,
        duration: LAND_DURATION,
        ease: 'power3.inOut'
      }, 0)

      timeline.to(image, {
        rotation: angle,
        borderRadius: 0,
        duration: LAND_DURATION,
        ease: 'power3.inOut'
      }, 0)

      // il velo si alza mentre la foto scende: la scena si scopre sotto di lei
      timeline.to(backdrop, {
        opacity: 0,
        duration: LAND_DURATION * 0.8,
        ease: 'power1.inOut'
      }, 0.1)
    })
  }

  // inclinazione (gradi) di un elemento, dalla sua matrice di trasformazione
  private rotationOf(element: Element | null): number {
    if(!element){
      return 0
    }

    const matrix = new DOMMatrix(getComputedStyle(element).transform)

    return Math.atan2(matrix.b, matrix.a) * 180 / Math.PI
  }

  // fallback: la foto si rimpicciolisce e svanisce mentre il velo si alza
  private fadeAway(): Promise<void> {
    return new Promise(resolve => {

      this.sway?.kill()
      this.sway = undefined

      const glass = this.glass?.nativeElement
      const backdrop = this.backdrop?.nativeElement

      if(!glass || !backdrop){
        this.transitionService.setActive(false)
        resolve()
        return
      }

      gsap.to(glass, {
        scale: '*=0.9',
        opacity: 0,
        duration: 0.32,
        ease: 'power2.in'
      })

      gsap.to(backdrop, {
        opacity: 0,
        duration: 0.4,
        ease: 'power1.inOut',
        onComplete: () => {
          this.transitionService.setActive(false)
          resolve()
        }
      })
    })
  }

  private waitForDetailReady(cocktailId: string): Promise<string> {
    return firstValueFrom(
      this.transitionService.detailReady$.pipe(
        filter(id => id === cocktailId),
        take(1),

        timeout(1500),
        catchError(() => of(cocktailId))
      )
    )
  }

  // l'immagine deve essere già decodificata, altrimenti compare a scatto durante il volo;
  // decode() può non risolversi mai se la pagina non renderizza (tab in background): niente attese infinite
  private async decodeImage(): Promise<void> {
    const image = this.transitionImage?.nativeElement

    if(!image){
      return
    }

    try{
      await Promise.race([
        image.decode(),
        new Promise(resolve => setTimeout(resolve, 300))
      ])
    }
    catch{
      // immagine non disponibile: si procede comunque
    }
  }

  private nextFrame(): Promise<void> {
    return new Promise(resolve => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          resolve()
        })
      })
    })
  }

  // la miniatura "viene sollevata": nella riga resta il riquadro vuoto
  private hideSource(source?: HTMLElement): void {
    const thumbnail = source?.querySelector('img') ?? source

    if(!thumbnail){
      return
    }

    thumbnail.style.visibility = 'hidden'

    this.hiddenSource = thumbnail
  }

  private restoreSource(): void {
    if(this.hiddenSource){
      this.hiddenSource.style.visibility = ''
      this.hiddenSource = undefined
    }
  }

  private prefersReducedMotion(): boolean {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }

  private lockScroll(): void {
    this.previousBodyOverflow = document.body.style.overflow

    document.body.style.overflow = 'hidden'
  }

  private unlockScroll(): void {
    document.body.style.overflow = this.previousBodyOverflow
  }

  private killTweens(): void {
    this.sway?.kill()
    this.sway = undefined

    const targets = [
      this.overlay,
      this.backdrop,
      this.glass,
      this.transitionImage
    ]

    for(const target of targets){
      if(target) gsap.killTweensOf(target.nativeElement)
    }
  }

  private finishTransition(): void {

    this.killTweens()
    this.restoreSource()

    this.transition = null
    this.running = false
    this.transitionService.setActive(false)
    this.unlockScroll()
    this.changeDetector.detectChanges()
  }

}
