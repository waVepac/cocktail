/*
 * Dalle misure dell'API alla grafica: nient'altro che aritmetica sui dati ricevuti.
 * Non si aggiunge nulla che l'API non dia (niente colori, gradazioni o capienze inventati).
 */

// millilitri per unità: solo unità di volume vere, con il loro valore standard
const ML_PER_UNIT: { pattern: RegExp, ml: number }[] = [
  { pattern: /^(fl\.?\s*)?oz\b|^ounces?\b/, ml: 29.5735 },
  { pattern: /^cl\b/, ml: 10 },
  { pattern: /^ml\b/, ml: 1 },
  { pattern: /^dl\b/, ml: 100 },
  { pattern: /^(l|liters?|litres?)\b/, ml: 1000 },
  { pattern: /^(tsp|tspn|teaspoons?)\b/, ml: 4.92892 },
  { pattern: /^(tblsp|tbsp|tbl|tablespoons?)\b/, ml: 14.7868 },
  { pattern: /^cups?\b/, ml: 236.588 },
  { pattern: /^pints?\b/, ml: 473.176 },
  { pattern: /^(qt|quarts?)\b/, ml: 946.353 },
  { pattern: /^(gal|gallons?)\b/, ml: 3785.41 }
]

function parseNumber(text: string): number | null {
  const parts = text.trim().split(/\s+/)
  let total = 0

  for (const part of parts) {
    if (/^\d+\/\d+$/.test(part)) {
      const [num, den] = part.split('/').map(Number)
      if (!den) return null
      total += num / den
    }
    else if (/^\d*\.?\d+$/.test(part)) {
      total += Number(part)
    }
    else {
      return null
    }
  }

  return parts.length ? total : null
}

/*
 * Volume in ml di una misura, solo se la misura è un volume esplicito ("1 1/2 oz", "30 ml", "1 tsp").
 * Un intervallo ("2-3 oz") vale il suo punto medio. "dash", "part", "juice of", "top" ecc. non sono
 * un volume preciso: null.
 */
export function volumeMl(measure: string | null | undefined): number | null {
  const text = (measure ?? '').toLowerCase().trim()

  const number = '(\\d+\\s+\\d+\\/\\d+|\\d+\\/\\d+|\\d*\\.\\d+|\\d+)'
  const match = text.match(new RegExp(`^${number}\\s*(?:-\\s*${number})?\\s*(.*)$`))

  if (!match) {
    return null
  }

  const from = parseNumber(match[1])
  const to = match[2] ? parseNumber(match[2]) : null

  if (from === null || from <= 0 || (match[2] && (to === null || to <= 0))) {
    return null
  }

  const amount = to === null ? from : (from + to) / 2

  for (const candidate of ML_PER_UNIT) {
    if (candidate.pattern.test(match[3].trim())) {
      return amount * candidate.ml
    }
  }

  return null
}


/*
 * "2 parts", "1 shot", "2 shots": unità relative. Danno proporzioni esatte tra gli ingredienti
 * (uno shot è lo stesso in tutta la ricetta) ma nessun volume assoluto, che l'API non indica.
 * Si usano solo quando TUTTI gli ingredienti con una quantità sono espressi così.
 */
export function partsCount(measure: string | null | undefined): number | null {
  const match = (measure ?? '').toLowerCase().trim().match(/^(\d+\s+\d+\/\d+|\d+\/\d+|\d*\.\d+|\d+)\s*(parts?|shots?|jiggers?)\b/)

  return match ? parseNumber(match[1]) : null
}

/*
 * Quantità liquida senza un volume preciso ("1 splash", "2 dashes", "Juice of 1/2", "Top", "1 shot"):
 * l'ingrediente è un liquido, ma l'API non dice quanto. Non è una stima nostra: il bicchiere lo mostra
 * come un sottile strato-segnaposto, non come una quantità.
 */
export function isLiquidAmount(measure: string | null | undefined): boolean {
  const text = (measure ?? '').toLowerCase().trim().replace(/^[\d\s\/.\-]+/, '')

  return /^(dash(es)?|splash(es)?|drops?|top( up)?|fill( with)?|shots?|jiggers?|parts?|float|squeeze|glug|slug|juice of|(small |large )?bottles?|fifth|full glass)\b/.test(text)
}


/* ---------- bicchiere ---------- */

export type GlassFamily = 'highball' | 'rocks' | 'shot' | 'cocktail' | 'coupe' | 'flute' | 'wine' | 'mug'

// da strGlass dell'API alla forma da disegnare
export function glassFamily(name: string | null | undefined): GlassFamily {
  const text = (name ?? '').toLowerCase()

  if (/shot|cordial|pousse|pony/.test(text)) return 'shot'
  if (/flute|champagne flute/.test(text)) return 'flute'
  if (/coupe|saucer|margarita|coupette|champagne/.test(text)) return 'coupe'
  if (/cocktail|martini/.test(text)) return 'cocktail'
  if (/wine|brandy|snifter|balloon|goblet|sherry|hurricane/.test(text)) return 'wine'
  if (/old.?fashioned|whisk|rocks|lowball|tumbler/.test(text)) return 'rocks'
  if (/mug|stein|coffee|irish|toddy|copper|cup|punch|bowl|jar|pitcher/.test(text)) return 'mug'

  return 'highball'
}


/* ---------- colori ---------- */

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace('#', '')

  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16)
  ]
}

function rgbToHex(rgb: number[]): string {
  return '#' + rgb.map(channel => Math.round(Math.max(0, Math.min(255, channel))).toString(16).padStart(2, '0')).join('')
}

export function mixColors(a: string, b: string, amount: number): string {
  const first = hexToRgb(a)
  const second = hexToRgb(b)

  return rgbToHex(first.map((channel, index) => channel + (second[index] - channel) * amount))
}

/*
 * Tinta di uno strato. I colori reali dei liquidi non sono nell'API, quindi gli strati
 * hanno una scala di ambra neutra (dal più scuro al più chiaro): distingue gli strati, non dice cosa c'è dentro.
 */
export function layerColor(index: number, count: number): string {
  const step = count > 1 ? index / (count - 1) : 0.5

  return mixColors('#c8662a', '#f7dcae', step)
}


export function ingredientImage(name: string, size: 'Small' | 'Medium'): string {
  return `https://www.thecocktaildb.com/images/ingredients/${encodeURIComponent(name.trim())}-${size}.png`
}
