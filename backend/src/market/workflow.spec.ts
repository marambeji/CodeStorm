import { describe, expect, it } from 'vitest'
import { availableActions, checkQuantity, checkTransition, orderTotals, type Viewer } from './workflow.js'

const farmer: Viewer = { role: 'agriculteur', isClient: false, isFarmer: true, isCourier: false }
const otherFarmer: Viewer = { ...farmer, isFarmer: false }
const client: Viewer = { role: 'client', isClient: true, isFarmer: false, isCourier: false }
const courier: Viewer = { role: 'livreur', isClient: false, isFarmer: false, isCourier: true }
const freeCourier: Viewer = { ...courier, isCourier: false }

describe('checkTransition', () => {
  it('suit le circuit complet ferme → livreur → client', () => {
    expect(checkTransition('accepter', 'en_attente', farmer)).toEqual({ ok: true, to: 'acceptee' })
    expect(checkTransition('preparer', 'acceptee', farmer)).toEqual({ ok: true, to: 'prete' })
    expect(checkTransition('prendre', 'prete', freeCourier)).toEqual({ ok: true, to: 'prise_en_charge' })
    expect(checkTransition('recuperer', 'prise_en_charge', courier)).toEqual({ ok: true, to: 'en_livraison' })
    expect(checkTransition('livrer', 'en_livraison', courier)).toEqual({ ok: true, to: 'livree' })
  })

  it('refuse de sauter une étape', () => {
    expect(checkTransition('preparer', 'en_attente', farmer)).toMatchObject({ ok: false, reason: 'status' })
    expect(checkTransition('prendre', 'acceptee', freeCourier)).toMatchObject({ ok: false, reason: 'status' })
    expect(checkTransition('livrer', 'prete', courier)).toMatchObject({ ok: false, reason: 'status' })
    expect(checkTransition('livrer', 'prise_en_charge', courier)).toMatchObject({ ok: false, reason: 'status' })
    expect(checkTransition('recuperer', 'prise_en_charge', freeCourier)).toMatchObject({ ok: false, reason: 'owner' })
  })

  it('vérifie le rôle et la personne', () => {
    expect(checkTransition('accepter', 'en_attente', client)).toMatchObject({ ok: false, reason: 'role' })
    expect(checkTransition('accepter', 'en_attente', otherFarmer)).toMatchObject({ ok: false, reason: 'owner' })
    expect(checkTransition('livrer', 'en_livraison', freeCourier)).toMatchObject({ ok: false, reason: 'owner' })
  })

  it("le client n'annule que tant que la ferme n'a pas accepté", () => {
    expect(checkTransition('annuler', 'en_attente', client)).toEqual({ ok: true, to: 'annulee' })
    expect(checkTransition('annuler', 'acceptee', client)).toMatchObject({ ok: false, reason: 'status' })
  })

  it('une commande terminée ne bouge plus', () => {
    for (const s of ['livree', 'refusee', 'annulee'] as const) {
      expect(availableActions(s, farmer, false)).toEqual([])
      expect(availableActions(s, client, false)).toEqual([])
      expect(availableActions(s, courier, true)).toEqual([])
    }
  })
})

describe('availableActions', () => {
  it('propose les bons boutons à chacun', () => {
    expect(availableActions('en_attente', farmer, false)).toEqual(['accepter', 'refuser'])
    expect(availableActions('en_attente', client, false)).toEqual(['annuler'])
    expect(availableActions('prete', freeCourier, false)).toEqual(['prendre'])
    expect(availableActions('prete', freeCourier, true)).toEqual([])
  })
})

describe('checkQuantity', () => {
  it('impose des unités entières pour les pièces, bottes et caisses', () => {
    expect(checkQuantity('caisse', 2)).toBeNull()
    expect(checkQuantity('caisse', 1.5)).toMatch(/unité entière/)
    expect(checkQuantity('kg', 1.5)).toBeNull()
    expect(checkQuantity('kg', 1.25)).toMatch(/0,1/)
    expect(checkQuantity('kg', 0)).toMatch(/positive/)
  })
})

describe('orderTotals', () => {
  it('ajoute les frais de livraison sous le seuil', () => {
    expect(orderTotals([{ unitPrice: 2.5, quantity: 4 }])).toEqual({ subtotal: 10, deliveryFee: 3, total: 13 })
  })
  it('offre la livraison à partir de 40 €', () => {
    expect(orderTotals([{ unitPrice: 8, quantity: 5 }])).toEqual({ subtotal: 40, deliveryFee: 0, total: 40 })
  })
})
