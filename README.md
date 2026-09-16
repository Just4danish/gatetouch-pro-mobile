# gatetouchpro

Expo (React Native) port of the CAME / Özak turnstile corridor showroom. Build a row of GLB turnstiles, configure lanes, and operate them in 3D with React Three Fiber.

## Run

```bash
cd gatetouch_pro
npm install
npx expo start
```

Then open in Expo Go, an Android/iOS emulator, or a dev client. Landscape works best on tablet.

## Stack

- Expo SDK 57 + React Native
- `@react-three/fiber/native` + `@react-three/drei/native` + `expo-gl`
- Zustand + AsyncStorage (library + theme)
- `expo-haptics` for tap feedback

## Notes

- GLB models live in `assets/models/` and are loaded via `require()` (see `MODEL_ASSETS` in `src/model/catalog.ts`).
- Mixamo crowd, canvas thumbnail capture, and Web Audio tones are omitted in v1.
