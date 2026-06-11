ARCHIVOS DE RECUPERACION - FINCA EL CARMEN

Copia estos archivos dentro de la raíz de tu proyecto 'elcarmen' respetando las carpetas.

Archivos incluidos:
- src/services/firebase.js
- .gitignore
- .env.example
- firestore.rules
- storage.rules
- vercel.json

IMPORTANTE:
1. No subas .env a GitHub.
2. Sí sube .env.example.
3. Verifica que src/services/firebase.js exista antes de hacer git push.
4. Después de copiar los archivos ejecuta:

npm run build
git add .
git commit -m "Restaurar archivos críticos del proyecto"
git push
