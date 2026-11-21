import { PasswordHasher } from '@nestjs/authentication'
/**
 * Données de démo d'EcoNexus.
 * Lancement : npm run db:seed   (idempotent : on peut le relancer sans créer de doublons)
 */
import 'dotenv/config'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import type { Polygon } from 'geojson'
import { mockPlantAdvice } from '../src/ai/plant-advice.mock.js'
import { mockTerrainAdvice } from '../src/ai/terrain-advice.mock.js'
import { buildPlan, seasonalWeather } from '../src/irrigation/irrigation.engine.js'
import { DISEASES, severityFromRatio } from '../src/plant/diseases.data.js'
import { PrismaClient } from '../src/generated/prisma/client.js'
import { estimate, measurePolygon, type Irrigation } from '../src/terrain/estimation.js'
import { SPECIES } from '../src/terrain/species.data.js'

const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? 'file:./dev.db' }) })

const DISCLAIMER =
  'Estimation indicative, calculée à partir de moyennes agronomiques. Les résultats réels dépendent de la variété, du sol, du climat et de la conduite.'

/** Terrains de démo dessinés sur de vraies zones agricoles */
const DEMO_TERRAINS: {
  name: string
  speciesId: string
  plantingYear: number | null
  irrigation: Irrigation
  ring: [number, number][] // [lng, lat]
}[] = [
  {
    name: 'Oliveraie de Sfax',
    speciesId: 'olivier',
    plantingYear: 2012,
    irrigation: 'goutte-a-goutte',
    ring: [
      [10.5512, 34.8051],
      [10.5561, 34.8055],
      [10.5566, 34.8021],
      [10.5531, 34.8012],
      [10.5509, 34.8027],
    ],
  },
  {
    name: 'Palmeraie de Tozeur',
    speciesId: 'palmier-dattier',
    plantingYear: 2019,
    irrigation: 'gravitaire',
    ring: [
      [8.1201, 33.9161],
      [8.1236, 33.9164],
      [8.1239, 33.9141],
      [8.1204, 33.9137],
    ],
  },
]

const DEMO_USER = 'demo-user'

async function main() {
  // 1. Espèces (upsert : met à jour les valeurs si on modifie species.data.ts)
  for (const s of SPECIES) {
    await prisma.species.upsert({ where: { id: s.id }, create: s, update: s })
  }
  console.log(`✔ ${SPECIES.length} espèces de référence`)

  // Compte de démo (demo@econexus.app / Demo2026!) : reçoit toutes les données d'exemple
  await prisma.user.upsert({
    where: { id: DEMO_USER },
    create: { id: DEMO_USER, email: 'demo@econexus.app', passwordHash: await new PasswordHasher().hash('Demo2026!'), name: 'Agriculteur démo', farmName: 'Ferme de démonstration', placeName: 'Sfax', lat: 34.74, lng: 10.76 },
    update: {},
  })
  console.log('✔ compte de démo : demo@econexus.app')

  // 2. Terrains de démo (seulement s'ils n'existent pas déjà)
  for (const t of DEMO_TERRAINS) {
    if (await prisma.terrain.findFirst({ where: { name: t.name } })) continue
    const species = await prisma.species.findUniqueOrThrow({ where: { id: t.speciesId } })
    const polygon: Polygon = { type: 'Polygon', coordinates: [[...t.ring, t.ring[0]]] }
    const m = measurePolygon(polygon)
    const e = estimate({ polygon, species, plantingYear: t.plantingYear, irrigation: t.irrigation, currentYear: new Date().getFullYear() })
    const stored = { ...e, trees: e.trees ? { ...e.trees, points: [] } : null, ai: mockTerrainAdvice(e, species), disclaimer: DISCLAIMER, computedAt: new Date().toISOString() }
    await prisma.terrain.create({
      data: {
        userId: DEMO_USER,
        name: t.name,
        polygon: JSON.stringify(polygon),
        areaM2: m.areaM2,
        perimeterM: m.perimeterM,
        centroidLat: m.centroid[0],
        centroidLng: m.centroid[1],
        speciesId: t.speciesId,
        plantingYear: t.plantingYear,
        irrigation: t.irrigation,
        estimate: JSON.stringify(stored),
      },
    })
    console.log(`✔ Terrain de démo : ${t.name} (${m.areaHa} ha, ${e.trees?.count ?? 0} arbres)`)
  }
}

const DAY = 86_400_000
const daysAgo = (n: number, hour = 9) => {
  const d = new Date(Date.now() - n * DAY)
  d.setHours(hour, 0, 0, 0)
  return d
}

/** PlantDoc : diagnostics sur 4 parcelles (sans photo : l'interface affiche une illustration) */
async function seedPlant() {
  if (await prisma.plantDiagnosis.count()) return
  const items: [string, string, number, number, number, string?][] = [
    // [parcelle, maladie, confiance, part atteinte, il y a N jours, statut]
    ['Parcelle Nord', 'tomate-mildiou', 0.94, 0.28, 1],
    ['Parcelle Nord', 'tomate-alternariose', 0.88, 0.12, 9, 'en-cours'],
    ['Parcelle Nord', 'tomate-sain', 0.97, 0, 21],
    ['Serre 2', 'tomate-cladosporiose', 0.81, 0.08, 3],
    ['Serre 2', 'tomate-sain', 0.95, 0, 17],
    ['Vignes du coteau', 'vigne-black-rot', 0.9, 0.18, 5, 'en-cours'],
    ['Vignes du coteau', 'vigne-sain', 0.96, 0, 26],
    ['Champ de pommes de terre', 'pomme-de-terre-mildiou', 0.86, 0.03, 12, 'traite'],
  ]
  for (const [parcel, key, confidence, ratio, ago, status] of items) {
    const d = DISEASES.find((x) => x.key === key)!
    const severity = severityFromRatio(d.healthy, ratio)
    const ai = mockPlantAdvice(d, severity, parcel)
    await prisma.plantDiagnosis.create({
      data: {
        userId: DEMO_USER,
        parcel,
        crop: d.crop,
        diseaseKey: key,
        disease: d.name,
        confidence,
        severity,
        advice: ai.advice,
        tips: JSON.stringify(ai.tips),
        status: status ?? (d.healthy ? 'traite' : 'a-traiter'),
        createdAt: daysAgo(ago, 10),
      },
    })
  }
  console.log(`✔ ${items.length} diagnostics PlantDoc`)
}

/** IrriPlan : un plan de démo pour l'oliveraie (météo saisonnière, recalculé avec la vraie météo dans l'app) */
async function seedIrrigation() {
  if (await prisma.irrigationPlan.count()) return
  const t = await prisma.terrain.findFirst({ where: { name: 'Oliveraie de Sfax' } })
  const olive = await prisma.species.findUnique({ where: { id: 'olivier' } })
  if (!t || !olive) return
  const trees = (JSON.parse(t.estimate ?? '{}') as { trees?: { count: number } }).trees?.count ?? 5000
  const plan = buildPlan({
    speciesId: 'olivier',
    kind: 'tree',
    areaM2: t.areaM2,
    trees,
    age: new Date().getFullYear() - (t.plantingYear ?? 2012),
    fullProductionAge: olive.fullProductionAge,
    irrigation: 'goutte-a-goutte',
    pumpHeadM: 35,
    kwhPrice: 0.25,
    habitWaterM3PerYear: (olive.waterM3PerTreeYear ?? 8) * trees,
    weather: seasonalWeather(new Date()),
  })
  const stored = {
    ...plan,
    species: { id: 'olivier', name: 'Olivier' },
    weatherSource: 'saisonnier',
    ai: { summary: `Plan de démo : ${plan.totals.irrigationDays} arrosage(s) cette semaine pour ${plan.totals.volumeM3} m³. Cliquez sur « Mettre à jour la météo » pour le recalculer avec la vraie météo.`, tips: ['Arrosez tôt le matin.', 'Paillez le pied des arbres.'], source: 'mock' },
    computedAt: new Date().toISOString(),
  }
  await prisma.irrigationPlan.create({
    data: { userId: DEMO_USER, name: 'Oliveraie de Sfax', terrainId: t.id, speciesId: 'olivier', areaM2: t.areaM2, trees, lat: t.centroidLat, lng: t.centroidLng, irrigation: 'goutte-a-goutte', plantingYear: t.plantingYear, pumpHeadM: 35, plan: JSON.stringify(stored) },
  })
  console.log('✔ 1 plan IrriPlan')
}

/** AquaScan : 2 compteurs, relevés hebdomadaires, une fuite récente sur le compteur maison */
async function seedMeters() {
  if (await prisma.meter.count()) return
  const add = async (name: string, location: string, start: number, litersPerDay: number[]) => {
    const meter = await prisma.meter.create({ data: { userId: DEMO_USER, name, location, createdAt: daysAgo(litersPerDay.length * 7 + 1) } })
    let value = start
    await prisma.meterReading.create({ data: { meterId: meter.id, value, readAt: daysAgo(litersPerDay.length * 7, 8), source: 'manuel' } })
    for (let i = 0; i < litersPerDay.length; i++) {
      value = Math.round((value + (litersPerDay[i] * 7) / 1000) * 1000) / 1000
      await prisma.meterReading.create({
        data: {
          meterId: meter.id,
          value,
          readAt: daysAgo((litersPerDay.length - 1 - i) * 7, 8),
          source: i % 3 === 0 ? 'manuel' : 'ocr',
          ocrConfidence: i % 3 === 0 ? null : 0.86 + (i % 4) * 0.03,
        },
      })
    }
  }
  await add('Compteur maison', 'Entrée, regard extérieur', 1248.6, [318, 305, 332, 296, 341, 310, 322, 298, 315, 329, 307, 812])
  await add('Compteur jardin', 'Arrosage du potager', 214.2, [140, 165, 152, 171, 148, 133, 159, 144])
  console.log('✔ 2 compteurs AquaScan (avec une fuite récente sur « Compteur maison »)')
}

main()
  .then(seedPlant)
  .then(seedIrrigation)
  .then(seedMeters)
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
