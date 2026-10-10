import { AfterViewInit, Component, ElementRef, NgZone, OnDestroy, ViewChild } from '@angular/core';

/*
 * Il bar: soffitto con faretti, pareti con grandi archi, retrobanco di bottiglie illuminate,
 * lampade a sospensione, banco curvo di pietra con le scanalature e gli sgabelli.
 * È decorativo (aria-hidden). Tre livelli scorrono a velocità diverse, come in una scena vera:
 * la parete lenta, il banco più veloce, gli sgabelli ancora di più.
 *
 * Disegno procedurale con seme fisso: stesso bar a ogni caricamento.
 */

interface BottleShape {
  width: number
  height: number
  neck: number
  path: string
}

const SHAPES: BottleShape[] = [
  { width: 34, height: 120, neck: 6, path: 'M14 0 H20 V32 C20 44 32 48 32 66 V116 A4 4 0 0 1 28 120 H6 A4 4 0 0 1 2 116 V66 C2 48 14 44 14 32 Z' },
  { width: 40, height: 104, neck: 12, path: 'M14 0 H26 V12 L38 24 V100 A4 4 0 0 1 34 104 H6 A4 4 0 0 1 2 100 V24 L14 12 Z' },
  { width: 46, height: 96, neck: 12, path: 'M17 0 H29 V16 C42 22 44 34 44 46 V92 A4 4 0 0 1 40 96 H6 A4 4 0 0 1 2 92 V46 C2 34 4 22 17 16 Z' },
  { width: 28, height: 130, neck: 8, path: 'M10 0 H18 V44 C22 52 26 58 26 70 V126 A4 4 0 0 1 22 130 H6 A4 4 0 0 1 2 126 V70 C2 58 6 52 10 44 Z' },
  { width: 48, height: 100, neck: 10, path: 'M19 0 H29 V18 C29 26 46 30 46 52 V96 A4 4 0 0 1 42 100 H6 A4 4 0 0 1 2 96 V52 C2 30 19 26 19 18 Z' }
]

// tinte scure: il testo sopra resta leggibile (grigio chiaro ≥ 4,8:1)
const GLASS_COLORS = ['#3d2c16', '#18291d', '#3d171d', '#18293a', '#2a3338', '#33231a']

// il disegno è in questo riquadro; il contenitore è più alto per lasciare spazio alla parallasse
const VIEW_W = 1600
const VIEW_H = 1000
const FLOOR = 620            // dove finiscono le pareti e comincia il pavimento

// quanto scorre ogni livello rispetto alla pagina (0 = fermo): effetto asintotico, non si "esaurisce" di colpo
const DEPTH = { back: 0.55, mid: 0.85, front: 1 }
const TRAVEL = 150           // spostamento massimo in px del livello più veloce

@Component({
  selector: 'app-back-bar',
  templateUrl: './back-bar.component.html',
  styleUrls: ['./back-bar.component.css']
})
export class BackBarComponent implements AfterViewInit, OnDestroy {

  @ViewChild('back') back!: ElementRef<HTMLDivElement>
  @ViewChild('mid') mid!: ElementRef<HTMLDivElement>
  @ViewChild('front') front!: ElementRef<HTMLDivElement>

  private frame = 0
  private parallax = !window.matchMedia('(prefers-reduced-motion: reduce)').matches

  constructor(private zone: NgZone) {}

  ngAfterViewInit(): void {
    this.back.nativeElement.innerHTML = this.svg(this.backLayer())
    this.mid.nativeElement.innerHTML = this.svg(this.midLayer())
    this.front.nativeElement.innerHTML = this.svg(this.frontLayer())

    if (this.parallax) {
      // fuori da Angular: lo scroll non deve far girare il change detection
      this.zone.runOutsideAngular(() => window.addEventListener('scroll', this.onScroll, { passive: true }))
    }

    this.move()
  }

  ngOnDestroy(): void {
    window.removeEventListener('scroll', this.onScroll)
    cancelAnimationFrame(this.frame)
  }

  private onScroll = () => {
    if (this.frame) {
      return
    }

    this.frame = requestAnimationFrame(() => {
      this.frame = 0
      this.move()
    })
  }

  private move(): void {
    // 0 → 1 man mano che si scende: i primi 700px fanno la maggior parte del movimento
    const progress = 1 - Math.exp(-window.scrollY / 700)

    const shift = (element: ElementRef<HTMLDivElement>, depth: number) => {
      element.nativeElement.style.transform = `translate3d(0, ${(-TRAVEL * depth * progress).toFixed(1)}px, 0)`
    }

    shift(this.back, DEPTH.back)
    shift(this.mid, DEPTH.mid)
    shift(this.front, DEPTH.front)
  }

  /* ---------- disegno ---------- */

  private svg(content: string): string {
    return `<svg viewBox="0 0 ${VIEW_W} ${VIEW_H}" preserveAspectRatio="xMidYMid slice" focusable="false">${content}</svg>`
  }

  // soffitto, pareti, retrobanco e lampade
  private backLayer(): string {
    const random = this.random(4207)
    let s = ''

    // soffitto con faretti incassati in prospettiva
    s += `<rect width="${VIEW_W}" height="150" fill="#17100e"/>`

    for (let row = 0; row < 3; row++) {
      const y = 28 + row * 34
      const count = 5 + row * 2
      const spread = 520 + row * 330

      for (let i = 0; i < count; i++) {
        const x = VIEW_W / 2 - spread / 2 + (spread / (count - 1)) * i
        s += `<ellipse cx="${x.toFixed(0)}" cy="${y}" rx="${14 - row * 2}" ry="${5 - row}" fill="#f0a04b" opacity="0.55"/>`
        s += `<ellipse cx="${x.toFixed(0)}" cy="${y}" rx="${44 - row * 6}" ry="${14 - row * 2}" fill="#f0a04b" opacity="0.07"/>`
      }
    }

    // pareti
    s += `<rect y="150" width="${VIEW_W}" height="${FLOOR - 150}" fill="#33231a"/>`

    // grandi archi organici, come i dipinti murali del locale
    s += `<path d="M-30 ${FLOOR} V320 C-30 190 120 140 230 175 C340 212 400 300 400 430 V${FLOOR} Z" fill="#3f2c20"/>`
    s += `<path d="M30 ${FLOOR} V380 C30 290 120 245 200 272 C280 300 330 360 330 450 V${FLOOR} Z" fill="#44301f"/>`
    s += `<path d="M${VIEW_W + 30} ${FLOOR} V320 C${VIEW_W + 30} 190 ${VIEW_W - 120} 140 ${VIEW_W - 230} 175 C${VIEW_W - 340} 212 ${VIEW_W - 400} 300 ${VIEW_W - 400} 430 V${FLOOR} Z" fill="#3f2c20"/>`
    s += `<path d="M${VIEW_W - 30} ${FLOOR} V380 C${VIEW_W - 30} 290 ${VIEW_W - 120} 245 ${VIEW_W - 200} 272 C${VIEW_W - 280} 300 ${VIEW_W - 330} 360 ${VIEW_W - 330} 450 V${FLOOR} Z" fill="#44301f"/>`

    // porta scura a sinistra e vetrina frigo a destra
    s += `<rect x="40" y="330" width="100" height="${FLOOR - 330}" rx="50" fill="#120c0a"/>`
    s += `<rect x="1440" y="390" width="86" height="${FLOOR - 390}" rx="6" fill="#1b1612"/>`
    s += `<rect x="1448" y="398" width="70" height="${FLOOR - 406}" rx="3" fill="#2a3338" opacity="0.7"/>`

    // retrobanco: cornice di legno, fondo caldo, scaffali pieni di bottiglie
    const left = 560
    const right = 1040
    const top = 110
    const bottom = 560

    s += `<rect x="${left - 18}" y="${top - 18}" width="${right - left + 36}" height="${bottom - top + 36}" fill="#22150f"/>`
    s += `<rect x="${left}" y="${top}" width="${right - left}" height="${bottom - top}" fill="#3a2618"/>`

    const shelves = [236, 350, 464, 548]

    shelves.forEach((y, index) => {
      s += this.bottleRow(random, left + 8, right - 8, y, 0.5 + (index % 2) * 0.04, 0.74)
      s += `<rect x="${left}" y="${y}" width="${right - left}" height="11" fill="#2b2018"/>`
      s += `<rect x="${left}" y="${y}" width="${right - left}" height="1.5" fill="#f0a04b" opacity="0.3"/>`
      s += `<rect x="${left}" y="${y + 11}" width="${right - left}" height="3" fill="#f0a04b" opacity="0.55"/>`
    })

    // parete di fondo del bancone, sotto il retrobanco
    s += `<rect x="${left - 18}" y="${bottom}" width="${right - left + 36}" height="${FLOOR - bottom + 6}" fill="#22150f"/>`

    // lampade a sospensione: cavo, paralume d'ottone, alone caldo
    for (const x of [380, 800, 1220]) {
      const y = 290
      s += `<line x1="${x}" y1="0" x2="${x}" y2="${y - 22}" stroke="#120c0a" stroke-width="2"/>`
      for (let ring = 0; ring < 6; ring++) {
        s += `<circle cx="${x}" cy="${y + 4}" r="${200 - ring * 30}" fill="#f0a04b" opacity="0.028"/>`
      }
      s += `<path d="M${x - 30} ${y} A30 22 0 0 1 ${x + 30} ${y} Z" fill="#5a4326" transform="translate(0 -4)"/>`
      s += `<ellipse cx="${x}" cy="${y}" rx="30" ry="4" fill="#3a3023"/>`
      s += `<ellipse cx="${x}" cy="${y + 3}" rx="16" ry="4" fill="#f0a04b" opacity="0.9"/>`
    }

    return s
  }

  // pavimento a terrazzo e banco curvo di pietra con le scanalature
  private midLayer(): string {
    const random = this.random(991)
    let s = ''

    // pavimento
    s += `<rect y="${FLOOR}" width="${VIEW_W}" height="${VIEW_H - FLOOR}" fill="#241a16"/>`

    const specks = ['#6e4d38', '#c9a98a', '#3d2a22', '#9c5a3a']

    for (let i = 0; i < 280; i++) {
      s += `<ellipse cx="${(random() * VIEW_W).toFixed(0)}" cy="${(FLOOR + random() * (VIEW_H - FLOOR)).toFixed(0)}" rx="${(2 + random() * 6).toFixed(1)}" ry="${(1.5 + random() * 3).toFixed(1)}" fill="${specks[Math.floor(random() * specks.length)]}" opacity="0.3"/>`
    }

    // il banco è un arco morbido: bordo anteriore e posteriore sono curve di Bézier
    const front = { x0: -120, y0: 662, cx: 800, cy: 560, x2: VIEW_W + 120, y2: 662 }
    const top = 56         // profondità del piano
    const panel = 150      // altezza del frontale

    const point = (t: number, offset: number) => ({
      x: (1 - t) * (1 - t) * front.x0 + 2 * (1 - t) * t * front.cx + t * t * front.x2,
      y: (1 - t) * (1 - t) * front.y0 + 2 * (1 - t) * t * front.cy + t * t * front.y2 + offset
    })

    const edge = (offset: number) => `M${front.x0} ${front.y0 + offset} Q${front.cx} ${front.cy + offset} ${front.x2} ${front.y2 + offset}`

    // ombra sul pavimento
    s += `<path d="${edge(panel)} L${front.x2} ${front.y2 + panel + 40} Q${front.cx} ${front.cy + panel + 40} ${front.x0} ${front.y0 + panel + 40} Z" fill="#0d0907" opacity="0.7"/>`

    // frontale scanalato
    s += `<path d="${edge(0)} L${front.x2} ${front.y2 + panel} Q${front.cx} ${front.cy + panel} ${front.x0} ${front.y0 + panel} Z" fill="#8c7757"/>`

    for (let t = 0.004; t < 1; t += 0.0125) {
      const p = point(t, 0)
      s += `<line x1="${p.x.toFixed(1)}" y1="${p.y.toFixed(1)}" x2="${p.x.toFixed(1)}" y2="${(p.y + panel - 6).toFixed(1)}" stroke="#6a5740" stroke-width="2.2" opacity="0.7"/>`
      s += `<line x1="${(p.x + 4).toFixed(1)}" y1="${(p.y).toFixed(1)}" x2="${(p.x + 4).toFixed(1)}" y2="${(p.y + panel - 6).toFixed(1)}" stroke="#b09a78" stroke-width="1" opacity="0.4"/>`
    }

    // piano di pietra: in alto un filo più chiaro dove prende la luce delle lampade
    s += `<path d="${edge(-top)} L${front.x2} ${front.y2} Q${front.cx} ${front.cy} ${front.x0} ${front.y0} Z" fill="#a8946f"/>`
    s += `<path d="${edge(-top)}" fill="none" stroke="#d6c4a3" stroke-width="3" opacity="0.8"/>`
    s += `<path d="${edge(0)}" fill="none" stroke="#6a5740" stroke-width="3"/>`

    // riflessi delle lampade sul piano
    for (const x of [380, 800, 1220]) {
      const t = (x - front.x0) / (front.x2 - front.x0)
      const p = point(t, -top / 2)
      s += `<ellipse cx="${p.x.toFixed(0)}" cy="${p.y.toFixed(0)}" rx="90" ry="9" fill="#f0a04b" opacity="0.2"/>`
    }

    // i cocktail sul banco: bicchieri di forme diverse, appoggiati sul piano di pietra.
    // Sono scenografia: colori e forme non rappresentano le ricette.
    const drinks: { kind: string, t: number, color: string, size: number }[] = [
      { kind: 'cocktail', t: 0.2, color: '#c8222b', size: 1 },
      { kind: 'highball', t: 0.32, color: '#f0a04b', size: 1.05 },
      { kind: 'coupe', t: 0.46, color: '#ee7a8a', size: 1 },
      { kind: 'rocks', t: 0.6, color: '#d9922b', size: 1 },
      { kind: 'flute', t: 0.72, color: '#efe3a0', size: 1.05 },
      { kind: 'cocktail', t: 0.85, color: '#3aa0d8', size: 1 }
    ]

    for (const drink of drinks) {
      const base = point(drink.t, -top * 0.42)

      s += this.drinkGlass(drink.kind, base.x, base.y, drink.color, drink.size)
    }

    return s
  }

  // un bicchiere con il suo drink: contorno, liquido, superficie e una guarnizione
  private drinkGlass(kind: string, x: number, y: number, color: string, size: number): string {
    const f = (n: number) => n.toFixed(1)
    const edge = 'stroke="#ede6e3" stroke-opacity="0.6" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"'
    const body = 'fill="#ede6e3" fill-opacity="0.07"'
    const surface = (cx: number, cy: number, rx: number) => `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(rx * 0.2)}" fill="#ffffff" fill-opacity="0.38"/>`

    let g = `<g transform="translate(${f(x)} ${f(y)}) scale(${size})">`

    // ombra sul piano
    g += `<ellipse cx="0" cy="3" rx="26" ry="5" fill="#000000" opacity="0.3"/>`

    if (kind === 'cocktail') {
      g += `<path d="M-28 -84 L28 -84 L0 -40 Z" ${body}/>`
      g += `<path d="M-24 -78 L24 -78 L0 -44 Z" fill="${color}" opacity="0.92"/>` + surface(0, -78, 24)
      g += `<path d="M-28 -84 L28 -84 L0 -40 Z M0 -40 V-4" fill="none" ${edge}/>`
      g += `<ellipse cx="0" cy="-84" rx="28" ry="5.5" fill="none" ${edge}/><ellipse cx="0" cy="-3" rx="17" ry="4" fill="none" ${edge}/>`
      g += `<circle cx="20" cy="-86" r="7" fill="#9ccc3b"/><circle cx="20" cy="-86" r="4.5" fill="#e5f0b8"/>`
    }
    else if (kind === 'coupe') {
      g += `<path d="M-30 -72 C-30 -46 -12 -40 0 -40 C12 -40 30 -46 30 -72 Z" ${body}/>`
      g += `<path d="M-26 -66 C-26 -48 -11 -44 0 -44 C11 -44 26 -48 26 -66 Z" fill="${color}" opacity="0.92"/>` + surface(0, -66, 26)
      g += `<path d="M-30 -72 C-30 -46 -12 -40 0 -40 C12 -40 30 -46 30 -72 M0 -40 V-4" fill="none" ${edge}/>`
      g += `<ellipse cx="0" cy="-72" rx="30" ry="5.5" fill="none" ${edge}/><ellipse cx="0" cy="-3" rx="17" ry="4" fill="none" ${edge}/>`
      g += `<circle cx="-4" cy="-70" r="6" fill="#b5122e"/><path d="M-4 -76 C0 -88 6 -92 12 -94" stroke="#5a3a14" stroke-width="1.4" fill="none"/>`
    }
    else if (kind === 'highball') {
      g += `<path d="M-17 -104 L17 -104 L14 0 L-14 0 Z" ${body}/>`
      g += `<path d="M-16 -88 L16 -88 L13.4 -2 L-13.4 -2 Z" fill="${color}" opacity="0.92"/>` + surface(0, -88, 16)
      g += `<rect x="-9" y="-72" width="11" height="11" rx="2.5" fill="#ffffff" fill-opacity="0.22" stroke="#ffffff" stroke-opacity="0.55"/>`
      g += `<rect x="1" y="-52" width="10" height="10" rx="2.5" fill="#ffffff" fill-opacity="0.22" stroke="#ffffff" stroke-opacity="0.55" transform="rotate(14 6 -47)"/>`
      g += `<path d="M-17 -104 L-14 0 L14 0 L17 -104" fill="none" ${edge}/><ellipse cx="0" cy="-104" rx="17" ry="3.4" fill="none" ${edge}/>`
      g += `<line x1="4" y1="-6" x2="16" y2="-122" stroke="#e8623f" stroke-width="3" stroke-linecap="round"/>`
    }
    else if (kind === 'rocks') {
      g += `<path d="M-26 -54 L26 -54 L23 0 L-23 0 Z" ${body}/>`
      g += `<path d="M-25 -40 L25 -40 L22.4 -2 L-22.4 -2 Z" fill="${color}" opacity="0.92"/>` + surface(0, -40, 25)
      g += `<rect x="-10" y="-44" width="20" height="20" rx="4" fill="#ffffff" fill-opacity="0.22" stroke="#ffffff" stroke-opacity="0.55"/>`
      g += `<path d="M-26 -54 L-23 0 L23 0 L26 -54" fill="none" ${edge}/><ellipse cx="0" cy="-54" rx="26" ry="5" fill="none" ${edge}/>`
      g += `<path d="M10 -58 a9 9 0 1 1 12 8" fill="none" stroke="#f5a623" stroke-width="2.4"/>`
    }
    else {
      g += `<path d="M-11 -100 L11 -100 L7 -42 L-7 -42 Z" ${body}/>`
      g += `<path d="M-10 -92 L10 -92 L6.4 -45 L-6.4 -45 Z" fill="${color}" opacity="0.92"/>` + surface(0, -92, 10)
      g += `<path d="M-11 -100 L-7 -42 L7 -42 L11 -100 M0 -42 V-4" fill="none" ${edge}/>`
      g += `<ellipse cx="0" cy="-100" rx="11" ry="2.4" fill="none" ${edge}/><ellipse cx="0" cy="-3" rx="15" ry="3.6" fill="none" ${edge}/>`
      g += `<circle cx="-3" cy="-76" r="1.3" fill="#ffffff" opacity="0.7"/><circle cx="3" cy="-62" r="1.1" fill="#ffffff" opacity="0.7"/>`
    }

    return g + '</g>'
  }

  // sgabelli in primo piano, in ombra
  private frontLayer(): string {
    let s = ''

    for (const x of [140, 430, 720, 1010, 1300, 1560]) {
      const y = 770

      // gambe e anello poggiapiedi
      s += `<line x1="${x - 34}" y1="${y}" x2="${x - 44}" y2="${VIEW_H + 40}" stroke="#2a2220" stroke-width="5" stroke-linecap="round"/>`
      s += `<line x1="${x + 34}" y1="${y}" x2="${x + 44}" y2="${VIEW_H + 40}" stroke="#2a2220" stroke-width="5" stroke-linecap="round"/>`
      s += `<ellipse cx="${x}" cy="${y + 66}" rx="40" ry="8" fill="none" stroke="#2a2220" stroke-width="4"/>`

      // seduta e schienale
      s += `<path d="M${x - 42} ${y - 70} Q${x} ${y - 96} ${x + 42} ${y - 70}" fill="none" stroke="#4a3d36" stroke-width="7" stroke-linecap="round"/>`
      s += `<ellipse cx="${x}" cy="${y}" rx="52" ry="13" fill="#4d4038"/>`
      s += `<ellipse cx="${x}" cy="${y - 3}" rx="52" ry="11" fill="#6a5a4e"/>`
    }

    return s
  }

  private bottleRow(random: () => number, from: number, to: number, baseY: number, minScale: number, maxScale: number): string {
    let svg = ''
    let x = from + random() * 8

    while (x < to - 20) {
      const shape = SHAPES[Math.floor(random() * SHAPES.length)]
      const scale = minScale + random() * (maxScale - minScale)
      const color = GLASS_COLORS[Math.floor(random() * GLASS_COLORS.length)]

      const y = baseY - shape.height * scale
      const bottleWidth = shape.width * scale

      if (x + bottleWidth > to) {
        break
      }

      svg += `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${scale.toFixed(3)})">`
      svg += `<path d="${shape.path}" fill="${color}"/>`
      svg += `<rect x="${(shape.width - shape.neck) / 2 - 8}" y="${shape.height * 0.52}" width="${shape.neck + 16}" height="${shape.height * 0.22}" fill="#ede6e3" opacity="0.05"/>`
      svg += `<rect x="${(shape.width - shape.neck) / 2 - 0.5}" y="-6" width="${shape.neck + 1}" height="7" fill="#3a3023"/>`
      svg += `<path d="M${shape.width - 3} ${shape.height * 0.3} V${shape.height - 6}" stroke="#f0a04b" stroke-width="1.6" opacity="0.4" fill="none"/>`
      svg += `<path d="M5 ${shape.height * 0.34} V${shape.height - 10}" stroke="#ffffff" stroke-width="2" opacity="0.08" fill="none"/>`
      svg += '</g>'

      x += bottleWidth + 1.5 + random() * 5
    }

    return svg
  }

  // generatore pseudo-casuale con seme (mulberry32)
  private random(seed: number): () => number {
    let state = seed >>> 0

    return () => {
      state = (state + 0x6D2B79F5) >>> 0

      let t = state
      t = Math.imul(t ^ (t >>> 15), t | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)

      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }

}
