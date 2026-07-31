import { describe, it, expect } from 'vitest'
import { PAD, PAD_ORDRE, VUE_H, etendueY, ecart, seChevauchent, zoneJoystick, MARGE_SURE } from '../../src/scenes/action-pad-layout'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// COMMANDES TACTILES DU BAS — LE « V » PIVOTÉ, ET LE QUART DE JOYSTICK
//
// Demande du user : attaque / saut / potion en bas à droite, disposés « comme un V qui a pivoté à 90
// degrés à gauche » — attaque à la pointe gauche, saut au-dessus à droite, potion en dessous à droite —
// et le joystick sur tout le quart bas-gauche.
//
// Ce qu'on verrouille ici, c'est la FORME et la JOUABILITÉ, pas des pixels : la disposition doit rester un
// « < » (donc l'attaque strictement plus à gauche, le saut strictement plus haut que la potion), les zones
// tactiles ne doivent pas se recouvrir — sinon un tap déclenche la mauvaise action, ce qui est le pire
// défaut possible sur un bouton de saut — et rien ne doit sortir du cadre.

const boutons = PAD_ORDRE.map((k) => ({ nom: k, b: PAD[k] }))

describe('la forme est bien un « < »', () => {
  it('l\'attaque est la pointe : strictement plus à gauche que le saut et la potion', () => {
    // « plus à gauche » = plus LOIN du bord droit
    expect(PAD.attaque.droite).toBeGreaterThan(PAD.saut.droite)
    expect(PAD.attaque.droite).toBeGreaterThan(PAD.potion.droite)
  })

  it('les deux branches sont alignées verticalement, à la même distance du bord', () => {
    expect(PAD.saut.droite).toBe(PAD.potion.droite)
  })

  it('le saut est AU-DESSUS, la potion EN DESSOUS, et l\'attaque entre les deux', () => {
    expect(PAD.saut.y).toBeLessThan(PAD.attaque.y)
    expect(PAD.potion.y).toBeGreaterThan(PAD.attaque.y)
  })

  it('la pointe est à mi-hauteur des deux branches, à peu près — sinon ce n\'est plus un V', () => {
    const milieu = (PAD.saut.y + PAD.potion.y) / 2
    expect(Math.abs(PAD.attaque.y - milieu)).toBeLessThan(30)
  })
})

describe('jouabilité au pouce', () => {
  it('AUCUNE paire de zones tactiles ne se recouvre', () => {
    const collisions: string[] = []
    for (let i = 0; i < boutons.length; i++) {
      for (let j = i + 1; j < boutons.length; j++) {
        const a = boutons[i]!, b = boutons[j]!
        if (seChevauchent(a.b, b.b)) collisions.push(`${a.nom} ↔ ${b.nom} (écart ${Math.round(ecart(a.b, b.b))} < ${a.b.rTap + b.b.rTap})`)
      }
    }
    expect(collisions, collisions.join(', ')).toEqual([])
  })

  it('chaque zone tactile est PLUS GRANDE que le visuel : on joue au pouce, pas à la souris', () => {
    for (const { nom, b } of boutons) expect(b.rTap, nom).toBeGreaterThan(b.r)
  })

  it('le SAUT est le plus gros bouton — action la plus fréquente et la plus punitive à rater', () => {
    expect(PAD.saut.r).toBeGreaterThan(PAD.attaque.r)
    expect(PAD.saut.r).toBeGreaterThan(PAD.potion.r)
  })

  it('la POTION est la plus petite : un gros bouton invite à la gaspiller par erreur', () => {
    expect(PAD.potion.r).toBeLessThan(PAD.attaque.r)
  })
})

describe('tout reste dans le cadre', () => {
  it('aucune zone tactile ni libellé ne sort en haut ou en bas', () => {
    for (const { nom, b } of boutons) {
      const [haut, bas] = etendueY(b)
      expect(haut, `${nom} sort par le haut`).toBeGreaterThanOrEqual(0)
      expect(bas, `${nom} sort par le bas`).toBeLessThanOrEqual(VUE_H)
    }
  })

  it('les boutons occupent bien la MOITIÉ BASSE de l\'écran, pas le milieu', () => {
    for (const { nom, b } of boutons) expect(b.y, nom).toBeGreaterThan(VUE_H / 2)
  })

  it('le triangle remplit vraiment le quart : il est large et haut', () => {
    // « tu peux grossir pour que le triangle remplisse le premier quart »
    const largeur = PAD.attaque.droite - PAD.saut.droite + PAD.attaque.rTap + PAD.saut.rTap
    const hauteur = PAD.potion.y - PAD.saut.y + PAD.saut.rTap + PAD.potion.rTap
    expect(largeur, 'triangle trop étroit').toBeGreaterThan(280)
    expect(hauteur, 'triangle trop plat').toBeGreaterThan(250)
    expect(hauteur, 'triangle plus haut que la moitié de l\'écran').toBeLessThanOrEqual(VUE_H / 2 + 20)
  })

  it('la marge de sûreté écarte le HUD du bord sans le renvoyer au centre', () => {
    // retour user : « avec la caméra de l'iPhone 12 je vois pas tout »
    expect(MARGE_SURE).toBeGreaterThanOrEqual(16)
    expect(MARGE_SURE).toBeLessThanOrEqual(48)
  })
})

describe('zone du joystick', () => {
  it('couvre tout le quart bas-gauche, quelle que soit la largeur d\'écran', () => {
    for (const w of [960, 1174, 1404]) {
      const z = zoneJoystick(w)
      expect(z.x).toBe(0)
      expect(z.y).toBe(VUE_H / 2)
      expect(z.w).toBe(w / 2)
      expect(z.h).toBe(VUE_H / 2)
    }
  })

  it('ne mord jamais sur les commandes de droite', () => {
    for (const w of [960, 1174, 1404]) {
      const z = zoneJoystick(w)
      // bord droit de la zone, en distance au bord droit de l'écran
      const distanceAuBordDroit = w - (z.x + z.w)
      expect(distanceAuBordDroit, `écran ${w}`).toBeGreaterThan(PAD.attaque.droite + PAD.attaque.rTap)
    }
  })
})
