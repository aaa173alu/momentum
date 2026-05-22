# 🔍 Auditoría de Preferencias de Accesibilidad

## Resumen Ejecutivo
✅ **PARCIALMENTE IMPLEMENTADO**. Las preferencias de accesibilidad se guardan y aplican, pero hay **gaps críticos** donde no se respetan:

1. ✅ Reducción de animaciones CSS (funciona para transiciones/keyframes)
2. ❌ Scroll suave (smooth scroll) - NO respeta preferencia
3. ❌ Animaciones requestAnimationFrame - NO están controladas
4. ✅ Énfasis de foco - Funciona correctamente
5. ✅ Modo lectura fácil - Funciona correctamente

---

## 1️⃣ REDUCIR ANIMACIONES (reduceAnimations)

### ✅ Lo que FUNCIONA correctamente

**CSS Global** - `src/styles/global.css` (líneas 68-73):
```css
body.pref-reduce-animations *,
body.pref-reduce-animations *::before,
body.pref-reduce-animations *::after {
  animation-duration: 0.01ms !important;
  animation-iteration-count: 1 !important;
  transition-duration: 0.01ms !important;
  scroll-behavior: auto !important;
}
```

✅ **Transiciones CSS** (62 instancias encontradas):
- Reducidas a 0.01ms en todos los elementos cuando `pref-reduce-animations` está activo
- Ejemplos:
  - `shared-capsule-view.css:115` - `transform 0.35s ease`
  - `notification-bell.css:79` - `opacity 0.15s`
  - `app.css:273` - `opacity 0.3s ease`

✅ **@keyframes CSS** (6 animaciones):
- `notification-bell.css:164` - `nb-slide-up`
- `app.css:333,2512` - `initial-loading-progress`
- `app.css:3948` - `onboarding-fade-out`
- `busqueda.css:230` - `pulse`
- `busqueda.css:253` - `fadeIn`

---

### ⚠️ Transiciones Inline (deberían funcionar con !important)

**CreateCapsuleStep1.tsx** (línea 213):
```tsx
transition: 'transform 0.2s ease'
```
✅ Debería ser controlada por CSS global con `!important`

**CreateCapsuleStep2.tsx** (línea 150):
```tsx
transition: 'max-height 0.3s ease'
```
✅ Debería ser controlada por CSS global con `!important`

---

### ❌ Lo que NO FUNCIONA

#### Scroll Suave (smooth scroll behavior)

**CreateCapsuleStep2.tsx** (líneas 32-36 y 48):
```tsx
window.requestAnimationFrame(() => {
  sharingSectionRef.current?.scrollIntoView({ 
    behavior: 'smooth',  // ❌ NO RESPETA PREFERENCIA
    block: 'start' 
  })
})
```

**Problema**: El CSS global intenta forzar `scroll-behavior: auto !important` pero:
- Se aplica en el `body`
- El `scrollIntoView()` JavaScript ignora esta propiedad cuando se especifica un `behavior` explícito
- La API `scrollIntoView` tiene prioridad sobre CSS

**Impacto**: Los usuarios con preferencia de reducción de animaciones seguirán viendo scroll suave.

---

#### Focus Management (requestAnimationFrame)

**CapsuleInterior.tsx** (líneas 211-216):
```tsx
window.requestAnimationFrame(() => {
  generalCommentInputRef.current?.focus()
  const value = generalCommentInputRef.current?.value || ''
  generalCommentInputRef.current?.setSelectionRange(value.length, value.length)
})
```

**MediaDetailPage.tsx** (líneas 177-182):
```tsx
window.requestAnimationFrame(() => {
  commentInputRef.current?.focus()
  const value = commentInputRef.current?.value || ''
  commentInputRef.current?.setSelectionRange(value.length, value.length)
})
```

**Problema**: 
- El uso de `requestAnimationFrame` aquí es para sincronizar con el navegador
- NO hay animación real, es solo para asegurar timing correcto
- ✅ Podría dejarse así (no es una animación visual)

---

#### Animaciones 3D (requestAnimationFrame)

**Model3DViewer.tsx** (líneas 81-90):
```tsx
let animId: number
const animate = () => {
  animId = requestAnimationFrame(animate)
  controls.update()
  renderer.render(scene, camera)
}
animate()
```

**Problema**:
- Loop de renderizado continuo para la escena 3D
- NO se detiene cuando `reduceAnimations` está activo
- Debería detener el loop de animación cuando la preferencia esté activada

---

## 2️⃣ ÉNFASIS DE FOCO (emphasizeFocus)

### ✅ FUNCIONA CORRECTAMENTE

**CSS Global** - `src/styles/global.css` (líneas 77-80):
```css
body.pref-emphasize-focus :focus-visible {
  outline: 3px solid var(--color-modal-fondo);
  outline-offset: 2px;
}
```

✅ Se aplica correctamente cuando está habilitado:
- Outline más grueso (3px vs normal)
- Color contrastado
- Offset para mejor visibilidad
- Funciona en navegación con Tab y controles interactivos

---

## 3️⃣ MODO LECTURA FÁCIL (easyReadMode)

### ✅ FUNCIONA CORRECTAMENTE

**CSS Global** - `src/styles/global.css` (líneas 82-86):
```css
body.pref-easy-read {
  line-height: 1.72;
  letter-spacing: 0.012em;
  word-spacing: 0.05em;
}
```

✅ Mejora la legibilidad cuando está habilitado:
- Line-height aumentado (1.72 vs 1.5 por defecto)
- Letter-spacing (0.012em)
- Word-spacing (0.05em)
- Se aplica a todo el contenido

---

## 4️⃣ ARQUITECTURA DE IMPLEMENTACIÓN

### ✅ Lo que funciona bien

1. **Almacenamiento en BD**: Las preferencias se guardan en la base de datos
2. **Contexto React**: `PreferencesContext` está disponible
3. **Hook `usePreferences()`**: Disponible para componentes
4. **Aplicación de estilos**: `applyUserPreferences()` en `userPreferences.ts`
5. **Clases CSS**: Se aplican correctamente en el body

### ❌ Lo que falta

1. **No hay consulta de preferencias en componentes con animaciones**:
   - `Model3DViewer.tsx` - No usa `usePreferences()`
   - `CreateCapsuleStep2.tsx` - No usa `usePreferences()`
   - `CapsuleInterior.tsx` - No usa `usePreferences()`
   - `MediaDetailPage.tsx` - No usa `usePreferences()`

2. **Control de animaciones JavaScript**: 
   - No hay lógica para detener/ralentizar animaciones basadas en preferencias
   - `scroll-behavior: auto !important` no anula `scrollIntoView({ behavior: 'smooth' })`

---

## 🛠️ PROBLEMAS IDENTIFICADOS

### Críticos
1. **Scroll suave ignora CSS global** ⚠️ IMPACTO ALTO
   - `CreateCapsuleStep2.tsx`: scrollIntoView con behavior='smooth'
   - El CSS no puede forzar `auto` cuando JS especifica `smooth`

2. **Animación 3D no controlada** ⚠️ IMPACTO MEDIO
   - `Model3DViewer.tsx`: requestAnimationFrame loop continuo
   - Podría ralentizarse o detenerse para usuarios con preferencia

### No Críticos
3. **requestAnimationFrame para focus** ✅ OK
   - Usado solo para timing, no es una animación visual
   - Mantenerlo tal como está

---

## 📊 MATRIZ DE CUMPLIMIENTO

| Característica | Configuración | Implementación | CSS | JavaScript | Verificado |
|---|---|---|---|---|---|
| Reducir animaciones | ✅ UI | ✅ Guardado | ✅ Funciona | ❌ Parcial | ✅ |
| Énfasis de foco | ✅ UI | ✅ Guardado | ✅ Funciona | - | ✅ |
| Modo lectura fácil | ✅ UI | ✅ Guardado | ✅ Funciona | - | ✅ |
| **Scroll suave** | ✅ UI | ✅ Guardado | ⚠️ Limitado | ❌ NO | ❌ |
| **Animaciones 3D** | ✅ UI | ✅ Guardado | N/A | ❌ NO | ❌ |

---

## 🎯 RECOMENDACIONES

### Alta Prioridad
1. **Controlar scroll suave en CreateCapsuleStep2.tsx**
   - Consultar `usePreferences()` antes de usar `behavior: 'smooth'`
   - Si `reduceAnimations` está activo, usar `behavior: 'auto'`

2. **Pausar animación 3D en Model3DViewer.tsx**
   - Consultar `usePreferences()` al montar
   - Si `reduceAnimations` está activo, saltar frames o ralentizar

### Media Prioridad
3. **Agregar data attribute para preferencias**
   - Alternativa: Usar `window.matchMedia('(prefers-reduced-motion)')` como fallback
   - Útil para selectores CSS más complejos

4. **Tests de accesibilidad**
   - Verificar que cambiar preferencia afecta inmediatamente el UI
   - Verificar que scroll suave se desactiva correctamente

---

## 📝 CÓDIGO DE PRUEBA

Para verificar manualmente:

```jsx
// En cualquier componente
import { usePreferences } from '../context/PreferencesContext'

function MyComponent() {
  const { preferences } = usePreferences()
  console.log('reduceAnimations:', preferences.reduceAnimations)
  console.log('emphasizeFocus:', preferences.emphasizeFocus)
  console.log('easyReadMode:', preferences.easyReadMode)
  return null
}
```

---

## 📅 Actualizado
2025-05-11

---

## Apéndice: Ubicación de Archivos Clave

- `frontend/src/pages/SettingsPreferencesPage.tsx` - UI de preferencias
- `frontend/src/context/PreferencesContext.tsx` - Context React
- `frontend/src/services/userPreferences.ts` - Aplicación de estilos
- `frontend/src/styles/global.css` - Reglas CSS global
- `backend/routes/authRoutes.js` - API de guardado
