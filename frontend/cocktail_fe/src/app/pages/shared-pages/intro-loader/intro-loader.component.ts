import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, HostListener, OnDestroy, ViewChild } from '@angular/core';
import gsap from 'gsap';
import { IntroService } from 'src/app/shared/service/intro/intro.service';

/*
 * Ingresso, una volta per sessione e solo sul catalogo: la facciata di un locale con la porta chiusa.
 * Si apre la porta (clic, o il pulsante "Apri la porta" anche da tastiera): si spalanca sulla cerniera,
 * la luce calda esce sul pavimento e dietro si vede il bar con i cocktail sul banco. Poi la camera
 * "entra": la facciata si ingrandisce finché sparisce e compare il catalogo.
 */
const STORAGE_KEY = 'cocktail-intro-done'
const OPEN_CLASS = 'intro-open'

const OPEN_DURATION = 0.95
const PUSH_AT = 0.75
const PUSH_DURATION = 0.95

// angolo di apertura (negativo: la porta si apre verso l'interno, il bordo libero si allontana)
const OPEN_ANGLE = -82

@Component({
  selector: 'app-intro-loader',
  templateUrl: './intro-loader.component.html',
  styleUrls: ['./intro-loader.component.css']
})
export class IntroLoaderComponent implements AfterViewInit, OnDestroy {

  @ViewChild('stage') stage?: ElementRef<HTMLDivElement>
  @ViewChild('scene') scene?: ElementRef<HTMLDivElement>
  @ViewChild('leaf') leaf?: ElementRef<HTMLDivElement>
  @ViewChild('light') light?: ElementRef<HTMLDivElement>
  @ViewChild('warmth') warmth?: ElementRef<HTMLDivElement>
  @ViewChild('doorButton') doorButton?: ElementRef<HTMLButtonElement>

  // deciso prima del primo render: l'ingresso non deve mai comparire "dopo" la pagina
  visible = this.shouldShow()

  private timeline?: gsap.core.Timeline
  private opened = false
  private finished = false
  private previousBodyOverflow = ''

  constructor(private intro: IntroService, private changeDetector: ChangeDetectorRef){}

  ngAfterViewInit(): void {
    if (!this.visible){
      this.intro.markDone()
      return
    }

    this.previousBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // finché la porta è chiusa il catalogo resta nascosto: dietro la porta si vede solo il bar
    document.documentElement.classList.add(OPEN_CLASS)

    this.layout()

    // il focus sulla porta: invio o spazio la aprono
    this.doorButton?.nativeElement.focus({ preventScroll: true })
  }

  ngOnDestroy(): void {
    this.timeline?.kill()
    document.documentElement.classList.remove(OPEN_CLASS)
    document.body.style.overflow = this.previousBodyOverflow
  }

  // dimensioni della porta in funzione dello schermo
  private layout(): void {
    const stage = this.stage?.nativeElement

    if (!stage){
      return
    }

    const width = Math.min(300, window.innerWidth * 0.6)
    const height = Math.min(window.innerHeight * 0.72, width * 1.85)
    const bottom = window.innerHeight * 0.88

    stage.style.setProperty('--door-w', `${width.toFixed(0)}px`)
    stage.style.setProperty('--door-h', `${height.toFixed(0)}px`)
    stage.style.setProperty('--door-top', `${(bottom - height).toFixed(0)}px`)
    stage.style.setProperty('--door-bottom', `${bottom.toFixed(0)}px`)
  }

  // un cenno di invito: passando sopra la porta si socchiude appena
  peek(open: boolean): void {
    const leaf = this.leaf?.nativeElement

    if (!leaf || this.opened){
      return
    }

    gsap.to(leaf, { rotationY: open ? -9 : 0, duration: 0.3, ease: 'power2.out', overwrite: 'auto' })
  }

  open(): void {
    const leaf = this.leaf?.nativeElement
    const scene = this.scene?.nativeElement
    const light = this.light?.nativeElement
    const warmth = this.warmth?.nativeElement
    const stage = this.stage?.nativeElement

    if (this.opened || this.finished){
      return
    }

    this.opened = true

    if (!leaf || !scene || !light || !warmth || !stage){
      this.finish()
      return
    }

    this.timeline = gsap.timeline({ onComplete: () => this.finish() })

    // i pulsanti escono di scena subito: ora c'è solo la porta
    const controls = stage.querySelectorAll('.door-open')

    gsap.set(controls, { pointerEvents: 'none' })
    this.timeline.to(controls, { opacity: 0, duration: 0.22, ease: 'power1.out' }, 0)

    // la porta si spalanca sulla cerniera di sinistra
    this.timeline.to(leaf, {
      rotationY: OPEN_ANGLE,
      duration: OPEN_DURATION,
      ease: 'power2.inOut'
    }, 0)

    // la luce del locale esce sul pavimento e illumina la soglia
    this.timeline.to(light, {
      scaleX: 1,
      opacity: 1,
      duration: OPEN_DURATION,
      ease: 'power2.out'
    }, 0.1)

    this.timeline.to(warmth, {
      opacity: 1,
      duration: OPEN_DURATION * 0.9,
      ease: 'power1.out'
    }, 0.05)

    // la camera entra: la facciata si ingrandisce attorno alla porta finché l'apertura riempie lo schermo
    this.timeline.to(scene, {
      scale: 7,
      duration: PUSH_DURATION,
      ease: 'power3.in'
    }, PUSH_AT)

    // il catalogo compare e il titolo può entrare mentre si attraversa la soglia
    this.timeline.call(() => {
      document.documentElement.classList.remove(OPEN_CLASS)
      this.intro.markDone()
    }, [], PUSH_AT + PUSH_DURATION * 0.62)

    this.timeline.to(stage, {
      opacity: 0,
      duration: 0.22,
      ease: 'power1.in'
    }, PUSH_AT + PUSH_DURATION - 0.1)
  }

  @HostListener('document:keydown.escape')
  skip(): void {
    if (!this.visible || this.finished){
      return
    }

    if (this.timeline){
      this.timeline.progress(1)
    }
    else{
      this.finish()
    }
  }

  private finish(): void {
    if (this.finished){
      return
    }

    this.finished = true

    this.timeline?.kill()

    try{
      sessionStorage.setItem(STORAGE_KEY, '1')
    }
    catch{
      // storage non disponibile: l'ingresso tornerà al prossimo caricamento
    }

    this.visible = false

    document.documentElement.classList.remove(OPEN_CLASS)
    document.body.style.overflow = this.previousBodyOverflow

    this.intro.markDone()
    this.changeDetector.detectChanges()
  }

  // una volta per sessione, solo sul catalogo, e mai con "meno movimento"
  private shouldShow(): boolean {
    const onCatalog = location.pathname === '/' || location.pathname.startsWith('/cocktails')

    if (!onCatalog || window.matchMedia('(prefers-reduced-motion: reduce)').matches){
      return false
    }

    try{
      return sessionStorage.getItem(STORAGE_KEY) !== '1'
    }
    catch{
      return true
    }
  }

}
