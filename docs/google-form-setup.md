# Setup: Google Form de Reportes de Error

## Cuenta recomendada

Usar la misma cuenta de Gmail con la que se publica la extensión en el Chrome Web Store.  
No es un requisito técnico, pero centraliza todo (reportes, consola de developer, analytics) en un solo lugar.

---

## Campos del formulario

Crear un nuevo Google Form en [forms.google.com](https://forms.google.com) con los siguientes campos **en este orden**:

### Campo 1 — Descripción del problema
- **Tipo:** Párrafo (respuesta larga)
- **Pregunta:** `¿Qué problema encontraste? Describilo con el mayor detalle posible.`
- **Obligatorio:** Sí
- **Nota:** Este es el único campo que el usuario completa manualmente. Los demás se pre-llenan automáticamente.

### Campo 2 — Versión
- **Tipo:** Respuesta corta
- **Pregunta:** `Versión de la extensión`
- **Obligatorio:** No
- **Nota:** Se pre-llena automáticamente con la versión del `manifest.json` (ej. `1.1`).

### Campo 3 — Estado de selectores
- **Tipo:** Respuesta corta
- **Pregunta:** `Estado de los selectores`
- **Obligatorio:** No
- **Nota:** Se pre-llena automáticamente. Ejemplo de valor: `degraded | emptyName: 87% | muestra: 12 | 2026-04-05T09:32:00.000Z`

### Campo 4 — Información de sesión
- **Tipo:** Párrafo (respuesta larga)
- **Pregunta:** `Información de la sesión`
- **Obligatorio:** No
- **Nota:** Se pre-llena automáticamente. Ejemplo de valor: `Estado: completado | Leads: 34`

---

## Configuración recomendada del form

- **Título:** `Reporte de error — Leads Maps`
- **Descripción:** `Gracias por reportar el problema. Los campos técnicos se completaron automáticamente para ayudarnos a diagnosticar el error.`
- **Recopilar dirección de email:** Activar (opcional, para poder responderle al usuario)
- **Notificaciones por email:** Activar en Respuestas → ícono de campana → "Recibir notificaciones de respuestas nuevas"

---

## Cómo obtener los entry IDs (paso crítico)

Los `entry.XXXXXXXXXX` son los identificadores de cada campo en la URL de pre-llenado.  
Sin estos IDs, el código no puede pre-llenar los campos automáticamente.

**Pasos:**

1. Abrir el form en modo edición
2. Hacer click en el menú `⋮` (tres puntos, arriba a la derecha)
3. Seleccionar **"Obtener enlace pre-llenado"**
4. Completar cada campo con un valor de prueba (ej. `TEST`)
5. Hacer click en **"Obtener enlace"**
6. Copiar la URL generada — tendrá este formato:
   ```
   https://docs.google.com/forms/d/e/FORM_ID/viewform?usp=pp_url
     &entry.1111111111=TEST   ← ID del campo 1
     &entry.2222222222=TEST   ← ID del campo 2
     &entry.3333333333=TEST   ← ID del campo 3
     &entry.4444444444=TEST   ← ID del campo 4
   ```

**Nota:** El campo "Descripción del problema" es el que el usuario llena, así que su entry ID NO se usa en el código. Solo se necesitan los IDs de los campos 2, 3 y 4.

---

## Dónde pegar los IDs en el código

Abrir [popup.js](../popup.js) y reemplazar los placeholders en las líneas 25–30:

```javascript
const REPORT_FORM_URL = 'https://docs.google.com/forms/d/e/TU_FORM_ID/viewform';
const REPORT_FIELDS = {
  version:       'entry.XXXXXXXXXX',  // ← entry ID del campo "Versión"
  selectorHealth:'entry.XXXXXXXXXX',  // ← entry ID del campo "Estado de selectores"
  sessionInfo:   'entry.XXXXXXXXXX',  // ← entry ID del campo "Información de sesión"
};
```

El `FORM_ID` está en la URL del form cuando lo editás:  
`https://docs.google.com/forms/d/e/**FORM_ID**/edit`

---

## Verificación final

1. Recargar la extensión en `chrome://extensions`
2. Abrir el popup en una pestaña de Google Maps
3. Hacer click en **"Reportar error"**
4. Verificar que el Google Form se abre en una nueva pestaña con los campos 2, 3 y 4 ya completados
5. Enviar una respuesta de prueba y confirmar que llega por email
