# F1Racer 🏁

A lightweight browser racing game with keyboard, on-screen, swipe, and optional head-steering controls.

## Run locally

From this folder, start a static server:

```bash
python3 -m http.server 4173
```

Open [http://localhost:4173](http://localhost:4173).

## Controls

- Keyboard: Left/Right arrows or `A` / `D`
- Touch: swipe across the track
- On-screen: circular arrow buttons beside the track
- Head steering: start a race, select **Enable head steering**, allow camera access, and centre your face. The game automatically calibrates after it detects your face.

Camera frames and facial landmarks stay in browser memory. Head steering requires `localhost` during development or an HTTPS deployment.

## Project structure

```text
index.html       Game page
styles.css       Responsive F1-inspired interface
js/              Game, storage, and head-steering logic
vendor/          Self-hosted MediaPipe runtime and face-landmarker model
car.png          Player car sprite
```

## Deploy

This project has no build step. Deploy the folder containing `index.html`, `styles.css`, `js/`, `vendor/`, and `car.png` to any HTTPS static host.

For Vercel, import the repository, choose the **Other** framework preset, and leave both the build command and output directory empty.

## Verify

```bash
npm test
```
