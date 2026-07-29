// Initialisation PARESSEUSE de Firebase. Deux contraintes qui dictent la forme de ce module :
//
// 1. Le jeu doit démarrer SANS RÉSEAU et sans attendre Firebase. Le SDK est donc chargé en
//    `import()` dynamique : il sort du bundle principal et n'est téléchargé qu'au moment où on
//    tente réellement de se connecter.
// 2. Config absente = CHEMIN NOMINAL, pas une erreur. Sans `.env` (clone du repo, CI, tests),
//    `getApp()` renvoie null, tout l'étage cloud devient inerte et le jeu se comporte exactement
//    comme avant : sauvegarde locale seule.

const cfg = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
}

export function isConfigured(): boolean {
  return !!(cfg.apiKey && cfg.authDomain && cfg.projectId && cfg.appId)
}

// Une seule instance pour toute la durée de vie de la page : on mémorise la PROMESSE, pas l'app,
// pour que deux appels concurrents ne déclenchent pas deux initialisations.
let appPromise: Promise<import('firebase/app').FirebaseApp> | null = null

export function getApp(): Promise<import('firebase/app').FirebaseApp> | null {
  if (!isConfigured()) return null
  if (!appPromise) {
    appPromise = import('firebase/app').then(({ initializeApp }) => initializeApp({
      apiKey: cfg.apiKey!,
      authDomain: cfg.authDomain!,
      projectId: cfg.projectId!,
      appId: cfg.appId!,
    }))
  }
  return appPromise
}
