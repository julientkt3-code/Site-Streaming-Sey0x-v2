# 🚀 Déploiement sur Render — HaloStream

## Ce qui a été ajouté

| Fichier | Rôle |
|---|---|
| `server.js` | Serveur Express qui sert le build React + fallback SPA |
| `render.yaml` | Config automatique pour Render |
| `src/components/AdBlocker.tsx` | Bloqueur de popups/pubs côté client |
| `src/hooks/use-keep-alive.ts` | Ping toutes les 14 min pour rester actif 24/7 |

---

## Étape 1 — Mettre le projet sur GitHub

1. Crée un dépôt GitHub (privé ou public)
2. Upload tous ces fichiers dedans :
   ```
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/TON_COMPTE/halostream.git
   git push -u origin main
   ```

---

## Étape 2 — Créer le service sur Render

1. Va sur **[render.com](https://render.com)** et connecte-toi
2. Clique **"New +"** → **"Web Service"**
3. Connecte ton compte GitHub et sélectionne ton dépôt
4. Render détecte automatiquement `render.yaml` — clique **"Apply"**

   OU configure manuellement :
   - **Build Command** : `npm install && npm run build`
   - **Start Command** : `node server.js`
   - **Environment** : `Node`
   - **Region** : Frankfurt (le plus proche de la France)

5. Clique **"Create Web Service"**

---

## Étape 3 — Attendre le build (~3-5 min)

Render va :
1. Cloner ton repo
2. Lancer `npm install && npm run build`
3. Démarrer `node server.js`

Ton site sera disponible à une URL du type :
`https://halostream.onrender.com`

---

## 24/7 — Comment ça marche

Le plan gratuit de Render met le service en veille après **15 minutes** d'inactivité.

La solution intégrée :
- Le hook `useKeepAlive` dans le navigateur envoie un ping à `/ping` **toutes les 14 minutes**
- Tant qu'un utilisateur est connecté, le serveur reste actif

### Pour une disponibilité totale sans utilisateur connecté

Option gratuite : utilise **[UptimeRobot](https://uptimerobot.com)**
1. Crée un compte gratuit
2. "New Monitor" → HTTP(s)
3. URL : `https://TON-SITE.onrender.com/ping`
4. Interval : **5 minutes**

Ça maintient le serveur actif même sans visiteur, gratuitement.

---

## Variables d'environnement (optionnel)

Si tu veux mettre ta propre clé TMDB :
1. Dans Render → ton service → **Environment**
2. Ajoute : `VITE_TMDB_KEY` = ta clé

---

## Troubleshooting

| Problème | Solution |
|---|---|
| Build failed | Vérifie que `node_modules` n'est pas dans le repo (`.gitignore`) |
| Page blanche | Vérifie que le `startCommand` est bien `node server.js` |
| Routes 404 | Normal si `server.js` n'est pas là — il gère le fallback SPA |
