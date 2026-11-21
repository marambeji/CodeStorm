import type { DashboardService } from '../dashboard/dashboard.module.js'

type Summary = Awaited<ReturnType<DashboardService['summary']>>
type Lang = 'fr' | 'en' | 'ar'
export interface AssistantReply {
  reply: string
  links: { label: string; to: string }[]
  suggestions: string[]
  source: 'mock' | 'llm'
}

const nf = (n: number, lang: Lang) => new Intl.NumberFormat(lang === 'ar' ? 'ar' : lang, { maximumFractionDigits: 0 }).format(n)

/**
 * Assistant simulé : reconnaît le sujet de la question (mots-clés FR / EN / AR)
 * et répond avec les VRAIS chiffres de l'application (tableau de bord).
 */
export function mockAssistant(question: string, lang: Lang, s: Summary): AssistantReply {
  const q = question.toLowerCase()
  const has = (...words: string[]) => words.some((w) => q.includes(w))
  const T = (fr: string, en: string, ar: string) => (lang === 'en' ? en : lang === 'ar' ? ar : fr)
  const suggestions = [
    T('Ai-je une fuite d’eau ?', 'Do I have a water leak?', 'هل يوجد تسرب للمياه؟'),
    T('Quand dois-je arroser ?', 'When should I water?', 'متى يجب أن أسقي؟'),
    T('Quelles cultures sont malades ?', 'Which crops are sick?', 'ما هي المحاصيل المريضة؟'),
    T('Explique mon éco-score', 'Explain my eco-score', 'اشرح مؤشري البيئي'),
  ]
  const m = s.modules

  if (has('fuite', 'leak', 'compteur', 'meter', 'تسرب', 'عداد', 'aquascan')) {
    return {
      reply: m.aquascan.leaks
        ? T(
            `Oui : ${m.aquascan.leaks} compteur signale une fuite possible. La consommation de la dernière période est bien au-dessus de l’habitude. Fermez tous les robinets et vérifiez si le compteur tourne encore pendant 30 minutes.`,
            `Yes: ${m.aquascan.leaks} meter shows a possible leak. Last period's consumption is well above usual. Close every tap and check whether the meter still moves for 30 minutes.`,
            `نعم: ${nf(m.aquascan.leaks, lang)} عداد يشير إلى تسرب محتمل. استهلاك الفترة الأخيرة أعلى بكثير من المعتاد. أغلق كل الصنابير وتحقق إن كان العداد يدور خلال 30 دقيقة.`,
          )
        : T('Aucune fuite détectée : vos compteurs ont une consommation normale.', 'No leak detected: your meters show normal consumption.', 'لم يتم اكتشاف أي تسرب: استهلاك عداداتك طبيعي.'),
      links: [{ label: 'AquaScan', to: '/app/aquascan' }],
      suggestions,
      source: 'mock',
    }
  }
  if (has('arros', 'irrig', 'eau pour', 'water my', 'irrigat', 'ري', 'سقي', 'irriplan', 'pomp', 'pump')) {
    const ir = m.irriplan
    return {
      reply: ir.plans
        ? T(
            `Vos plans d’irrigation prévoient ${ir.weekM3} m³ d’eau cette semaine, en tenant compte de la pluie et de la chaleur prévues.${ir.next ? ` Prochain arrosage : ${ir.next.plan}, le ${ir.next.date} (${ir.next.volumeM3} m³).` : ''} Vous économisez ${ir.savedM3} m³ par rapport à un arrosage d’habitude.`,
            `Your irrigation plans need ${ir.weekM3} m³ of water this week, accounting for forecast rain and heat.${ir.next ? ` Next watering: ${ir.next.plan}, on ${ir.next.date} (${ir.next.volumeM3} m³).` : ''} You save ${ir.savedM3} m³ compared with usual watering.`,
            `تحتاج خطط الري لديك إلى ${nf(ir.weekM3, lang)} م³ من الماء هذا الأسبوع، مع مراعاة الأمطار والحرارة المتوقعة. توفّر ${nf(ir.savedM3, lang)} م³ مقارنة بالري المعتاد.`,
          )
        : T('Vous n’avez pas encore de plan d’irrigation : créez-en un dans IrriPlan à partir de votre terrain.', 'You have no irrigation plan yet: create one in IrriPlan from your plot.', 'ليس لديك خطة ري بعد: أنشئ واحدة في IrriPlan.'),
      links: [{ label: 'IrriPlan', to: '/app/irriplan' }],
      suggestions,
      source: 'mock',
    }
  }
  if (has('malad', 'feuille', 'plant', 'culture', 'crop', 'sick', 'disease', 'leaf', 'مرض', 'نبات', 'محصول', 'ورق')) {
    const sick = m.plantdoc.latest.filter((d) => d.severity !== 'aucune')
    return {
      reply: T(
        `${m.plantdoc.toTreat} diagnostic(s) restent à traiter sur ${m.plantdoc.parcels} parcelles.${sick.length ? ` Les plus récents : ${sick.map((d) => `${d.disease} (${d.parcel})`).join(', ')}.` : ''} Prenez une nouvelle photo dans PlantDoc pour suivre l’évolution.`,
        `${m.plantdoc.toTreat} diagnosis(es) still need treatment across ${m.plantdoc.parcels} plots.${sick.length ? ` Most recent: ${sick.map((d) => `${d.disease} (${d.parcel})`).join(', ')}.` : ''} Take a new photo in PlantDoc to follow up.`,
        `${nf(m.plantdoc.toTreat, lang)} تشخيصات تحتاج إلى علاج في ${nf(m.plantdoc.parcels, lang)} قطع أرض. التقط صورة جديدة في PlantDoc لمتابعة التطور.`,
      ),
      links: [{ label: 'PlantDoc', to: '/app/plantdoc' }],
      suggestions,
      source: 'mock',
    }
  }
  if (has('terrain', 'arbre', 'olivier', 'land', 'tree', 'hectare', 'أرض', 'شجر', 'زيتون')) {
    return {
      reply: T(
        `Vous suivez ${m.terracalc.count} terrains (${nf(m.terracalc.hectares, lang)} ha, ${nf(m.terracalc.trees, lang)} arbres) pour une production estimée de ${nf(m.terracalc.productionKg / 1000, lang)} tonnes par an. Dessinez un nouveau terrain dans TerraCalc pour une estimation.`,
        `You track ${m.terracalc.count} plots (${nf(m.terracalc.hectares, lang)} ha, ${nf(m.terracalc.trees, lang)} trees) with an estimated production of ${nf(m.terracalc.productionKg / 1000, lang)} tonnes per year. Draw a new plot in TerraCalc for an estimate.`,
        `تتابع ${nf(m.terracalc.count, lang)} أراضٍ (${nf(m.terracalc.hectares, lang)} هكتار، ${nf(m.terracalc.trees, lang)} شجرة) بإنتاج تقديري ${nf(m.terracalc.productionKg / 1000, lang)} طن سنوياً.`,
      ),
      links: [{ label: 'TerraCalc', to: '/app/terracalc' }],
      suggestions,
      source: 'mock',
    }
  }
  if (has('score', 'éco', 'eco', 'bilan', 'résumé', 'summary', 'مؤشر', 'ملخص')) {
    const weakest = [...s.parts].sort((a, b) => a.score - b.score)[0]
    return {
      reply: T(
        `Votre éco-score est de ${s.ecoScore}/100. Le point le plus faible est « ${weakest.label} » (${weakest.score}/100) : c’est là que vos efforts compteront le plus. ${s.alerts.length} alertes sont en cours.`,
        `Your eco-score is ${s.ecoScore}/100. The weakest point is "${weakest.label}" (${weakest.score}/100): that's where your efforts will count most. ${s.alerts.length} alerts are active.`,
        `مؤشرك البيئي هو ${nf(s.ecoScore, lang)}/100. أضعف نقطة هي «${weakest.label}» (${nf(weakest.score, lang)}/100). هناك ${nf(s.alerts.length, lang)} تنبيهات نشطة.`,
      ),
      links: [{ label: T('Vue d’ensemble', 'Overview', 'نظرة عامة'), to: '/app' }],
      suggestions,
      source: 'mock',
    }
  }
  return {
    reply: T(
      'Je suis l’assistant EcoNexus. Je peux vous parler de vos fuites d’eau, de l’irrigation de la semaine, de la santé de vos cultures ou de vos terrains. Que voulez-vous savoir ?',
      'I’m the EcoNexus assistant. I can tell you about water leaks, this week’s irrigation, crop health or your plots. What would you like to know?',
      'أنا مساعد EcoNexus. يمكنني إخبارك عن تسربات المياه، ري هذا الأسبوع، صحة المحاصيل أو أراضيك. ماذا تريد أن تعرف؟',
    ),
    links: [],
    suggestions,
    source: 'mock',
  }
}
