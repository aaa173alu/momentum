# 🧪 GUÍA DE PRUEBA - Preferencias de Accesibilidad

## Verificación Rápida del Cumplimiento

Esta guía proporciona pasos específicos para verificar que cada preferencia de accesibilidad funciona correctamente.

---

## 📝 Requisitos Previos

- [ ] Tener una cuenta de usuario en la aplicación
- [ ] Acceso a la página de Preferencias (SettingsPreferencesPage)
- [ ] Una cápsula con modelo 3D para pruebas (para probar animación 3D)

---

## ✅ Prueba 1: Reducir Animaciones - Scroll Suave

**Objetivo**: Verificar que el scroll suave se desactiva cuando está habilitada la preferencia.

### Pasos:

1. Abre la aplicación y **navega a Crear Cápsula > Paso 2**

2. Abre **Preferencias** (⚙️ > Preferencias)

3. **SIN activar** "Reducir animaciones":
   - Marca la casilla "Compartir con amigos"
   - ✅ **Espera observar**: El panel se desliza **suavemente** hacia arriba (animación visible)
   - Desmarca la casilla

4. **Activando** "Reducir animaciones":
   - Marca la casilla para activar
   - **Guarda**
   - Vuelve a Crear Cápsula > Paso 2
   - Marca la casilla "Compartir con amigos"
   - ✅ **Espera observar**: El panel salta **instantáneamente** sin animación suave

5. **Resultado**:
   - ✅ PASÓ: Scroll suave está presente sin preferencia, ausente con preferencia
   - ❌ FALLÓ: Scroll suave siempre presente o ausente
   - ⚠️ PARCIAL: Comportamiento inconsistente

---

## ✅ Prueba 2: Reducir Animaciones - Modelo 3D

**Objetivo**: Verificar que las animaciones 3D se detienen cuando está habilitada la preferencia.

### Pasos:

1. Crea una cápsula con un **modelo 3D** o accede a una existente

2. **SIN activar** "Reducir animaciones":
   - Abre la vista del modelo 3D
   - ✅ **Espera observar**: El modelo rota/anima **continuamente** (si tiene animaciones)
   - Interactúa: El modelo debería responder fluidamente

3. Abre **Preferencias** (⚙️ > Preferencias)

4. **Activando** "Reducir animaciones":
   - Marca la casilla para activar
   - **Guarda**
   - Vuelve a la vista del modelo 3D
   - ✅ **Espera observar**: El modelo está **estático** (sin rotación continua)
   - El modelo sigue siendo **visible**

5. **Desactivar** "Reducir animaciones":
   - Vuelve a Preferencias
   - Desmarca la casilla
   - **Guarda**
   - Vuelve a la vista del modelo 3D
   - ✅ **Espera observar**: El modelo vuelve a **animar**

6. **Resultado**:
   - ✅ PASÓ: Modelo anima sin preferencia, estático con preferencia
   - ❌ FALLÓ: Modelo siempre estático o siempre animando
   - ⚠️ PARCIAL: Comportamiento inconsistente

---

## ✅ Prueba 3: Reducir Animaciones - Transiciones CSS

**Objetivo**: Verificar que las transiciones CSS se reducen significativamente.

### Pasos:

1. Abre **Preferencias** (⚙️ > Preferencias)

2. **SIN activar** "Reducir animaciones":
   - Observa cualquier elemento interactivo (botón, tarjeta, notificación)
   - Al interactuar (hover, click, open modal)
   - ✅ **Espera observar**: Las transiciones son **suaves** (0.2s, 0.3s, etc.)

3. **Activando** "Reducir animaciones":
   - Marca la casilla para activar
   - **Guarda**
   - Interactúa con elementos
   - ✅ **Espera observar**: Cambios son **casi instantáneos** (muy pocas transiciones visibles)

4. Ejemplos de elementos a probar:
   - Campanas de notificación (fade in)
   - Modales (opacity)
   - Botones (hover states)
   - Tarjetas (transformations)

5. **Resultado**:
   - ✅ PASÓ: Transiciones visibles sin preferencia, instantáneas con preferencia
   - ❌ FALLÓ: Transiciones siempre instantáneas o siempre lentas
   - ⚠️ PARCIAL: Algunas transiciones reducidas, otras no

---

## ✅ Prueba 4: Enfatizar Foco (Focus Emphasis)

**Objetivo**: Verificar que el foco se destaca más cuando está habilitada la preferencia.

### Pasos:

1. Abre **Preferencias** (⚙️ > Preferencias)

2. **SIN activar** "Enfatizar foco":
   - Presiona **Tab** para navegar entre elementos
   - ✅ **Espera observar**: El foco tiene un outline normal (fine)

3. **Activando** "Enfatizar foco":
   - Marca la casilla para activar
   - **Guarda**
   - Presiona **Tab** para navegar
   - ✅ **Espera observar**: El foco tiene un outline **más grueso y visible** (3px)
   - El outline tiene mejor contraste visual

4. Elementos a probar:
   - Botones
   - Campos de entrada (inputs)
   - Enlaces
   - Elementos interactivos
   - Checkboxes/selects

5. **Resultado**:
   - ✅ PASÓ: Outline normal sin preferencia, grueso con preferencia
   - ❌ FALLÓ: Outline siempre igual o no visible
   - ⚠️ PARCIAL: Outline visible pero inconsistente

---

## ✅ Prueba 5: Modo Lectura Fácil (Easy Read Mode)

**Objetivo**: Verificar que el texto se vuelve más legible cuando está habilitado.

### Pasos:

1. Abre **Preferencias** (⚙️ > Preferencias)

2. **SIN activar** "Modo lectura fácil":
   - Observa cualquier página con texto largo
   - ✅ **Espera observar**: Espaciado normal entre líneas y letras

3. **Activando** "Modo lectura fácil":
   - Marca la casilla para activar
   - **Guarda**
   - Navega a una página con mucho texto
   - ✅ **Espera observar**:
     - Line-height más grande (1.72 vs 1.5)
     - Letter-spacing más espaciado
     - Word-spacing aumentado
     - Texto notoriamente **más fácil de leer**

4. Páginas a probar:
   - Descripción de cápsulas
   - Comentarios
   - Cualquier página con contenido textual

5. **Resultado**:
   - ✅ PASÓ: Texto espaciado normalmente sin preferencia, aumentado con preferencia
   - ❌ FALLÓ: Espaciado siempre igual
   - ⚠️ PARCIAL: Cambio mínimo o inconsistente

---

## 📊 Matriz de Verificación Final

Marca cada prueba como completada:

| # | Prueba | Sin Preferencia | Con Preferencia | Estado |
|---|--------|---|---|---|
| 1 | Scroll Suave | Suave ✓ | Instantáneo ✓ | [ ] ✅ |
| 2 | Modelo 3D | Animado ✓ | Estático ✓ | [ ] ✅ |
| 3 | Transiciones CSS | Visibles ✓ | Instantáneas ✓ | [ ] ✅ |
| 4 | Énfasis Foco | Outline fino ✓ | Outline grueso ✓ | [ ] ✅ |
| 5 | Modo Lectura | Espaciado normal ✓ | Espaciado aumentado ✓ | [ ] ✅ |

---

## 🐛 Si algo no funciona

### Scroll Suave no funciona:
1. Verificar consola del navegador (F12 > Console) para errores
2. Verificar que `CreateCapsuleStep2.tsx` tiene import de `usePreferences`
3. Probar en navegador diferente (Chrome, Firefox, Safari)

### Modelo 3D no se detiene:
1. Verificar que `Model3DViewer.tsx` tiene import de `usePreferences`
2. Verificar que la preferencia se guardó correctamente
3. Recargar la página después de cambiar preferencia

### Transiciones no se reducen:
1. Verificar `frontend/src/styles/global.css` tiene la clase `pref-reduce-animations`
2. Abrir DevTools (F12) y verificar que el body tiene la clase CSS correcta
3. Verificar que hay un `!important` en el CSS

### Foco no se destaca:
1. Verificar `frontend/src/styles/global.css` tiene la clase `pref-emphasize-focus`
2. Verificar presionando Tab, no solo hover
3. Comprobar que el outline es visible en el navegador

### Modo lectura no funciona:
1. Verificar `frontend/src/styles/global.css` tiene la clase `pref-easy-read`
2. Verificar que hay contenido textual en la página
3. Comprobar el line-height y letter-spacing en DevTools

---

## 🔍 Verificación en DevTools

Para verificación avanzada, abre Developer Tools (F12):

1. **Pestaña Console**:
   ```javascript
   // Ver preferencias actuales
   const authUser = JSON.parse(sessionStorage.getItem('authUser'))
   console.log(authUser.preferences)
   ```

2. **Pestaña Inspector**:
   ```html
   <!-- Verificar que el body tiene las clases CSS -->
   <body class="pref-reduce-animations pref-emphasize-focus pref-easy-read">
   ```

3. **Pestaña Styles**:
   - Seleccionar un elemento
   - Buscar reglas de `pref-reduce-animations`
   - Verificar que `animation-duration: 0.01ms !important` se aplica

---

## ✨ Resultado General

Una vez completadas todas las pruebas con ✅ en cada sección:

**IMPLEMENTACIÓN EXITOSA**: Todas las preferencias de accesibilidad funcionan correctamente y se respetan consistentemente en toda la aplicación.

---

**Última actualización**: 2025-05-11
