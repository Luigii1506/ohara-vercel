# Motor reutilizable de observacion, cambios y alertas

## Objetivo
Construir un sistema base que permita observar fuentes, detectar cambios, guardar historial, resumir cambios, alertar y mostrar evolucion en el tiempo. Este motor se puede aplicar luego a cualquier dominio (reglas, eventos, precios, documentos, politicas, inventarios, catalogos, convocatorias, drops, releases).

## Principios
- No necesitas una idea de negocio aun; necesitas un motor reutilizable.
- Modela la diferencia entre lo que observas y lo que realmente es.
- Prioriza auditabilidad, reconstruccion y trazabilidad.
- Diseña para fallar: reintentos, idempotencia y alertas.

## Roles asumidos
- **Arquitecto de datos**: define el modelo canonical, trazabilidad y cambios.
- **Ingeniero de scraping**: implementa extractores resilientes y pruebas de contrato.
- **Ingeniero de datos**: orquesta pipelines y asegura consistencia.
- **Product owner tecnico**: define prioridades de observacion y alertas.

## Caja de herramientas

### A) Modelado de datos para scraping
**Idea central:** separar entidad canonical de observacion.

- **Entidad canonical**: tu objeto limpio y estable. Ej: "Carta OP01-001".
- **Observacion**: lo que aparece en una fuente en un momento. Ej: nombre/imagen/precio en un sitio hoy.
- **Fuente**: sitio, region, tipo, con metadatos y reglas.
- **Proveniencia**: origen de los datos, version del scraper y fecha.
- **IDs estables**: identificar lo mismo a traves del tiempo.

**Patron recomendado de tablas (universal):**
- `source`: sitio + region + tipo
- `raw_document`: HTML/JSON/PDF guardado + hash
- `extract_run`: corrida con fecha, version del scraper, stats
- `observation`: datos extraidos "tal cual", con `source_url`, `fetched_at`
- `entity`: objeto limpio, canonico
- `entity_mapping`: como una observacion mapea a una entidad
- `change_log`: diffs e historial

**Beneficios:**
- Depuracion y auditoria
- Versionado y reconstruccion
- Explicabilidad de cambios

### B) Identificacion y deduplicacion (entity resolution)
**Problema:** la misma entidad aparece distinta en cada fuente.

Estrategias:
- **Claves fuertes**: SKU/GTIN/ISBN/ID oficial
- **Claves debiles**: nombre + atributos + imagen + precio
- **Fuzzy matching**: normalizacion, distancia de texto, sinonimos
- **Blocking**: reducir candidatos antes del match

Tecnicas a estudiar:
- Normalizacion: lowercase, remove diacritics, stopwords
- Heuristicas por dominio: "OP01-001" es ID fuerte
- Reglas de merge: que campo gana ante conflicto

### C) Pipelines de datos y orquestacion
Cuando pases de 1 scraper a 50, necesitas esto.

Conceptos:
- Jobs programados (cron / queue)
- Reintentos con backoff
- Dead-letter queue para fallas repetidas
- Idempotencia (correr 2 veces no duplica)
- Observabilidad: logs, metricas, alertas

Herramientas/conceptos:
- Colas: Redis/BullMQ, RabbitMQ
- Workers
- Scheduling
- Exactly-once vs at-least-once (disenar para lo segundo)

### D) Robustez contra cambios del sitio
Este es el problema #1.

Buenas practicas:
- Selectores resilientes
- Preferir JSON embebido si existe
- Snapshots + tests para cambios de DOM
- Schema validation (Zod) para detectar cambios

**Pruebas de contrato (contract tests):**
- "De esta pagina espero campos X"
- Si faltan campos -> alerta

### E) Rendimiento y costos
Esto hace el sistema rentable.

- Caching por URL
- ETags/Last-Modified cuando aplique
- Frecuencia inteligente (no todo cada minuto)
- Priorizacion (watchlist > catalogo completo)
- Compresion y almacenamiento de raws

### F) Legal, etica y operacion
Practicas generales (sin asesoria legal):
- Respetar robots/ToS cuando aplique
- Rate limit
- User-agent honesto
- Preferir APIs oficiales cuando existan
- Si un sitio bloquea scraping:
  - pedir permiso
  - usar feeds/APIs
  - limitar alcance
  - enfocarte en fuentes publicas permitidas

## Especificacion del motor reutilizable

### Flujo general
1) Observa fuentes (scraping o API)
2) Guarda raw_document
3) Ejecuta extract_run
4) Genera observation
5) Resuelve entity + entity_mapping
6) Calcula change_log
7) Dispara alertas
8) Muestra evolucion historica

### Modulos
- **Collector**: fetcher, parser, normalizador
- **Storage**: raws, observaciones, entidades, historial
- **Resolver**: matching y deduplicacion
- **Diff Engine**: compara observacion vs entidad
- **Alerting**: reglas y notificaciones
- **Analytics**: historial y tendencias

### Datos minimos por observacion
- `source_id`
- `source_url`
- `fetched_at`
- `raw_document_id`
- `payload` (tal cual)
- `extraction_version`

### Datos minimos por entidad
- `canonical_id`
- `canonical_name`
- `canonical_attributes`
- `first_seen_at`
- `last_seen_at`

### Datos minimos por change_log
- `entity_id`
- `observation_id`
- `changed_fields`
- `change_type`
- `diff`
- `detected_at`

## Checklist de implementacion
- Definir esquema de datos y tablas
- Crear pipeline de ingest y normalizacion
- Implementar resolucion de entidades
- Agregar diff engine y change_log
- Implementar alertas basicas
- Panel de evolucion historica
- Pruebas de contrato por fuente
- Observabilidad y metricas

## Siguientes decisiones cuando arranque el proyecto
- Elegir primer dominio objetivo (precios, catalogos, documentos, etc.)
- Definir fuentes iniciales (2-3)
- Establecer frecuencia y prioridades
- Definir reglas de alerta
- Medir costo de fetch y almacenamiento

## Notas finales
Si dominas este modelo y lo automatizas, puedes aplicarlo a cualquier vertical sin rehacer todo. Ese es el activo principal del negocio.

## Stack objetivo (Next.js)
- **Frontend/Backend**: Next.js (App Router) como base unica.
- **Auth**: BetterAuth como alternativa a NextAuth (evaluar segun needs).
- **DB**: flexible; elegir segun volumen y queries (Postgres recomendado para historial y diffs).
- **Jobs**: workers + cron (puedes iniciar con Vercel Cron o un worker separado).
- **Storage de raws**: bucket (S3 compatible) si crece el volumen de HTML/JSON.

## Nuevo target: informacion util y accionable (no generica)
Idea: salir de lo generico tipo \"Google ya lo sabe\" y enfocarse en informacion cambiante con impacto directo en negocios. El valor esta en: detectar cambios antes, resumirlos mejor y disparar accion.

### Definicion del target
Un target bueno cumple al menos 3 de estas:
- Cambia con frecuencia (diario/semanal).
- Tiene impacto economico directo (precio, stock, riesgos, oportunidades).
- Es dificil de monitorear manualmente (muchas fuentes o formatos).
- No hay un dashboard unico confiable.
- La gente paga por no perderse esos cambios.

### Modelos posibles (elige 1 para empezar)
1) **Radar de licitaciones/convocatorias**  
   - Valor: negocios pierden oportunidades por no enterarse a tiempo.  
   - Fuentes: portales oficiales, boletines, PDFs.  
   - Insight: nuevas convocatorias, cambios en requisitos, fechas limite.  

2) **Monitor de precios y stock de insumos clave**  
   - Valor: compras inteligentes y ahorro en costos.  
   - Fuentes: proveedores, marketplaces B2B, listas de precios.  
   - Insight: alzas/bajas, quiebres de stock, sustitutos.  

3) **Cambios regulatorios/legales por industria**  
   - Valor: evitar multas y reaccionar antes.  
   - Fuentes: diarios oficiales, reguladores, boletines.  
   - Insight: nuevas normas, cambios de requisito, fechas de aplicacion.  

4) **Alertas de competencia local (negocios fisicos)**  
   - Valor: entender el movimiento del mercado.  
   - Fuentes: aperturas/cierres, cambios de horario, menus, reseñas.  
   - Insight: aperturas en zona, cambios de precios, nuevas promociones.  

5) **Seguimiento de catalogos B2B con cambios de ficha tecnica**  
   - Valor: ventas y soporte tecnico actualizados.  
   - Fuentes: fabricantes y distribuidores.  
   - Insight: specs que cambian, nuevos modelos, fin de vida.  

### Como se convierte en \"insight\"
- **No mostrar datos crudos**: mostrar diferencias y resumen.  
- **Resumen automatico**: \"Cambio de precio promedio +8%\" o \"Se agrego requisito X\".  
- **Impacto estimado**: ahorro, riesgo o oportunidad.  
- **Alertas accionables**: email/WhatsApp/Slack con contexto.  

### Estructura de datos para insights
Agregar capas sobre el modelo base:
- `insight`: resumen del cambio (titulo, severidad, impacto estimado).
- `insight_rule`: reglas que detectan patrones o umbrales.
- `delivery_log`: a quien se envio, canal, estado.

### Ejemplo de insight (plantilla)
- **Titulo**: \"Nuevo requisito en convocatoria X\"\n- **Fuente**: portal Y\n- **Cambio**: \"Se agrego certificacion ISO 9001\"\n- **Impacto**: \"Podrias quedar fuera si no la tienes\"\n- **Accion**: \"Revisar documentos antes del DD/MM\"\n- **Severidad**: Alta\n+
## Criterios para elegir el primer target (practico)
- 2 a 3 fuentes iniciales maximo.
- Facilidad de scraping/API (PDF/HTML con estructura decente).
- Clientes potenciales claros (empresas, pymes, freelancers).
- Cambios frecuentes y dolor real.

## Propuesta inicial (si no hay decision aun)
Elegir uno de estos por velocidad:
- **Licitaciones y convocatorias** (alta urgencia, alto valor).
- **Precios/stock de insumos** (impacto directo, facil de explicar).
