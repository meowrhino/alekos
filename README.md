# akkrazzo di cane

Portfolio de Alekos: cómic, ilustración, animación y música. Un cielo negro donde cada sección y cada proyecto es una estrella dibujada a mano.

**Web estática, sin frameworks y sin build.** Todo el contenido vive en archivos JSON dentro de [`data/`](data/): para cambiar textos, imágenes o añadir proyectos **no hace falta tocar código**, solo editar JSON y subir archivos a [`assets/`](assets/).

---

## Cómo funciona

- **Welcome** (`index.html`): fondo negro, título dibujado a mano en el centro (~60% del ancho × 40% del alto de la ventana) y las cuatro secciones como estrellas colocadas al azar. Algunas flotan a la deriva, otras orbitan y otras están fijas — se configura por estrella en el JSON.
- **Hover sobre una estrella** → aparece su sinopsis (campo `synopsis` del JSON).
- **Cada sección** repite la plantilla del welcome: su título dibujado en el centro y sus proyectos como estrellas.
- **Cada proyecto** pinta solo los bloques que existen en su JSON, en este orden: portada → texto → vídeos → canciones → galería. La misma plantilla sirve para las cuatro secciones.
- **Proyecto con capítulos** → su pantalla es otro cielo: la portada del proyecto ocupa el centro y la pantalla se divide en tantas franjas verticales como capítulos. Cada capítulo aparece en un punto aleatorio dentro de su franja, así la colocación es azarosa pero el orden de lectura se conserva de izquierda a derecha.
- **Botón de volver**: siempre abajo a la izquierda, sube un nivel (capítulo → proyecto → sección → welcome).
- **Estética**: fuente [Darumadrop One](https://fonts.google.com/specimen/Darumadrop+One) y todos los dibujos/textos con `mix-blend-mode: difference`, así se ven en blanco (en negativo) sobre el negro.

Las rutas usan hash (`#/comics/perro-cosmico/capitulo-1`), así que funciona en cualquier hosting estático sin configurar nada.

## Estructura

```
index.html          único html, carga css y js
css/style.css       estilos
js/app.js           lee los JSON y pinta las pantallas
data/
  assets.json       recursos compartidos de la interfaz (título, botón volver)
  welcome.json      las secciones del menú + estrellas decorativas
  comics.json       proyectos de cómic (con capítulos opcionales)
  illustrations.json
  animation.json
  music.json
assets/             todas las imágenes, audio y vídeo
  ui/               título, botón de volver
  icons/            iconos de estrella
  placeholders/     dibujos provisionales (sustituir por los escaneos)
```

## Guía de edición (para Alekos)

Cada recurso del JSON tiene siempre la misma forma:

```json
{ "name": "portada del ep", "src": "assets/music/primer-ep/portada.png" }
```

- `name` es descriptivo (y sirve de texto alternativo de la imagen).
- `src` es la ruta del archivo dentro del repo. Para cambiar un dibujo: sube el archivo nuevo a `assets/` y apunta el `src` ahí (o sustituye el archivo dejando el mismo nombre, sin tocar el JSON).

En `data/assets.json` los recursos compartidos llevan además un `id` (`welcomeTitle`, `backButton`): es la variable con la que el código los encuentra — **no cambiar el `id`**, solo el `src`.

### Añadir un proyecto

Copia uno existente dentro de `projects` en el JSON de su sección y cambia:

```json
{
  "id": "mi-proyecto",            ← sin espacios ni tildes, será parte de la URL
  "name": "mi proyecto",          ← nombre visible bajo la estrella
  "synopsis": "texto del hover",
  "icon": { "name": "icono", "src": "assets/icons/star.svg" },
  "motion": { "type": "drift" }   ← opcional: cómo se mueve su estrella
}
```

y añade los bloques que tenga: `cover`, `text`, `videos`, `tracks`, `chapters`, `gallery`.

### Movimiento de las estrellas (`motion`)

| tipo | qué hace | opciones |
|---|---|---|
| `{ "type": "fixed" }` | quieta | `x`, `y` opcionales (posición en % de pantalla; sin ellos, posición aleatoria) |
| `{ "type": "orbit" }` | gira en círculo | `radius` (tamaño de la órbita, en vmin), `speed` (segundos por vuelta) |
| `{ "type": "drift" }` | flota a la deriva | `amplitude` (cuánto se aleja, en vmin), `speed` (segundos por vaivén) |

### Galerías

```json
"gallery": {
  "layout": "horizontal",        ← "horizontal" (cómic) o "vertical" (ilustración)
  "images": [
    { "name": "página 1", "src": "assets/comics/mi-proyecto/01.png" }
  ]
}
```

### Capítulos (cómics y lo que haga falta)

Un proyecto largo puede llevar `chapters`: entonces su pantalla se convierte en un cielo de capítulos (portada en el centro, capítulos como estrellas ordenadas de izquierda a derecha). Cada capítulo tiene su propio `id`, `name`, `synopsis` (el texto del hover), `cover` y `gallery`, y opcionalmente `icon` y `motion` propios (si no, hereda el icono del proyecto). Ver `perro-cosmico` en [`data/comics.json`](data/comics.json) como ejemplo.

### Música

```json
"tracks": [
  { "name": "canción 1", "src": "assets/music/primer-ep/cancion-1.mp3" }
]
```

Si `src` está vacío se muestra solo el nombre, sin reproductor. Lo mismo con los vídeos de animación: `src` puede ser un `.mp4` propio o un enlace de embed (`https://www.youtube.com/embed/ID` o de Vimeo).

### Los escaneos

Los dibujos de `assets/placeholders/`, `assets/icons/` y `assets/ui/` son provisionales. Al sustituirlos por los escaneos reales, lo ideal es **PNG con fondo transparente** (o el dibujo sobre fondo blanco, que con el `mix-blend-mode: difference` se verá en negativo). Mantener los mismos nombres de archivo evita tocar los JSON.

⚠️ **Cuidado con las comas en los JSON**: cada elemento de una lista se separa con coma, pero el último no lleva. Se puede comprobar que un JSON es válido pegándolo en [jsonlint.com](https://jsonlint.com).

## Desarrollo local

Al usar `fetch()` para los JSON hace falta servir los archivos (no vale abrir `index.html` a pelo):

```bash
python3 -m http.server 8000
# → http://localhost:8000
```

## Publicación

La web está pensada para GitHub Pages (Settings → Pages → rama `main`, carpeta `/`). El dominio definitivo será **akkrazzodicane.com**; cuando esté, se configura en Settings → Pages → Custom domain y se añade un archivo `CNAME`.
