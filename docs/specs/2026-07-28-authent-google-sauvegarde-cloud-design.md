# Authent Google + sauvegarde cloud — design

> Statut : **implémenté en R275, en attente du test sur appareil.**
> Déployé pour test : https://panda-run-reizine.web.app
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
     ├──> src/core/sync.ts         ⭐ LOGIQUE PURE : decideSync(local, cloud, lastSyncedAt)
     │
     └──> src/cloud/cloud-save.ts  pull(uid) / push(uid, state) — I/O Firestore, fine couche
               │
               └──> src/core/save.ts   +savedAt dans l'enveloppe, +crochet onSaved
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
Un document par joueur : `saves/{uid}`, champs `{ json, savedAt, build }`.

**La sauvegarde est stockée comme une CHAÎNE JSON, pas comme un objet Firestore.** Firestore refuse
les champs `undefined` — or `PlayerState` en a plein (`equipment.hat`, `quests`…) — interdit les
tableaux imbriqués et contraint les noms de clés. Sérialiser en amont supprime cette classe entière
de plantages à l'écriture, et le format de sauvegarde reste défini au seul endroit qui le connaît
(`core/save.ts`), migrations de version comprises. Une save fait ~10 Ko, très loin de la limite de
1 Mio par document.

`pull` renvoie `null` si le document est absent OU illisible (même traitement que `safeLoad` de
TitleScene : une sauvegarde corrompue ne bloque jamais le jeu).

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
Ajout d'un `savedAt` (epoch ms) dans l'**enveloppe** du fichier. Sans cet horodatage, aucune
comparaison local/cloud n'est possible.

⚠️ **PAS de bump de version, et c'est volontaire** (la 1re version de cette spec disait « version 9 » :
c'était une erreur). `deserialize` rejette `version > VERSION` : une save v9 serait illisible par une
build encore en cache sur le téléphone, qui la traiterait comme *absente* — « j'ai perdu ma partie »,
exactement ce qu'on cherche à éviter. Un champ **optionnel** ajouté à l'enveloppe est ignoré sans
bruit par les anciennes builds : compatible dans les deux sens. Un test verrouille ce choix.

Ajout aussi d'un crochet **`onSaved`** : la poussée cloud s'y branche en UN point, au lieu d'être
greffée sur chacun des appels à `save()` dispersés dans le jeu (fin de terrain, achat, level-up,
réforge…) — un oubli y serait invisible et ferait diverger le cloud en silence.

## Flux

**Lancement** — inchangé : lecture localStorage, écran-titre immédiat. En parallèle, si une session
Firebase existe, `pull()` en tâche de fond → `decideSync` → au pire un panneau de choix.

**Connexion** — bouton sur l'écran-titre. Au retour : `pull()`, `decideSync`, application.

**Écriture** — partout où le code appelle `save(p)` aujourd'hui (fin de terrain, achat, level-up), on
ajoute un push cloud **débouncé (~3 s) et fire-and-forget**. Le jeu n'attend jamais le réseau.

**Hors connexion** — un push qui échoue est simplement ignoré : le local reste alors en avance sur
`lastSyncedAt`, donc la prochaine synchro le voit modifié et le pousse. **Aucune file d'attente à
maintenir** (la 1re version de cette spec en prévoyait une, c'était inutile) : on réécrit l'état
complet du joueur à chaque fois, jamais un journal — le dernier état gagne, rien à fusionner, rien à
rejouer dans l'ordre.

## Avertissement « sauvegarde non garantie » (exigence user)

Écran-titre, **non connecté** :

> ⚠️ Sauvegarde locale uniquement — elle peut disparaître (cache vidé, réinstallation).
> Connecte-toi pour la mettre à l'abri.

Écran-titre, **connecté** : `☁️ Sauvegardé — <email>` + « Se déconnecter ».
Pas de pop-up récurrent en jeu : l'avertissement est permanent mais discret, là où il est utile.

## Risque n°1 : OAuth en PWA iOS — CORRIGÉ le 2026-07-29

**Le user avait raison, la première version de cette spec était fausse.** Elle proposait une échelle
« popup → redirect → FedCM » qui n'a pas de sens ici.

Ce que dit la doc officielle
([redirect-best-practices](https://firebase.google.com/docs/auth/web/redirect-best-practices)) :
depuis le **24 juin 2024**, `signInWithRedirect` fait passer le flux par une **iframe cross-origin**
servie depuis `authDomain`. Les navigateurs qui bloquent le stockage tiers — **Safari 16.1+**, donc
l'iPhone — la cassent. Le jeu étant servi depuis `charlesreizine.github.io` alors que `authDomain`
vaut `panda-run-reizine.firebaseapp.com`, **le redirect est mort d'avance sur gh-pages**. Ce n'était
donc pas un repli, c'était une impasse.

La doc donne 5 issues. Retenues :

1. **Servir le jeu depuis le même domaine que l'auth** → plus aucune iframe tierce, popup ET redirect
   fonctionnent. C'est la seule option qui **supprime la cause** au lieu de la contourner.
   Mise en œuvre : déploiement sur **Firebase Hosting** (`panda-run-reizine.web.app`), gratuit.
   Coût : l'URL partagée change (gh-pages peut rediriger).
2. `signInWithPopup` — implémenté aujourd'hui. Pas de problème d'iframe, mais la doc prévient que les
   popups sont parfois bloquées « par l'appareil ou la plateforme ». Le cas non tranché reste la PWA
   **installée** en standalone sur iOS : c'est précisément ce que le test doit départager.

Écartées : reverse proxy (impossible sur gh-pages, purement statique) ; auto-hébergement du helper
d'auth sous `/__/auth/` (faisable avec un `.nojekyll`, mais du contournement là où l'option 1 règle
le fond) ; SDK Google tiers + `signInWithCredential` (« approche complexe » selon la doc).

`cloud/auth.ts` isole ce choix : en changer ne touche aucun autre fichier.

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

## Mise en place — FAIT le 2026-07-29

Projet **panda-run-reizine**. Presque tout par CLI ; deux étapes seulement en console, parce que le
CLI Firebase ne les expose pas.

```
npx -y firebase-tools@latest login
npx -y firebase-tools@latest projects:create panda-run-reizine -n "Panda Run"
npx -y firebase-tools@latest apps:create WEB "panda-run" --project panda-run-reizine
npx -y firebase-tools@latest apps:sdkconfig WEB --project panda-run-reizine   # imprime la config
npx -y firebase-tools@latest deploy --only firestore:rules --project panda-run-reizine
```

En console (impossible en CLI) : activer le fournisseur **Google** dans
`authentication/providers`, et créer la base Firestore (`/firestore`, mode production, `eur3`).

⚠️ **`gcloud` ne sert à rien ici** : il est authentifié sur le compte de service Pretto
(`sa-dataplatform-production@pretto-apis`), qui n'a aucun droit sur un projet personnel. Ne PAS faire
`gcloud auth login` pour corriger ça — ça changerait le compte actif global et casserait les accès
data-platform. `firebase-tools`, lui, a sa propre auth (charles.reizine@gmail.com).

⚠️ Si l'auth doit aussi marcher sur gh-pages : ajouter `charlesreizine.github.io` dans
`authentication/settings` → Authorized domains. Inutile sur `*.web.app`, autorisé d'office.

## Hors périmètre

Classements, parties multi-appareils simultanées, plusieurs slots, comptes anonymes Firebase,
retrait du bouton « Télécharger l'app ».
