# Carles Inventaire

Application web **professionnelle de gestion de stock** (ERP / PWA) pour un point de vente physique : suivi des articles, entrées/sorties, bons de livraison, inventaires, scan code-barres, tableau de bord, gestion des rôles et exports.

Monorepo : **backend** Node + Express + Prisma + PostgreSQL, **frontend** React + TypeScript + Vite + Tailwind, déployable en **un seul service** sur Render.

---

## Sommaire

- [Stack technique](#stack-technique)
- [Fonctionnalités (12 modules)](#fonctionnalités-12-modules)
- [Structure du projet](#structure-du-projet)
- [Installation en local](#installation-en-local)
- [Déploiement sur Render](#déploiement-sur-render)
- [Comptes par défaut](#comptes-par-défaut)
- [Rôles et permissions](#rôles-et-permissions)
- [Import CSV des articles](#import-csv-des-articles)
- [Notes techniques](#notes-techniques)

---

## Stack technique

| Côté | Technologies |
|------|--------------|
| Frontend | React 18, TypeScript, Vite, React Router, Tailwind CSS, Recharts, @zxing/browser (scan caméra), PWA (service worker) |
| Backend | Node 20, Express, Prisma ORM, PostgreSQL, JWT (auth), Zod (validation), PDFKit (PDF), ExcelJS (export), Multer + csv-parse (import) |
| Sécurité | Helmet, CORS, rate-limiting, hash bcrypt, rôles, journal d'audit |
| Déploiement | Render (service web, gratuit) + Neon (PostgreSQL, gratuit) |

Polices auto-hébergées (Inter + Space Grotesk via `@fontsource`) — **aucun appel externe**, conforme RGPD.

---

## Fonctionnalités (12 modules)

Tous les modules de la spécification sont implémentés :

1. **Gestion des articles** — CRUD complet, référence unique, code-barres, marque, prix achat/vente, stock min, zone, catégorie, recherche et filtres (zone, catégorie, marque, état de stock).
2. **Entrées de stock** — réception simple ou fournisseur, multi-lignes, ajout par recherche ou scan, référence (BL/facture).
3. **Sorties de stock** — vente, casse, perte, SAV, retour fournisseur, avec contrôle du stock disponible.
4. **Bons de livraison + PDF** — création (brouillon), lignes avec prix unitaire, signature client tactile, validation (décrémente le stock), génération PDF imprimable.
5. **Inventaire + écarts** — sessions complètes, par zone ou tournantes ; stock théorique figé, saisie des comptages, calcul automatique des écarts (quantité et valeur), régularisation du stock à la validation, rapport de synthèse.
6. **Scan code-barres** — caméra du smartphone (`@zxing/browser`) **et** douchette USB/Bluetooth (détection « keyboard wedge »), utilisables partout (recherche, entrées, sorties, bons).
7. **Historique des mouvements** — journal immuable et horodaté, filtres (article, type, période…), pagination.
8. **Tableau de bord** — KPIs (nombre d'articles, ruptures, stock bas, valeurs d'achat/vente, unités), graphique des mouvements sur 6 mois, alertes de stock, derniers mouvements.
9. **Gestion des zones** — emplacements physiques (rayons, vitrine, réserve…) + catégories.
10. **Recherche ultra-rapide** — barre de recherche globale instantanée (référence, code-barres, nom, marque) avec navigation clavier.
11. **Sécurité & rôles** — authentification JWT, 3 rôles (Admin / Employé / Inventaire), journal d'audit de toutes les actions sensibles.
12. **Sauvegarde / Export** — export CSV et Excel des articles, export CSV des mouvements, import CSV d'articles en masse.

Le tout en **PWA installable**, responsive (mobile/tablette/desktop), avec **mode sombre** et grands boutons tactiles.

---

## Structure du projet

```
carles-inventaire/
├── package.json            # scripts monorepo (render-build / render-start)
├── render.yaml             # blueprint Render (service web ; base PostgreSQL externe via DATABASE_URL)
├── server/                 # API REST + service du frontend buildé
│   ├── prisma/
│   │   ├── schema.prisma   # modèle de données complet
│   │   └── seed.ts         # données initiales (comptes, zones, articles…)
│   └── src/
│       ├── app.ts          # Express : middlewares, /api, statique React
│       ├── index.ts        # démarrage serveur
│       ├── config/         # env + client Prisma
│       ├── middleware/     # auth, rôles, gestion d'erreurs
│       ├── lib/            # logique stock (mouvements) + génération PDF
│       ├── utils/          # JWT, helpers, audit, numérotation documents
│       └── routes/         # 15 routeurs (articles, mouvements, BL, inventaire…)
└── client/                 # application React (Vite)
    ├── vite.config.ts      # build + PWA + proxy /api en dev
    └── src/
        ├── api/            # client axios + types partagés
        ├── contexts/       # Auth + thème (clair/sombre)
        ├── hooks/          # toasts, douchette code-barres
        ├── lib/            # formatage (€, dates, libellés)
        ├── components/     # UI réutilisable, layout, scanner, signature…
        └── pages/          # 18 écrans (dashboard, articles, BL, inventaire…)
```

---

## Installation en local

**Prérequis :** Node 20+, une base PostgreSQL accessible.

```bash
# 1. Installer les dépendances (serveur + client)
npm run install:all

# 2. Configurer le serveur
cp server/.env.example server/.env
# → éditer server/.env et renseigner DATABASE_URL + JWT_SECRET

# 3. Préparer la base (génère le client Prisma, crée les tables, insère les données)
npm --prefix server run prisma:generate
npm --prefix server run prisma:push
npm --prefix server run seed

# 4. Lancer en développement (2 terminaux)
npm run dev:server    # API sur http://localhost:4000
npm run dev:client    # Front sur http://localhost:5173 (proxy /api → 4000)
```

Le front de développement (port 5173) appelle automatiquement l'API (port 4000) via un proxy.

---

## Déploiement (Render + base Neon gratuite)

L'application tourne sur un service web **Render** (gratuit), et la base de données PostgreSQL est hébergée gratuitement sur **[Neon](https://neon.tech)** (0,5 Go, sans carte bancaire, n'expire pas). On évite ainsi la base Render, dont l'offre gratuite expire au bout de 30 jours.

### 1. Créer la base sur Neon

1. Créer un compte sur **https://neon.tech** (connexion via GitHub/Google, sans carte).
2. **Create project** → choisir une région proche (ex. *Europe (Frankfurt)*) → créer.
3. Dans **Connect** (ou *Connection Details*), **décocher/désactiver « Connection pooling »** pour obtenir la chaîne **directe**, puis copier la chaîne de connexion. Elle ressemble à :
   ```
   postgresql://user:motdepasse@ep-xxxx.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require&connect_timeout=15
   ```
   > **Important :** utiliser la chaîne **directe** (sans `-pooler` dans l'hôte). Prisma en a besoin pour créer les tables au déploiement (`prisma db push`) : la chaîne « pooler » ferait échouer cette étape.
   >
   > Le paramètre `&connect_timeout=15` évite un time-out au premier accès, le temps que la base Neon (en veille) se réactive.

### 2. Déployer sur Render

1. Pousser ce projet sur un dépôt Git (GitHub/GitLab).
2. Sur Render : **New → Blueprint**, sélectionner le dépôt. Le `render.yaml` est détecté.
3. Render demande la valeur de **`DATABASE_URL`** (marquée « sync: false ») : y **coller la chaîne Neon** copiée à l'étape 1.
4. Valider. Render lance le build :
   - installe le client et le serveur, **génère le client Prisma**, compile TypeScript,
   - crée les tables (`prisma db push`) sur Neon et insère les données initiales (seed),
   - sert l'API sous `/api` et le frontend React buildé sur la même URL.

Les autres variables sont gérées par le blueprint : `JWT_SECRET` (auto-généré), `SEED_ADMIN_USERNAME`, `SEED_ADMIN_PASSWORD`, `COMPANY_NAME`, `PDF_VAT_RATE`.

> ⚠️ **Sécurité** : après le premier déploiement, connectez-vous (`admin` / `Admin123!`) et **changez le mot de passe administrateur**.

> 💤 **Mises en veille (offres gratuites)** : Neon et le service web Render se mettent en veille après quelques minutes d'inactivité et se réveillent tout seuls à la requête suivante (léger délai au premier accès). C'est normal sur les offres gratuites.

**Autres bases gratuites compatibles** (même principe : coller la chaîne dans `DATABASE_URL`) : **Supabase** (500 Mo, mais met le projet en pause après 7 jours d'inactivité, à réactiver manuellement) ou **Aiven**. N'importe quel PostgreSQL fait l'affaire.

---

## Comptes par défaut

Créés automatiquement par le seed :

| Rôle | Identifiant | Mot de passe |
|------|-------|--------------|
| Administrateur | `admin` | `Admin123!` |
| Employé | `employe` | `Employe123!` |
| Inventaire | `inventaire` | `Invent123!` |

L'identifiant et le mot de passe administrateur sont configurables via les variables `SEED_ADMIN_USERNAME` / `SEED_ADMIN_PASSWORD`.

---

## Rôles et permissions

| Action | Admin | Employé | Inventaire |
|--------|:----:|:------:|:---------:|
| Consulter articles, mouvements, tableau de bord | ✓ | ✓ | ✓ |
| Entrées / sorties / bons de livraison | ✓ | ✓ | — |
| Référentiels (zones, catégories, fournisseurs, clients) | ✓ | ✓ | — |
| Inventaires (comptage, régularisation) | ✓ | — | ✓ |
| Suppressions | ✓ | — | — |
| Utilisateurs + journal d'audit | ✓ | — | — |
| Exports / import | ✓ | ✓ | ✓ |

---

## Import CSV des articles

Module **Paramètres & export → Importer**. Fichier CSV (séparateur `;`), colonnes :

```
reference;barcode;brand;name;description;purchasePrice;salePrice;stock;minStock;zone;category
```

- `reference` sert de clé : si elle existe, l'article est mis à jour, sinon créé.
- La colonne `stock` est traitée comme une **quantité ajoutée** (mouvement d'entrée tracé), pas un écrasement — l'historique reste cohérent.
- `zone` (code) et `category` (nom) sont résolues automatiquement, et créées si absentes.

Le résultat indique le nombre d'articles créés, mis à jour, le stock ajouté et les éventuelles erreurs par ligne.

---

## Notes techniques

- **Mouvements de stock** : journal immuable. Chaque mouvement enregistre une quantité signée (+entrée / −sortie) et le stock avant/après. Le stock d'un article n'est jamais modifié « à la main » : il découle des mouvements (un ajustement d'inventaire est lui-même un mouvement tracé).
- **Numérotation** : bons de livraison `BL-AAAA-NNNN`, inventaires `INV-AAAA-NNNN`.
- **PWA** : l'application est installable ; l'API n'est jamais mise en cache hors-ligne (données temps réel).
- **Signatures** : capturées au format image (base64) et intégrées au PDF du bon de livraison.

---

Développé comme application directement exploitable. Les comptes et données de démonstration permettent de tester immédiatement tous les modules après déploiement.
