# ✅ Verificar PWA en Producción

## 🔍 Paso 1: Verificar que el Service Worker se Registró

### En Chrome DevTools:
1. Abre tu sitio en producción
2. **F12** (DevTools) → Pestaña **Application**
3. En el menú izquierdo → **Service Workers**
4. Deberías ver:
   ```
   Source: /sw.js
   Status: Activated and is running
   ```

### Si NO aparece:
- ✅ Verifica que el sitio use **HTTPS** (requerido para PWA)
- ✅ Abre la **Console** y busca errores de registro del SW
- ✅ Verifica que `/sw.js` sea accesible: `https://tusitio.com/sw.js`

---

## 📦 Paso 2: Verificar Caché de Imágenes

### Test de Caché:
1. Visita `/card-list`
2. Espera a que carguen las primeras 24 imágenes
3. **Application → Cache Storage**
4. Deberías ver estos cachés:
   - `card-images-cache` (imágenes de Digital Ocean)
   - `card-images-dotgg` (imágenes de dotgg)
   - `card-images-official` (imágenes oficiales)
   - `static-images` (imágenes locales)
   - `google-fonts` (fuentes)

### Test de Hard Refresh:
1. **Ctrl+Shift+R** (hard refresh)
2. Las imágenes deberían cargar **instantáneamente** desde caché
3. En la pestaña **Network**:
   - Filtra por "Img"
   - Verás `(from ServiceWorker)` en la columna Size

---

## ⚡ Paso 3: Verificar Rendimiento

### Lighthouse Audit:
1. **F12** → Pestaña **Lighthouse**
2. Categories: Selecciona "Progressive Web App"
3. Click **"Analyze page load"**
4. Score esperado: **90-100**

### Métricas Clave:
- ✅ **First Load**: 2-4s (primera vez)
- ✅ **Subsequent Loads**: <500ms
- ✅ **Hard Refresh**: <500ms (con caché)

---

## 📲 Paso 4: Verificar Instalabilidad

### Desktop (Chrome):
1. Barra de URL → Ícono de **"Instalar"** (⊕ o computadora)
2. Click para instalar
3. La app se abre en ventana standalone

### Mobile (Chrome Android):
1. Menú (⋮) → **"Agregar a pantalla de inicio"**
2. La app se añade como ícono nativo
3. Al abrir, se ve como app nativa (sin barra de navegador)

---

## 🌐 Paso 5: Verificar Funcionamiento Offline

### Test Offline:
1. **Application → Service Workers** → ☑️ Offline
2. Recarga la página
3. La app debería funcionar completamente:
   - Ver cartas cacheadas
   - Buscar/filtrar funciona
   - Imágenes se muestran desde caché

### O en Network Tab:
1. **Network → Throttling → Offline**
2. Recarga
3. Todo debería funcionar

---

## 🐛 Troubleshooting

### Problema: Service Worker no se registra

**Posibles Causas:**
- ❌ Sitio no usa HTTPS
- ❌ Archivo `/sw.js` no accesible (404)
- ❌ Error en el build

**Solución:**
```bash
# Verificar que el archivo existe en public/
ls -la public/sw.js

# Rebuild
npm run build

# Verificar acceso en producción
curl https://tusitio.com/sw.js
```

### Problema: Caché no funciona

**Solución:**
1. **Application → Clear storage → Clear site data**
2. Recarga con Ctrl+F5
3. Espera 30 segundos para que el SW cachee
4. Prueba hard refresh

### Problema: Actualización no aparece

**Por qué:** El SW actualiza en segundo plano pero no se activa hasta cerrar todas las pestañas

**Solución:**
1. Cierra **TODAS** las pestañas del sitio
2. Reabre
3. Nueva versión se activa

**O Forzar:**
1. **Application → Service Workers → skipWaiting**
2. Recarga

---

## 📊 Comandos Útiles

### Ver Caché en Console:
```javascript
// Ver todos los cachés
caches.keys().then(console.log)

// Ver contenido de un caché
caches.open('card-images-cache').then(cache =>
  cache.keys().then(keys => console.log(keys.length + ' imágenes'))
)

// Limpiar caché específico
caches.delete('card-images-cache')

// Limpiar todo
caches.keys().then(keys =>
  Promise.all(keys.map(key => caches.delete(key)))
)
```

### Verificar Registro del SW:
```javascript
navigator.serviceWorker.getRegistration().then(reg => {
  console.log('SW Status:', reg.active.state)
  console.log('SW URL:', reg.active.scriptURL)
})
```

---

## ✅ Checklist Final

- [ ] Service Worker aparece como "Activated and running"
- [ ] Existe caché "card-images-cache" con imágenes
- [ ] Hard refresh carga imágenes instantáneamente
- [ ] Lighthouse PWA score > 90
- [ ] Ícono "Instalar" aparece en desktop
- [ ] "Agregar a pantalla" funciona en móvil
- [ ] Modo offline funciona correctamente
- [ ] Network tab muestra "(from ServiceWorker)"

---

## 🎯 Resultado Esperado

**Primera Visita:**
- Carga: 2-4s
- Descarga 1,813 cartas → localStorage
- SW cachea primeras 24 imágenes

**Segunda Visita:**
- Carga: <500ms
- Datos desde localStorage
- Imágenes desde Service Worker
- **Todo instantáneo**

**Hard Refresh (Ctrl+Shift+R):**
- Carga: <500ms
- ¡Las imágenes PERSISTEN!
- Service Worker caché sobrevive hard refresh
- **Experiencia como app nativa**

---

Made with ⚡ by Claude Code
