# EcoNexus 🌱💧⚡

Plateforme IA (sans IoT) pour l'**Eau**, l'**Énergie** et l'**Agriculture** : PlantDoc, FactureIA, HydroMap, AquaScan.

## Structure

```
econexus/
├── package.json   → scripts racine (concurrently)
├── frontend/      → React 19 + Vite 8 + TypeScript + Tailwind v4 + shadcn/ui
├── mobile/        → Expo + React Native pour Android et iOS
└── backend/       → NestJS 12 + Prisma 7 + SQLite
```

## Prérequis

- Node.js ≥ 20 (testé avec 26 LTS) et npm

## Première installation (après un clone)

```bash
cd econexus
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
npm run setup      # installe les dépendances + crée la base SQLite + données de démo
```

## Lancer le projet

```bash
npm run dev
```

- Frontend : http://localhost:5173
- API : http://localhost:3000/api (test : http://localhost:3000/api/health)

Pour lancer la version mobile et valider les parcours Android et iOS, voir [le guide mobile](mobile/README.md).

## Autres commandes utiles

| Commande | Où | Rôle |
|---|---|---|
| `npm run build` | racine | Build backend + frontend |
| `npm test` | racine | Tests unitaires du backend |
| `npm run db:migrate` | backend | Applique les changements de `prisma/schema.prisma` |
| `npm run db:studio` | backend | Interface web pour voir la base |
| `npm run db:reset` | backend | Vide et recrée la base |
| `npm run db:seed` | backend | Recharge les données de démo (espèces, terrains) |
| `npx shadcn@latest add <composant>` | frontend | Ajoute un composant shadcn/ui |

## Marché : de la ferme au client

Trois rôles, choisis à l'inscription :

| Rôle | Pages | Ce qu'il fait |
|---|---|---|
| Agriculteur | outils agricoles + **Ma boutique** | met ses produits en vente (prix, stock, origine, date de récolte, photo), accepte ou refuse les commandes, les marque « prêtes » |
| Client | **Marché**, **Mes commandes** | achète (un panier multi-fermes donne une commande par ferme), suit chaque étape, peut annuler tant que la ferme n'a pas accepté |
| Livreur | **Livraisons** | prend en charge une commande prête, la livre et valide la remise avec le code à 4 chiffres du client |

Circuit d'une commande : `en_attente → acceptee → prete → prise_en_charge → en_livraison → livree` (ou `refusee` / `annulee`, avec remise en stock).

**Suivi en direct et itinéraire** : le client place son point de livraison sur la carte à la commande ; la position de la ferme vient du profil de l'agriculteur.
Pendant sa tournée, le téléphone du livreur partage sa position GPS (page « Livraisons » ouverte) ; le client et la ferme la voient sur une carte avec l'heure d'arrivée estimée.
Le livreur voit sa tournée optimisée (chaque ferme avant son client, plus proche voisin + 2-opt) et peut la lancer dans Google Maps.
Itinéraires : OSRM (`router.project-osrm.org`, serveur de démonstration gratuit) ; repli à vol d'oiseau s'il ne répond pas.
Les règles sont dans `backend/src/market/workflow.ts` (testées dans `workflow.spec.ts`). Le stock est réservé au moment de la commande.
Livraison : 3 € par ferme, offerte dès 40 €. Paiement à la livraison.

Comptes de démo (mot de passe `Demo2026!`) : `demo@econexus.app` (agriculteur), `client@econexus.app`. Pas de produits ni de commandes au départ ; un livreur crée son compte depuis « Créer un compte » → Livreur.

## Mode démo

Sans `LLM_API_KEY` dans `backend/.env`, l'API fonctionne en **mode mock** (réponses IA simulées), sans internet.
