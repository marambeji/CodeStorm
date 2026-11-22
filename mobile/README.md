# EcoNexus mobile

L’application Expo affiche le frontend EcoNexus existant dans une WebView React Native. Elle utilise les mêmes comptes, données et services IA que le site configuré. La connexion au site est nécessaire pour charger les écrans.

## Démarrage

1. Rendre le frontend accessible au téléphone avec une URL HTTPS et un certificat valide. Si le frontend utilise le réglage par défaut `VITE_API_URL=/api`, son serveur doit transmettre `/api` à NestJS et servir `index.html` pour les routes React comme `/app/plantdoc` et `/trace/:code`.
2. Copier `mobile/.env.example` vers `mobile/.env` et renseigner `EXPO_PUBLIC_ECONEXUS_URL` avec l’adresse du frontend. Cette variable est publique. La clé Gemini reste dans la configuration du backend.
3. Dans le dossier `mobile`, lancer `npm ci`. Avec le SDK Android installé, lancer `npm run android`. Sur macOS avec Xcode, lancer `npm run ios`. Pour reconnecter une application de développement déjà installée à Metro, lancer `npm start`.

`npm run build --prefix mobile` exporte les bundles JavaScript Android et iOS. `npm run test:mobile` vérifie les règles de navigation.

Pour un aperçu en développement, un téléphone sur le même Wi-Fi peut utiliser l’adresse HTTP privée du serveur Vite. Dans `frontend`, lancer `npm run dev -- --host 0.0.0.0`, puis renseigner `EXPO_PUBLIC_ECONEXUS_URL=http://ADRESSE_DU_PC:5173` dans `mobile/.env`. Cette configuration est réservée au développement. Pour tester la caméra web et les autres API qui exigent un contexte sécurisé, utiliser HTTPS.

Sur iPhone, le projet cible le SDK 58 demandé par Expo Go sur l’appareil de test. Dans `mobile`, lancer `npm start -- --tunnel ngrok --go` puis scanner le QR avec l’app Appareil photo. Le tunnel transporte le bundle Expo. Avec une URL privée dans `mobile/.env`, le téléphone doit aussi pouvoir joindre le frontend sur le Wi-Fi. Pour tester depuis un autre réseau, configurer l’URL HTTPS d’un environnement de test accessible au téléphone.

## Recette sur Android et iOS

Comparer chaque écran au site EcoNexus à la même largeur, dans les mêmes langues et avec les mêmes comptes. Utiliser une base de test pour les actions qui créent des données.

| Parcours | Vérification sur téléphone |
| --- | --- |
| Compte et navigation | Inscription pour chaque rôle, connexion, déconnexion, session après relance, profil, changement de langue, affichage arabe, bouton Retour Android |
| PlantDoc | Galerie et caméra, diagnostic, détails et historique |
| TerraCalc | Dessiner et modifier une parcelle, position GPS, calcul, sauvegarde, réouverture et export PDF |
| IrriPlan | Créer puis modifier un plan, comparer recommandations et historique au site |
| AquaScan | Caméra, import, OCR, correction manuelle et historique de consommation |
| Marché et boutique | Créer un produit avec photo, passer une commande, vérifier le stock, accepter, refuser ou annuler |
| Livraisons | Rendre la commande disponible, affecter un livreur, partager sa position, ouvrir Google Maps, confirmer avec le code client |
| Traçabilité | Créer un lot, ajouter des événements, exporter le QR, scanner en direct et depuis la galerie, ouvrir la fiche publique sans compte |
| Assistant IA | Envoyer une question avec le contexte, valider la réponse en mode démo puis avec Gemini configuré, tester dictée et lecture vocale |
| Autorisations et réseau | Tester les refus caméra, micro et GPS, puis les autorisations accordées. Couper le réseau, le rétablir et utiliser « Réessayer » |

La caméra, le GPS, les téléchargements PDF et QR ainsi que les API de dictée et de lecture vocale dépendent du moteur web du téléphone. Leur fonctionnement doit être vérifié sur les deux plateformes.
