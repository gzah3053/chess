# Atelier Schach

Ein vollständiges lokales Schachspiel in 3D und 2D mit React, TypeScript und Vite. Three.js und React Three Fiber zeichnen einen echten, frei drehbaren Schachtisch. Die Schachregeln liefert `chess.js`; eine eigene Engine mit iterativer Alpha-Beta-Suche rechnet im Web Worker. Web Audio erzeugt Figurenklänge und optionale Hintergrundmusik direkt auf dem Gerät.

## Starten

Voraussetzung: Node.js 20.19+ oder 22.12+ und npm.

```sh
npm ci
npm run dev -- --port 5174
```

Danach die im Terminal ausgegebene lokale Adresse öffnen. Standardmäßig bindet der Entwicklungsserver nur an `127.0.0.1`.

```sh
npm run build   # TypeScript-Prüfung und Produktionsbuild
npm test        # Tests der Engine, Regeln, Persistenz und 3D-Zuordnung
npm run preview -- --port 4174
```

## Die 3D-Version

- Dreidimensional modellierte Figuren: gedrechselte Körper, Turmzinnen, Pferdeköpfe mit Mähne und Augen, Läufermitra, Damenkrone und Königskreuz.
- Drei Materialien/Sets: warmes Atelier mit Holz und Elfenbeinoptik, metallisches Noir und kantiges Modern. Der Designeditor verändert beide Ansichten.
- Lokal erzeugte Texturen mit 2048 × 2048 Pixeln für Holzmaserung, feine Oberflächenstruktur und Steinadern; physikalische Materialien, Reflexionen und Messingeinlagen.
- Drei Lichtstimmungen: Tageslicht, Abendlicht und Galerie. Echte Schatten mit bis zu 4096 Pixeln, Umgebungsreflexionen und ein Modus mit geringerer Renderauflösung für schwächere Geräte.
- Gewichtete Zuganimationen: schwere Türme, springende Springer, sanft angehobene andere Figuren. Figurenidentitäten bleiben auch bei Rochade, en passant und Umwandlung erhalten.
- Kamera durch Ziehen am leeren Tisch drehen, Mausrad oder Zwei-Finger-Geste zum Zoomen. Draufsicht, Kamera-Reset und Brettdrehung. Figuren klicken oder direkt ziehen; ein ungültiger Zug setzt die Figur zurück.
- Die 2D-Ansicht bleibt jederzeit als tastaturbedienbare Alternative verfügbar. Bei WebGL-Ausfall lässt sich das Spiel in 2D fortsetzen.
- Die 3D-Szene wird separat geladen und zeichnet neue Frames nur bei Änderungen, Animationen und Kamerabewegungen. Die Einstellung für reduzierte Bewegung wird berücksichtigt.

## Klang & Musik

Jede Figur besitzt einen eigenen synthetisierten Klang aus Filzreibung und resonantem Aufsetzen. Der Turm klingt tief und schwer, der Läufer heller; Schlagen ergänzt einen eigenen Impuls. Das Figurenset verändert die Resonanz. Die Stereo-Position folgt der Brettseite.

Unter dem Wellen-Symbol oben oder „Klang & Musik“ unter dem Brett lassen sich Gesamtlautstärke, Effekte und Musik separat regeln. Eine ruhige, originale Klavierfolge mit Raumklang ist optional und standardmäßig ausgeschaltet. „Schweren Turm probehören“ spielt einen Beispielzug.

Audio startet erst nach einer Interaktion, wie es Browser verlangen. Beim Wechsel in einen anderen Browser-Tab pausieren Musik und Klänge. Sämtliche Audiodaten entstehen lokal; es gibt keine Audio-Downloads, Streamingdienste oder externen Assets.

## Schachfunktionen

- Computergegner in vier Stufen, freie Farbwahl; Spiel zu zweit am selben Gerät.
- Legale Zielfelder, Schach- und letzte Zugmarkierung, Brett drehen.
- Rochade, en passant und Auswahl aller vier Umwandlungsfiguren.
- Automatische Erkennung von Matt, Patt, unzureichendem Material, dreifacher Wiederholung und 50-Züge-Regel.
- Unbegrenzte Bedenkzeit oder 3, 5, 10, 15 und 30 Minuten mit optionalem Zeitbonus.
- Pause/Fortsetzen, Rücknahme, Zugtipp, Aufgabe und vereinbartes Remis.
- Zugverlauf mit Stellungsnavigation, geschlagene Figuren und grobe Stellungsbewertung.
- PGN-Import/-Export, automatische Wiederherstellung; nach Neuladen bleiben laufende Partien bis zum Fortsetzen pausiert.
- Designeditor mit vier Brett-Paletten, individuellen Feldfarben und drei Figurensets.
- Lokale Ergebnisstatistik mit Export der letzten 200 abgeschlossenen Partien.
- Responsive Oberfläche, beschriftete 2D-Felder und Dialog-Fokusführung.
- Schriften, Geometrien und Texturen sind lokal gebündelt oder lokal erzeugt. Im Spiel sind keine externen Dienste nötig.

## Aufbau

- `src/game/engine.ts`: Suche, Stellungsbewertung und Ergebniserkennung.
- `src/game/engine.worker.ts`: nebenläufige Engine für Computerzüge und Tipps.
- `src/game/storage.ts`: Konfiguration, Datentypen und Wiederherstellung.
- `src/scene/ChessBoard3D.tsx`: 3D-Szene, Licht, Kamera, Pointerbedienung und Animationen.
- `src/scene/PieceModel.tsx`: modellierte, gemeinsam genutzte Figurengeometrien.
- `src/scene/materials.ts`: hochauflösende prozedurale Texturen und Materialien.
- `src/scene/board.ts`: Feldkoordinaten, Bewegungszeiten und Figurenidentitäten.
- `src/audio/ChessAudio.ts`: Audiofreigabe, Klanggestaltung, Musik und Lautstärkeregelung.
- `src/components/Piece.tsx`: skalierbare SVG-Figuren für die 2D-Ansicht und Oberfläche.
- `src/App.tsx`: Spielsteuerung, Uhr und Oberfläche.
- `src/styles.css`: responsives Design.

Three.js hält die 3D-Darstellung direkt im bestehenden Browserprojekt. Die Spiellogik bleibt von der Darstellung unabhängig, sodass später weitere Modelle, Texturen und Ansichten ergänzt werden können.

Die Engine ist ein lokaler Spielpartner ohne offizielle Elo-Einstufung. Die Bewertungsleiste in 2D ist eine einfache Material- und Positionsbewertung. Remisangebote werden im Computermodus als Übungshilfe akzeptiert. Zeitüberschreitung gegen einen alleinigen König ergibt Remis; weitere seltene tote Stellungen außerhalb der Materialerkennung von `chess.js` werden nicht vollständig bewiesen.

Menschliche Gegner spielen gemeinsam an einem Gerät. Online-Räume und Konten sind noch nicht enthalten. Spielstände und Ergebnisse liegen ausschließlich im jeweiligen Browserprofil; das Löschen der Browserdaten entfernt sie.
