# Finca El Carmen

Proyecto React + Vite + Firebase + Vercel para sitio web administrable de Finca El Carmen.

## Desarrollo local

```bash
npm install
cp .env.example .env
npm run dev
```

Completa `.env` con los datos reales de Firebase. No subas `.env` a GitHub.

## Build

```bash
npm run build
```

## Firebase

Contenido principal:

```text
siteContent/main
```

Imágenes:

```text
Storage/site-images
```

## Reglas

Copia `firestore.rules` y `storage.rules` en Firebase Console.

## Deploy

Vercel debe tener las variables `VITE_FIREBASE_*` configuradas en Production.
