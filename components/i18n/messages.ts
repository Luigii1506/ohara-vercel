export type SupportedLanguage = "es" | "en";

export type MessageKey =
  | "nav.home"
  | "nav.deckbuilder"
  | "nav.events"
  | "nav.tournaments"
  | "nav.decks"
  | "nav.collection"
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
  | "cardList.search.placeholderPrefix"
  | "cardList.search.helpButton"
  | "cardList.search.bannerTitle"
  | "cardList.search.bannerDescription"
  | "cardList.search.examplesCta"
  | "cardList.search.chipsTitle"
  | "cardList.search.chipsHide"
  | "cardList.search.chipsShow"
  | "cardList.search.helpTitle"
  | "cardList.search.helpSubtitle"
  | "cardList.search.helpHint"
  | "cardList.search.modalTitle"
  | "cardList.search.modalDescription"
  | "cardList.search.modalDismiss"
  | "cardList.search.close"
  | "cardList.search.example.don.label"
  | "cardList.search.example.don.desc"
  | "cardList.search.example.secret.label"
  | "cardList.search.example.secret.desc"
  | "cardList.search.example.luffyRed.label"
  | "cardList.search.example.luffyRed.desc"
  | "cardList.search.example.namiOp12.label"
  | "cardList.search.example.namiOp12.desc"
  | "cardList.search.example.power3000.label"
  | "cardList.search.example.power3000.desc"
  | "cardList.search.example.cost7.label"
  | "cardList.search.example.cost7.desc"
  | "cardList.search.example.code120.label"
  | "cardList.search.example.code120.desc"
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
  | "announcement.dismiss"
  | "announcement.ctaDefault"
  | "announcement.ctaSecondary"
  | "announcement.badge"
  | "collection.actions.title"
  | "collection.actions.subtitle"
  | "collection.stats.estimatedValue"
  | "collection.stats.totalCards"
  | "collection.stats.uniqueCards"
  | "collection.sort.label"
  | "collection.sort.placeholder"
  | "collection.sort.collectionOrder"
  | "collection.sort.nameAsc"
  | "collection.sort.nameDesc"
  | "collection.sort.costAsc"
  | "collection.sort.costDesc"
  | "collection.sort.rarityAsc"
  | "collection.sort.rarityDesc"
  | "collection.sort.quantityDesc"
  | "collection.sort.quantityAsc"
  | "collection.sort.addedNew"
  | "collection.sort.addedOld"
  | "collection.reorder.disableHint"
  | "collection.viewBinder"
  | "collection.reorder.reordering"
  | "collection.reorder.cards"
  | "collection.reorder.short"
  | "collection.reorder.hint"
  | "collection.login.title"
  | "collection.login.subtitle"
  | "collection.login.button"
  | "collection.login.popupBlocked"
  | "collection.title"
  | "collection.cardsCount"
  | "collection.search.placeholder"
  | "collection.filters"
  | "collection.binder"
  | "collection.empty.title.noResults"
  | "collection.empty.title.noCards"
  | "collection.empty.subtitle.noResults"
  | "collection.empty.subtitle.noCards"
  | "collection.empty.cta"
  | "collection.reorder.slotsMissing"
  | "collection.reorder.pickDestination"
  | "collection.reorder.tapToMove"
  | "collection.reorder.tapToSelect"
  | "collection.reorder.selectToMove"
  | "collection.reorder.selectedCount"
  | "collection.reorder.moveBatch"
  | "collection.reorder.moveToPosition"
  | "collection.reorder.clear"
  | "collection.position"
  | "collection.invalidPosition"
  | "collection.move"
  | "collection.move.cancel"
  | "collection.move.target"
  | "collection.move.short"
  | "collection.positionRange"
  | "collection.selectCardsToMove"
  | "collection.start"
  | "collection.end"
  | "collection.delete"
  | "collection.configure"
  | "collection.drag"
  | "collection.quantityInCollection"
  | "collection.removeFromCollection"
  | "collection.tapToExpand"
  | "collection.tapToClose"
  | "collection.deleteCardTitle"
  | "collection.deleteCardDesc"
  | "collection.deleteCopy"
  | "collection.cancel"
  | "collection.accept"
  | "collection.errors.orderSave"
  | "collection.errors.slotRemove"
  | "collection.errors.collectionLoad"
  | "collection.errors.quantityUpdate"
  | "collection.success.removedFromCollection"
  | "collection.errors.removeCard"
  | "collection.toast.removed"
  | "collection.cardsPerPage"
  | "collection.binder.title"
  | "collection.binder.subtitle"
  | "collection.binder.loginTitle"
  | "collection.binder.loginSubtitle"
  | "collection.binder.loginButton"
  | "collection.binder.emptyTitle"
  | "collection.binder.emptySubtitle"
  | "collection.binder.backToCollection"
  | "collection.binder.back"
  | "collection.binder.cover"
  | "collection.binder.pageOf"
  | "collection.binder.insideCover"
  | "collection.binder.collectionName"
  | "collection.binder.previous"
  | "collection.binder.next"
  | "collection.binder.page"
  | "collection.binder.tapToClose"
  | "collection.binder.collectionLoadError"
  | "collection.binder.share"
  | "collection.binder.shareTitle"
  | "collection.binder.shareText"
  | "collection.binder.shareSelectGrid"
  | "collection.binder.shareCopied"
  | "collection.binder.shareError"
  | "folder.cover"
  | "folder.insideCover"
  | "folder.page"
  | "folder.pages"
  | "folder.of"
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
    "nav.collection": "Colección",
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
    "cardList.search.placeholderPrefix": "Ej:",
    "cardList.search.helpButton": "Ayuda de busqueda",
    "cardList.search.bannerTitle": "Nuevo: busqueda inteligente",
    "cardList.search.bannerDescription":
      "Usa colores, rareza, codigos y mas en una sola busqueda.",
    "cardList.search.examplesCta": "Ver ejemplos",
    "cardList.search.chipsTitle": "Prueba busquedas rapidas",
    "cardList.search.chipsHide": "Ocultar",
    "cardList.search.chipsShow": "Mostrar tips de busqueda",
    "cardList.search.helpTitle": "Busqueda inteligente",
    "cardList.search.helpSubtitle": "Explora combinaciones de busqueda.",
    "cardList.search.helpHint": "Toca un ejemplo para probarlo.",
    "cardList.search.modalTitle": "Busqueda inteligente",
    "cardList.search.modalDescription":
      "Combina color, rareza, codigo y mas en una sola busqueda.",
    "cardList.search.modalDismiss": "No mostrar otra vez",
    "cardList.search.close": "Cerrar",
    "cardList.search.example.don.label": "don",
    "cardList.search.example.don.desc": "Cartas DON!!",
    "cardList.search.example.secret.label": "secreta",
    "cardList.search.example.secret.desc": "Rareza Secret Rare",
    "cardList.search.example.luffyRed.label": "luffy rojo",
    "cardList.search.example.luffyRed.desc": "Nombre + color",
    "cardList.search.example.namiOp12.label": "nami op08",
    "cardList.search.example.namiOp12.desc": "Nombre + set",
    "cardList.search.example.power3000.label": "3000",
    "cardList.search.example.power3000.desc": "Poder",
    "cardList.search.example.cost7.label": "7",
    "cardList.search.example.cost7.desc": "Costo",
    "cardList.search.example.code120.label": "120",
    "cardList.search.example.code120.desc": "Sufijo de codigo",
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
    "collection.actions.title": "Acciones",
    "collection.actions.subtitle": "Resumen y accesos rápidos de tu colección",
    "collection.stats.estimatedValue": "Valor estimado",
    "collection.stats.totalCards": "Cartas totales",
    "collection.stats.uniqueCards": "Únicas",
    "collection.sort.label": "Orden",
    "collection.sort.placeholder": "Ordenar por",
    "collection.sort.collectionOrder": "Orden de colección",
    "collection.sort.nameAsc": "Nombre A-Z",
    "collection.sort.nameDesc": "Nombre Z-A",
    "collection.sort.costAsc": "Coste: menor a mayor",
    "collection.sort.costDesc": "Coste: mayor a menor",
    "collection.sort.rarityAsc": "Rareza: menor a mayor",
    "collection.sort.rarityDesc": "Rareza: mayor a menor",
    "collection.sort.quantityDesc": "Cantidad: mayor a menor",
    "collection.sort.quantityAsc": "Cantidad: menor a mayor",
    "collection.sort.addedNew": "Agregadas: más nuevas",
    "collection.sort.addedOld": "Agregadas: más antiguas",
    "collection.reorder.disableHint":
      "Desactiva el modo reordenar para cambiar el orden.",
    "collection.viewBinder": "Ver carpeta",
    "collection.reorder.reordering": "Reordenando",
    "collection.reorder.cards": "Reordenar cartas",
    "collection.reorder.short": "Reordenar",
    "collection.reorder.hint":
      "Usa el modo ordenar para acomodar tus cartas en el grid.",
    "collection.login.title": "Tu Colección",
    "collection.login.subtitle":
      "Inicia sesión para ver y gestionar tu colección de cartas",
    "collection.login.button": "Iniciar sesión con Google",
    "collection.login.popupBlocked":
      "Activa los pop-ups para iniciar sesión",
    "collection.title": "Mi Colección",
    "collection.cardsCount": "{count} cartas",
    "collection.search.placeholder": "Buscar cartas...",
    "collection.filters": "Filtros",
    "collection.binder": "Carpeta",
    "collection.empty.title.noResults": "No se encontraron cartas",
    "collection.empty.title.noCards": "Tu colección está vacía",
    "collection.empty.subtitle.noResults": "Intenta con otra búsqueda",
    "collection.empty.subtitle.noCards":
      "Empieza a agregar cartas desde el catálogo",
    "collection.empty.cta": "Explorar cartas",
    "collection.reorder.slotsMissing":
      "Falta crear los slots. Corre el backfill para ordenar por copias.",
    "collection.reorder.pickDestination":
      "Elige la carta destino para mover el lote.",
    "collection.reorder.tapToMove": "Toca las cartas que quieras mover.",
    "collection.reorder.tapToSelect":
      "Toca para seleccionar. Mantén presionado para mover.",
    "collection.reorder.selectToMove": "Selecciona cartas para mover.",
    "collection.reorder.selectedCount": "{count} seleccionadas",
    "collection.reorder.moveBatch": "Mover lote",
    "collection.reorder.moveToPosition": "Mover a posición",
    "collection.reorder.clear": "Limpiar",
    "collection.position": "Posición",
    "collection.invalidPosition": "Posición inválida",
    "collection.move": "Mover",
    "collection.move.cancel": "Cancelar mover",
    "collection.move.target": "Destino",
    "collection.move.short": "Mover",
    "collection.positionRange": "Posición válida: 1 - {max}",
    "collection.selectCardsToMove": "Selecciona cartas para mover",
    "collection.start": "Inicio",
    "collection.end": "Final",
    "collection.delete": "Eliminar",
    "collection.configure": "Configura",
    "collection.drag": "Arrastra",
    "collection.quantityInCollection": "Cantidad en colección",
    "collection.removeFromCollection": "Eliminar de la colección",
    "collection.tapToExpand": "Tap para expandir",
    "collection.tapToClose": "Tap para cerrar",
    "collection.deleteCardTitle": "Eliminar carta",
    "collection.deleteCardDesc": "Se eliminará una copia de tu colección.",
    "collection.deleteCopy": "Eliminar copia",
    "collection.cancel": "Cancelar",
    "collection.accept": "Aceptar",
    "collection.errors.orderSave": "Error al guardar el orden",
    "collection.errors.slotRemove": "Error al eliminar la carta",
    "collection.errors.collectionLoad": "Error al cargar la colección",
    "collection.errors.quantityUpdate": "Error al actualizar cantidad",
    "collection.success.removedFromCollection":
      "Carta eliminada de la colección",
    "collection.errors.removeCard": "Error al eliminar carta",
    "collection.toast.removed": "Eliminada",
    "collection.cardsPerPage": "{count} cartas por página",
    "collection.binder.title": "Ver como carpeta",
    "collection.binder.subtitle": "Selecciona el tamaño de la cuadrícula",
    "collection.binder.loginTitle": "Ver Carpeta",
    "collection.binder.loginSubtitle":
      "Inicia sesión para ver tu colección como carpeta",
    "collection.binder.loginButton": "Iniciar sesión con Google",
    "collection.binder.emptyTitle": "Colección vacía",
    "collection.binder.emptySubtitle":
      "Agrega cartas a tu colección para verlas en la carpeta.",
    "collection.binder.backToCollection": "Volver a la colección",
    "collection.binder.back": "Volver",
    "collection.binder.cover": "Cubierta",
    "collection.binder.pageOf": "Página {page} de {total}",
    "collection.binder.insideCover": "Cubierta Interior",
    "collection.binder.collectionName": "Mi Colección",
    "collection.binder.previous": "Anterior",
    "collection.binder.next": "Siguiente",
    "collection.binder.page": "Página",
    "collection.binder.tapToClose": "Tap para cerrar",
    "collection.binder.collectionLoadError": "Error al cargar la colección",
    "collection.binder.share": "Compartir",
    "collection.binder.shareTitle": "Mi colección en Ohara TCG",
    "collection.binder.shareText":
      "Mira mi colección de One Piece TCG en formato carpeta.",
    "collection.binder.shareSelectGrid":
      "Selecciona el tamaño de la cuadrícula para compartir",
    "collection.binder.shareCopied": "Enlace copiado",
    "collection.binder.shareError": "No se pudo compartir el enlace",
    "folder.cover": "Cubierta",
    "folder.insideCover": "Cubierta Interior",
    "folder.page": "Página",
    "folder.pages": "Páginas",
    "folder.of": "de",
    "announcement.dismiss": "Ahora no",
    "announcement.ctaDefault": "Ver novedades",
    "announcement.ctaSecondary": "Entendido",
    "announcement.badge": "Novedad",
    "language.title": "Idioma",
    "language.subtitle": "Elige tu idioma",
  },
  en: {
    "nav.home": "Home",
    "nav.deckbuilder": "Deckbuilder",
    "nav.events": "Events",
    "nav.tournaments": "Tournaments",
    "nav.decks": "Decks",
    "nav.collection": "Collection",
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
    "cardList.search.placeholderPrefix": "Eg:",
    "cardList.search.helpButton": "Search help",
    "cardList.search.bannerTitle": "New: smart search",
    "cardList.search.bannerDescription":
      "Use color, rarity, code, and more in one search.",
    "cardList.search.examplesCta": "See examples",
    "cardList.search.chipsTitle": "Try quick searches",
    "cardList.search.chipsHide": "Hide",
    "cardList.search.chipsShow": "Show search tips",
    "cardList.search.helpTitle": "Smart search",
    "cardList.search.helpSubtitle": "Explore search combinations.",
    "cardList.search.helpHint": "Tap an example to try it.",
    "cardList.search.modalTitle": "Smart search",
    "cardList.search.modalDescription":
      "Combine color, rarity, code, and more in one search.",
    "cardList.search.modalDismiss": "Don't show again",
    "cardList.search.close": "Close",
    "cardList.search.example.don.label": "don",
    "cardList.search.example.don.desc": "DON!! cards",
    "cardList.search.example.secret.label": "secret",
    "cardList.search.example.secret.desc": "Secret Rare rarity",
    "cardList.search.example.luffyRed.label": "luffy red",
    "cardList.search.example.luffyRed.desc": "Name + color",
    "cardList.search.example.namiOp12.label": "nami op08",
    "cardList.search.example.namiOp12.desc": "Name + set",
    "cardList.search.example.power3000.label": "3000",
    "cardList.search.example.power3000.desc": "Power",
    "cardList.search.example.cost7.label": "7",
    "cardList.search.example.cost7.desc": "Cost",
    "cardList.search.example.code120.label": "120",
    "cardList.search.example.code120.desc": "Code suffix",
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
    "collection.actions.title": "Actions",
    "collection.actions.subtitle": "Summary and quick access to your collection",
    "collection.stats.estimatedValue": "Estimated value",
    "collection.stats.totalCards": "Total cards",
    "collection.stats.uniqueCards": "Unique",
    "collection.sort.label": "Sort",
    "collection.sort.placeholder": "Sort by",
    "collection.sort.collectionOrder": "Collection order",
    "collection.sort.nameAsc": "Name A-Z",
    "collection.sort.nameDesc": "Name Z-A",
    "collection.sort.costAsc": "Cost: low to high",
    "collection.sort.costDesc": "Cost: high to low",
    "collection.sort.rarityAsc": "Rarity: low to high",
    "collection.sort.rarityDesc": "Rarity: high to low",
    "collection.sort.quantityDesc": "Quantity: high to low",
    "collection.sort.quantityAsc": "Quantity: low to high",
    "collection.sort.addedNew": "Added: newest",
    "collection.sort.addedOld": "Added: oldest",
    "collection.reorder.disableHint":
      "Disable reorder mode to change the order.",
    "collection.viewBinder": "View binder",
    "collection.reorder.reordering": "Reordering",
    "collection.reorder.cards": "Reorder cards",
    "collection.reorder.short": "Reorder",
    "collection.reorder.hint":
      "Use reorder mode to arrange your cards in the grid.",
    "collection.login.title": "Your Collection",
    "collection.login.subtitle":
      "Sign in to view and manage your card collection",
    "collection.login.button": "Sign in with Google",
    "collection.login.popupBlocked": "Enable pop-ups to sign in",
    "collection.title": "My Collection",
    "collection.cardsCount": "{count} cards",
    "collection.search.placeholder": "Search cards...",
    "collection.filters": "Filters",
    "collection.binder": "Binder",
    "collection.empty.title.noResults": "No cards found",
    "collection.empty.title.noCards": "Your collection is empty",
    "collection.empty.subtitle.noResults": "Try another search",
    "collection.empty.subtitle.noCards": "Start adding cards from the catalog",
    "collection.empty.cta": "Browse cards",
    "collection.reorder.slotsMissing":
      "Slots are missing. Run the backfill to reorder by copies.",
    "collection.reorder.pickDestination":
      "Choose the destination card to move the batch.",
    "collection.reorder.tapToMove": "Tap the cards you want to move.",
    "collection.reorder.tapToSelect": "Tap to select. Press and hold to move.",
    "collection.reorder.selectToMove": "Select cards to move.",
    "collection.reorder.selectedCount": "{count} selected",
    "collection.reorder.moveBatch": "Move batch",
    "collection.reorder.moveToPosition": "Move to position",
    "collection.reorder.clear": "Clear",
    "collection.position": "Position",
    "collection.invalidPosition": "Invalid position",
    "collection.move": "Move",
    "collection.move.cancel": "Cancel move",
    "collection.move.target": "Target",
    "collection.move.short": "Move",
    "collection.positionRange": "Valid position: 1 - {max}",
    "collection.selectCardsToMove": "Select cards to move",
    "collection.start": "Start",
    "collection.end": "End",
    "collection.delete": "Delete",
    "collection.configure": "Set up",
    "collection.drag": "Drag",
    "collection.quantityInCollection": "Quantity in collection",
    "collection.removeFromCollection": "Remove from collection",
    "collection.tapToExpand": "Tap to expand",
    "collection.tapToClose": "Tap to close",
    "collection.deleteCardTitle": "Delete card",
    "collection.deleteCardDesc": "One copy will be removed from your collection.",
    "collection.deleteCopy": "Delete copy",
    "collection.cancel": "Cancel",
    "collection.accept": "Accept",
    "collection.errors.orderSave": "Error saving order",
    "collection.errors.slotRemove": "Error removing card",
    "collection.errors.collectionLoad": "Error loading collection",
    "collection.errors.quantityUpdate": "Error updating quantity",
    "collection.success.removedFromCollection": "Card removed from collection",
    "collection.errors.removeCard": "Error removing card",
    "collection.toast.removed": "Removed",
    "collection.cardsPerPage": "{count} cards per page",
    "collection.binder.title": "View as binder",
    "collection.binder.subtitle": "Select the grid size",
    "collection.binder.loginTitle": "View Binder",
    "collection.binder.loginSubtitle":
      "Sign in to view your collection as a binder",
    "collection.binder.loginButton": "Sign in with Google",
    "collection.binder.emptyTitle": "Empty collection",
    "collection.binder.emptySubtitle":
      "Add cards to your collection to view them in the binder.",
    "collection.binder.backToCollection": "Back to collection",
    "collection.binder.back": "Back",
    "collection.binder.cover": "Cover",
    "collection.binder.pageOf": "Page {page} of {total}",
    "collection.binder.insideCover": "Inside cover",
    "collection.binder.collectionName": "My Collection",
    "collection.binder.previous": "Previous",
    "collection.binder.next": "Next",
    "collection.binder.page": "Page",
    "collection.binder.tapToClose": "Tap to close",
    "collection.binder.collectionLoadError": "Error loading collection",
    "collection.binder.share": "Share",
    "collection.binder.shareTitle": "My collection on Ohara TCG",
    "collection.binder.shareText":
      "Check out my One Piece TCG collection in binder view.",
    "collection.binder.shareSelectGrid":
      "Select a grid size to share",
    "collection.binder.shareCopied": "Link copied",
    "collection.binder.shareError": "Could not share the link",
    "folder.cover": "Cover",
    "folder.insideCover": "Inside cover",
    "folder.page": "Page",
    "folder.pages": "Pages",
    "folder.of": "of",
    "announcement.dismiss": "Not now",
    "announcement.ctaDefault": "See what's new",
    "announcement.ctaSecondary": "Got it",
    "announcement.badge": "Update",
    "language.title": "Language",
    "language.subtitle": "Choose your language",
  },
};
