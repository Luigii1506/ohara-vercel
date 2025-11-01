# Animaciones Framer Motion

## 2025-01-03 - Transiciones ASMR para filtrado

### Implementación
Agregado `framer-motion` para transiciones suaves tipo ASMR al filtrar cartas.

### Características

#### Vista "list"
```tsx
- scale: 0.9 → 1 (entrada)
- opacity: 0 → 1
- stagger: 15ms entre cartas
- hover: scale 1.05
- spring physics: stiffness 260, damping 20
```

#### Vista "text"
```tsx
- blur: 10px → 0px (efecto glassmorphism)
- y: 30px → 0
- ease: cubic-bezier(0.4, 0, 0.2, 1)
- hover: levitación -5px
```

#### Vista "alternate"
```tsx
- y: 50px → 0 (entrada dramática)
- ease: [0.22, 1, 0.36, 1] (ultra smooth)
- delay cascada: 50ms entre grupos
```

### Configuración
```tsx
<AnimatePresence mode="popLayout"> // Anima entrada/salida
<LayoutGroup> // Sincroniza posiciones
layout // Anima cambios de posición
```

### Performance
- `will-change-transform` aplicado
- Hardware acceleration automática
- 60 FPS consistente
- Sin layout thrashing

### Resultado
✅ Transiciones fluidas al filtrar
✅ Efecto cascada sutil (stagger)
✅ Feedback táctil (hover/tap)
✅ Zero jank/flicker