import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { DashboardService } from '../dashboard/dashboard.module.js'
import type { Plan } from '../irrigation/irrigation.engine.js'
import type { DiseaseInfo } from '../plant/diseases.data.js'
import type { Estimate, SpeciesRef } from '../terrain/estimation.js'
import { mockAssistant } from './assistant.mock.js'
import { GeminiClient, type GeminiPart } from './gemini.client.js'
import { mockPlantAdvice, mockPlantAnswer } from './plant-advice.mock.js'
import { mockTerrainAdvice, type AiAdvice } from './terrain-advice.mock.js'

type Lang = 'fr' | 'en' | 'ar'
const LANG_NAME: Record<Lang, string> = { fr: 'français', en: 'anglais', ar: 'arabe' }
const STR = { type: 'STRING' }
const STR_LIST = { type: 'ARRAY', items: { type: 'STRING' } }

/** Vérification d'un terrain sur l'image satellite */
export interface SiteCheck {
  landUse: string
  builtShare: number
  existingTreesShare: number
  context: string
  verdict: 'adapte' | 'a-verifier' | 'inadapte'
  issues: string[]
  summary: string
  confidence: number
  model: string
}

/** Résultat du diagnostic d'une feuille par Gemini Vision */
export interface PlantVision {
  isPlant: boolean
  crop: string
  healthy: boolean
  diseaseKey: string
  diseaseName: string
  agent: string
  symptomsSeen: string
  confidence: number
  affectedRatio: number
  contagious: boolean
  treatment: string
  organic: string
  prevention: string
  alternatives: { name: string; confidence: number }[]
}

/**
 * Point d'entrée UNIQUE vers le LLM pour tous les modules.
 * - Avec LLM_API_KEY (Gemini) : vraies réponses, à partir des chiffres calculés par nos moteurs.
 * - Sans clé, sans connexion ou en cas d'erreur : réponses simulées (la démo marche toujours).
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name)

  constructor(private readonly config: ConfigService) {}

  get hasApiKey(): boolean {
    return Boolean(this.config.get<string>('LLM_API_KEY'))
  }

  /** Client Gemini si une clé est configurée (LLM_PROVIDER=gemini), sinon null */
  private get gemini(): GeminiClient | null {
    const key = this.config.get<string>('LLM_API_KEY')
    if (!key || this.config.get<string>('LLM_PROVIDER', 'gemini') !== 'gemini') return null
    return new GeminiClient(key, this.config.get<string>('LLM_MODEL') || 'gemini-3.5-flash-lite')
  }

  /** Modèle principal + secours, sans doublon */
  private textClients(): GeminiClient[] {
    const key = this.config.get<string>('LLM_API_KEY')
    if (!key || this.config.get<string>('LLM_PROVIDER', 'gemini') !== 'gemini') return []
    const models = [this.config.get<string>('LLM_MODEL') || 'gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-2.5-flash']
    return [...new Set(models)].map((m) => new GeminiClient(key, m))
  }

  /**
   * Vérifie le terrain sur l'image satellite : occupation du sol, bâtiments, arbres existants.
   * Renvoie null si l'IA n'est pas disponible.
   */
  async siteCheck(image: Buffer, pixels: [number, number][]): Promise<SiteCheck | null> {
    const prompt =
      'Image satellite vue du ciel (768 × 768 pixels, nord en haut). Un utilisateur veut PLANTER sur le terrain délimité par le polygone ' +
      `dont les sommets sont, en pixels (x, y) : ${pixels.map(([x, y]) => `(${x}, ${y})`).join(', ')}. Le terrain occupe le centre de l'image.` + '\n' +
      'Analyse UNIQUEMENT ce qui est visible à l’intérieur du polygone, de façon factuelle et prudente :' + '\n' +
      '- landUse : occupation principale du sol (urbain, terrain-nu, terre-agricole, verger-existant, foret, eau, route-parking, mixte).' + '\n' +
      '- builtShare : part du polygone couverte par des bâtiments, routes ou parkings (0 à 1). existingTreesShare : part couverte par des arbres (0 à 1).' + '\n' +
      '- context : l’environnement autour (ville dense, périphérie, campagne agricole, désert…).' + '\n' +
      '- verdict : "adapte" si c’est une terre cultivable, "a-verifier" si c’est possible mais avec des réserves (terrain vague en ville, sol caillouteux, arbres déjà présents…), ' +
      '"inadapte" si on ne peut pas planter (bâtiments, routes, eau).' + '\n' +
      '- issues : 0 à 4 problèmes concrets en français simple (ex. « Terrain situé en pleine zone urbaine : vérifier le statut foncier et la qualité du sol »). ' +
      'summary : 1 à 2 phrases en français simple. confidence : ta certitude (0 à 1).'
    const schema = {
      type: 'OBJECT',
      properties: {
        landUse: { type: 'STRING', enum: ['urbain', 'terrain-nu', 'terre-agricole', 'verger-existant', 'foret', 'eau', 'route-parking', 'mixte'] },
        builtShare: { type: 'NUMBER' },
        existingTreesShare: { type: 'NUMBER' },
        context: STR,
        verdict: { type: 'STRING', enum: ['adapte', 'a-verifier', 'inadapte'] },
        issues: STR_LIST,
        summary: STR,
        confidence: { type: 'NUMBER' },
      },
      required: ['landUse', 'builtShare', 'existingTreesShare', 'context', 'verdict', 'issues', 'summary', 'confidence'],
    }
    const parts: GeminiPart[] = [{ inline_data: { mime_type: 'image/jpeg', data: image.toString('base64') } }, { text: prompt }]
    const clients = [this.visionGemini, ...this.textClients()].filter((c): c is GeminiClient => c !== null)
    for (const [i, c] of clients.entries()) {
      try {
        const r = await c.json<Omit<SiteCheck, 'model'>>(parts, schema, 20_000, 'minimal')
        const clamp = (n: number) => Math.max(0, Math.min(1, Number(n) || 0))
        return { ...r, builtShare: clamp(r.builtShare), existingTreesShare: clamp(r.existingTreesShare), confidence: clamp(r.confidence), issues: r.issues.slice(0, 4), model: c.modelName }
      } catch (e) {
        this.logger.warn(`Vérification du terrain (${c.modelName}) : ${(e as Error).message}`)
      }
    }
    return null
  }

  /** Modèle plus puissant pour le diagnostic visuel des plantes (précision avant vitesse) */
  private get visionGemini(): GeminiClient | null {
    const key = this.config.get<string>('LLM_API_KEY')
    if (!key || this.config.get<string>('LLM_PROVIDER', 'gemini') !== 'gemini') return null
    return new GeminiClient(key, this.config.get<string>('LLM_VISION_MODEL') || 'gemini-3.8-flash')
  }

  /**
   * Appelle le LLM avec une consigne + des données, attend un JSON conforme au schéma.
   * Sans clé ou en cas d'échec : renvoie `fallback()` (réponse simulée).
   */
  private async ask<T extends object>(prompt: string, schema: Record<string, unknown>, fallback: () => T, parts: GeminiPart[] = []): Promise<T & { source: 'llm' | 'mock' }> {
    // Modèle principal puis modèles de secours (un modèle peut être saturé : « high demand »)
    for (const client of this.textClients()) {
      try {
        const r = await client.json<T>([...parts, { text: prompt }], schema)
        return { ...r, source: 'llm' }
      } catch (e) {
        this.logger.warn(`LLM (${client.modelName}) indisponible : ${(e as Error).message}`)
      }
    }
    return { ...fallback(), source: 'mock' }
  }

  private static readonly RULES =
    "Tu es l'assistant d'EcoNexus (eau, énergie, agriculture). Tu écris en langage simple, pour un agriculteur ou un particulier. " +
    "Tu n'inventes JAMAIS de chiffre : tu utilises uniquement ceux fournis dans les données. Phrases courtes, ton concret et bienveillant."

  // ─────────────────────────── TerraCalc ───────────────────────────

  /** Explique une estimation TerraCalc et donne des conseils (les chiffres viennent du moteur). */
  async terrainAdvice(estimate: Estimate, species: SpeciesRef): Promise<AiAdvice> {
    const { trees, ...rest } = estimate
    const data = { ...rest, trees: trees ? { count: trees.count, densityPerHa: trees.densityPerHa } : null, espece: species.name }
    const mock = mockTerrainAdvice(estimate, species)
    const r = await this.ask<{ summary: string; tips: string[] }>(
      `${AiService.RULES}\nVoici l'estimation d'un terrain (JSON). Écris en français un résumé (3 à 4 phrases) puis 3 à 5 conseils pratiques ` +
        `(irrigation, entretien, rentabilité, adaptation au climat).\nDonnées : ${JSON.stringify(data)}`,
      { type: 'OBJECT', properties: { summary: STR, tips: STR_LIST }, required: ['summary', 'tips'] },
      () => ({ summary: mock.summary, tips: mock.tips }),
    )
    // La confiance reste calculée par nos règles (données disponibles), pas par le LLM
    return { summary: r.summary, tips: r.tips.slice(0, 5), confidence: mock.confidence, source: r.source }
  }

  // ─────────────────────────── PlantDoc ───────────────────────────

  /**
   * Diagnostic d'une photo de feuille par Gemini Vision (phytopathologiste).
   * Renvoie null si l'IA n'est pas configurée ou ne répond pas : le modèle local prend alors le relais.
   */
  async diagnoseLeaf(image: Buffer, mimeType: string, cropHint: string | null, catalog: DiseaseInfo[]): Promise<PlantVision | null> {
    const client = this.visionGemini
    if (!client) return null
    const keys = [...catalog.map((d) => d.key), 'autre']
    try {
      const call = (c: GeminiClient, ms: number, level: 'minimal' | 'low') =>
        c.json<PlantVision>(
        [
          { inline_data: { mime_type: mimeType, data: image.toString('base64') } },
          {
            text:
              'Tu es phytopathologiste expert. Pose un diagnostic PRÉCIS et HONNÊTE de cette photo.\n' +
              'RÈGLES IMPORTANTES :\n' +
              '- Par défaut la plante est SAINE. Ne conclus à une maladie que si tu vois un symptôme NET et caractéristique sur la photo.\n' +
              '- Ne décris QUE ce qui est réellement visible : n’invente jamais un symptôme que la photo ne montre pas (ex. face inférieure non visible).\n' +
              '- Ne sont PAS des symptômes : les poils (trichomes) des feuilles de tomate, les reflets de lumière, la poussière, les nervures claires, ' +
              'l’ombre, le flou, un vert légèrement plus clair des jeunes feuilles, de petits points brillants.\n' +
              '- Si les signes sont faibles ou ambigus : healthy = true (ou confidence basse), et dis-le dans symptomsSeen.\n' +
              'ÉTAPES :\n' +
              '1. isPlant = false si la photo ne montre pas une plante (remplis alors le reste avec des valeurs vides).\n' +
              `2. crop = nom français de la plante (Tomate, Olivier, Vigne, Blé…)${cropHint ? ` ; l'utilisateur indique « ${cropHint} », vérifie-le` : ''}.\n` +
              '3. symptomsSeen = description factuelle de ce que tu vois (couleur, forme, répartition des taches, jaunissement, nécroses, moisissure, insectes), ' +
              'ou « Feuillage vert et homogène, aucun symptôme visible » si la plante est saine.\n' +
              '4. diseaseKey = la clé du catalogue si la plante ET la maladie correspondent exactement (plante saine du catalogue : clé « <culture>-sain »), sinon "autre". ' +
              'Plante saine : healthy = true, diseaseName = "Plante saine", agent = "aucun", affectedRatio = 0. Carence ou ravageur : décris-le comme la maladie.\n' +
              '5. confidence = ta certitude réelle (0 à 1) ; affectedRatio = part de la surface visible atteinte (0 à 1).\n' +
              '6. alternatives = 2 autres hypothèses plausibles (dont « Plante saine » si c’est possible) avec leur probabilité.\n' +
              '7. treatment, organic, prevention : conseils concrets en français simple (produits génériques, jamais de dose inventée, respecter l’étiquette). ' +
              'Pour une plante saine : conseils de prévention.\n' +
              `Catalogue de clés : ${keys.join(', ')}.`,
          },
        ],
        {
          type: 'OBJECT',
          properties: {
            isPlant: { type: 'BOOLEAN' },
            crop: STR,
            healthy: { type: 'BOOLEAN' },
            diseaseKey: { type: 'STRING', enum: keys },
            diseaseName: STR,
            agent: { type: 'STRING', enum: ['champignon', 'bactérie', 'virus', 'ravageur', 'carence', 'aucun'] },
            symptomsSeen: STR,
            confidence: { type: 'NUMBER' },
            affectedRatio: { type: 'NUMBER' },
            contagious: { type: 'BOOLEAN' },
            treatment: STR,
            organic: STR,
            prevention: STR,
            alternatives: { type: 'ARRAY', items: { type: 'OBJECT', properties: { name: STR, confidence: { type: 'NUMBER' } }, required: ['name', 'confidence'] } },
          },
          required: ['isPlant', 'crop', 'healthy', 'diseaseKey', 'diseaseName', 'agent', 'symptomsSeen', 'confidence', 'affectedRatio', 'contagious', 'treatment', 'organic', 'prevention', 'alternatives'],
        },
        ms,
        level,
      )
      let r: PlantVision
      try {
        r = await call(client, 30_000, 'low')
      } catch (e) {
        // Modèle puissant trop lent ou indisponible : même consigne sur le modèle rapide
        this.logger.warn(`Diagnostic (modèle vision) : ${(e as Error).message}, repli sur le modèle rapide.`)
        const fast = this.gemini
        if (!fast) throw e
        r = await call(fast, 20_000, 'minimal')
      }
      const clamp = (n: number) => Math.max(0, Math.min(1, Number(n) || 0))
      return { ...r, confidence: clamp(r.confidence), affectedRatio: clamp(r.affectedRatio), alternatives: (r.alternatives ?? []).slice(0, 3).map((a) => ({ ...a, confidence: clamp(a.confidence) })) }
    } catch (e) {
      this.logger.warn(`Diagnostic par IA impossible : ${(e as Error).message}`)
      return null
    }
  }

  /** Conseil de traitement en langage simple (la maladie vient du modèle de vision) */
  async plantAdvice(disease: DiseaseInfo, severity: string, parcel: string, seen?: string) {
    return this.ask<{ advice: string; tips: string[] }>(
      `${AiService.RULES}\nDiagnostic d'une feuille (${parcel}) : ${disease.name} (gravité : ${severity}). ` +
        (seen ? `Symptômes observés sur la photo : ${seen}. ` : '') +
        `Fiche de référence : ${JSON.stringify(disease)}. Écris en français : advice = 2 à 3 phrases précises (quoi faire, avec quelle urgence, en citant les symptômes observés), ` +
        'tips = 3 à 4 conseils (traitement bio, prévention, contagion, sécurité des produits). Si la plante est saine, rassure et donne des conseils de prévention.',
      { type: 'OBJECT', properties: { advice: STR, tips: STR_LIST }, required: ['advice', 'tips'] },
      () => mockPlantAdvice(disease, severity, parcel),
    )
  }

  /** Réponse à une question posée sur un diagnostic (écrite ou dictée) */
  async plantAnswer(disease: DiseaseInfo, question: string) {
    return this.ask<{ answer: string }>(
      `${AiService.RULES}\nUn agriculteur pose une question sur ce diagnostic : ${JSON.stringify(disease)}.\n` +
        `Question : « ${question} »\nRéponds dans la langue de la question, en 2 à 4 phrases.`,
      { type: 'OBJECT', properties: { answer: STR }, required: ['answer'] },
      () => ({ answer: mockPlantAnswer(disease, question) }),
    )
  }

  // ─────────────────────────── IrriPlan ───────────────────────────

  /** Explique le plan d'irrigation (volumes et dates calculés par le moteur FAO-56) */
  async irrigationAdvice(plan: Plan, ctx: { species: string; areaHa: number; trees: number | null; irrigation: string; age: number | null }) {
    const irrigationDays = plan.days.filter((d) => d.irrigate)
    const fallback = () => ({
      summary:
        `Pour vos ${ctx.trees ? `${ctx.trees} ${ctx.species.toLowerCase()}s` : `${ctx.areaHa.toFixed(2)} ha de ${ctx.species.toLowerCase()}`}, ` +
        `il faut irriguer ${plan.totals.irrigationDays} jour(s) cette semaine, pour ${plan.totals.volumeM3} m³ au total. ` +
        (irrigationDays.length ? `Premier arrosage le ${irrigationDays[0].date}. ` : 'Le sol a assez d’eau : aucun arrosage nécessaire. ') +
        (plan.comparison.savedM3 > 0 ? `Vous économisez ${plan.comparison.savedM3} m³ par rapport à un arrosage d’habitude.` : ''),
      tips: [
        'Arrosez tôt le matin : moins d’évaporation et moins de maladies.',
        'Paillez le pied des arbres pour garder l’humidité du sol.',
        ...(plan.totals.rainMm > 5 ? ['Pluie prévue : le plan a déjà réduit les arrosages, inutile d’en ajouter.'] : []),
        'Vérifiez régulièrement que les goutteurs ne sont pas bouchés.',
      ].slice(0, 4),
    })
    return this.ask<{ summary: string; tips: string[] }>(
      `${AiService.RULES}
Voici le plan d'irrigation de la semaine, calculé par la méthode FAO-56 avec la météo réelle (JSON). ` +
        `Culture : ${ctx.species}${ctx.age !== null ? `, arbres de ${ctx.age} ans` : ''}, ${ctx.areaHa.toFixed(2)} ha${ctx.trees ? `, ${ctx.trees} arbres` : ''}, irrigation ${ctx.irrigation}. ` +
        'Écris en français : summary = 3 à 4 phrases (quels jours arroser, combien, pourquoi, économie réalisée), ' +
        `tips = 3 à 4 conseils pratiques adaptés à la météo de la semaine (chaleur, pluie, gel, vent).
Plan : ${JSON.stringify(plan)}`,
      { type: 'OBJECT', properties: { summary: STR, tips: STR_LIST }, required: ['summary', 'tips'] },
      fallback,
    )
  }

  /** Réponse à une question sur un plan d'irrigation */
  async irrigationAnswer(plan: unknown, question: string) {
    return this.ask<{ answer: string }>(
      `${AiService.RULES}
Un agriculteur pose une question sur son plan d'irrigation (JSON) : ${JSON.stringify(plan)}
` +
        `Question : « ${question} »
Réponds dans la langue de la question, en 2 à 4 phrases, avec les chiffres du plan.`,
      { type: 'OBJECT', properties: { answer: STR }, required: ['answer'] },
      () => ({ answer: 'Suivez le plan : il tient compte de la pluie et de la chaleur prévues. Arrosez tôt le matin et vérifiez l’humidité du sol au pied des arbres avant chaque arrosage.' }),
    )
  }

  // ─────────────────────────── Assistant ───────────────────────────

  /** Assistant flottant : répond à partir des données réelles de l'application */
  async assistantReply(
    question: string,
    lang: Lang,
    context: Awaited<ReturnType<DashboardService['summary']>>,
    page?: string,
    history: { role: 'user' | 'assistant'; content: string }[] = [],
    details: unknown = null,
  ) {
    const mock = mockAssistant(question, lang, context)
    const PAGES = ['/app', '/app/plantdoc', '/app/terracalc', '/app/irriplan', '/app/aquascan'] as const
    const PAGE_LABEL: Record<(typeof PAGES)[number], string> = { '/app': 'Vue d’ensemble', '/app/plantdoc': 'PlantDoc', '/app/terracalc': 'TerraCalc', '/app/irriplan': 'IrriPlan', '/app/aquascan': 'AquaScan' }
    const conversation = history
      .slice(0, -1)
      .map((m) => `${m.role === 'user' ? 'Utilisateur' : 'Assistant'} : ${m.content}`)
      .join('\n')
    const r = await this.ask<{ reply: string; pages: string[]; suggestions: string[] }>(
      "Tu es l'assistant d'EcoNexus, expert en agriculture, irrigation et économies d'eau, pour un agriculteur ou un particulier." + '\n' +
        `Réponds en ${LANG_NAME[lang]}, en 2 à 6 phrases claires, sans markdown. ` +
        'Utilise EN PRIORITÉ les données ci-dessous et cite leurs chiffres exacts (dates, m³, L/jour, noms de parcelles). ' +
        'Tu peux ajouter des connaissances agronomiques générales fiables, mais n’invente JAMAIS un chiffre propre à l’utilisateur : si une donnée manque, dis-le et indique quel module utiliser. ' +
        'Tiens compte de la météo pour les conseils (pluie, chaleur, vent). Si la question est hors sujet, réponds brièvement puis ramène vers l’eau et l’agriculture.' + '\n' +
        `Modules : PlantDoc (maladies des feuilles par photo), TerraCalc (terrains et estimation), IrriPlan (planning d'irrigation 7 jours, recalculé avec la météo du jour à l'ouverture d'un nouveau jour ou avec le bouton « Mettre à jour la météo » ; l'utilisateur coche les arrosages faits), AquaScan (compteur d'eau, fuites). L'utilisateur est sur la page « ${page ?? '/app'} ».` + '\n' +
        `pages = 0 à 2 pages utiles parmi ${PAGES.join(', ')}. suggestions = 3 questions de suivi courtes et utiles, en ${LANG_NAME[lang]}.` + '\n' +
        `Synthèse (JSON) : ${JSON.stringify({ ecoScore: context.ecoScore, parts: context.parts, alerts: context.alerts.slice(0, 8), goals: context.goals, modules: context.modules })}` + '\n' +
        `Détails (JSON) : ${JSON.stringify(details)}` + '\n' +
        (conversation ? `Conversation précédente :\n${conversation}\n` : '') +
        `Question : « ${question} »`,
      {
        type: 'OBJECT',
        properties: { reply: STR, pages: { type: 'ARRAY', items: { type: 'STRING', enum: [...PAGES] } }, suggestions: STR_LIST },
        required: ['reply', 'pages', 'suggestions'],
      },
      () => ({ reply: mock.reply, pages: mock.links.map((l) => l.to), suggestions: mock.suggestions }),
    )
    const links = (r.pages ?? []).filter((p): p is (typeof PAGES)[number] => (PAGES as readonly string[]).includes(p)).slice(0, 2).map((to) => ({ label: PAGE_LABEL[to], to }))
    return { reply: r.reply, links: r.source === 'llm' ? links : mock.links, suggestions: (r.suggestions?.length ? r.suggestions : mock.suggestions).slice(0, 4), source: r.source }
  }


  // ─────────────────────────── AquaScan ───────────────────────────

  /**
   * Lecture d'un compteur d'eau sur une photo (modèle de vision).
   * Le modèle recopie les chiffres ; c'est NOTRE code qui calcule l'index en m³.
   * Sans clé ou en cas d'échec : erreur 503, le frontend bascule sur l'OCR local (Tesseract).
   */
  async readMeter(image: Buffer, mimeType: string) {
    const client = this.gemini
    if (!client) throw new ServiceUnavailableException('Lecture par IA non configurée : utilisez la lecture locale.')
    try {
      const r = await client.json<{ found: boolean; blackDigits: string; redDigits: string; confidence: number }>(
        [
          { inline_data: { mime_type: mimeType, data: image.toString('base64') } },
          {
            text:
              "Photo d'un compteur d'eau. Recopie exactement les chiffres affichés sur les ROULEAUX de l'index " +
              '(la rangée de chiffres dans la petite fenêtre du compteur) : blackDigits = les rouleaux à fond noir ' +
              '(mètres cubes), redDigits = les rouleaux à fond rouge (litres), y compris les zéros au début. ' +
              "Ignore tout autre nombre : numéro de série, marquages imprimés, cadran à aiguille, texte d'écran ou d'étiquette. " +
              "N'invente rien : si les rouleaux ne sont pas lisibles, found = false. confidence = ta certitude entre 0 et 1.",
          },
        ],
        {
          type: 'OBJECT',
          properties: { found: { type: 'BOOLEAN' }, blackDigits: STR, redDigits: STR, confidence: { type: 'NUMBER' } },
          required: ['found', 'blackDigits', 'redDigits', 'confidence'],
        },
      )
      const black = r.blackDigits.replace(/\D/g, '')
      const red = r.redDigits.replace(/\D/g, '')
      if (!r.found || !black) return { value: null, digits: '', confidence: 0, source: 'ia' as const }
      const value = Number(black) + (red ? Number(red) / 10 ** red.length : 0)
      return { value: Math.round(value * 1000) / 1000, digits: black + red, confidence: Math.max(0, Math.min(1, r.confidence)), source: 'ia' as const }
    } catch (e) {
      this.logger.warn(`Lecture du compteur par IA impossible : ${(e as Error).message}`)
      throw new ServiceUnavailableException('Le service de lecture par IA ne répond pas : utilisez la lecture locale.')
    }
  }
}
