# Adventure - instalacion como app web

Esta carpeta esta lista para publicarse como PWA en GitHub Pages.

## Correcciones del 16 de octubre de 2026

La eliminación de cuentas ahora borra en una sola operación la cuenta, su saldo
inicial y sus movimientos asociados. La confirmación explica que se eliminan las
transferencias completas y se revierten los pagos de deuda correspondientes.
Las cuentas eliminadas no se reconstruyen al recargar ni se reutiliza su
identificador al crear otra cuenta con el mismo nombre.

También se corrigieron el reinicio financiero, la reversión de pagos de deuda,
la edición de deudas saldadas, la validación de transferencias e importes, el
total de salidas, los límites de fecha y el manejo de errores al guardar.

El mensaje «Guardando cambios…» indica operaciones pendientes. Si falla el
guardado, se revierte el cambio visual y se muestra el error. Los cambios
requieren conexión para que la transacción pueda confirmarse.

Para actualizar una instalación existente, sube la carpeta completa al repositorio
que publica GitHub Pages, espera a que termine el despliegue y vuelve a abrir la
aplicación. Se actualizó la versión de caché del service worker. Si todavía ves
la versión anterior, recarga la página después del despliegue. No necesitas
borrar tus datos del navegador ni reiniciar tus finanzas para instalar la corrección.

## Desarrollo y pruebas

`app.js` ya está compilado y funciona sin instalar dependencias en el servidor.
Si modificas `app.jsx`, `data-model.js` o `cloud-store.js`, debes recompilar:

```powershell
npm ci
npm run build
npm test
npm run test:browser
```

Las pruebas de navegador usan Chrome instalado en Windows. En otra ubicación,
configura `CHROME_PATH`; en otros sistemas puedes instalar Chromium con
`npx playwright install chromium`. Las capturas de prueba se guardan en
`work/browser-tests/` o en `TEST_ARTIFACT_DIR` si se define.

Las pruebas usan datos ficticios y un servicio de Firebase simulado: no acceden
a los registros reales. La configuración y las reglas del proyecto Firebase
deben comprobarse por separado en el entorno publicado.

## Publicar en GitHub Pages

1. Crea un repositorio en GitHub, por ejemplo `adventure`.
2. Sube todos los archivos de esta carpeta a la raiz del repositorio.
3. En GitHub ve a `Settings > Pages`.
4. En `Build and deployment`, elige `Deploy from a branch`.
5. Selecciona la rama `main` y la carpeta `/root`.
6. Guarda y espera a que GitHub genere la URL.

La app quedara en una URL parecida a:

```text
https://tuusuario.github.io/adventure/
```

## Configurar Firebase

Para que el inicio de sesion funcione desde GitHub Pages:

1. Abre Firebase Console.
2. Entra a `Authentication > Settings > Authorized domains`.
3. Agrega:

```text
tuusuario.github.io
```

Si usas un dominio propio, agregalo tambien.

## Instalar en Android

1. Abre la URL de GitHub Pages en Chrome.
2. Toca el menu de tres puntos.
3. Elige `Instalar app` o `Agregar a pantalla principal`.
4. Acepta la instalacion.

Chrome generara la app instalada a partir de esta PWA.

## Instalar en PC

En Chrome o Edge:

1. Abre la URL de GitHub Pages.
2. Pulsa el icono de instalar en la barra de direcciones.
3. Confirma la instalacion.

Tambien puedes entrar al menu del navegador y elegir `Instalar Adventure`.

## Archivos importantes

- `index.html`: entrada principal.
- `app.js`: app compilada lista para navegador.
- `app.jsx`: fuente editable de React.
- `manifest.json`: configuracion de instalacion PWA.
- `sw.js`: service worker para cache y modo app.
- `icon-192.png`, `icon-512.png`, `favicon.ico`: iconos de instalacion.
- `.nojekyll`: evita que GitHub Pages procese los archivos con Jekyll.

## Nota

No necesitas un APK para instalarla en Android si la publicas por HTTPS en GitHub Pages. Android/Chrome la instala como WebAPK/PWA. Para un APK firmado de Play Store haria falta un paso adicional con TWA, Bubblewrap o Capacitor.
