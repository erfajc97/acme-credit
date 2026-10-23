import type { Messages } from '@acme/ui';

/** es-MX, the default locale (docs/brand.md › Voice): "tú", short sentences, amounts named. */
export const esMX = {
  app: {
    name: 'Acme Credit',
    tagline: 'Una tarjeta de crédito garantizada con tu propio depósito de garantía (colateral).',
  },
  og: {
    lead: 'Tu depósito fija tu límite. Compra, paga y te lo devolvemos al cerrar.',
    imageAlt:
      'Credi, la tarjeta mascota de Acme Credit, saluda junto al lema de la tarjeta garantizada.',
  },
  meta: {
    homeTitle: 'Acme Credit — tarjeta garantizada y cartera',
    homeDescription:
      'Abre una tarjeta de crédito garantizada con un depósito que te devolvemos. Tu depósito fija tu límite y cada compra se queda dentro de él.',
    signInTitle: 'Inicia sesión — Acme Credit',
    signInDescription:
      'Inicia sesión en Acme Credit para ver lo disponible para gastar, hacer un pago y administrar tu tarjeta garantizada y tu depósito.',
    signUpTitle: 'Crea tu cuenta — Acme Credit',
    signUpDescription:
      'Crea tu cuenta de Acme Credit y abre una tarjeta garantizada cuyo límite es igual al depósito de garantía que decidas dejarnos.',
    appTitle: 'Tu cartera — Acme Credit',
    cardTitle: 'Tu tarjeta — Acme Credit',
    storeTitle: 'Tienda — Acme Credit',
    checkoutTitle: 'Pagar — Acme Credit',
    activityTitle: 'Actividad — Acme Credit',
    profileTitle: 'Perfil — Acme Credit',
    privateDescription:
      'Tu cuenta de Acme Credit: saldos, tarjeta, pagos y actividad. Esta página es privada y solo aparece después de iniciar sesión.',
  },
  a11y: {
    notifications: 'Notificaciones',
    skipToContent: 'Saltar al contenido',
    mainNav: 'Principal',
    accountNav: 'Tu cartera',
    tabNav: 'Pestañas de tu cartera',
    opensInNewTab: '(se abre en otra pestaña)',
    cartCount: '{count} en tu carrito',
  },
  prefs: {
    title: 'Preferencias',
    theme: 'Tema',
    light: 'Claro',
    dark: 'Oscuro',
    system: 'Sistema',
    language: 'Idioma',
    spanish: 'Español',
    english: 'English',
    languageSettings: 'Idioma de la app',
  },
  common: {
    pagination: {
      previous: 'Anterior',
      next: 'Siguiente',
      page: 'Página {page}',
      status: 'Página {page} de {total}',
      summary: 'Mostrando {from}–{to} de {total}',
    },
    retry: 'Reintentar',
    retrying: 'Reintentando…',
    done: 'Listo',
    backToAccount: 'Volver a tu cartera',
    close: 'Cerrar',
  },
  nav: {
    signIn: 'Iniciar sesión',
    getStarted: 'Empezar',
    home: 'Inicio',
    card: 'Tarjeta',
    store: 'Tienda',
    activity: 'Actividad',
    profile: 'Perfil',
  },
  landing: {
    eyebrow: 'Tarjeta de crédito garantizada',
    title: 'Una tarjeta de crédito respaldada por tu propio depósito.',
    lead: 'Déjanos un depósito de garantía (colateral) y tu límite de crédito es igual a él. Compra en tu cartera, paga y te lo devolvemos cuando cierres tu cuenta al corriente.',
    ctaPrimary: 'Abrir mi cuenta',
    ctaSecondary: 'Iniciar sesión',
    trustLabel: 'Por qué confiar en Acme Credit',
    trustAmounts: 'Sin letra chiquita: cada monto a la vista',
    trustDeposit: 'Tu depósito sigue siendo tuyo',
    trustFreeze: 'Congela tu tarjeta cuando quieras',
    stepsTitle: 'Cómo funciona',
    steps: {
      depositTitle: 'Deja un depósito de garantía',
      depositBody: 'Elige un monto entre {min} y {max}. Lo guardamos para ti, no se gasta.',
      limitTitle: 'Recibe un límite igual',
      limitBody:
        'Cuando tu banco confirma la transferencia, tu tarjeta se activa con un límite de crédito igual a tu depósito.',
      spendTitle: 'Gasta dentro del límite',
      spendBody:
        'Cada compra se revisa contra lo disponible para gastar. Las que lo superan se rechazan, nunca se cobran.',
      repayTitle: 'Paga lo que debes',
      repayBody: 'Tus pagos regresan lo disponible para gastar en cuanto tu banco los confirma.',
      returnTitle: 'Recupera tu depósito',
      returnBody: 'Cierra la cuenta y te lo devolvemos, después de cubrir lo que aún debas.',
    },
    exampleTitle: 'Todos los montos, lado a lado',
    exampleBody:
      'Tu cartera muestra lo disponible, lo que está en espera y lo que debes — nunca un solo número que esconda retenciones.',
    exampleDeposit: 'Depósito de garantía',
    exampleLimit: 'Límite de crédito',
    exampleHeld: 'En espera',
    exampleOwed: 'Lo que debes',
    exampleAvailable: 'Disponible para gastar',
    storeTitle: 'Una tienda dentro de tu cartera',
    storeBody:
      'Tacos, despensa, tecnología y cosas para tu casa de comercios aliados. Paga con tu tarjeta en un paso y sigue cada pedido de en espera a publicado.',
    closingTitle: 'Listo cuando tú lo estés',
    closingBody: 'Crear tu cuenta toma un minuto. Tú decides el depósito y sigue siendo tuyo.',
    footer: 'Acme Credit es un producto de demostración. No se mueve dinero real.',
  },
  session: {
    checkFailedTitle: 'No pudimos revisar tu sesión',
    checkFailedBody: 'Acme Credit no respondió. Revisa tu conexión e inténtalo de nuevo.',
    redirecting: 'Te llevamos a iniciar sesión…',
    signOut: 'Cerrar sesión',
    signingOut: 'Cerrando sesión…',
    signOutFailed: 'No pudimos cerrar tu sesión. Revisa tu conexión e inténtalo de nuevo.',
    profileLink: 'Tu perfil, {name}',
  },
  auth: {
    asideTitle: 'Construye tu crédito con tu propio depósito',
    fields: {
      email: 'Correo electrónico',
      password: 'Contraseña',
      newPassword: 'Contraseña',
      newPasswordHint: 'Al menos {min} caracteres.',
      fullName: 'Nombre completo',
    },
    signIn: {
      title: 'Inicia sesión',
      intro: 'Qué bueno verte. Inicia sesión para ver tu tarjeta y lo disponible para gastar.',
      submit: 'Iniciar sesión',
      submitting: 'Iniciando sesión…',
      failed: 'No pudimos iniciar tu sesión. Revisa tu conexión e inténtalo de nuevo.',
      noAccount: '¿Eres nuevo en Acme Credit?',
      createAccount: 'Crea una cuenta',
      demo: 'Usar cuenta demo',
      demoHint: 'Llena los datos del cliente demo. Tú presionas Iniciar sesión.',
    },
    signUp: {
      title: 'Crea tu cuenta',
      intro: 'Elegirás tu depósito de garantía después de este paso. Todavía no se cobra nada.',
      submit: 'Crear cuenta',
      submitting: 'Creando tu cuenta…',
      failed: 'No pudimos crear tu cuenta. Revisa tu conexión e inténtalo de nuevo.',
      haveAccount: '¿Ya tienes cuenta?',
      signIn: 'Inicia sesión',
      demo: 'Rellenar con datos de prueba',
      demoName: 'Cliente Demo',
    },
  },
  validation: {
    emailRequired: 'Escribe tu correo.',
    emailInvalid: 'Escribe un correo como nombre@ejemplo.com.',
    emailTooLong: 'Usa un correo de máximo {emailMax} caracteres.',
    passwordRequired: 'Escribe tu contraseña.',
    passwordTooShort: 'Usa al menos {passwordMin} caracteres.',
    passwordTooLong: 'Usa máximo {passwordMax} caracteres.',
    nameRequired: 'Escribe tu nombre completo.',
    nameTooLong: 'Usa máximo {nameMax} caracteres.',
    amountRequired: 'Escribe un monto.',
    amountInvalid: 'Escribe un monto como 250 o 250.75 (dólares y hasta dos decimales).',
    amountTooLarge: 'Ese monto es mayor de lo que permite una sola operación. Escribe uno menor.',
    depositBelowMin: 'El depósito de garantía empieza en {depositMin}. Escribe un monto mayor.',
    depositAboveMax: 'El depósito de garantía llega hasta {depositMax}. Escribe un monto menor.',
    paymentAboveOwed: 'Eso es más de lo que debes. Escribe un monto hasta lo que debes.',
  },
  status: {
    onHold: 'En espera',
    posted: 'Publicado',
    declined: 'Rechazado',
    cancelled: 'Cancelado',
    pending: 'Pendiente',
    confirmed: 'Confirmado',
    failed: 'Fallido',
    released: 'Devuelto',
    applied: 'Aplicado',
    recorded: 'Registrado',
    frozen: 'Congelada',
    active: 'Activa',
    closed: 'Cerrada',
    awaitingDeposit: 'Esperando depósito',
    expired: 'Vencido',
  },
  account: {
    pageTitle: 'Tu cartera',
    greeting: 'Hola, {name}',
    loading: 'Cargando tu cartera',
    loadFailedTitle: 'No pudimos cargar tu cuenta',
    loadFailedBody: 'Acme Credit no respondió. Revisa tu conexión e inténtalo de nuevo.',
    onboarding: {
      title: 'Abre tu tarjeta garantizada',
      body: 'Una tarjeta garantizada funciona como una de crédito, respaldada por un depósito de garantía (colateral) que nos dejas y te lo devolvemos al cerrar la cuenta.',
      step1: 'Abre la cuenta.',
      step2: 'Agrega tu depósito de garantía desde tu banco.',
      step3: 'Gasta hasta tu límite y paga lo que debes.',
      open: 'Abrir mi tarjeta garantizada',
      opening: 'Abriendo tu cuenta…',
    },
    card: {
      numberLabel: 'Tarjeta con terminación {last4}',
      expires: 'Vence',
      summary: 'Tu tarjeta',
      view: 'Ver tarjeta',
    },
    frozenTitle: 'Tu tarjeta está congelada',
    frozenNotice:
      'Las compras nuevas se rechazan hasta que la descongeles. Los pagos siguen funcionando.',
    balances: {
      title: 'Saldos',
      available: 'Disponible para gastar',
      limit: 'Límite de crédito',
      onHold: 'En espera',
      onHoldHint: 'Compras por publicarse',
      owed: 'Lo que debes',
    },
    usage: {
      title: 'Tu límite de crédito',
    },
    meter: {
      label: 'Cómo se usa tu límite de crédito',
      collateral: 'Respaldado por tu depósito de garantía',
    },
    actions: {
      title: 'Acciones rápidas',
      shop: 'Ir a la tienda',
      payment: 'Hacer un pago',
      deposit: 'Agregar al depósito',
      freeze: 'Congelar tarjeta',
      unfreeze: 'Descongelar tarjeta',
      updating: 'Actualizando tu tarjeta…',
    },
    recent: {
      title: 'Pedidos recientes',
      seeAll: 'Ver toda la actividad',
      emptyTitle: 'Todavía no hay pedidos',
      emptyBody: 'Tu primer pedido de la tienda aparece aquí, de en espera a publicado.',
    },
    toast: {
      opened: 'Tu cuenta está abierta. Agrega tu depósito de garantía para activar tu tarjeta.',
      openFailed: 'No pudimos abrir tu cuenta. Revisa tu conexión e inténtalo de nuevo.',
      frozen:
        'Tu tarjeta está congelada. Las compras nuevas se rechazarán hasta que la descongeles.',
      freezeFailed: 'No pudimos congelar tu tarjeta. Revisa tu conexión e inténtalo de nuevo.',
      unfrozen: 'Tu tarjeta está activa otra vez. Las compras hasta lo disponible sí pasan.',
      unfreezeFailed: 'No pudimos descongelar tu tarjeta. Revisa tu conexión e inténtalo de nuevo.',
    },
  },
  card: {
    pageTitle: 'Tu tarjeta',
    loading: 'Cargando tu tarjeta',
    secured: 'Garantizada',
    detailsTitle: 'Datos de la tarjeta',
    holder: 'Titular',
    number: 'Número',
    status: 'Estado',
    settingsTitle: 'Ajustes de la tarjeta',
    freeze: {
      label: 'Congelar tarjeta',
      description:
        'Mientras está congelada, las compras nuevas se rechazan. Tus pagos, tu depósito de garantía y los pedidos en espera no cambian.',
      freezeTitle: '¿Congelar tu tarjeta?',
      freezeBody:
        'Las compras nuevas se rechazarán hasta que la descongeles. Puedes seguir haciendo pagos.',
      freezeConfirm: 'Congelar tarjeta',
      unfreezeTitle: '¿Descongelar tu tarjeta?',
      unfreezeBody: 'Las compras hasta lo disponible para gastar vuelven a pasar.',
      unfreezeConfirm: 'Descongelar tarjeta',
      cancel: 'Cancelar',
    },
    limit: {
      title: 'Sube tu límite',
      body: 'Tu límite de crédito es igual a tu depósito de garantía ({limit}). Agrega al depósito y tu límite sube lo mismo cuando tu banco lo confirme.',
    },
    close: {
      title: 'Cerrar la cuenta',
      body: 'Cierra la cuenta desde tu perfil: te devolvemos tu depósito de garantía después de pagar lo que debas.',
      link: 'Ir a tu perfil',
    },
    noCardTitle: 'Todavía no tienes una tarjeta activa',
    noCardBody:
      'Tu tarjeta aparece aquí cuando se confirme tu depósito de garantía. Empieza desde tu cartera.',
    adminFrozen: {
      title: 'Tu tarjeta fue congelada por Acme Credit',
      body: 'Solo nuestro equipo puede descongelarla. Las compras nuevas se rechazan; tus pagos, tu depósito de garantía y los pedidos en espera no cambian. Escríbenos a soporte para revisarla.',
    },
  },
  deposit: {
    title: 'Agrega tu depósito de garantía',
    intro:
      'Tu depósito de garantía (colateral) fija tu límite de crédito. Sigue siendo tuyo: te lo devolvemos al cerrar la cuenta, después de cubrir lo que debas.',
    addTitle: 'Agrega a tu depósito de garantía',
    addIntro:
      'Un depósito mayor sube tu límite de crédito por el mismo monto cuando tu banco confirma la transferencia.',
    amountLabel: 'Monto del depósito',
    amountHint: 'Entre {min} y {max}.',
    submit: 'Agregar depósito de garantía',
    addSubmit: 'Agregar al depósito',
    roomHint:
      'Puedes agregar hasta {room} más: el máximo de depósito de garantía por tarjeta es {cap}.',
    capReachedTitle: 'Tu depósito llegó al máximo',
    capReachedBody:
      'Tu depósito de garantía ya está en {cap}, el máximo por tarjeta, así que tu límite de crédito no puede subir más.',
    submitting: 'Pidiendo la transferencia…',
    toast: {
      requested: 'Transferencia de {amount} solicitada. Apruébala en Acme Bank para terminar.',
      failed:
        'No pudimos pedir tu depósito. Revisa tu conexión e inténtalo de nuevo; reintentar no te cobra dos veces.',
    },
  },
  payment: {
    title: 'Hacer un pago',
    intro:
      'Paga lo que debes desde tu banco. Lo disponible para gastar sube en cuanto tu banco confirma el pago.',
    amountLabel: 'Monto del pago',
    amountHint: 'Debes {owed}.',
    submit: 'Hacer un pago',
    submitting: 'Pidiendo la transferencia…',
    noDebtTitle: 'No debes nada',
    noDebtBody:
      'Las compras publicadas aparecen aquí como lo que debes. Las que están en espera se pagan cuando se publican.',
    toast: {
      requested: 'Pago de {amount} solicitado. Apruébalo en Acme Bank para terminar.',
      failed:
        'No pudimos pedir tu pago. Revisa tu conexión e inténtalo de nuevo; reintentar no te cobra dos veces.',
    },
  },
  transfer: {
    approve: 'Aprobar en Acme Bank (simulador)',
    waiting: 'Esperando la confirmación de Acme Bank…',
    timedOutTitle: 'Acme Bank todavía no responde',
    timedOutBody:
      'Si ya aprobaste la transferencia de {amount}, revisa otra vez. Si no, apruébala primero.',
    checkAgain: 'Revisar otra vez',
    checking: 'Revisando…',
    loadFailedTitle: 'No pudimos cargar tus transferencias',
    loadFailedBody: 'Acme Credit no respondió. Revisa tu conexión e inténtalo de nuevo.',
    deposit: {
      waitingTitle: 'Aprueba tu depósito de {amount}',
      waitingBody:
        'Abre Acme Bank (simulador) y aprueba la transferencia. Esta página se actualiza sola cuando el banco la confirma.',
      confirmedTitle: 'Depósito de {amount} confirmado',
      confirmedBody: 'Tu límite de crédito ya lo incluye.',
      failedTitle: 'Tu depósito de {amount} no se completó',
      failedBody:
        'Acme Bank no aprobó la transferencia, así que no salió nada de tu cuenta. Puedes intentarlo de nuevo abajo.',
    },
    repayment: {
      waitingTitle: 'Aprueba tu pago de {amount}',
      waitingBody:
        'Abre Acme Bank (simulador) y aprueba la transferencia. Esta página se actualiza sola cuando el banco la confirma.',
      confirmedTitle: 'Pago de {amount} confirmado',
      confirmedBody: 'Lo que debes bajó y lo disponible para gastar subió por el mismo monto.',
      failedTitle: 'Tu pago de {amount} no se completó',
      failedBody:
        'Acme Bank no aprobó la transferencia, así que no salió nada de tu cuenta. Puedes intentarlo de nuevo abajo.',
    },
  },
  close: {
    title: '¿Cerrar tu cuenta?',
    bodyWithDebt:
      'Tu depósito de garantía de {collateral} primero cubre los {applied} que debes. Los {returned} restantes te los devolvemos.',
    bodyNoDebt:
      'No debes nada, así que te devolvemos todo tu depósito de garantía de {collateral}.',
    depositLabel: 'Depósito de garantía',
    appliedLabel: 'Aplicado a lo que debes',
    returnedLabel: 'Te lo devolvemos',
    holdsTitle: 'Tienes {amount} en espera',
    holdsBody:
      'Podemos cerrar la cuenta cuando esas compras se publiquen o se cancelen. Cancélalas en Actividad o inténtalo en unos minutos.',
    confirm: 'Cerrar cuenta',
    cancel: 'Conservar mi cuenta',
    closing: 'Cerrando tu cuenta…',
    toast: {
      closed: 'Tu cuenta está cerrada. Te devolvemos {amount} de tu depósito de garantía.',
      failed: 'No pudimos cerrar tu cuenta. Revisa tu conexión e inténtalo de nuevo.',
    },
  },
  closed: {
    title: 'Tu cuenta está cerrada',
    body: 'Tu tarjeta ya no funciona. Puedes abrir una nueva tarjeta garantizada cuando quieras.',
    deposit: 'Depósito de garantía',
    applied: 'Aplicado a lo que debías',
    returned: 'Te lo devolvimos',
    openNew: 'Abrir una tarjeta nueva',
    loadFailedTitle: 'No pudimos cargar tu liquidación',
    loadFailedBody: 'Acme Credit no respondió. Revisa tu conexión e inténtalo de nuevo.',
  },
  store: {
    pageTitle: 'Tienda',
    pageIntro:
      'Compra en comercios aliados con tu tarjeta. Cada pedido se paga en un solo comercio.',
    loading: 'Cargando la tienda',
    merchantsLabel: 'Comercio',
    categoriesLabel: 'Categoría',
    merchantsPrevious: 'Comercios anteriores',
    merchantsNext: 'Más comercios',
    categoriesPrevious: 'Categorías anteriores',
    categoriesNext: 'Más categorías',
    allCategories: 'Todo',
    allMerchants: 'Todos los comercios',
    category: {
      food: 'Comida',
      groceries: 'Despensa',
      electronics: 'Tecnología',
      home: 'Hogar',
    },
    productsLabel: 'Productos de {merchant}',
    add: 'Agregar',
    addLabel: 'Agregar {product} al carrito',
    quantityLabel: 'Cantidad de {product}',
    decreaseLabel: 'Uno menos de {product}',
    increaseLabel: 'Uno más de {product}',
    removeLabel: 'Quitar {product} del carrito',
    noProductsTitle: 'No hay nada de esta categoría aquí',
    noProductsBody: 'Elige otra categoría u otro comercio.',
    noCardTitle: 'Tu tarjeta todavía no está activa',
    noCardBody:
      'Para comprar necesitas una tarjeta activa. Agrega tu depósito de garantía en tu cartera para activarla.',
    available: 'Disponible para gastar',
    productsTitle: 'Productos',
    pagesLabel: 'Páginas de productos',
    added: 'Agregado: {product}',
    removed: 'Quitado: {product}',
    cart: {
      title: 'Tu carrito',
      fromMerchant: 'De {merchant}',
      emptyTitle: 'Tu carrito está vacío',
      emptyBody: 'Agrega algo de un comercio para empezar un pedido.',
      itemsOne: '1 artículo',
      itemsOther: '{count} artículos',
      total: 'Total',
      checkout: 'Ir a pagar',
      open: 'Ver carrito · {items} · {total}',
      clear: 'Vaciar carrito',
    },
    switch: {
      title: '¿Empezar un carrito nuevo?',
      body: 'Tu carrito de {current} tiene {items}. Cada pedido se paga en un solo comercio, así que para agregar de {next} primero lo vaciamos.',
      confirm: 'Vaciar y cambiar',
      cancel: 'Conservar mi carrito',
    },
  },
  checkout: {
    pageTitle: 'Pagar',
    pageIntro: 'Revisa tu pedido y paga con tu tarjeta.',
    resultIntro: 'La red de la tarjeta respondió. Esto pasó con tu pedido.',
    loading: 'Cargando tu pedido',
    linesTitle: 'Tu pedido',
    editCart: 'Editar carrito',
    lineQuantity: '{quantity} × {unit}',
    summaryTitle: 'Pago',
    payWith: 'Pagas con',
    total: 'Total',
    available: 'Disponible para gastar',
    leftAfter: 'Te queda después de este pedido',
    overLimitTitle: 'Esto es más de lo que tienes disponible',
    overLimitBody:
      'El total de {total} es mayor que tu disponible de {available}. Lo más probable es que la red lo rechace: quita artículos o haz un pago primero.',
    frozenNotice:
      'Tu tarjeta está congelada, así que la red rechazará este pedido. Descongélala primero en tu cartera.',
    confirm: 'Pagar {total}',
    confirming: 'Enviando a la red de tarjetas…',
    emptyTitle: 'Tu carrito está vacío',
    emptyBody: 'Agrega productos de un comercio en la tienda y vuelve para pagar.',
    backToStore: 'Ir a la tienda',
    noCardTitle: 'Tu tarjeta todavía no está activa',
    noCardBody:
      'Para pagar necesitas una tarjeta activa. Agrega tu depósito de garantía en tu cartera para activarla.',
    result: {
      approvedTitle: 'Aprobado: {total} en {merchant}',
      receipt: 'Recibo',
      onHold: 'En espera → se publica en unos segundos',
      onHoldBody:
        'El comercio lo publica en unos segundos. Mientras tanto aparece en espera en Actividad y todavía puedes cancelarlo ahí.',
      newAvailable: 'Disponible para gastar ahora',
      keepShopping: 'Seguir comprando',
      seeActivity: 'Ver actividad',
      declinedTitle: 'Rechazado: {total} en {merchant}',
      nothingCharged: 'No se cobró nada y tu carrito sigue aquí.',
      makePayment: 'Hacer un pago',
      openWallet: 'Ir a tu cartera',
      editCart: 'Editar carrito',
    },
    decline: {
      insufficient_funds:
        'Este pedido de {total} se rechazó: es más que tu disponible de {available}. Haz un pago o quita artículos y vuelve a intentarlo.',
      card_frozen:
        'Este pedido de {total} se rechazó porque tu tarjeta está congelada. Descongélala en tu cartera y vuelve a intentarlo.',
      account_not_active:
        'Este pedido de {total} se rechazó porque tu cuenta no está activa. Revisa su estado en tu cartera.',
      invalid_card:
        'Este pedido de {total} se rechazó: la red no reconoció la tarjeta. Recarga la página y vuelve a intentarlo.',
    },
    toast: {
      failed:
        'La red de tarjetas no respondió. Vuelve a intentarlo; el mismo pedido no se cobra dos veces.',
    },
  },
  activity: {
    pageTitle: 'Actividad',
    pageIntro: 'Tus pedidos y cada movimiento de tu cuenta, del más reciente al más antiguo.',
    loading: 'Cargando tu actividad',
    listTitle: 'Movimientos',
    emptyTitle: 'Todavía no hay actividad',
    emptyBody:
      'Tu depósito de garantía, tus pedidos y tus pagos aparecen aquí con su estado en cuanto empieces.',
    loadFailedTitle: 'No pudimos cargar tu actividad',
    loadFailedBody: 'Acme Credit no respondió. Revisa tu conexión e inténtalo de nuevo.',
    pagesLabel: 'Páginas de movimientos',
    type: {
      deposit: 'Depósito de garantía',
      purchase: 'Compra',
      repayment: 'Pago',
      collateral_applied: 'Depósito aplicado a lo que debías',
      collateral_released: 'Depósito devuelto',
    },
    orders: {
      title: 'Pedidos',
      summary: '{merchant} · {items}',
      viewDetail: 'Ver detalle',
      pagesLabel: 'Páginas de pedidos',
      emptyTitle: 'Todavía no hay pedidos',
      emptyBody: 'Los pedidos de la tienda aparecen aquí, de en espera a publicado.',
      loadFailedTitle: 'No pudimos cargar tus pedidos',
      loadFailedBody: 'Acme Credit no respondió. Revisa tu conexión e inténtalo de nuevo.',
      cancel: 'Cancelar',
      cancelLabel: 'Cancelar el pedido de {amount} en {merchant}',
      cancelling: 'Cancelando…',
      declineShort: {
        insufficient_funds: 'Supera lo disponible',
        card_frozen: 'Tarjeta congelada',
        account_not_active: 'Cuenta no activa',
        invalid_card: 'Tarjeta no reconocida',
      },
      toast: {
        voided: 'Pedido de {amount} en {merchant} cancelado. Se liberó lo que estaba en espera.',
        voidFailed: 'No pudimos cancelar el pedido. Revisa tu conexión e inténtalo de nuevo.',
      },
    },
    detail: {
      title: 'Detalle del pedido',
      loading: 'Cargando el pedido',
      merchant: 'Comercio',
      date: 'Fecha',
      status: 'Estado',
      items: 'Artículos',
      lineQuantity: '{quantity} × {unit}',
      noItems: 'Una compra con tarjeta, sin detalle de artículos.',
      total: 'Total',
      whatHappened: 'Qué pasó',
      timelineTitle: 'Paso a paso',
      holdExpiry: 'Se libera sola',
      timeline: {
        createdAt: 'Pedido hecho',
        approvedAt: 'Aprobado, monto en espera',
        declinedAt: 'Rechazado',
        capturedAt: 'Publicado en tu tarjeta',
        reversedAt: 'Cancelado, se liberó lo que estaba en espera',
        expiredAt: 'La retención venció y se liberó',
        adminReleasedAt: 'Acme Credit liberó la retención',
      },
      outcome: {
        APPROVED:
          'En espera: apartamos {amount} de tu disponible hasta que el comercio lo publique. Todavía puedes cancelarlo.',
        CAPTURED: 'Publicado: se cargaron {amount} a tu tarjeta.',
        DECLINED: 'Rechazado, no se cobró nada: {reason}',
        REVERSED: 'Cancelado: liberamos lo que estaba en espera y no se cobró nada.',
        REVERSED_expired:
          'Vencido: el comercio no lo publicó a tiempo, así que liberamos lo que estaba en espera y no se cobró nada.',
        REVERSED_admin_release:
          'Liberado por Acme Credit: nuestro equipo liberó lo que estaba en espera y no se cobró nada.',
      },
      declineReason: {
        insufficient_funds: 'el pedido superaba tu disponible.',
        card_frozen: 'tu tarjeta estaba congelada.',
        account_not_active: 'tu cuenta no estaba activa.',
        invalid_card: 'la red de tarjetas no reconoció la tarjeta.',
        unknown: 'la red de tarjetas no indicó el motivo.',
      },
      notFoundTitle: 'No encontramos este pedido',
      notFoundBody:
        'Este enlace no corresponde a ningún pedido de tu cuenta. Cierra este panel para ver tus pedidos.',
    },
  },
  tour: {
    skip: 'Saltar',
    next: 'Siguiente',
    back: 'Atrás',
    done: 'Listo',
    progress: '{current} de {total}',
    announcement: 'Paso {current} de {total}: {title}',
    welcomeTitle: '¡Hola! Soy Credi',
    welcomeBody:
      'Te enseño tu cartera en un minuto. Usa las flechas del teclado o los botones, y sal cuando quieras con Esc.',
    cardTitle: 'Tu tarjeta garantizada',
    cardBody:
      'Aquí está tu tarjeta y su estado. Tócala para ver sus datos, congelarla o subir tu límite.',
    availableTitle: 'Lo disponible para gastar',
    availableBody:
      'Tu límite menos lo que está en espera y lo que debes. Cada monto aparece completo, con centavos.',
    storeTitle: 'La tienda',
    storeBody:
      'Compra en comercios aliados con tu tarjeta. Cada pedido queda en espera hasta que el comercio lo publica.',
    activityTitle: 'Tu actividad',
    activityBody: 'Sigue cada pedido, pago y depósito, paso a paso, de en espera a publicado.',
    freezeTitle: 'Congela tu tarjeta',
    freezeBody:
      'En la página de tu tarjeta puedes congelarla cuando quieras: las compras nuevas se rechazan y tus pagos siguen.',
    doneTitle: '¡Listo para empezar!',
    doneBody: 'Puedes volver a ver este tutorial desde tu perfil cuando quieras.',
  },
  profile: {
    pageTitle: 'Perfil',
    pageIntro: 'Tus datos, preferencias y cuenta.',
    loading: 'Cargando tu perfil',
    signedInAs: 'Sesión iniciada como',
    tutorialTitle: 'Tutorial de tu cartera',
    tutorialBody:
      'En un minuto Credi te enseña tu tarjeta, lo disponible, la tienda y tu actividad.',
    tutorialAction: 'Ver tutorial',
    accountTitle: 'Tu cuenta',
    closeBody: 'Al cerrar te devolvemos tu depósito de garantía, después de cubrir lo que debas.',
    closeAction: 'Cerrar cuenta',
    noOpenAccount: 'Ahora no tienes una cuenta abierta.',
  },
  errors: {
    unknown: 'Algo salió mal. Vuelve a intentarlo; si sigue pasando, contacta a soporte.',
    common: {
      validation_failed:
        'Algunos datos no se aceptaron. Revisa los campos marcados y vuelve a intentarlo.',
      not_found: 'No encontramos eso. Recarga la página y vuelve a intentarlo.',
      unauthenticated: 'Tu sesión terminó. Inicia sesión otra vez para continuar.',
      forbidden: 'Esta cuenta no puede hacer eso.',
      rate_limited: 'Demasiados intentos en poco tiempo. Espera un minuto y vuelve a intentarlo.',
      conflict: 'Esto cambió mientras trabajabas. Recarga la página y vuelve a intentarlo.',
      internal:
        'Algo salió mal de nuestro lado. Inténtalo en un momento; si sigue pasando, contacta a soporte.',
      payload_too_large: 'Esa solicitud es demasiado grande. Acórtala y vuelve a intentarlo.',
    },
    auth: {
      invalid_credentials:
        'Ese correo y esa contraseña no coinciden. Revísalos y vuelve a intentarlo.',
      email_taken: 'Ya existe una cuenta con este correo. Inicia sesión o usa otro correo.',
      session_expired: 'Tu sesión expiró. Inicia sesión otra vez para continuar.',
    },
    idempotency: {
      key_required:
        'No pudimos enviar eso de forma segura. Recarga la página y vuelve a intentarlo.',
      key_reused:
        'Esta solicitud ya se envió con otros datos. Recarga la página y empieza de nuevo.',
      in_progress:
        'Todavía estamos procesando tu solicitud anterior. Espera unos segundos y vuelve a intentarlo.',
    },
    operation: {
      in_progress:
        'Hay otro cambio en curso en tu cuenta. Espera unos segundos y vuelve a intentarlo.',
    },
    signature: {
      invalid: 'No pudimos verificar esa solicitud. Recarga la página y vuelve a intentarlo.',
    },
    account: {
      already_open: 'Ya tienes una cuenta abierta. Recarga la página para verla.',
      not_active:
        'Tu tarjeta no está activa, así que esto no se puede hacer ahora. Revisa el estado de tu cuenta.',
      not_frozen:
        'Tu tarjeta no está congelada, así que no hay nada que descongelar. Recarga la página.',
      closed: 'Esta cuenta está cerrada. Abre una tarjeta nueva para seguir usando Acme Credit.',
      pending_holds:
        'Tienes compras en espera. Podemos cerrar la cuenta cuando se publiquen o se cancelen; inténtalo en unos minutos.',
      frozen_by_admin:
        'Acme Credit congeló tu tarjeta, así que solo nuestro equipo puede descongelarla. Contacta a soporte para revisarla.',
    },
    deposit: {
      amount_out_of_range:
        'El depósito de garantía debe estar entre {depositMin} y {depositMax}. Cambia el monto y vuelve a intentarlo.',
    },
    repayment: {
      exceeds_debt:
        'Eso es más de lo que debes. Escribe un monto hasta lo que debes y vuelve a intentarlo.',
      no_debt: 'Ahora no debes nada, así que no hay nada que pagar.',
    },
    payment: {
      not_confirmed:
        'Acme Bank todavía no confirma esta transferencia. Apruébala ahí y revisa otra vez.',
      provider_unavailable:
        'Acme Bank no responde ahora, así que no se pidió nada. Inténtalo en unos minutos.',
      deposit_cap_exceeded:
        'Ese depósito superaría el máximo de depósito de garantía para una tarjeta. Ingresa un monto menor.',
    },
    authorization: {
      not_capturable: 'Esta compra ya no se puede publicar. Recarga la página para ver su estado.',
      not_reversible:
        'Este pedido ya no se puede cancelar: ya se publicó o se liberó. Recarga la página.',
      capture_exceeds_hold:
        'Esta compra no se puede publicar por más de lo retenido. Recarga la página para ver su estado.',
      hold_released:
        'Esta retención se liberó, así que la compra ya no se puede publicar. Recarga la página para ver su estado.',
    },
  },
} satisfies Messages;
