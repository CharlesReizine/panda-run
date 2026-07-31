#!/usr/bin/env python3
"""Génère les illustrations d'objets manquantes (public/art/item-<id>.png) via Vertex AI Imagen.

POURQUOI CE FICHIER EST DANS LE DÉPÔT. Une version précédente de ce script vivait dans le scratchpad
d'une session Claude : le scratchpad a disparu, le script avec. Il est donc versionné ici, à côté du
reste de l'outillage d'art (art-manquant.mjs, art-caps.mjs, shrink-art.mjs).

⚠️ C'EST TOI QUI LE LANCES, PAS L'ASSISTANT. Les identifiants Vertex vivent dans le .env du monorepo
pretto, qui contient des secrets de production : l'assistant ne les lit pas et ne lance pas ce script.

Ce que le script fait, et pourquoi dans cet ordre :
 1. il lit le roster dans src/data/items.ts — SOURCE UNIQUE. Aucune liste d'objets recopiée ici : une
    liste en double finit désynchronisée du jeu, et on générerait de l'art pour des objets disparus ;
 2. il saute tout objet qui a déjà son PNG (idempotent : relancer ne regénère rien, sauf --force) ;
 3. il demande l'image sur un fond MAGENTA UNI, puis détache l'objet en partant des bords. Imagen ne
    sait pas sortir d'alpha ; un simple « remplace le magenta » troue l'objet dès qu'il contient du
    rose, alors qu'un remplissage depuis les bords ne peut atteindre que le vrai fond ;
 4. il recadre sur le contenu et sort du 128×128 RGBA — le format EXACT des 48 illustrations existantes
    (vérifié), donc inutile de repasser shrink-art.mjs derrière pour les objets.

Usage :
    python3 scripts/generate_art.py --list                  # ce qui manque, sans rien générer
    python3 scripts/generate_art.py --dry only anneau       # affiche les prompts, aucun appel réseau
    python3 scripts/generate_art.py only anneau collier     # génère ces objets (filtre = sous-chaîne)
    python3 scripts/generate_art.py                         # génère TOUT ce qui manque (90 objets)
    python3 scripts/generate_art.py --force only ruban      # refait un objet déjà illustré

Après génération : `npx vitest run tests/data/item-images.test.ts` échouera en signalant les entrées
devenues périmées dans ART_A_GENERER — il faut les retirer de la liste, c'est le signe que ça a marché.
Puis `node scripts/art-manquant.mjs` pour rafraîchir docs/art-a-generer.md.
"""
from __future__ import annotations

import argparse
import base64
import io
import json
import re
import sys
import time
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
ITEMS_TS = RACINE / "src" / "data" / "items.ts"
PRELOAD_TS = RACINE / "src" / "scenes" / "PreloadScene.ts"
ART = RACINE / "public" / "art"

ENV_DEFAUT = Path.home() / "pretto" / "apps" / "data-api" / ".env"
PREFIXE_CRED = "VERTEXAI_B64_SERVICE_ACCOUNTS_PART"

# Modèles essayés dans l'ordre : le premier qui répond gagne. Les identifiants de modèle Imagen
# changent au fil des versions ; enchaîner évite de devoir corriger le script à chaque rotation.
MODELES = ["imagen-4.0-generate-001", "imagen-3.0-generate-002", "imagegeneration@006"]
REGION = "us-central1"

TAILLE_FINALE = 128  # identique aux 48 illustrations déjà en place
FOND = (255, 0, 255)  # magenta pur : absent de toute palette d'objet, donc détachable sans ambiguïté
TOLERANCE = 60

# ── STYLE : il doit coller aux illustrations existantes, sinon les nouveaux objets jureront dans la
# même grille d'inventaire. Observé sur les PNG en place : aplats saturés, gros contour sombre, aucune
# ombre portée, objet centré et cadré serré, lisible à 40 px.
STYLE = (
    "2D game item icon, flat vector illustration, bold dark outline, bright saturated colors, "
    "simple cel shading, no drop shadow, no text, no border, no frame, single object centered, "
    "three-quarter view, cute stylized fantasy MMORPG inventory icon, highly readable at small size"
)
CADRE = (
    "The object fills most of the frame. Plain uniform magenta background (#FF00FF), "
    "absolutely nothing else in the image."
)

# Formulation par emplacement : une armure doit être vue comme un vêtement posé à plat, une arme de
# trois-quarts, un anneau de face. Sans ça Imagen livre des personnages qui PORTENT l'objet.
CADRAGE_SLOT = {
    "weapon": "The weapon alone, floating, diagonal, blade or limb pointing up-right.",
    "armor": "The garment alone, laid flat and empty, front view, no body wearing it, no mannequin.",
    "hat": "The headgear alone, empty, three-quarter view, no head wearing it, no face.",
    "accessory": "The small trinket alone, front view, slightly enlarged so its details read.",
}

TEINTE_RARETE = {
    "commun": "muted everyday materials, worn leather, plain iron, linen",
    "rare": "polished metal with a blue-steel sheen and a small gemstone accent",
    "epique": "ornate craftsmanship, purple and gold filigree, faint magical glow",
    "legendaire": "legendary artifact, radiant golden and orange energy, glowing runes, aura of power",
}

MOTIF_ITEM = re.compile(
    r"\{ id: '([^']+)', name: '((?:[^'\\]|\\.)*)', slot: '(\w+)'"
    r"(?:, weaponType: '(\w+)')?, bonus: \{([^}]*)\}, rarity: '(\w+)'"
    r", description: '((?:[^'\\]|\\.)*)' \}"
)


def lire_items():
    """Objets du jeu, lus dans la source TypeScript. Échoue bruyamment si le format a changé."""
    src = ITEMS_TS.read_text(encoding="utf-8")
    items = []
    for m in MOTIF_ITEM.finditer(src):
        items.append(
            {
                "id": m.group(1),
                "name": m.group(2).replace("\\'", "'"),
                "slot": m.group(3),
                "weaponType": m.group(4),
                "rarity": m.group(6),
                "description": m.group(7).replace("\\'", "'"),
            }
        )
    if len(items) < 100:
        sys.exit(
            f"❌ seulement {len(items)} objets lus dans {ITEMS_TS.name} — le format a changé, "
            "corrige MOTIF_ITEM au lieu de générer de l'art incomplet."
        )
    return items


def chapeaux_dessines() -> set:
    """Chapeaux qui ont déjà un VRAI visuel dessiné vectoriellement (cosmetic-<id> dans PreloadScene).

    ⚠️ MÊME HEURISTIQUE QUE scripts/art-manquant.mjs, ET C'EST VOLONTAIRE : si les deux outils ne
    comptaient pas la même chose, la liste générée dans docs/ ne correspondrait plus à ce que ce script
    produit — et on ne saurait plus si la dette est réglée. Un premier jet ignorait ce filtre et
    proposait 103 objets au lieu de 90 : il aurait écrasé 13 chapeaux qui vont déjà bien.
    """
    if not PRELOAD_TS.exists():
        return set()
    return set(re.findall(r"case '([a-z0-9-]+)':", PRELOAD_TS.read_text(encoding="utf-8")))


def a_un_visuel(item, dessines: set) -> bool:
    if (ART / f"item-{item['id']}.png").exists():
        return True
    return item["slot"] == "hat" and item["id"] in dessines


def prompt_pour(item) -> str:
    famille = {"sword": "sword or blade", "bow": "bow or crossbow", "staff": "magic staff or scepter"}
    quoi = item["name"]
    if item["slot"] == "weapon" and item["weaponType"]:
        quoi = f"{quoi}, a {famille.get(item['weaponType'], 'weapon')}"
    return (
        f"{quoi}. {item['description']} "
        f"{CADRAGE_SLOT.get(item['slot'], '')} "
        f"Material and mood: {TEINTE_RARETE.get(item['rarity'], '')}. "
        f"{STYLE}. {CADRE}"
    )


def charger_credentials(chemin_env: Path):
    """Reconstitue le compte de service Vertex depuis les parts base64 du .env pretto."""
    if not chemin_env.exists():
        sys.exit(f"❌ fichier d'identifiants introuvable : {chemin_env}\n   (passe --env <chemin>)")
    parts = {}
    for ligne in chemin_env.read_text(encoding="utf-8", errors="replace").splitlines():
        if not ligne.startswith(PREFIXE_CRED):
            continue
        cle, _, val = ligne.partition("=")
        suffixe = cle[len(PREFIXE_CRED):].strip()
        if suffixe.isdigit():
            parts[int(suffixe)] = val.strip().strip("'\"")
    if not parts:
        sys.exit(f"❌ aucune variable {PREFIXE_CRED}* dans {chemin_env}")
    brut = "".join(parts[k] for k in sorted(parts))
    try:
        decode = base64.b64decode(brut)
        data = json.loads(decode)
    except Exception as e:  # noqa: BLE001
        sys.exit(f"❌ les parts {PREFIXE_CRED}* ne se décodent pas en JSON ({e})")

    # Le nom est au pluriel : le blob peut contenir PLUSIEURS comptes. On prend le premier qui en est un.
    if isinstance(data, dict) and data.get("type") == "service_account":
        sa = data
    elif isinstance(data, dict):
        sa = next((v for v in data.values() if isinstance(v, dict) and v.get("type") == "service_account"), None)
    else:
        sa = None
    if not sa:
        sys.exit("❌ aucun compte de service trouvé dans le blob décodé")

    try:
        from google.oauth2 import service_account
        import google.auth.transport.requests as gart
    except ImportError:
        sys.exit("❌ paquet manquant : pip install google-auth")
    creds = service_account.Credentials.from_service_account_info(
        sa, scopes=["https://www.googleapis.com/auth/cloud-platform"]
    )
    creds.refresh(gart.Request())
    return creds, sa.get("project_id")


def detacher(png_bytes: bytes) -> "object":
    """Enlève le fond magenta EN PARTANT DES BORDS, recadre sur l'objet, sort du 128×128 RGBA.

    Le remplissage part des bords exprès : un « remplace tous les pixels magenta » perce l'objet dès
    qu'il contient du rose ou du violet — et les objets épiques en sont pleins.
    """
    from PIL import Image
    from collections import deque

    im = Image.open(io.BytesIO(png_bytes)).convert("RGBA")
    w, h = im.size
    px = im.load()

    def est_fond(c):
        return sum(abs(c[i] - FOND[i]) for i in range(3)) <= TOLERANCE * 3

    vus = bytearray(w * h)
    file = deque()
    for x in range(w):
        for y in (0, h - 1):
            if est_fond(px[x, y]):
                file.append((x, y)); vus[y * w + x] = 1
    for y in range(h):
        for x in (0, w - 1):
            if est_fond(px[x, y]):
                file.append((x, y)); vus[y * w + x] = 1
    while file:
        x, y = file.popleft()
        px[x, y] = (0, 0, 0, 0)
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h and not vus[ny * w + nx] and est_fond(px[nx, ny]):
                vus[ny * w + nx] = 1
                file.append((nx, ny))

    boite = im.split()[-1].getbbox()
    if boite:
        im = im.crop(boite)
    # carré + petite marge, pour que tous les objets aient le même air dans la grille
    cote = max(im.size)
    marge = max(2, cote // 16)
    fond = Image.new("RGBA", (cote + marge * 2, cote + marge * 2), (0, 0, 0, 0))
    fond.paste(im, ((fond.width - im.width) // 2, (fond.height - im.height) // 2), im)
    return fond.resize((TAILLE_FINALE, TAILLE_FINALE), Image.LANCZOS)


def generer(creds, project, prompt: str) -> bytes:
    import requests

    erreurs = []
    for modele in MODELES:
        url = (
            f"https://{REGION}-aiplatform.googleapis.com/v1/projects/{project}"
            f"/locations/{REGION}/publishers/google/models/{modele}:predict"
        )
        r = requests.post(
            url,
            headers={"Authorization": f"Bearer {creds.token}", "Content-Type": "application/json"},
            json={
                "instances": [{"prompt": prompt}],
                "parameters": {"sampleCount": 1, "aspectRatio": "1:1", "personGeneration": "dont_allow"},
            },
            timeout=180,
        )
        if r.status_code == 200:
            preds = r.json().get("predictions") or []
            if not preds:
                erreurs.append(f"{modele}: réponse vide (filtre de sécurité ?)")
                continue
            b64 = preds[0].get("bytesBase64Encoded")
            if not b64:
                erreurs.append(f"{modele}: pas d'image dans la réponse")
                continue
            return base64.b64decode(b64)
        erreurs.append(f"{modele}: HTTP {r.status_code} {r.text[:160]}")
    raise RuntimeError(" | ".join(erreurs))


def main():
    ap = argparse.ArgumentParser(description="Génère les illustrations d'objets manquantes.")
    ap.add_argument("only", nargs="*", help="filtre par sous-chaîne d'identifiant (mot-clé 'only' optionnel)")
    ap.add_argument("--list", action="store_true", help="liste ce qui manque et sort")
    ap.add_argument("--dry", action="store_true", help="affiche les prompts, aucun appel réseau")
    ap.add_argument("--force", action="store_true", help="regénère même si le PNG existe")
    ap.add_argument("--env", type=Path, default=ENV_DEFAUT, help=f"fichier d'identifiants (défaut : {ENV_DEFAUT})")
    ap.add_argument("--limit", type=int, default=0, help="s'arrête après N objets")
    ap.add_argument(
        "--dessines", action="store_true",
        help="inclut aussi les chapeaux qui ont déjà un dessin vectoriel (pour les remplacer par une illustration)",
    )
    args = ap.parse_args()

    filtres = [f for f in args.only if f != "only"]
    items = lire_items()
    dessines = set() if args.dessines else chapeaux_dessines()
    cibles = [it for it in items if args.force or not a_un_visuel(it, dessines)]
    if filtres:
        cibles = [it for it in cibles if any(f in it["id"] for f in filtres)]
    if args.limit:
        cibles = cibles[: args.limit]

    if not cibles:
        print("Rien à générer. 🎉")
        return

    par_slot = {}
    for it in cibles:
        par_slot[it["slot"]] = par_slot.get(it["slot"], 0) + 1
    print(f"{len(cibles)} objet(s) à générer : " + ", ".join(f"{n} {s}" for s, n in sorted(par_slot.items())))

    if args.list:
        for it in cibles:
            print(f"  item-{it['id']}.png   {it['name']} ({it['rarity']}, {it['slot']})")
        return

    if args.dry:
        for it in cibles:
            print(f"\n── item-{it['id']}.png ──\n{prompt_pour(it)}")
        return

    creds, project = charger_credentials(args.env)
    print(f"Projet Vertex : {project} · région {REGION}")
    ART.mkdir(parents=True, exist_ok=True)

    ok, echecs = 0, []
    for i, it in enumerate(cibles, 1):
        cible = ART / f"item-{it['id']}.png"
        print(f"[{i}/{len(cibles)}] {it['id']} … ", end="", flush=True)
        try:
            brut = generer(creds, project, prompt_pour(it))
            detacher(brut).save(cible)
            ok += 1
            print("ok")
        except Exception as e:  # noqa: BLE001
            echecs.append((it["id"], str(e)[:200]))
            print("ÉCHEC")
        time.sleep(0.4)  # on ne martèle pas l'API

    print(f"\n{ok} illustration(s) écrite(s) dans {ART.relative_to(RACINE)}")
    if echecs:
        print(f"{len(echecs)} échec(s) :")
        for iid, err in echecs:
            print(f"   {iid} : {err}")
    print(
        "\nEnsuite :\n"
        "   npx vitest run tests/data/item-images.test.ts   # signale les entrées à retirer de ART_A_GENERER\n"
        "   node scripts/art-manquant.mjs                   # rafraîchit docs/art-a-generer.md"
    )


if __name__ == "__main__":
    main()
