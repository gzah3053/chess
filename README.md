# Atelier Schach

Ein vollständiges lokales 2D-Schachspiel mit React, TypeScript und Vite. Die Schachregeln liefert `chess.js`; eine eigene Engine mit iterativer Alpha-Beta-Suche rechnet im Web Worker. Für eine spätere 3D-Ansicht sind Regelprüfung und Suche von der SVG-Darstellung getrennt.

## Starten

Voraussetzung: Node.js 20.19+ oder 22.12+ und npm.

```sh
npm ci
npm run dev -- --port 5174
```

Danach die im Terminal ausgegebene lokale Adresse öffnen. Standardmäßig bindet der Entwicklungsserver nur an `127.0.0.1`.

```sh
npm run build   # TypeScript-Prüfung und Produktionsbuild
npm test        # Tests der Engine, Regeln und Persistenz
npm run preview -- --port 4174
```

## Funktionen

- Computergegner in vier Stufen, freie Farbwahl; Spiel zu zweit am selben Gerät.
- Klick- und Ziehbedienung, legale Zielfelder, Schach- und letzte Zugmarkierung, Brett drehen.
- Rochade, en passant und Auswahl aller vier Umwandlungsfiguren.
- Automatische Erkennung von Matt, Patt, unzureichendem Material, dreifacher Wiederholung und 50-Züge-Regel.
- Unbegrenzte Bedenkzeit oder 3, 5, 10, 15 und 30 Minuten mit optionalem Zeitbonus.
- Pause/Fortsetzen, Rücknahme, Zugtipp, Aufgabe und vereinbartes Remis.
- Zugverlauf mit Stellungsnavigation, geschlagene Figuren und grobe Stellungsbewertung.
- PGN-Import/-Export, automatische Wiederherstellung; nach Neuladen bleiben laufende Partien bis zum Fortsetzen pausiert.
- Designeditor mit vier Brett-Paletten, individuellen Feldfarben und drei selbst gezeichneten SVG-Figurensets.
- Lokale Ergebnisstatistik mit Export der letzten 200 abgeschlossenen Partien.
- Responsive Oberfläche, Tastaturbedienung, beschriftete Felder, Dialog-Fokusführung und reduzierte Bewegung.
- Schriften und Assets sind lokal gebündelt. Im Spiel sind keine externen Dienste nötig.

## Aufbau

- `src/game/engine.ts`: Suche, Stellungsbewertung und Ergebniserkennung.
- `src/game/engine.worker.ts`: nebenläufige Engine für Computerzüge und Tipps.
- `src/game/storage.ts`: Konfiguration, Datentypen und Wiederherstellung.
- `src/components/Piece.tsx`: skalierbare Figuren mit Struktur und Schattierung.
- `src/App.tsx`: Spielsteuerung, Uhr und Oberfläche.
- `src/styles.css`: responsives Design.

Die Engine ist ein lokaler Spielpartner ohne offizielle Elo-Einstufung. Die Bewertungsleiste ist eine einfache Material- und Positionsbewertung. Remisangebote werden im Computermodus als Übungshilfe akzeptiert. Zeitüberschreitung gegen einen alleinigen König ergibt Remis; weitere seltene tote Stellungen außerhalb der Materialerkennung von `chess.js` werden nicht vollständig bewiesen.

Menschliche Gegner spielen in diesem ersten Wurf gemeinsam an einem Gerät. Online-Räume, Konten und 3D-Darstellung sind noch nicht enthalten. Spielstände und Ergebnisse liegen ausschließlich im jeweiligen Browserprofil; das Löschen der Browserdaten entfernt sie.
