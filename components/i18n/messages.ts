export type SupportedLanguage = "es" | "en";

export type MessageKey =
  | "nav.home"
  | "nav.deckbuilder"
  | "nav.events"
  | "nav.tournaments"
  | "nav.decks"
  | "nav.admin"
  | "nav.adminTools"
  | "nav.viewAllAdmin"
  | "nav.followUs"
  | "auth.signIn"
  | "auth.signOut"
  | "common.searchPlaceholder"
  | "common.filters"
  | "common.sort"
  | "common.loading"
  | "common.clear"
  | "common.done"
  | "common.showResults"
  | "cardList.cardsFound"
  | "cardList.noResults"
  | "cardList.newsLabel"
  | "cardList.refresh"
  | "proxies.cardsFound"
  | "proxies.loading"
  | "news.deckbuilder.title"
  | "news.deckbuilder.description"
  | "news.deckbuilder.cta"
  | "news.tournaments.title"
  | "news.tournaments.description"
  | "news.tournaments.cta"
  | "news.events.title"
  | "news.events.description"
  | "news.events.cta"
  | "news.proxies.title"
  | "news.proxies.description"
  | "news.proxies.cta"
  | "news.decks.title"
  | "news.decks.description"
  | "news.decks.cta"
  | "sort.title"
  | "sort.subtitle"
  | "sort.clear"
  | "sort.codeAsc"
  | "sort.codeAscDesc"
  | "sort.codeDesc"
  | "sort.codeDescDesc"
  | "sort.nameAsc"
  | "sort.nameAscDesc"
  | "sort.nameDesc"
  | "sort.nameDescDesc"
  | "sort.priceHigh"
  | "sort.priceHighDesc"
  | "sort.priceLow"
  | "sort.priceLowDesc"
  | "sort.mostVariants"
  | "sort.mostVariantsDesc"
  | "sort.lessVariants"
  | "sort.lessVariantsDesc"
  | "view.title"
  | "view.subtitle"
  | "view.images"
  | "view.description"
  | "view.alternates"
  | "view.imagesDesc"
  | "view.descriptionDesc"
  | "view.alternatesDesc"
  | "filters.title"
  | "filters.applied"
  | "filters.codes"
  | "filters.sets"
  | "filters.altArts"
  | "filters.categories"
  | "filters.colors"
  | "filters.rarity"
  | "filters.costs"
  | "filters.power"
  | "filters.effects"
  | "filters.counter"
  | "filters.trigger"
  | "filters.types"
  | "filters.attributes"
  | "filters.region"
  | "filters.noResults"
  | "filters.show"
  | "filters.hide"
  | "filters.clear"
  | "filters.clearHint"
  | "filters.selected"
  | "cardPreview.tapToExpand"
  | "cardPreview.tapToReset"
  | "cardPreview.tapToClose"
  | "cardPreview.viewOnTcg"
  | "cardPreview.rulingsTitle"
  | "cardPreview.rulingsSubtitle"
  | "cardDetails.familyType"
  | "cardDetails.cost"
  | "cardDetails.power"
  | "cardDetails.counter"
  | "cardDetails.colors"
  | "cardDetails.attribute"
  | "cardDetails.effect"
  | "cardDetails.trigger"
  | "deckbuilder.filters"
  | "deckbuilder.sort"
  | "deckbuilder.cardsFound"
  | "deckbuilder.loading"
  | "deckbuilder.selectLeaderTitle"
  | "deckbuilder.selectLeaderSubtitle"
  | "deckbuilder.selectLeaderHint"
  | "deckbuilder.selectLeaderLabel"
  | "deckbuilder.chooseLeaderLabel"
  | "deckbuilder.left"
  | "deckbuilder.total"
  | "deckbuilder.price"
  | "deckbuilder.priceBreakdown"
  | "deckbuilder.cardsWithPrice"
  | "deckbuilder.cardsWithoutPrice"
  | "deckbuilder.averagePerCard"
  | "deckbuilder.statsView"
  | "deckbuilder.statsHide"
  | "deckbuilder.statsTitle"
  | "deckbuilder.completeLabel"
  | "deckbuilder.leftCount"
  | "deckbuilder.chooseLeaderTitle"
  | "deckbuilder.chooseLeaderBody"
  | "deckbuilder.chooseLeaderTip"
  | "deckbuilder.buildDeckTitle"
  | "deckbuilder.buildDeckBody"
  | "deckbuilder.goalText"
  | "deckbuilder.deckNamePlaceholder"
  | "deckbuilder.shopSlugPlaceholder"
  | "deckbuilder.shopUrlPlaceholder"
  | "deckbuilder.shopPublished"
  | "deckbuilder.shopUnpublished"
  | "deckbuilder.clearDeck"
  | "deckbuilder.proxies"
  | "deckbuilder.saveDeck"
  | "deckbuilder.saveDeckShort"
  | "deckbuilder.savingDeck"
  | "deckbuilder.nameDeck"
  | "deckbuilder.completeShopFields"
  | "deckbuilder.noPrice"
  | "deckbuilder.noCardsAdded"
  | "deckbuilder.deckPreview"
  | "deckbuilder.shareText"
  | "deckbuilder.linkCopied"
  | "deckbuilder.noCardsToPrint"
  | "deckbuilder.pdfErrorTitle"
  | "deckbuilder.pdfErrorSubtitle"
  | "deckbuilder.imageTimeout"
  | "deckbuilder.canvasError"
  | "deckbuilder.imageLoadError"
  | "deckbuilder.unknownError"
  | "deckbuilder.textCopied"
  | "deckbuilder.exportedFrom"
  | "deckbuilder.loadingDeck"
  | "deckbuilder.edit"
  | "deckbuilder.printPdfTitle"
  | "deckbuilder.printPdf"
  | "deckbuilder.close"
  | "deckbuilder.generatingPdf"
  | "deckbuilder.preparingImages"
  | "deckbuilder.statsToggleOnLabel"
  | "deckbuilder.statsToggleOffLabel"
  | "deckbuilder.statsAriaOn"
  | "deckbuilder.statsAriaOff"
  | "deckbuilder.noCardsInDeck"
  | "deckbuilder.exportDeckTitle"
  | "deckbuilder.export"
  | "deckbuilder.copied"
  | "deckbuilder.copyText"
  | "deckbuilder.copyUrl"
  | "deckbuilder.share"
  | "deckbuilder.downloadImage"
  | "deckbuilder.unknownRarity"
  | "deckbuilder.nameFallback"
  | "deckbuilder.defaultDeckName"
  | "deckbuilder.forkDeckName"
  | "deckbuilder.deckNotFound"
  | "deckbuilder.shopLoadError"
  | "deckbuilder.shopLoadErrorGeneric"
  | "deckbuilder.shopSelectLeader"
  | "deckbuilder.shopNeedFifty"
  | "deckbuilder.shopSlugInvalid"
  | "deckbuilder.shopUrlInvalid"
  | "deckbuilder.shopUpdateError"
  | "deckbuilder.shopUpdated"
  | "deckbuilder.shopUpdateErrorGeneric"
  | "deckbuilder.shopCreateError"
  | "deckbuilder.shopCreated"
  | "deckbuilder.shopCreateErrorGeneric"
  | "deckbuilder.maxSameCode"
  | "deckbuilder.maxDeckCards"
  | "deckbuilder.maxReached"
  | "deckStats.powerCurve"
  | "deckStats.costCurve"
  | "deckStats.attributeCurve"
  | "deckStats.counterCurve"
  | "deckStats.powerLabel"
  | "deckStats.costLabel"
  | "deckStats.counterLabel"
  | "deckStats.typeLabel"
  | "deckStats.empty"
  | "language.title"
  | "language.subtitle";

export type Messages = Record<MessageKey, string>;

export const messages: Record<SupportedLanguage, Messages> = {
  es: {
    "nav.home": "Inicio",
    "nav.deckbuilder": "Deckbuilder",
    "nav.events": "Eventos",
    "nav.tournaments": "Torneos",
    "nav.decks": "Decks",
    "nav.admin": "Admin",
    "nav.adminTools": "HERRAMIENTAS ADMIN",
    "nav.viewAllAdmin": "Ver todas las opciones admin",
    "nav.followUs": "SIGUENOS",
    "auth.signIn": "Iniciar sesion",
    "auth.signOut": "Cerrar sesion",
    "common.searchPlaceholder": "Buscar...",
    "common.filters": "Filtros",
    "common.sort": "Ordenar",
    "common.loading": "Cargando...",
    "common.clear": "Limpiar",
    "common.done": "Listo",
    "common.showResults": "Ver resultados",
    "cardList.cardsFound": "{count} cartas",
    "cardList.noResults":
      "No hay cartas con esos filtros. Ajusta tu seleccion.",
    "cardList.newsLabel": "Novedades",
    "cardList.refresh": "Actualizar",
    "proxies.cardsFound": "{count} cartas",
    "proxies.loading": "Cargando...",
    "news.deckbuilder.title": "DeckBuilder nuevo",
    "news.deckbuilder.description":
      "Crea decks mas rapido con previews, stats y filtros mobile.",
    "news.deckbuilder.cta": "Ir a DeckBuilder",
    "news.tournaments.title": "Torneos en vivo",
    "news.tournaments.description":
      "Explora eventos oficiales y metas del momento.",
    "news.tournaments.cta": "Ver Torneos",
    "news.events.title": "Eventos y anuncios",
    "news.events.description": "No te pierdas los proximos eventos y noticias.",
    "news.events.cta": "Abrir Eventos",
    "news.proxies.title": "Proxies Builder",
    "news.proxies.description": "Genera proxies PDF en segundos con tu deck.",
    "news.proxies.cta": "Crear Proxies",
    "news.decks.title": "Mis Decks",
    "news.decks.description":
      "Guarda y comparte tus decks desde un solo lugar.",
    "news.decks.cta": "Ver Decks",
    "sort.title": "Ordenar cartas",
    "sort.subtitle": "Elige como ordenar los resultados",
    "sort.clear": "Quitar orden",
    "sort.codeAsc": "Codigo A-Z",
    "sort.codeAscDesc": "Ascendente por codigo",
    "sort.codeDesc": "Codigo Z-A",
    "sort.codeDescDesc": "Descendente por codigo",
    "sort.nameAsc": "Nombre A-Z",
    "sort.nameAscDesc": "Orden alfabetico",
    "sort.nameDesc": "Nombre Z-A",
    "sort.nameDescDesc": "Orden alfabetico inverso",
    "sort.priceHigh": "Precio: mayor a menor",
    "sort.priceHighDesc": "Mas caro primero",
    "sort.priceLow": "Precio: menor a mayor",
    "sort.priceLowDesc": "Mas barato primero",
    "sort.mostVariants": "Mas variantes",
    "sort.mostVariantsDesc": "Con mas variantes primero",
    "sort.lessVariants": "Menos variantes",
    "sort.lessVariantsDesc": "Con menos variantes primero",
    "view.title": "Selecciona vista",
    "view.subtitle": "Elige como mostrar las cartas",
    "view.images": "Imagenes",
    "view.description": "Descripcion",
    "view.alternates": "Alternas",
    "view.imagesDesc": "Solo imagenes",
    "view.descriptionDesc": "Cartas con detalles",
    "view.alternatesDesc": "Mostrar artes alternas",
    "filters.title": "Filtros",
    "filters.applied": "{count} filtros aplicados",
    "filters.codes": "Codigos",
    "filters.sets": "Sets",
    "filters.altArts": "Alt Arts",
    "filters.categories": "Tipo",
    "filters.colors": "Color",
    "filters.rarity": "Rareza",
    "filters.costs": "Coste",
    "filters.power": "Poder",
    "filters.effects": "Efectos",
    "filters.counter": "Counter",
    "filters.trigger": "Trigger",
    "filters.types": "Familia",
    "filters.attributes": "Atributo",
    "filters.region": "Region",
    "filters.noResults": "Sin resultados",
    "filters.show": "Mostrar filtros",
    "filters.hide": "Ocultar filtros",
    "filters.clear": "Limpiar filtros",
    "filters.clearHint": "Quitar todos los filtros activos",
    "filters.selected": "{count} seleccionados",
    "cardPreview.tapToExpand": "Toca para expandir",
    "cardPreview.tapToReset": "Toca para regresar",
    "cardPreview.tapToClose": "Toca para cerrar",
    "cardPreview.viewOnTcg": "Ver en TCGplayer",
    "cardPreview.rulingsTitle": "Reglas oficiales",
    "cardPreview.rulingsSubtitle": "{count} preguntas y respuestas",
    "cardDetails.familyType": "Familia",
    "cardDetails.cost": "Coste",
    "cardDetails.power": "Poder",
    "cardDetails.counter": "Counter",
    "cardDetails.colors": "Colores",
    "cardDetails.attribute": "Atributo",
    "cardDetails.effect": "Efecto",
    "cardDetails.trigger": "Trigger",
    "deckbuilder.filters": "Filtros",
    "deckbuilder.sort": "Ordenar",
    "deckbuilder.cardsFound": "{count} cartas",
    "deckbuilder.loading": "Cargando...",
    "deckbuilder.selectLeaderTitle": "Selecciona tu Lider",
    "deckbuilder.selectLeaderSubtitle": "Toca una carta Lider para empezar",
    "deckbuilder.selectLeaderHint":
      "Usa los filtros para encontrar tu Lider rapido",
    "deckbuilder.selectLeaderLabel": "Selecciona lider",
    "deckbuilder.chooseLeaderLabel": "Elige tu lider",
    "deckbuilder.left": "Restantes",
    "deckbuilder.total": "Total",
    "deckbuilder.price": "Precio",
    "deckbuilder.priceBreakdown": "Desglose de precios",
    "deckbuilder.cardsWithPrice": "Cartas con precio",
    "deckbuilder.cardsWithoutPrice": "Cartas sin precio",
    "deckbuilder.averagePerCard": "Promedio por carta",
    "deckbuilder.statsView": "Ver estadisticas",
    "deckbuilder.statsHide": "Ocultar estadisticas",
    "deckbuilder.statsTitle": "Estad.",
    "deckbuilder.completeLabel": "Completado",
    "deckbuilder.leftCount": "{count} restantes",
    "deckbuilder.chooseLeaderTitle": "Elige tu Lider",
    "deckbuilder.chooseLeaderBody":
      "Selecciona un lider para desbloquear las cartas disponibles a la izquierda.",
    "deckbuilder.chooseLeaderTip": "Tip: puedes filtrar por color o set.",
    "deckbuilder.buildDeckTitle": "Arma tu Deck",
    "deckbuilder.buildDeckBody":
      "Agrega cartas a tu deck desde las opciones disponibles.",
    "deckbuilder.goalText": "Meta: 50 cartas exactas",
    "deckbuilder.deckNamePlaceholder": "Nombre del deck...",
    "deckbuilder.shopSlugPlaceholder": "Slug de la tienda (ej. super-deck)",
    "deckbuilder.shopUrlPlaceholder": "URL de la tienda (https://...)",
    "deckbuilder.shopPublished": "Publicado",
    "deckbuilder.shopUnpublished": "Sin publicar",
    "deckbuilder.clearDeck": "Resetear",
    "deckbuilder.proxies": "Proxies",
    "deckbuilder.saveDeck": "Guardar",
    "deckbuilder.saveDeckShort": "Guardar",
    "deckbuilder.savingDeck": "Guardando Deck...",
    "deckbuilder.nameDeck": "Nombra tu deck",
    "deckbuilder.completeShopFields": "Completa slug y URL de la tienda",
    "deckbuilder.noPrice": "Sin precio",
    "deckbuilder.noCardsAdded": "No hay cartas agregadas",
    "deckbuilder.deckPreview": "Vista previa del deck",
    "deckbuilder.shareText": "Mira mi deck en One Piece Card Game!",
    "deckbuilder.linkCopied": "Link copiado al portapapeles",
    "deckbuilder.noCardsToPrint": "No hay cartas en el deck para imprimir",
    "deckbuilder.pdfErrorTitle": "Error al generar el PDF",
    "deckbuilder.pdfErrorSubtitle": "Por favor, intenta de nuevo",
    "deckbuilder.imageTimeout": "Timeout cargando imagen",
    "deckbuilder.canvasError": "No se pudo obtener el contexto del canvas",
    "deckbuilder.imageLoadError": "Error cargando imagen",
    "deckbuilder.unknownError": "Error desconocido",
    "deckbuilder.textCopied": "Texto copiado al portapapeles",
    "deckbuilder.exportedFrom": "Exportado desde oharatcg.com",
    "deckbuilder.loadingDeck": "Cargando deck...",
    "deckbuilder.edit": "Editar",
    "deckbuilder.printPdfTitle": "Generar PDF de Proxies",
    "deckbuilder.printPdf": "Imprimir PDF",
    "deckbuilder.close": "Cerrar",
    "deckbuilder.generatingPdf": "Generando PDF...",
    "deckbuilder.preparingImages": "Preparando imagenes",
    "deckbuilder.statsToggleOnLabel": "Apagar",
    "deckbuilder.statsToggleOffLabel": "Encender",
    "deckbuilder.statsAriaOn": "Encendido",
    "deckbuilder.statsAriaOff": "Apagado",
    "deckbuilder.noCardsInDeck": "No hay cartas en el deck.",
    "deckbuilder.exportDeckTitle": "Exportar Deck",
    "deckbuilder.export": "Exportar",
    "deckbuilder.copied": "Copiado!",
    "deckbuilder.copyText": "Copiar texto",
    "deckbuilder.copyUrl": "Copiar URL",
    "deckbuilder.share": "Compartir",
    "deckbuilder.downloadImage": "Descargar imagen",
    "deckbuilder.unknownRarity": "Desconocido",
    "deckbuilder.nameFallback": "Nombre",
    "deckbuilder.defaultDeckName": "Mi Deck",
    "deckbuilder.forkDeckName": "Fork de Deck",
    "deckbuilder.deckNotFound": "Deck no encontrado",
    "deckbuilder.shopLoadError": "No se pudo cargar el deck",
    "deckbuilder.shopLoadErrorGeneric": "Error cargando el deck de tienda",
    "deckbuilder.shopSelectLeader": "Selecciona un lider para el deck.",
    "deckbuilder.shopNeedFifty":
      "El deck debe tener 50 cartas (sin contar el lider).",
    "deckbuilder.shopSlugInvalid": "Define un slug valido para la tienda.",
    "deckbuilder.shopUrlInvalid":
      "Ingresa una URL de tienda valida (https://...).",
    "deckbuilder.shopUpdateError": "No se pudo actualizar el deck",
    "deckbuilder.shopUpdated": "Deck actualizado correctamente",
    "deckbuilder.shopUpdateErrorGeneric":
      "Error actualizando el deck de tienda",
    "deckbuilder.shopCreateError": "No se pudo crear el deck de tienda",
    "deckbuilder.shopCreated": "Deck de tienda creado correctamente",
    "deckbuilder.shopCreateErrorGeneric": "Error creando el deck de tienda",
    "deckbuilder.maxSameCode":
      "No puedes agregar mas de 4 cartas del mismo codigo al deck.",
    "deckbuilder.maxDeckCards": "No puedes agregar mas de 50 cartas al deck.",
    "deckbuilder.maxReached": "Maximo {count} cartas alcanzadas.",
    "deckStats.powerCurve": "Curva de poder",
    "deckStats.costCurve": "Curva de coste",
    "deckStats.attributeCurve": "Curva de atributo",
    "deckStats.counterCurve": "Curva de counter",
    "deckStats.powerLabel": "Poder",
    "deckStats.costLabel": "Coste",
    "deckStats.counterLabel": "Counter",
    "deckStats.typeLabel": "Tipo",
    "deckStats.empty": "Agrega cartas para ver stats",
    "language.title": "Idioma",
    "language.subtitle": "Elige tu idioma",
  },
  en: {
    "nav.home": "Home",
    "nav.deckbuilder": "Deckbuilder",
    "nav.events": "Events",
    "nav.tournaments": "Tournaments",
    "nav.decks": "Decks",
    "nav.admin": "Admin",
    "nav.adminTools": "ADMIN TOOLS",
    "nav.viewAllAdmin": "View all admin options",
    "nav.followUs": "FOLLOW US",
    "auth.signIn": "Sign In",
    "auth.signOut": "Sign Out",
    "common.searchPlaceholder": "Search...",
    "common.filters": "Filters",
    "common.sort": "Sort",
    "common.loading": "Loading...",
    "common.clear": "Clear",
    "common.done": "Done",
    "common.showResults": "Show results",
    "cardList.cardsFound": "{count} cards",
    "cardList.noResults":
      "No cards match your filters. Try adjusting the selection.",
    "cardList.newsLabel": "News",
    "cardList.refresh": "Refresh",
    "proxies.cardsFound": "{count} cards",
    "proxies.loading": "Loading...",
    "news.deckbuilder.title": "New DeckBuilder",
    "news.deckbuilder.description":
      "Build decks faster with previews, stats, and mobile filters.",
    "news.deckbuilder.cta": "Go to DeckBuilder",
    "news.tournaments.title": "Live tournaments",
    "news.tournaments.description":
      "Explore official events and the current meta.",
    "news.tournaments.cta": "View Tournaments",
    "news.events.title": "Events & updates",
    "news.events.description": "Stay updated with upcoming events and news.",
    "news.events.cta": "Open Events",
    "news.proxies.title": "Proxies Builder",
    "news.proxies.description":
      "Generate proxy PDFs in seconds with your deck.",
    "news.proxies.cta": "Create Proxies",
    "news.decks.title": "My Decks",
    "news.decks.description": "Save and share your decks in one place.",
    "news.decks.cta": "View Decks",
    "sort.title": "Sort Cards",
    "sort.subtitle": "Choose how to order results",
    "sort.clear": "Clear sorting",
    "sort.codeAsc": "Code A-Z",
    "sort.codeAscDesc": "Ascending by code",
    "sort.codeDesc": "Code Z-A",
    "sort.codeDescDesc": "Descending by code",
    "sort.nameAsc": "Name A-Z",
    "sort.nameAscDesc": "Alphabetical order",
    "sort.nameDesc": "Name Z-A",
    "sort.nameDescDesc": "Reverse alphabetical",
    "sort.priceHigh": "Price: High to Low",
    "sort.priceHighDesc": "Most expensive first",
    "sort.priceLow": "Price: Low to High",
    "sort.priceLowDesc": "Cheapest first",
    "sort.mostVariants": "Most variants",
    "sort.mostVariantsDesc": "Most variants first",
    "sort.lessVariants": "Less variants",
    "sort.lessVariantsDesc": "Least variants first",
    "view.title": "Select View",
    "view.subtitle": "Choose how to display cards",
    "view.images": "Images",
    "view.description": "Description",
    "view.alternates": "Alternates",
    "view.imagesDesc": "Card images only",
    "view.descriptionDesc": "Cards with details",
    "view.alternatesDesc": "Show alternate arts",
    "filters.title": "Filters",
    "filters.applied": "{count} filters applied",
    "filters.codes": "Codes",
    "filters.sets": "Sets",
    "filters.altArts": "Alt Arts",
    "filters.categories": "Type",
    "filters.colors": "Color",
    "filters.rarity": "Rarity",
    "filters.costs": "Cost",
    "filters.power": "Power",
    "filters.effects": "Effects",
    "filters.counter": "Counter",
    "filters.trigger": "Trigger",
    "filters.types": "Family",
    "filters.attributes": "Attribute",
    "filters.region": "Region",
    "filters.noResults": "No results found",
    "filters.show": "Show filters",
    "filters.hide": "Hide filters",
    "filters.clear": "Clear filters",
    "filters.clearHint": "Remove all active filters",
    "filters.selected": "{count} selected",
    "cardPreview.tapToExpand": "Tap to expand",
    "cardPreview.tapToReset": "Tap to reset",
    "cardPreview.tapToClose": "Tap to close",
    "cardPreview.viewOnTcg": "View on TCGplayer",
    "cardPreview.rulingsTitle": "Official rulings",
    "cardPreview.rulingsSubtitle": "{count} Q&A",
    "cardDetails.familyType": "Family type",
    "cardDetails.cost": "Cost",
    "cardDetails.power": "Power",
    "cardDetails.counter": "Counter",
    "cardDetails.colors": "Colors",
    "cardDetails.attribute": "Attribute",
    "cardDetails.effect": "Effect",
    "cardDetails.trigger": "Trigger",
    "deckbuilder.filters": "Filters",
    "deckbuilder.sort": "Sort",
    "deckbuilder.cardsFound": "{count} cards",
    "deckbuilder.loading": "Loading...",
    "deckbuilder.selectLeaderTitle": "Select your Leader",
    "deckbuilder.selectLeaderSubtitle": "Tap a Leader card to start",
    "deckbuilder.selectLeaderHint": "Use filters to find your Leader fast.",
    "deckbuilder.selectLeaderLabel": "Select leader",
    "deckbuilder.chooseLeaderLabel": "Choose your leader",
    "deckbuilder.left": "Left",
    "deckbuilder.total": "Total",
    "deckbuilder.price": "Price",
    "deckbuilder.priceBreakdown": "Price breakdown",
    "deckbuilder.cardsWithPrice": "Cards with price",
    "deckbuilder.cardsWithoutPrice": "Cards without price",
    "deckbuilder.averagePerCard": "Average per card",
    "deckbuilder.statsView": "View statistics",
    "deckbuilder.statsHide": "Hide statistics",
    "deckbuilder.statsTitle": "Stats",
    "deckbuilder.completeLabel": "Complete",
    "deckbuilder.leftCount": "{count} left",
    "deckbuilder.chooseLeaderTitle": "Choose Your Leader",
    "deckbuilder.chooseLeaderBody":
      "Select a leader to unlock available cards on the left.",
    "deckbuilder.chooseLeaderTip": "Tip: filter by color or set.",
    "deckbuilder.buildDeckTitle": "Build Your Deck",
    "deckbuilder.buildDeckBody":
      "Add cards to your deck from the available options.",
    "deckbuilder.goalText": "Goal: exactly 50 cards",
    "deckbuilder.deckNamePlaceholder": "Deck name...",
    "deckbuilder.shopSlugPlaceholder": "Shop slug (ex. super-deck)",
    "deckbuilder.shopUrlPlaceholder": "Shop URL (https://...)",
    "deckbuilder.shopPublished": "Published",
    "deckbuilder.shopUnpublished": "Unpublished",
    "deckbuilder.clearDeck": "Clear Deck",
    "deckbuilder.proxies": "Proxies",
    "deckbuilder.saveDeck": "Save Deck ({count}/50)",
    "deckbuilder.saveDeckShort": "Save Deck",
    "deckbuilder.savingDeck": "Saving Deck...",
    "deckbuilder.nameDeck": "Name your deck",
    "deckbuilder.completeShopFields": "Complete shop slug and URL",
    "deckbuilder.noPrice": "No price",
    "deckbuilder.noCardsAdded": "No cards added",
    "deckbuilder.deckPreview": "Deck preview",
    "deckbuilder.shareText": "Check my deck in One Piece Card Game!",
    "deckbuilder.linkCopied": "Link copied to clipboard",
    "deckbuilder.noCardsToPrint": "No cards in the deck to print",
    "deckbuilder.pdfErrorTitle": "Error generating the PDF",
    "deckbuilder.pdfErrorSubtitle": "Please try again",
    "deckbuilder.imageTimeout": "Image load timeout",
    "deckbuilder.canvasError": "Could not get canvas context",
    "deckbuilder.imageLoadError": "Error loading image",
    "deckbuilder.unknownError": "Unknown error",
    "deckbuilder.textCopied": "Text copied to clipboard",
    "deckbuilder.exportedFrom": "Exported from oharatcg.com",
    "deckbuilder.loadingDeck": "Loading deck...",
    "deckbuilder.edit": "Edit",
    "deckbuilder.printPdfTitle": "Generate Proxies PDF",
    "deckbuilder.printPdf": "Print PDF",
    "deckbuilder.close": "Close",
    "deckbuilder.generatingPdf": "Generating PDF...",
    "deckbuilder.preparingImages": "Preparing images",
    "deckbuilder.statsToggleOnLabel": "Turn off",
    "deckbuilder.statsToggleOffLabel": "Turn on",
    "deckbuilder.statsAriaOn": "On",
    "deckbuilder.statsAriaOff": "Off",
    "deckbuilder.noCardsInDeck": "No cards in the deck.",
    "deckbuilder.exportDeckTitle": "Export Deck",
    "deckbuilder.export": "Export",
    "deckbuilder.copied": "Copied!",
    "deckbuilder.copyText": "Copy text",
    "deckbuilder.copyUrl": "Copy URL",
    "deckbuilder.share": "Share",
    "deckbuilder.downloadImage": "Download image",
    "deckbuilder.unknownRarity": "Unknown",
    "deckbuilder.nameFallback": "Name",
    "deckbuilder.defaultDeckName": "My Deck",
    "deckbuilder.forkDeckName": "Deck Fork",
    "deckbuilder.deckNotFound": "Deck not found",
    "deckbuilder.shopLoadError": "Could not load the deck",
    "deckbuilder.shopLoadErrorGeneric": "Error loading shop deck",
    "deckbuilder.shopSelectLeader": "Select a leader for the deck.",
    "deckbuilder.shopNeedFifty":
      "Deck must have 50 cards (excluding the leader).",
    "deckbuilder.shopSlugInvalid": "Define a valid shop slug.",
    "deckbuilder.shopUrlInvalid": "Enter a valid shop URL (https://...).",
    "deckbuilder.shopUpdateError": "Could not update the deck",
    "deckbuilder.shopUpdated": "Deck updated successfully",
    "deckbuilder.shopUpdateErrorGeneric": "Error updating shop deck",
    "deckbuilder.shopCreateError": "Could not create the shop deck",
    "deckbuilder.shopCreated": "Shop deck created successfully",
    "deckbuilder.shopCreateErrorGeneric": "Error creating shop deck",
    "deckbuilder.maxSameCode":
      "You can't add more than 4 cards of the same code to the deck.",
    "deckbuilder.maxDeckCards": "You can't add more than 50 cards to the deck.",
    "deckbuilder.maxReached": "Max {count} cards reached.",
    "deckStats.powerCurve": "Power Curve",
    "deckStats.costCurve": "Cost Curve",
    "deckStats.attributeCurve": "Attribute Curve",
    "deckStats.counterCurve": "Counter Curve",
    "deckStats.powerLabel": "Power",
    "deckStats.costLabel": "Cost",
    "deckStats.counterLabel": "Counter",
    "deckStats.typeLabel": "Type",
    "deckStats.empty": "Add cards to see stats",
    "language.title": "Language",
    "language.subtitle": "Choose your language",
  },
};
