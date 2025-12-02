# Event Scraper - Documentación

Sistema de scraping automático de eventos de One Piece TCG desde el sitio oficial.

## 📋 Arquitectura

### Modelo de Datos

La solución se basa en una relación simple: **Events → Sets**

```
Event (Torneo, Championship, etc.)
  ├─ EventSet (tabla intermedia)
  └─ Set (Tournament Pack Vol. 5, Booster Pack OP-01, etc.)
       └─ CardSet (tabla intermedia)
            └─ Card (cartas individuales con alternateArt)
```

**¿Por qué no relacionar Events con Cards directamente?**
- Las cartas ya tienen el campo `alternateArt` que indica si son versiones especiales (Winner, Judge, etc.)
- Los Sets agrupan las cartas relacionadas al evento
- Mantiene la estructura de datos existente sin duplicación

### Nuevos Modelos en Prisma

#### Event
```prisma
model Event {
  id              Int           @id @default(autoincrement())
  slug            String        @unique
  title           String
  description     String?
  content         String?
  originalContent String?
  region          EventRegion   @default(GLOBAL)
  status          EventStatus   @default(UPCOMING)
  eventType       EventType     @default(OTHER)
  startDate       DateTime?
  endDate         DateTime?
  location        String?
  sourceUrl       String?
  imageUrl        String?
  createdAt       DateTime?     @default(now())
  updatedAt       DateTime?     @updatedAt
  sets            EventSet[]
}
```

#### Enums
```prisma
enum EventRegion {
  GLOBAL, NA, EU, LA, ASIA, JP
}

enum EventStatus {
  UPCOMING, ONGOING, COMPLETED
}

enum EventType {
  STORE_TOURNAMENT, CHAMPIONSHIP, RELEASE_EVENT, ONLINE, OTHER
}
```

## 🚀 Uso

### 1. Configurar Variables de Entorno

Agrega a tu archivo `.env`:

```bash
# Cron Secret para proteger el endpoint
CRON_SECRET=tu_secret_super_seguro_aqui
```

### 2. Migrar la Base de Datos

```bash
# Crea la migración
npx prisma migrate dev --name add_events_system

# O si prefieres push directo (desarrollo)
npx prisma db push
```

### 3. Ejecutar el Scraper Manualmente

```bash
# Via API (usando curl)
curl -X POST http://localhost:3000/api/cron/scrape-events \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# Via código (crea un script temporal)
# scripts/test-scraper.ts
```

### 4. Configurar Cron Job en Vercel

Agrega a `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/scrape-events",
      "schedule": "0 0 * * 0"
    }
  ]
}
```

Configuraciones de schedule:
- `"0 0 * * 0"` - Cada domingo a medianoche
- `"0 0 * * *"` - Diario a medianoche
- `"0 */12 * * *"` - Cada 12 horas

## 🔍 Cómo Funciona el Scraper

### Detección de Sets

El scraper busca keywords en el contenido del evento:

- `"Tournament Pack"`
- `"Promotion Pack"`
- `"Booster Pack"`
- `"OP-XX"` (códigos de sets)
- `"Standard Battle Pack"`
- etc.

### Matching Inteligente

1. **Búsqueda exacta**: Busca en `Set.title` usando `contains`
2. **Búsqueda flexible**: Extrae códigos (OP-01, ST-05) y busca en `Set.code`
3. **Case-insensitive**: Todas las búsquedas ignoran mayúsculas/minúsculas

Ejemplo:
```
Texto del evento: "Distributed: Tournament Pack Vol. 5"
  ↓
Detecta: "Tournament Pack Vol. 5"
  ↓
Busca en DB: Set.title LIKE '%Tournament Pack Vol. 5%'
  ↓
Match encontrado: Set ID 42 "Tournament Pack Vol. 5"
  ↓
Crea relación: EventSet (eventId, setId: 42)
```

### Generación de Slug

Formato: `{region}-{title-slug}-{url-hash}`

Ejemplo:
- Evento: "NA Store Tournament Vol. 5"
- URL: `https://example.com/events/store-tournament-2024.php`
- Slug: `na-store-tournament-vol-5-store-tournament-2024`

## 📊 Respuesta del API

```json
{
  "success": true,
  "timestamp": "2025-12-01T10:00:00.000Z",
  "duration": "12.45s",
  "stats": {
    "eventsProcessed": 8,
    "setsLinked": 15,
    "errors": 0
  },
  "events": [
    {
      "slug": "na-store-tournament-vol-5-abc123",
      "title": "NA Store Tournament Vol. 5",
      "sets": ["Set ID: 42", "Set ID: 43"]
    }
  ],
  "errors": []
}
```

## 🛠️ Desarrollo y Testing

### Testing Local

Crea un script temporal para probar:

```typescript
// scripts/test-event-scraper.ts
import { scrapeEvents } from '@/lib/services/scraper/eventScraper';

async function test() {
  const result = await scrapeEvents();
  console.log(JSON.stringify(result, null, 2));
}

test();
```

Ejecuta:
```bash
npx ts-node scripts/test-event-scraper.ts
```

### Limitar Eventos Procesados

El scraper por defecto procesa **máximo 10 eventos** para evitar sobrecarga.

Modifica en `eventScraper.ts`:
```typescript
const urlsToProcess = eventUrls.slice(0, 10); // Cambia el límite aquí
```

### Logs

El scraper genera logs detallados:

```
🚀 Starting event scraper...

📋 Fetching events list from: https://...
  Found 25 potential event URLs

🔍 Scraping event: https://...
  Title: NA Store Tournament Vol. 5
  Region: NA
  Type: STORE_TOURNAMENT
  Sets detected: 2

✓ Matched "Tournament Pack Vol. 5" -> Tournament Pack Vol. 5
✅ Saved event: na-store-tournament-vol-5 (2 sets linked)
```

## 🔒 Seguridad

- **Autenticación**: El endpoint requiere `Authorization: Bearer CRON_SECRET`
- **Rate Limiting**: 1 segundo de pausa entre requests al sitio oficial
- **Límite de eventos**: Máximo 10 eventos por ejecución
- **Timeout**: 15 segundos por request HTTP

## 📝 Queries Útiles

### Ver todos los eventos
```typescript
const events = await prisma.event.findMany({
  include: {
    sets: {
      include: {
        set: true
      }
    }
  }
});
```

### Eventos por región
```typescript
const naEvents = await prisma.event.findMany({
  where: {
    region: 'NA',
    status: 'UPCOMING'
  }
});
```

### Sets de un evento
```typescript
const eventSets = await prisma.event.findUnique({
  where: { slug: 'na-store-tournament-vol-5' },
  include: {
    sets: {
      include: {
        set: {
          include: {
            cards: {
              include: {
                card: true
              }
            }
          }
        }
      }
    }
  }
});
```

## 🐛 Troubleshooting

### "No events found to scrape"
- Verifica que el sitio oficial esté accesible
- Revisa el selector CSS en `scrapeEventsList()`

### "No sets matched"
- Verifica que existan Sets en tu DB
- Ajusta las keywords en `SET_KEYWORDS`
- Revisa los logs para ver qué texto se detectó

### "Unauthorized" en Cron
- Verifica que `CRON_SECRET` esté configurado en Vercel
- Asegúrate de usar el header correcto: `Authorization: Bearer SECRET`

## 📚 Próximas Mejoras

- [ ] Soporte para más idiomas (JP, ES)
- [ ] Detección de fechas más robusta
- [ ] Cache de eventos procesados
- [ ] Notificaciones cuando se detecten nuevos eventos
- [ ] Dashboard para visualizar eventos scrapeados
