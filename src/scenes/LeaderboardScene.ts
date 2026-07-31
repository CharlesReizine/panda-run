import Phaser from 'phaser'
import { top, type LeaderEntry } from '../cloud/leaderboard'
import { ensureUser } from '../cloud/auth'
import { readActivePseudo, pseudoKey } from '../cloud/identity'
import { CLASSES } from '../data/classes'
import type { ClassId } from '../core/types'
import { VIEW_H, VIEW_W, centerCamera } from '../core/viewport'

// Classement : tous les joueurs, triés par niveau. Lecture seule, publique.
// Le tri et la limite sont faits par Firestore (cf. cloud/leaderboard.ts) : on ne télécharge jamais
// toute la collection pour n'afficher que le haut du tableau.
export class LeaderboardScene extends Phaser.Scene {
  constructor() { super('Leaderboard') }

  private returnKey = 'Title'

  init(data: { return?: string }) {
    this.returnKey = data.return ?? 'Title'
  }

  create() {
    // espace de conception 0→960 recentré sur l'écran élargi (core/viewport.ts)
    centerCamera(this)
    this.add.rectangle(480, 270, VIEW_W, VIEW_H, 0x0d1b2a, 0.97)
    this.add.text(480, 40, '🏆 Classement', { fontSize: '30px', color: '#ffd54f', fontStyle: 'bold' }).setOrigin(0.5)

    this.add.text(60, 500, '✕ Retour', { fontSize: '18px', color: '#ffffff', fontStyle: 'bold', backgroundColor: '#8e2f2f', padding: { x: 12, y: 7 } })
      .setOrigin(0, 0.5).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.scene.start(this.returnKey))

    const status = this.add.text(480, 270, 'Chargement…', { fontSize: '18px', color: '#e1f5fe' }).setOrigin(0.5)

    void this.load_(status)
  }

  private async load_(status: Phaser.GameObjects.Text) {
    // L'authent anonyme est exigée par les règles Firestore, même en lecture : on l'assure d'abord.
    await ensureUser()
    let rows: LeaderEntry[] = []
    try {
      rows = await top(50)
    } catch (e) {
      status.setColor('#ffab91').setText(`Classement indisponible\n${e instanceof Error ? e.message : String(e)}`)
      status.setAlign('center')
      return
    }
    if (!rows.length) {
      status.setText('Personne n\'a encore joué en ligne.')
      return
    }
    status.destroy()
    this.draw(rows)
  }

  private draw(rows: LeaderEntry[]) {
    // Le joueur de CET appareil est surligné : dans une liste de pseudos, on se cherche d'abord.
    const mine = readActivePseudo()
    const mineKey = mine ? pseudoKey(mine) : null

    // en-têtes
    this.add.text(90, 88, '#', { fontSize: '15px', color: '#90a4ae', fontStyle: 'bold' }).setOrigin(0.5)
    this.add.text(140, 88, 'JOUEUR', { fontSize: '15px', color: '#90a4ae', fontStyle: 'bold' }).setOrigin(0, 0.5)
    this.add.text(560, 88, 'CLASSE', { fontSize: '15px', color: '#90a4ae', fontStyle: 'bold' }).setOrigin(0, 0.5)
    this.add.text(860, 88, 'NIVEAU', { fontSize: '15px', color: '#90a4ae', fontStyle: 'bold' }).setOrigin(1, 0.5)

    // 12 lignes visibles : au-delà on déborderait de la hauteur de 540. Le défilement d'une liste
    // plus longue est un chantier à part (aucun joueur n'en a besoin aujourd'hui).
    const MAX_ROWS = 12
    const rowH = 32
    rows.slice(0, MAX_ROWS).forEach((r, i) => {
      const y = 122 + i * rowH
      const isMine = mineKey !== null && r.key === mineKey
      const cls = CLASSES[r.classId as ClassId]

      if (isMine) this.add.rectangle(480, y, 820, rowH - 4, 0x1b5e20, 0.55).setStrokeStyle(1, 0xa5d6a7, 0.8)
      else if (i % 2 === 0) this.add.rectangle(480, y, 820, rowH - 4, 0xffffff, 0.04)

      // les 3 premiers en couleur de médaille — repère visuel immédiat
      const rankColor = i === 0 ? '#ffd54f' : i === 1 ? '#cfd8dc' : i === 2 ? '#d7a06a' : '#78909c'
      this.add.text(90, y, String(i + 1), { fontSize: '17px', color: rankColor, fontStyle: 'bold' }).setOrigin(0.5)
      this.add.text(140, y, r.pseudo, { fontSize: '18px', color: isMine ? '#a5d6a7' : '#ffffff', fontStyle: 'bold' }).setOrigin(0, 0.5)
      this.add.text(560, y, cls ? cls.name : r.classId, { fontSize: '16px', color: '#b0bec5' }).setOrigin(0, 0.5)
      this.add.text(860, y, String(r.level), { fontSize: '19px', color: '#ffd54f', fontStyle: 'bold' }).setOrigin(1, 0.5)
    })

    if (rows.length > MAX_ROWS) {
      this.add.text(480, 122 + MAX_ROWS * rowH + 6, `… et ${rows.length - MAX_ROWS} autres`, { fontSize: '14px', color: '#78909c' }).setOrigin(0.5)
    }
  }
}
