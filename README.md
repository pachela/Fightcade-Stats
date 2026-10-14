# Fightcade Stats

Extensión de Chrome para analizar estadísticas de perfiles públicos de Fightcade.

La extensión analiza el historial visible del perfil y muestra:

- Sets jugados.
- Sets ganados y perdidos.
- Win rate de sets.
- Rounds ganados y perdidos.
- Win rate de rounds.
- Rivales más jugados.
- Estado global contra cada rival.
- Estadísticas por juego.
- Win rate contra cada rango rival.
- Historial completo por fecha.
- Exportación en JSON.
- Exportación en CSV.
- Exportación de una imagen resumen.
- Dashboard en una pestaña independiente.

## Instalación

1. Creá una carpeta llamada:

   ```text
   fightcade-stats
   ```

2. Guardá dentro de la carpeta estos archivos:

   ```text
   manifest.json
   content.js
   styles.css
   service-worker.js
   dashboard.html
   dashboard.js
   dashboard.css
   background.png
   ```

3. Abrí Chrome.

4. Entrá a:

   ```text
   chrome://extensions
   ```

5. Activá **Modo de desarrollador**.

6. Pulsá **Cargar descomprimida**.

7. Seleccioná la carpeta `fightcade-stats`.

8. Abrí un perfil público de Fightcade, por ejemplo:

   ```text
   https://www.fightcade.com/id/pachela12
   ```

9. Pulsá el botón:

   ```text
   Analizar estadísticas
   ```

## Actualizar la extensión

Después de modificar uno o más archivos:

1. Guardá los cambios.
2. Abrí:

   ```text
   chrome://extensions
   ```

3. Pulsá **Recargar** en la extensión.
4. Cerrá la pestaña del perfil de Fightcade.
5. Abrí nuevamente el perfil.
6. Ejecutá un análisis nuevo.

Es importante ejecutar nuevamente el análisis después de actualizar `content.js`, especialmente cuando se agregan nuevos campos como los rangos.

## Archivos principales

### `manifest.json`

Define:

- Los permisos de la extensión.
- Los sitios donde se ejecuta.
- El `service worker`.
- Los archivos del dashboard.
- Los recursos accesibles para la extensión.

### `content.js`

Se ejecuta dentro del perfil de Fightcade y se encarga de:

- Detectar el usuario del perfil.
- Leer las filas del historial.
- Detectar jugadores y marcadores.
- Detectar el rango de cada jugador.
- Recorrer las páginas del historial.
- Calcular las estadísticas.
- Mostrar el botón de análisis.
- Mostrar el popup de estadísticas.
- Exportar datos.
- Abrir el dashboard.

### `styles.css`

Contiene los estilos del botón y del popup que aparecen sobre Fightcade.

### `dashboard.html`

Es la estructura de la pestaña independiente del dashboard.

### `dashboard.js`

Lee las estadísticas guardadas por la extensión y genera:

- Tarjetas resumen.
- Tablas.
- Gráficos.
- Win rate por rango rival.
- Historial por fecha.

### `dashboard.css`

Contiene los estilos visuales del dashboard.

### `service-worker.js`

Se encarga de:

- Abrir el dashboard en una pestaña nueva.
- Descargar imágenes de previews de juegos.
- Cargar el fondo utilizado para la exportación de imágenes.

## Rangos

La extensión detecta el rango a partir de la imagen que utiliza Fightcade:

```html
<img src="/ranks/rank3.png" class="rank">
```

La correspondencia utilizada es:

| Archivo | Rango |
|---|---|
| `rank0.png` | Sin rango |
| `rank1.png` | E |
| `rank2.png` | D |
| `rank3.png` | C |
| `rank4.png` | B |
| `rank5.png` | A |
| `rank6.png` | S |

En cada registro analizado se guardan:

```javascript
{
  playerRank: "C",
  opponentRank: "D"
}
```

El rango del rival se utiliza para calcular:

- Sets jugados contra ese rango.
- Victorias contra ese rango.
- Derrotas contra ese rango.
- Win rate contra ese rango.

## Estadísticas por rango

El dashboard incluye una sección:

```text
Win rate por rango rival
```

La tabla muestra:

| Rango rival | Sets jugados | Victoria | Derrota | Win rate |
|---|---:|---:|---:|---:|
| S | 2 | 1 | 1 | 50.00% |
| A | 8 | 6 | 2 | 75.00% |
| B | 20 | 12 | 8 | 60.00% |
| C | 35 | 22 | 13 | 62.86% |
| D | 14 | 8 | 6 | 57.14% |
| E | 4 | 1 | 3 | 25.00% |
| Sin rango | 10 | 6 | 4 | 60.00% |

También se muestra un gráfico con el win rate de cada rango.

## Interpretación de los sets

La extensión interpreta cada fila del historial como un set.

Por ejemplo:

```text
Pachela12 3 - 2 Lag rimasdepomelo
FT3
```

Se interpreta como:

```text
Sets ganados: 1
Sets perdidos: 0

Rounds ganados: 3
Rounds perdidos: 2
```

Otro ejemplo:

```text
Lag rimasdepomelo 3 - 1 Pachela12
FT3
```

Se interpreta como:

```text
Sets ganados: 0
Sets perdidos: 1

Rounds ganados: 1
Rounds perdidos: 3
```

Si ambos jugadores tienen el mismo marcador, el resultado se considera:

```text
Empate
```

## Rivales más jugados

La sección **Rivales más jugados** agrupa los sets contra cada rival.

El estado mostrado representa el balance global contra ese jugador:

- Más victorias que derrotas: `Victoria`.
- Más derrotas que victorias: `Derrota`.
- Igual cantidad de victorias y derrotas: `Empate`.

Por ejemplo:

```text
Rival: maurogius
Sets jugados: 4
Victorias: 3
Derrotas: 1
Estado: Victoria
```

Aunque el último set individual haya terminado en derrota, el estado global será `Victoria` porque el balance total es `3-1`.

## Historial por fecha

El historial mantiene las siguientes columnas:

```text
Fecha
Juego
Jugador
Resultado
Rival
Estado
```

El campo `Estado` corresponde exclusivamente al resultado de ese set individual:

- `Victoria`
- `Derrota`
- `Empate`

El rango del rival se guarda internamente en los datos, pero no modifica la estructura visual del historial.

## Datos guardados

La extensión utiliza `chrome.storage.local` para guardar temporalmente el último análisis:

```javascript
chrome.storage.local.set({
  fightcadeStatsDashboard: currentStats
});
```

El dashboard lee esos datos cuando se abre en una pestaña nueva.

No es necesario modificar manualmente `chrome.storage`.

Los datos se actualizan automáticamente cuando se ejecuta un nuevo análisis.

## Exportación JSON

El archivo JSON contiene:

- Resumen general.
- Lista de rivales.
- Estadísticas por juego.
- Estadísticas por rango.
- Historial completo.
- Rango del jugador en cada set.
- Rango del rival en cada set.

Ejemplo de un registro:

```json
{
  "date": "8/10/2026, 17:04:09",
  "game": "sfiii3nr1",
  "format": "FT2",
  "leftPlayer": "Pachela12",
  "leftRank": "C",
  "leftScore": 1,
  "rightPlayer": "LPG311",
  "rightRank": "Sin rango",
  "rightScore": 0,
  "player": "Pachela12",
  "opponent": "LPG311",
  "playerRank": "C",
  "opponentRank": "Sin rango",
  "playerScore": 1,
  "opponentScore": 0,
  "isDraw": false,
  "wonSet": true,
  "result": "Victoria"
}
```

## Exportación CSV

El CSV incluye estas columnas:

```text
fecha
juego
formato
jugador
rango_jugador
rounds_jugador
rounds_rival
rival
rango_rival
resultado
duracion
```

El archivo puede abrirse con:

- Microsoft Excel.
- LibreOffice Calc.
- Google Sheets.
- Cualquier editor de texto.

## Botón del dashboard

En el popup, el botón `↗` abre una nueva pestaña con el dashboard completo.

El dashboard muestra:

- Resumen general.
- Gráfico de sets.
- Gráfico de rounds.
- Gráfico de rivales más jugados.
- Gráfico por juego.
- Gráfico de win rate por rango.
- Tabla de rivales.
- Tabla de win rate por rango.
- Tabla de estadísticas por juego.
- Historial por fecha.

## Colores utilizados

### Resultados

| Resultado | Color |
|---|---|
| Victoria | Turquesa |
| Derrota | Rosa |
| Empate | Amarillo |

### Win rate por rango

- Win rate igual o superior al 50%: turquesa.
- Win rate inferior al 50%: rosa.

## Limitaciones

- La extensión depende de la estructura HTML visible de Fightcade.
- Si Fightcade modifica la tabla, los nombres de las clases o los botones de paginación, puede ser necesario actualizar el parser.
- Solo se procesan filas donde se pueden identificar los dos jugadores y ambos marcadores.
- Las filas duplicadas se eliminan utilizando una firma basada en fecha, juego, jugadores y marcador.
- Los rangos se detectan solamente cuando Fightcade incluye una imagen con formato `rankN.png`.
- Los análisis anteriores no contienen rangos si fueron generados con una versión anterior de la extensión.
- Para incorporar rangos en datos anteriores es necesario ejecutar nuevamente el análisis.

## Solución de problemas

### El botón de análisis no aparece

1. Abrí `chrome://extensions`.
2. Verificá que la extensión esté habilitada.
3. Pulsá **Recargar**.
4. Cerrá la pestaña de Fightcade.
5. Abrí nuevamente el perfil.
6. Confirmá que la URL sea:

   ```text
   https://www.fightcade.com/id/usuario
   ```

7. Revisá la sección **Errores** de la extensión.

### El dashboard dice que no hay estadísticas

Ejecutá nuevamente el análisis desde el perfil de Fightcade antes de abrir el dashboard.

### No aparecen rangos

Puede ocurrir si:

- El historial no incluye la imagen de rango.
- La imagen no tiene la clase `rank`.
- Fightcade modificó la ruta de las imágenes.
- El análisis se realizó con una versión anterior.

Después de actualizar la extensión, ejecutá un análisis nuevo.

### El dashboard no se actualiza

1. Recargá la extensión.
2. Cerrá la pestaña anterior del dashboard.
3. Ejecutá un nuevo análisis.
4. Abrí nuevamente el dashboard con el botón `↗`.

## Privacidad

La extensión analiza el historial visible de perfiles públicos de Fightcade.

Los resultados se guardan localmente mediante `chrome.storage.local`.

La extensión no requiere una cuenta propia ni envía las estadísticas a un servidor externo.