import { AfterViewInit, Component, ElementRef, Input, OnChanges, OnDestroy, SimpleChanges, ViewChild } from '@angular/core';
import gsap from 'gsap';
import { GlassFamily, glassFamily, mixColors } from 'src/app/shared/utils/cocktail-measure';

/*
 * Bicchiere come solido di rotazione, disegnato in SVG.
 * La forma dipende da strGlass (il tipo di bicchiere dato dall'API).
 * Gira: i meridiani scorrono davanti ai riflessi, che restano fermi.
 *
 * Si riempie a strati, uno per ingrediente con un volume esplicito. Il bicchiere si riempie
 * sempre allo stesso livello (nessuna capienza inventata) e quel volume è diviso tra gli strati
 * in proporzione ai millilitri delle misure. In un bicchiere conico il volume non cresce
 * linearmente con l'altezza, quindi i confini si ricavano dal volume interno (integrale del profilo).
 */

export interface GlassLayer {
  name: string
  color: string
  ml: number             // peso dello strato (millilitri, o parti se la ricetta è in parti)
  measure: string        // il testo della misura, come lo dà l'API
  marker?: boolean       // liquido senza volume indicato ("1 splash"): sottile strato-segnaposto
}

interface Profile {
  height: number          // altezza in unità del viewBox
  radius: number          // raggio massimo in unità del viewBox
  bowlStart: number       // altezza (0-1) da cui il bicchiere può contenere liquido
  stem: boolean
  points: [number, number][]   // [altezza 0-1, raggio relativo 0-1]
}

const PROFILES: Record<GlassFamily, Profile> = {
  highball: {
    height: 224, radius: 62, bowlStart: 0.06, stem: false,
    points: [[0, 0.88], [0.015, 0.92], [1, 1]]
  },
  rocks: {
    height: 128, radius: 70, bowlStart: 0.12, stem: false,
    points: [[0, 0.95], [0.03, 0.97], [1, 1]]
  },
  shot: {
    height: 100, radius: 44, bowlStart: 0.18, stem: false,
    points: [[0, 0.86], [0.03, 0.9], [1, 1]]
  },
  mug: {
    height: 176, radius: 60, bowlStart: 0.1, stem: false,
    points: [[0, 0.92], [0.04, 1], [1, 1]]
  },
  cocktail: {
    height: 236, radius: 74, bowlStart: 0.55, stem: true,
    points: [[0, 0.46], [0.012, 0.44], [0.03, 0.3], [0.06, 0.07], [0.08, 0.045], [0.5, 0.045], [0.55, 0.06],
      [0.65, 0.3], [0.78, 0.58], [0.9, 0.82], [1, 1]]
  },
  coupe: {
    height: 228, radius: 72, bowlStart: 0.5, stem: true,
    points: [[0, 0.46], [0.012, 0.44], [0.03, 0.3], [0.06, 0.07], [0.08, 0.05], [0.46, 0.05], [0.5, 0.07],
      [0.54, 0.3], [0.6, 0.55], [0.7, 0.8], [0.82, 0.95], [0.92, 1], [1, 1]]
  },
  flute: {
    height: 250, radius: 36, bowlStart: 0.38, stem: true,
    points: [[0, 0.9], [0.012, 0.85], [0.03, 0.55], [0.06, 0.1], [0.08, 0.08], [0.36, 0.08], [0.4, 0.14],
      [0.46, 0.36], [0.6, 0.52], [0.8, 0.58], [1, 0.52]]
  },
  wine: {
    height: 244, radius: 58, bowlStart: 0.44, stem: true,
    points: [[0, 0.62], [0.012, 0.58], [0.03, 0.4], [0.06, 0.09], [0.08, 0.07], [0.4, 0.07], [0.44, 0.1],
      [0.52, 0.58], [0.62, 0.88], [0.75, 1], [0.88, 0.92], [1, 0.74]]
  }
}

const CENTER_X = 100
const BASE_Y = 252
const FLATTEN = 0.2          // quanto si vede l'apertura dall'alto (rapporto tra i semiassi)
const WALL = 3               // spessore del vetro
const MERIDIANS = 12
const SAMPLES = 22
const SVG_NS = 'http://www.w3.org/2000/svg'
const LEGEND_SLOTS = 8

// il bicchiere si riempie sempre fino a questa frazione dell'altezza utile
const FILL_HEIGHT = 0.8

// quota del volume per ogni strato-segnaposto (liquido di cui l'API non dà il volume)
const MARKER_SHARE = 0.04

interface LegendEntry {
  line: SVGPathElement
  dot: SVGCircleElement
  text: SVGTextElement
}

interface Callout {
  line: SVGPathElement
  dot: SVGCircleElement
  label: SVGTextElement
  value: SVGTextElement
  text: string
}

@Component({
  selector: 'app-glass',
  templateUrl: './glass.component.html',
  styleUrls: ['./glass.component.css']
})
export class GlassComponent implements AfterViewInit, OnChanges, OnDestroy {

  @Input() glass: string | null = null

  // gli strati, dal fondo verso l'alto
  @Input() layers: GlassLayer[] = []

  // quando diventa true il bicchiere si riempie
  @Input() filled: boolean = false

  @Input() labelGlass: string = ''

  @ViewChild('shadow') shadow!: ElementRef<SVGEllipseElement>
  @ViewChild('rimBack') rimBack!: ElementRef<SVGEllipseElement>
  @ViewChild('liquid') liquid!: ElementRef<SVGGElement>
  @ViewChild('surface') surface!: ElementRef<SVGEllipseElement>
  @ViewChild('rings') rings!: ElementRef<SVGGElement>
  @ViewChild('meridians') meridians!: ElementRef<SVGGElement>
  @ViewChild('body') body!: ElementRef<SVGPathElement>
  @ViewChild('outline') outline!: ElementRef<SVGPathElement>
  @ViewChild('rim') rim!: ElementRef<SVGEllipseElement>
  @ViewChild('highlightA') highlightA!: ElementRef<SVGPathElement>
  @ViewChild('highlightB') highlightB!: ElementRef<SVGPathElement>
  @ViewChild('callouts') calloutLayer!: ElementRef<SVGGElement>

  private profile: Profile = PROFILES.highball
  private meridianPaths: SVGPathElement[] = []
  private ringPaths: SVGPathElement[] = []
  private glassCallout?: Callout

  // liquido a strati
  private layerPaths: SVGPathElement[] = []
  private layerArcs: SVGPathElement[] = []
  private legend: LegendEntry[] = []
  private volumes: { t: number, v: number }[] = []
  private bounds: number[] = []
  private total = 0
  private topT = 0

  // stato animato: quanto è stato versato (0-1 del volume), fase di rotazione, velocità angolare (rad/s)
  private state = { level: 0, phase: 0.6, speed: 0.5 }
  private ready = false
  private fillTween?: gsap.core.Tween

  private tick = (_time: number, deltaTime: number) => {
    this.state.phase += this.state.speed * deltaTime / 1000
    this.render()
  }

  ngAfterViewInit(): void {
    // creati da codice: Angular non applica loro gli stili del componente, quindi lo stile è inline
    for (let i = 0; i < MERIDIANS; i++) {
      this.meridianPaths.push(this.createLine(this.meridians.nativeElement, 1, 0.3))
    }

    for (let i = 0; i < 3; i++) {
      this.ringPaths.push(this.createLine(this.rings.nativeElement, 0.8, 0.22))
    }

    this.glassCallout = this.createCallout(this.calloutLayer.nativeElement)

    for (let i = 0; i < LEGEND_SLOTS; i++) {
      this.legend.push(this.createLegendEntry(this.calloutLayer.nativeElement))
    }

    this.ready = true
    this.profile = PROFILES[glassFamily(this.glass)]
    this.rebuildLiquid()

    if (this.reducedMotion()) {
      this.state.level = this.filled ? 1 : 0
    }
    else {
      gsap.ticker.add(this.tick)

      if (this.filled) {
        this.fillUp()
      }
    }

    this.render()
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.ready) {
      return
    }

    if (changes['glass']) {
      this.profile = PROFILES[glassFamily(this.glass)]
    }

    if (changes['glass'] || changes['layers']) {
      this.rebuildLiquid()
    }

    if (changes['filled'] && this.filled) {
      this.fillUp()
    }
    else if (changes['layers'] && this.filled) {
      this.state.level = 1
    }

    this.render()
  }

  ngOnDestroy(): void {
    gsap.ticker.remove(this.tick)
    this.fillTween?.kill()
  }

  private fillUp(): void {
    if (this.reducedMotion()) {
      this.state.level = 1
      return
    }

    this.fillTween?.kill()

    // mentre si riempie gira più veloce, poi rallenta
    gsap.fromTo(this.state, { speed: 2.6 }, { speed: 0.5, duration: 2.2, ease: 'power2.out' })

    this.fillTween = gsap.to(this.state, {
      level: 1,
      duration: 1.5,
      ease: 'power2.inOut'
    })
  }

  /* ---------- geometria ---------- */

  private createLine(parent: SVGGElement, width: number, opacity: number): SVGPathElement {
    const path = document.createElementNS(SVG_NS, 'path')

    path.style.fill = 'none'
    path.style.stroke = 'var(--bone)'
    path.style.strokeWidth = String(width)
    path.style.strokeLinecap = 'round'
    path.style.strokeLinejoin = 'round'
    path.style.opacity = String(opacity)

    parent.appendChild(path)

    return path
  }

  private radiusAt(t: number): number {
    const points = this.profile.points

    if (t <= points[0][0]) return points[0][1] * this.profile.radius

    for (let i = 1; i < points.length; i++) {
      if (t <= points[i][0]) {
        const [t0, r0] = points[i - 1]
        const [t1, r1] = points[i]
        return (r0 + (r1 - r0) * (t - t0) / (t1 - t0)) * this.profile.radius
      }
    }

    return points[points.length - 1][1] * this.profile.radius
  }

  private innerRadiusAt(t: number): number {
    return Math.max(0, this.radiusAt(t) - WALL)
  }

  private yAt(t: number): number {
    return BASE_Y - t * this.profile.height
  }

  private point(t: number, angle: number, radius = this.radiusAt(t)): [number, number] {
    return [
      CENTER_X + radius * Math.sin(angle),
      this.yAt(t) + radius * FLATTEN * Math.cos(angle)
    ]
  }

  // altezza (0-1) a cui il volume interno cumulato raggiunge v
  private tAtVolume(volume: number): number {
    const table = this.volumes

    if (volume <= 0) return table[0].t

    let low = 0
    let high = table.length - 1

    while (high - low > 1) {
      const mid = (low + high) >> 1

      if (table[mid].v < volume) low = mid
      else high = mid
    }

    const span = table[high].v - table[low].v

    return span > 0 ? table[low].t + (table[high].t - table[low].t) * (volume - table[low].v) / span : table[high].t
  }

  /* ---------- disegno ---------- */

  private render(): void {
    if (!this.ready) {
      return
    }

    const p = this.profile
    const f = (n: number) => n.toFixed(1)

    // sagoma
    const left: string[] = []
    const right: string[] = []

    for (let i = 0; i <= SAMPLES; i++) {
      const t = i / SAMPLES
      const r = this.radiusAt(t)
      left.push(`${f(CENTER_X - r)} ${f(this.yAt(t))}`)
      right.push(`${f(CENTER_X + r)} ${f(this.yAt(t))}`)
    }

    const r0 = this.radiusAt(0)
    const r1 = this.radiusAt(1)

    this.outline.nativeElement.setAttribute('d',
      `M${left.join(' L')} M${right.join(' L')} M${f(CENTER_X - r0)} ${f(BASE_Y)} A${f(r0)} ${f(r0 * FLATTEN)} 0 0 0 ${f(CENTER_X + r0)} ${f(BASE_Y)}`)

    this.body.nativeElement.setAttribute('d',
      `M${left.join(' L')} L${f(CENTER_X + r1)} ${f(this.yAt(1))} L${right.slice().reverse().join(' L')} Z`)

    this.setEllipse(this.rim.nativeElement, CENTER_X, this.yAt(1), r1, r1 * FLATTEN)
    this.setEllipse(this.rimBack.nativeElement, CENTER_X, this.yAt(1), r1, r1 * FLATTEN)
    this.setEllipse(this.shadow.nativeElement, CENTER_X, BASE_Y + 4, r0 * 1.2, r0 * 1.2 * FLATTEN * 0.9)

    // anelli fissi: danno il volume
    const ringFrom = p.stem ? p.bowlStart + 0.08 : 0.2
    const ringTo = 0.9

    this.ringPaths.forEach((path, index) => {
      const t = ringFrom + (ringTo - ringFrom) * (index + 1) / (this.ringPaths.length + 1)
      const r = this.radiusAt(t)
      path.setAttribute('d', `M${f(CENTER_X - r)} ${f(this.yAt(t))} A${f(r)} ${f(r * FLATTEN)} 0 0 0 ${f(CENTER_X + r)} ${f(this.yAt(t))}`)
    })

    // meridiani: scorrono con la fase, si vedono solo quelli sul lato rivolto a chi guarda
    const tStart = p.stem ? p.bowlStart - 0.02 : 0.02

    this.meridianPaths.forEach((path, index) => {
      const angle = this.state.phase + index * Math.PI * 2 / MERIDIANS
      const facing = Math.cos(angle)

      if (facing <= 0.03) {
        path.setAttribute('d', '')
        return
      }

      const points: string[] = []

      for (let i = 0; i <= SAMPLES; i++) {
        const t = tStart + (1 - tStart) * i / SAMPLES
        const [x, y] = this.point(t, angle)
        points.push(`${f(x)} ${f(y)}`)
      }

      path.setAttribute('d', `M${points.join(' L')}`)
      path.style.opacity = (0.1 + 0.5 * facing).toFixed(2)
    })

    // riflessi fissi
    this.setHighlight(this.highlightA.nativeElement, -0.78, tStart + 0.08, 0.93)
    this.setHighlight(this.highlightB.nativeElement, 0.95, tStart + 0.2, 0.8)

    this.renderLiquid()
    this.renderGlassLabel()
  }

  private createCallout(parent: SVGGElement): Callout {
    const line = document.createElementNS(SVG_NS, 'path')
    line.style.fill = 'none'
    line.style.stroke = 'var(--bone)'
    line.style.strokeWidth = '0.8'
    line.style.opacity = '0.55'

    const dot = document.createElementNS(SVG_NS, 'circle')
    dot.setAttribute('r', '2.2')
    dot.style.fill = 'var(--peel)'

    const label = document.createElementNS(SVG_NS, 'text')
    label.style.fontFamily = 'var(--font-mono)'
    label.style.fontSize = '10.5px'
    label.style.letterSpacing = '0.08em'
    label.style.textTransform = 'uppercase'
    label.style.fill = 'var(--mute-dark)'

    const value = document.createElementNS(SVG_NS, 'text')
    value.style.fontFamily = 'var(--font-text)'
    value.style.fontSize = '13px'
    value.style.fontWeight = '600'
    value.style.fill = 'var(--bone)'

    parent.append(line, dot, label, value)

    return { line, dot, label, value, text: '' }
  }

  // didascalia con filo sul bordo: il tipo di bicchiere, come lo dà l'API (strGlass)
  private renderGlassLabel(): void {
    const callout = this.glassCallout

    if (!callout) {
      return
    }

    const f = (n: number) => n.toFixed(1)

    if (!this.labelGlass) {
      callout.line.style.display = callout.dot.style.display = callout.label.style.display = callout.value.style.display = 'none'
      return
    }

    const ax = CENTER_X - this.radiusAt(1)
    const ay = this.yAt(1)
    const horizontalY = ay - 14

    callout.line.style.display = callout.dot.style.display = callout.label.style.display = callout.value.style.display = ''
    callout.line.setAttribute('d', `M${f(ax)} ${f(ay)} L${f(ax - 14)} ${f(horizontalY)} L-12 ${f(horizontalY)}`)
    callout.dot.setAttribute('cx', f(ax))
    callout.dot.setAttribute('cy', f(ay))

    callout.label.setAttribute('x', '-17')
    callout.label.setAttribute('y', f(horizontalY - 5))
    callout.label.setAttribute('text-anchor', 'end')
    callout.value.setAttribute('x', '-17')
    callout.value.setAttribute('y', f(horizontalY + 13))
    callout.value.setAttribute('text-anchor', 'end')

    if (callout.text !== this.labelGlass) {
      callout.text = this.labelGlass
      callout.label.textContent = 'Bicchiere'
      callout.value.textContent = this.labelGlass
    }
  }

  private setHighlight(path: SVGPathElement, angle: number, from: number, to: number): void {
    const points: string[] = []

    for (let i = 0; i <= 14; i++) {
      const t = from + (to - from) * i / 14
      const [x, y] = this.point(t, angle)
      points.push(`${x.toFixed(1)} ${y.toFixed(1)}`)
    }

    path.setAttribute('d', `M${points.join(' L')}`)
  }

  private setEllipse(element: SVGEllipseElement, cx: number, cy: number, rx: number, ry: number): void {
    element.setAttribute('cx', cx.toFixed(1))
    element.setAttribute('cy', cy.toFixed(1))
    element.setAttribute('rx', Math.max(0, rx).toFixed(1))
    element.setAttribute('ry', Math.max(0, ry).toFixed(1))
  }

  /*
   * Volume interno cumulato lungo il profilo (integrale di π·r²·dh) e confini degli strati.
   * Il bicchiere si riempie sempre fino a FILL_HEIGHT: quel volume è diviso tra gli strati in
   * proporzione ai loro millilitri. Nessuna capienza: contano solo i rapporti tra le misure.
   */
  private rebuildLiquid(): void {
    const profile = this.profile
    const from = profile.bowlStart
    const to = 1 - 0.04
    const steps = 160

    this.volumes = [{ t: from, v: 0 }]

    let volume = 0

    for (let i = 1; i <= steps; i++) {
      const a = from + (to - from) * (i - 1) / steps
      const b = from + (to - from) * i / steps
      const r = this.innerRadiusAt((a + b) / 2)

      volume += Math.PI * r * r * (b - a) * profile.height
      this.volumes.push({ t: b, v: volume })
    }

    // volume del liquido: quello contenuto fino all'altezza di riempimento
    const fillT = from + (to - from) * FILL_HEIGHT
    const fillVolume = this.volumes.find(entry => entry.t >= fillT)?.v ?? volume

    // i segnaposto hanno una quota fissa; gli altri dividono il resto in proporzione alle misure
    const markers = this.layers.filter(layer => layer.marker).length
    const measuredShare = Math.max(0.2, 1 - markers * MARKER_SHARE)
    const sum = this.layers.reduce((acc, layer) => acc + (layer.marker ? 0 : layer.ml), 0)
    const unmeasured = this.layers.length - markers

    let cumulative = 0

    this.bounds = this.layers.map(layer => {
      const share = layer.marker
        ? MARKER_SHARE
        : sum > 0 ? layer.ml / sum * measuredShare : measuredShare / Math.max(1, unmeasured)

      return cumulative += share * fillVolume
    })

    this.total = cumulative

    // un elemento per strato, più un arco sul bordo superiore: lì si vede il confine nel vetro
    const group = this.liquid.nativeElement

    while (group.firstChild) {
      group.removeChild(group.firstChild)
    }

    this.layerPaths = []
    this.layerArcs = []

    this.layers.forEach(() => {
      const path = document.createElementNS(SVG_NS, 'path')
      const arc = document.createElementNS(SVG_NS, 'path')

      arc.style.fill = 'none'
      arc.style.stroke = 'rgba(255, 255, 255, 0.55)'
      arc.style.strokeWidth = '0.9'

      group.appendChild(path)
      group.appendChild(arc)

      this.layerPaths.push(path)
      this.layerArcs.push(arc)
    })
  }

  private layerShape(tBottom: number, tTop: number): string {
    const f = (n: number) => n.toFixed(1)
    const steps = Math.max(2, Math.ceil((tTop - tBottom) * 40))

    const leftEdge: string[] = []
    const rightEdge: string[] = []

    for (let i = 0; i <= steps; i++) {
      const t = tBottom + (tTop - tBottom) * i / steps
      const r = this.innerRadiusAt(t)

      leftEdge.push(`${f(CENTER_X - r)} ${f(this.yAt(t))}`)
      rightEdge.push(`${f(CENTER_X + r)} ${f(this.yAt(t))}`)
    }

    const rBottom = this.innerRadiusAt(tBottom)
    const rTop = this.innerRadiusAt(tTop)

    // fianco sinistro, bordo anteriore in alto, fianco destro, fondo
    return `M${leftEdge.join(' L')} A${f(rTop)} ${f(rTop * FLATTEN)} 0 0 0 ${f(CENTER_X + rTop)} ${f(this.yAt(tTop))} ` +
      `L${rightEdge.reverse().join(' L')} A${f(rBottom)} ${f(rBottom * FLATTEN)} 0 0 1 ${f(CENTER_X - rBottom)} ${f(this.yAt(tBottom))} Z`
  }

  private renderLiquid(): void {
    const surface = this.surface.nativeElement
    const f = (n: number) => n.toFixed(1)

    // volume versato finora: gli strati si riempiono uno dopo l'altro, dal fondo
    const poured = this.state.level * this.total

    this.topT = poured > 0 ? this.tAtVolume(poured) : this.profile.bowlStart

    let topIndex = -1
    const visible: { layer: GlassLayer, tMid: number }[] = []

    this.layers.forEach((layer, index) => {
      const path = this.layerPaths[index]
      const arc = this.layerArcs[index]
      const volumeBottom = index === 0 ? 0 : this.bounds[index - 1]

      if (poured <= volumeBottom + 1e-6) {
        path.setAttribute('d', '')
        arc.setAttribute('d', '')
        return
      }

      const tBottom = this.tAtVolume(volumeBottom)
      const tTop = this.tAtVolume(Math.min(poured, this.bounds[index]))
      const rTop = this.innerRadiusAt(tTop)

      path.setAttribute('d', this.layerShape(tBottom, tTop))
      path.style.fill = layer.color

      arc.setAttribute('d', `M${f(CENTER_X - rTop)} ${f(this.yAt(tTop))} A${f(rTop)} ${f(rTop * FLATTEN)} 0 0 0 ${f(CENTER_X + rTop)} ${f(this.yAt(tTop))}`)

      topIndex = index
      visible.push({ layer, tMid: (tBottom + tTop) / 2 })
    })

    if (topIndex < 0) {
      surface.setAttribute('rx', '0')
      this.renderLegend([])
      return
    }

    // l'ultimo strato visibile non ha arco: ha la superficie, un'ellisse più chiara
    this.layerArcs[topIndex].setAttribute('d', '')

    const rSurface = this.innerRadiusAt(this.topT)

    this.setEllipse(surface, CENTER_X, this.yAt(this.topT), rSurface, rSurface * FLATTEN)
    surface.style.fill = mixColors(this.layers[topIndex].color, '#ffffff', 0.28)

    this.renderLegend(visible)
  }

  private createLegendEntry(parent: SVGGElement): LegendEntry {
    const line = document.createElementNS(SVG_NS, 'path')
    line.style.fill = 'none'
    line.style.stroke = 'var(--bone)'
    line.style.strokeWidth = '0.8'
    line.style.opacity = '0.5'
    line.style.display = 'none'

    const dot = document.createElementNS(SVG_NS, 'circle')
    dot.setAttribute('r', '1.8')
    dot.style.fill = 'var(--bone)'
    dot.style.display = 'none'

    const text = document.createElementNS(SVG_NS, 'text')
    text.style.fontFamily = 'var(--font-text)'
    text.style.fontSize = '11.5px'
    text.style.fontWeight = '600'
    text.style.fill = 'var(--bone)'
    text.setAttribute('text-anchor', 'end')
    text.style.display = 'none'

    parent.append(line, dot, text)

    return { line, dot, text }
  }

  /*
   * Una voce per strato, sul lato sinistro: nome e misura, come li dà l'API. Gli strati sottili
   * si toccano, quindi le etichette si distanziano scendendo di un'altezza di riga.
   */
  private renderLegend(visible: { layer: GlassLayer, tMid: number }[]): void {
    const f = (n: number) => n.toFixed(1)

    // dall'alto verso il basso
    const entries = visible
      .map(item => ({ item, anchorY: this.yAt(item.tMid), labelY: this.yAt(item.tMid) }))
      .sort((a, b) => a.anchorY - b.anchorY)

    const gap = 15.5

    entries.forEach((entry, index) => {
      if (index > 0) {
        entry.labelY = Math.max(entry.labelY, entries[index - 1].labelY + gap)
      }
    })

    this.legend.forEach((slot, index) => {
      const entry = entries[index]

      if (!entry) {
        slot.line.style.display = slot.dot.style.display = slot.text.style.display = 'none'
        return
      }

      const t = entry.item.tMid
      const anchorX = CENTER_X - this.radiusAt(t) + 4
      const name = entry.item.layer.name.length > 15 ? entry.item.layer.name.slice(0, 14) + '…' : entry.item.layer.name
      const label = `${name} · ${entry.item.layer.measure}`

      slot.line.style.display = slot.dot.style.display = slot.text.style.display = ''
      slot.line.setAttribute('d', `M${f(anchorX)} ${f(entry.anchorY)} L${f(anchorX - 12)} ${f(entry.labelY)} L-8 ${f(entry.labelY)}`)
      slot.dot.setAttribute('cx', f(anchorX))
      slot.dot.setAttribute('cy', f(entry.anchorY))
      slot.text.setAttribute('x', '-12')
      slot.text.setAttribute('y', f(entry.labelY + 4))

      if (slot.text.textContent !== label) {
        slot.text.textContent = label
      }
    })
  }

  private reducedMotion(): boolean {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }

}
