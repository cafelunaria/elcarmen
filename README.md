# Finca El Carmen — React + Firebase + Vercel

Proyecto independiente para una web administrable de Finca El Carmen.

## Tecnologías

- React + Vite
- Firebase Auth
- Firestore
- Firebase Storage
- Vercel

## Ejecutar localmente

```bash
npm install
cp .env.example .env
npm run dev
```

Abrir:

```txt
http://localhost:5173
```

## Configurar Firebase

1. Crear proyecto en Firebase Console.
2. Registrar una app web.
3. Copiar la configuración web en `.env`.
4. Activar Authentication con Email/Password.
5. Crear un usuario administrador manualmente.
6. Crear Firestore Database.
7. Crear Storage.
8. Copiar las reglas de `firestore.rules` en Firestore > Rules.
9. Copiar las reglas de `storage.rules` en Storage > Rules.
10. Reiniciar Vite con `npm run dev`.

## Variables `.env`

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

## Documento principal en Firestore

```txt
siteContent/main
```

La primera vez que ingreses al panel admin y guardes cambios, se creará automáticamente este documento.

## Deploy en Vercel

- Build command: `npm run build`
- Output directory: `dist`
- Variables de entorno: las mismas `VITE_FIREBASE_*`
