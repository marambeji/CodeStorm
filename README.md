# EcoNexus 🌱💧⚡

Plateforme IA (sans IoT) pour l'**Eau**, l'**Énergie** et l'**Agriculture** : PlantDoc, FactureIA, HydroMap, AquaScan.

## Structure

```
econexus/
├── package.json   → scripts racine (concurrently)
├── frontend/      → React 19 + Vite 8 + TypeScript + Tailwind v4 + shadcn/ui
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

## Mode démo

Sans `LLM_API_KEY` dans `backend/.env`, l'API fonctionne en **mode mock** (réponses IA simulées), sans internet.
