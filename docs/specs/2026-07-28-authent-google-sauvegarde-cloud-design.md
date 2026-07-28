# Authent Google + sauvegarde cloud — design

> Statut : **en attente de validation user**. Rien n'est codé.
> Date : 2026-07-28. Contexte : le user perd ses sauvegardes (localStorage volatil : cache vidé,
> réinstallation de la PWA, mode privé). Il veut pouvoir recharger sa partie depuis n'importe où.

## Décisions déjà prises par le user

| Question | Décision |
|---|---|
| Backend | **Firebase** — Auth Google + Firestore. Plan gratuit (Spark) qui ne se met jamais en pause, zéro serveur, marche depuis gh-pages. |
| Sans compte | **Jouable sans compte**, connexion **optionnelle**. |
| Avertissement | **Prévenir explicitement** le joueur non connecté que sa sauvegarde n'est pas garantie. |
| Slots | Un seul slot par compte (pas d'écran de sélection de partie). |

## Ce que ça NE résout PAS (à ne pas confondre)

Le bouton « Télécharger l'app » et la sauvegarde cloud répondent à deux problèmes **orthogonaux** :

- « Télécharger l'app » met les **ASSETS** dans le cache du service worker → jouer **sans réseau**.
  Le précache automatique ne couvre que 16 entrées (~2 Mo) : tout l'art vient de ce bouton.
- La sauvegarde cloud sécurise la **PROGRESSION** → et exige au contraire du **réseau**.

Retirer le bouton parce que le cloud marche casserait le jeu hors connexion. Décision reportée,
hors périmètre de cette spec.

## Contrainte structurante : le jeu doit démarrer sans réseau

Le démarrage ne doit JAMAIS attendre Firebase. Conséquences :

- le SDK Firebase est chargé en **`import()` dynamique**, pas dans le bundle principal ;
- la sauvegarde locale (localStorage) reste la source du démarrage — le cloud vient **après**, en
  tâche de fond ;
- si Firebase est absent, non configuré, ou injoignable, le jeu se comporte **exactement comme
  aujourd'hui**. C'est un chemin nominal, pas une erreur.

## Architecture

Six unités, dont **une seule contient de la logique intéressante** — et elle est pure, donc testable
sans Firebase.

```
TitleScene ─── bouton « Se connecter avec Google » + avertissement
     │
     ├──> src/cloud/auth.ts        signInWithGoogle / signOut / onUser / currentUser
     │         └──> src/cloud/firebase.ts   init paresseux, renvoie null si non configuré
     │
     ├──> src/core/sync.ts         ⭐ LOGIQUE PURE : decideSync(local, cloud) → action
     │
     └──> src/cloud/cloud-save.ts  pull(uid) / push(uid, state) — I/O Firestore, fine couche
               │
               └──> src/core/save.ts   +champ savedAt (migration version 9)
```

### `src/cloud/firebase.ts`
Initialise l'app Firebase **à la première demande**, depuis `import.meta.env.VITE_FIREBASE_*`.
Renvoie `null` si la config est absente → tout l'étage cloud devient inerte (dev, tests, fork sans
projet Firebase). Aucune exception qui remonte.

### `src/cloud/auth.ts`
Encapsule le choix popup/redirect (cf. le risque iOS plus bas) pour que le reste du code ne le voie
jamais. Expose `signInWithGoogle()`, `signOut()`, `onUser(cb)`, `currentUser()`. La session Firebase
est persistée par le SDK → on reste connecté entre les lancements.

### `src/cloud/cloud-save.ts`
Un document par joueur : `saves/{uid}`, champs `{ version, player, savedAt, build }`.
`pull` renvoie `null` si le document est absent OU illisible (même traitement que `safeLoad` de
TitleScene aujourd'hui : une sauvegarde corrompue ne bloque pas le jeu).

### `src/core/sync.ts` ⭐
Le cœur, **pur et sans I/O** :

```ts
type SyncAction = 'rien' | 'prendre-le-cloud' | 'garder-le-local' | 'pousser-le-local' | 'demander'

decideSync(local: Stamped | null, cloud: Stamped | null, lastSyncedAt: number): SyncAction
```

**Pourquoi un troisième argument.** Comparer `local.savedAt` à `cloud.savedAt` ne suffit PAS : ça dit
lequel est le plus récent, jamais si les deux ont divergé. Exemple qui perd des données avec une
simple comparaison — je joue sur l'iPhone (local avance), puis sur le Mac (cloud avance encore plus) :
le cloud est plus récent, donc « prendre le cloud », et ma session iPhone est **écrasée en silence**.

On mémorise donc localement `lastSyncedAt` = le `savedAt` du dernier état effectivement échangé avec
le cloud. Il sert de point de référence commun (comparaison à trois branches) :

- `local.savedAt > lastSyncedAt` ⇒ **le local a changé** depuis la dernière synchro ;
- `cloud.savedAt > lastSyncedAt` ⇒ **le cloud a changé** depuis la dernière synchro ;
- les deux ⇒ **divergence réelle** ⇒ `demander`.

Règles :

| local | cloud | a changé | action |
|---|---|---|---|
| absent | absent | — | `rien` |
| présent | absent | — | `pousser-le-local` (1re connexion : on ne perd pas la partie en cours) |
| absent | présent | — | `prendre-le-cloud` |
| présent | présent | ni l'un ni l'autre | `rien` |
| présent | présent | le cloud seul | `prendre-le-cloud` |
| présent | présent | le local seul | `garder-le-local`, puis push |
| présent | présent | **les deux** | `demander`¹ |

¹ **Le cas qui compte** : le joueur a progressé sur deux appareils. On ne détruit RIEN en silence —
un panneau affiche les deux parties (niveau, or, date) et il choisit. C'est la seule interaction
bloquante de tout le système.

`lastSyncedAt` vit dans sa propre clé localStorage (pas dans le fichier de sauvegarde : il décrit la
relation avec le cloud, pas l'état du joueur — le mêler à la save le ferait voyager avec elle, ce qui
casserait justement la détection sur un second appareil).

### `src/core/save.ts`
Ajout d'un `savedAt` (epoch ms) au fichier de sauvegarde → **version 9**, migration cumulative comme
les huit précédentes (`savedAt` absent ⇒ `0`, donc toujours plus vieux que le cloud). Sans cet
horodatage, aucune comparaison local/cloud n'est possible.

## Flux

**Lancement** — inchangé : lecture localStorage, écran-titre immédiat. En parallèle, si une session
Firebase existe, `pull()` en tâche de fond → `decideSync` → au pire un panneau de choix.

**Connexion** — bouton sur l'écran-titre. Au retour : `pull()`, `decideSync`, application.

**Écriture** — partout où le code appelle `save(p)` aujourd'hui (fin de terrain, achat, level-up), on
ajoute un push cloud **débouncé (~3 s) et fire-and-forget**. Le jeu n'attend jamais le réseau.

**Hors connexion** — un push qui échoue est marqué « en attente » dans localStorage et rejoué au
prochain succès (ou au prochain lancement). Une seule écriture en attente à la fois : l'état complet
du joueur, pas un journal — le dernier état gagne, donc rien à fusionner.

## Avertissement « sauvegarde non garantie » (exigence user)

Écran-titre, **non connecté** :

> ⚠️ Sauvegarde locale uniquement — elle peut disparaître (cache vidé, réinstallation).
> Connecte-toi pour la mettre à l'abri.

Écran-titre, **connecté** : `☁️ Sauvegardé — <email>` + « Se déconnecter ».
Pas de pop-up récurrent en jeu : l'avertissement est permanent mais discret, là où il est utile.

## Risque à lever EN PREMIER : OAuth en PWA iOS standalone

C'est le seul point qui peut faire échouer le projet, et le user joue justement en PWA installée.
`signInWithPopup` s'appuie sur `window.open` + `postMessage` : en mode standalone iOS, la fenêtre
s'ouvre dans une vue navigateur séparée et le retour peut ne jamais arriver. `signInWithRedirect`
souffre du cloisonnement du stockage tiers de Safari.

**Ordre de bataille — un spike AVANT d'écrire le reste :**

1. `signInWithPopup` en PWA installée sur l'iPhone du user ;
2. sinon `signInWithRedirect` ;
3. sinon Google Identity Services (bouton FedCM, jeton rendu à la page sans popup) +
   `signInWithCredential`.

`auth.ts` isole ce choix : basculer de stratégie ne touche aucun autre fichier. **Si les trois
échouent, on s'arrête et on rediscute du backend** — c'est le scénario où le user a raison de dire
« ça marchera jamais ».

## Sécurité

Règles Firestore — un joueur ne lit et n'écrit que son propre document :

```
match /databases/{db}/documents {
  match /saves/{uid} {
    allow read, write: if request.auth != null && request.auth.uid == uid;
  }
}
```

La config web Firebase (`apiKey` & co.) sera **publique** dans le bundle gh-pages : c'est normal et
sans danger pour une app web Firebase — la sécurité vient des règles Firestore et de la liste des
domaines autorisés, pas du secret de la clé. Elle vit dans `.env` (git-ignoré) + `.env.example`.

## Tests

- `tests/core/sync.test.ts` — les 7 lignes de la table de décision, `savedAt` manquant des deux côtés,
  et surtout le **scénario de divergence deux appareils** (celui qui perdrait des données avec une
  simple comparaison de dates). C'est là qu'est tout le risque de bug, et c'est pur.
- `tests/core/save.test.ts` — migration version 8 → 9 (`savedAt` absent ⇒ 0).
- `cloud/*` = fines couches d'I/O, vérifiées à la main (mocker le SDK Firebase testerait le mock).

## À la charge du user (je n'ai pas accès à sa console Google)

1. Créer un projet sur console.firebase.google.com.
2. Authentication → activer le fournisseur **Google**.
3. Authentication → Settings → Authorized domains → ajouter **charlesreizine.github.io**
   (et `localhost` pour le dev).
4. Firestore Database → créer en mode production, coller les règles ci-dessus.
5. Project settings → Web app → copier la config dans `.env` (je fournirai `.env.example`).

## Hors périmètre

Classements, parties multi-appareils simultanées, plusieurs slots, comptes anonymes Firebase,
retrait du bouton « Télécharger l'app ».
