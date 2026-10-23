import type { Messages } from '@acme/ui';

export const enUS = {
  app: {
    name: 'Acme Credit',
    tagline: 'A secured credit card backed by your own security deposit (collateral).',
  },
  og: {
    lead: 'Your deposit sets your limit. Shop, pay it back, and get it returned when you close.',
    imageAlt: 'Credi, the Acme Credit card mascot, waves next to the secured card tagline.',
  },
  meta: {
    homeTitle: 'Acme Credit — secured credit card and wallet',
    homeDescription:
      'Open a secured credit card with a security deposit that is returned to you. Your deposit sets your limit, and every purchase stays inside it.',
    signInTitle: 'Sign in — Acme Credit',
    signInDescription:
      'Sign in to Acme Credit to see what is available to spend, make a payment and manage your secured credit card and its security deposit.',
    signUpTitle: 'Create your account — Acme Credit',
    signUpDescription:
      'Create your Acme Credit account, then open a secured credit card whose limit matches the security deposit you choose to leave with us.',
    appTitle: 'Your wallet — Acme Credit',
    cardTitle: 'Your card — Acme Credit',
    storeTitle: 'Store — Acme Credit',
    checkoutTitle: 'Checkout — Acme Credit',
    activityTitle: 'Activity — Acme Credit',
    profileTitle: 'Profile — Acme Credit',
    privateDescription:
      'Your Acme Credit account: balances, card, payments and activity. This page is private and only shows after you sign in.',
  },
  a11y: {
    notifications: 'Notifications',
    skipToContent: 'Skip to content',
    mainNav: 'Main',
    accountNav: 'Your wallet',
    tabNav: 'Wallet tabs',
    opensInNewTab: '(opens in a new tab)',
    cartCount: '{count} in your cart',
  },
  prefs: {
    title: 'Preferences',
    theme: 'Theme',
    light: 'Light',
    dark: 'Dark',
    system: 'System',
    language: 'Language',
    spanish: 'Español',
    english: 'English',
    languageSettings: 'App language',
  },
  common: {
    pagination: {
      previous: 'Previous',
      next: 'Next',
      page: 'Page {page}',
      status: 'Page {page} of {total}',
      summary: 'Showing {from}–{to} of {total}',
    },
    retry: 'Try again',
    retrying: 'Trying again…',
    done: 'Done',
    backToAccount: 'Back to your wallet',
    close: 'Close',
  },
  nav: {
    signIn: 'Sign in',
    getStarted: 'Get started',
    home: 'Home',
    card: 'Card',
    store: 'Store',
    activity: 'Activity',
    profile: 'Profile',
  },
  landing: {
    eyebrow: 'Secured credit card',
    title: 'A credit card backed by your own security deposit.',
    lead: 'Leave a security deposit (collateral) with us and your credit limit matches it. Shop in your wallet, repay, and get the deposit back when you close in good standing.',
    ctaPrimary: 'Open my account',
    ctaSecondary: 'Sign in',
    trustLabel: 'Why you can trust Acme Credit',
    trustAmounts: 'No fine print: every amount in plain sight',
    trustDeposit: 'Your deposit stays yours',
    trustFreeze: 'Freeze your card whenever you want',
    stepsTitle: 'How it works',
    steps: {
      depositTitle: 'Leave a security deposit',
      depositBody: 'Choose an amount between {min} and {max}. It is held for you, not spent.',
      limitTitle: 'Get a matching limit',
      limitBody:
        'Once your bank confirms the transfer, your card is active with a credit limit equal to your deposit.',
      spendTitle: 'Spend inside the limit',
      spendBody:
        'Every purchase is checked against what is available to spend. Purchases over it are declined, never charged.',
      repayTitle: 'Repay what you owe',
      repayBody: 'Payments restore what is available to spend as soon as your bank confirms them.',
      returnTitle: 'Get your deposit back',
      returnBody:
        'Close the account and the deposit is returned to you, after paying anything still owed.',
    },
    exampleTitle: 'Every amount, side by side',
    exampleBody:
      'Your wallet shows what is available, what is on hold and what you owe — never one number that hides holds.',
    exampleDeposit: 'Security deposit',
    exampleLimit: 'Credit limit',
    exampleHeld: 'On hold',
    exampleOwed: 'Owed',
    exampleAvailable: 'Available to spend',
    storeTitle: 'A store inside your wallet',
    storeBody:
      'Tacos, groceries, gadgets and things for home from partner merchants. Pay with your card in one step and follow each order from on hold to posted.',
    closingTitle: 'Ready when you are',
    closingBody: 'Creating an account takes a minute. You decide the deposit, and it stays yours.',
    footer: 'Acme Credit is a demonstration product. No real money moves.',
  },
  session: {
    checkFailedTitle: 'We could not check your session',
    checkFailedBody: 'Acme Credit did not answer. Check your connection and try again.',
    redirecting: 'Taking you to sign in…',
    signOut: 'Sign out',
    signingOut: 'Signing out…',
    signOutFailed: 'We could not sign you out. Check your connection and try again.',
    profileLink: 'Your profile, {name}',
  },
  auth: {
    asideTitle: 'Build your credit with your own deposit',
    fields: {
      email: 'Email',
      password: 'Password',
      newPassword: 'Password',
      newPasswordHint: 'At least {min} characters.',
      fullName: 'Full name',
    },
    signIn: {
      title: 'Sign in',
      intro: 'Welcome back. Sign in to see your card and what is available to spend.',
      submit: 'Sign in',
      submitting: 'Signing in…',
      failed: 'We could not sign you in. Check your connection and try again.',
      noAccount: 'New to Acme Credit?',
      createAccount: 'Create an account',
      demo: 'Use demo account',
      demoHint: 'Fills in the demo customer. You still press Sign in.',
    },
    signUp: {
      title: 'Create your account',
      intro: 'You will choose your security deposit after this step. Nothing is charged yet.',
      submit: 'Create account',
      submitting: 'Creating your account…',
      failed: 'We could not create your account. Check your connection and try again.',
      haveAccount: 'Already have an account?',
      signIn: 'Sign in',
      demo: 'Fill with test data',
      demoName: 'Demo Customer',
    },
  },
  validation: {
    emailRequired: 'Enter your email.',
    emailInvalid: 'Enter an email like name@example.com.',
    emailTooLong: 'Use an email of at most {emailMax} characters.',
    passwordRequired: 'Enter your password.',
    passwordTooShort: 'Use at least {passwordMin} characters.',
    passwordTooLong: 'Use at most {passwordMax} characters.',
    nameRequired: 'Enter your full name.',
    nameTooLong: 'Use at most {nameMax} characters.',
    amountRequired: 'Enter an amount.',
    amountInvalid: 'Enter an amount like 250 or 250.75 (dollars and up to two decimals).',
    amountTooLarge:
      'That amount is larger than any single operation allows. Enter a smaller amount.',
    depositBelowMin: 'The security deposit starts at {depositMin}. Enter a larger amount.',
    depositAboveMax: 'The security deposit goes up to {depositMax}. Enter a smaller amount.',
    paymentAboveOwed: 'That is more than you owe. Enter an amount up to what you owe.',
  },
  status: {
    onHold: 'On hold',
    posted: 'Posted',
    declined: 'Declined',
    cancelled: 'Cancelled',
    pending: 'Pending',
    confirmed: 'Confirmed',
    failed: 'Failed',
    released: 'Returned',
    applied: 'Applied',
    recorded: 'Recorded',
    frozen: 'Frozen',
    active: 'Active',
    closed: 'Closed',
    awaitingDeposit: 'Awaiting deposit',
    expired: 'Expired',
  },
  account: {
    pageTitle: 'Your wallet',
    greeting: 'Hi, {name}',
    loading: 'Loading your wallet',
    loadFailedTitle: 'We could not load your account',
    loadFailedBody: 'Acme Credit did not answer. Check your connection and try again.',
    onboarding: {
      title: 'Open your secured card',
      body: 'A secured card works like a credit card, backed by a security deposit (collateral) that you leave with us and get back when you close the account.',
      step1: 'Open the account.',
      step2: 'Add your security deposit from your bank.',
      step3: 'Spend up to your limit and repay what you owe.',
      open: 'Open my secured card',
      opening: 'Opening your account…',
    },
    card: {
      numberLabel: 'Card ending in {last4}',
      expires: 'Expires',
      summary: 'Your card',
      view: 'See card',
    },
    frozenTitle: 'Your card is frozen',
    frozenNotice: 'New purchases are declined until you unfreeze it. Payments still work.',
    balances: {
      title: 'Balances',
      available: 'Available to spend',
      limit: 'Credit limit',
      onHold: 'On hold',
      onHoldHint: 'Purchases waiting to post',
      owed: 'Owed',
    },
    usage: {
      title: 'Your credit limit',
    },
    meter: {
      label: 'How your credit limit is used',
      collateral: 'Backed by your security deposit',
    },
    actions: {
      title: 'Quick actions',
      shop: 'Go to the store',
      payment: 'Make a payment',
      deposit: 'Add to deposit',
      freeze: 'Freeze card',
      unfreeze: 'Unfreeze card',
      updating: 'Updating your card…',
    },
    recent: {
      title: 'Recent orders',
      seeAll: 'See all activity',
      emptyTitle: 'No orders yet',
      emptyBody: 'Your first order from the store shows up here, from on hold to posted.',
    },
    toast: {
      opened: 'Your account is open. Add your security deposit to activate your card.',
      openFailed: 'We could not open your account. Check your connection and try again.',
      frozen: 'Your card is frozen. New purchases will be declined until you unfreeze it.',
      freezeFailed: 'We could not freeze your card. Check your connection and try again.',
      unfrozen: 'Your card is active again. Purchases up to what is available will go through.',
      unfreezeFailed: 'We could not unfreeze your card. Check your connection and try again.',
    },
  },
  card: {
    pageTitle: 'Your card',
    loading: 'Loading your card',
    secured: 'Secured',
    detailsTitle: 'Card details',
    holder: 'Cardholder',
    number: 'Number',
    status: 'Status',
    settingsTitle: 'Card settings',
    freeze: {
      label: 'Freeze card',
      description:
        'While it is frozen, new purchases are declined. Payments, your security deposit and orders on hold do not change.',
      freezeTitle: 'Freeze your card?',
      freezeBody:
        'New purchases will be declined until you unfreeze it. You can still make payments.',
      freezeConfirm: 'Freeze card',
      unfreezeTitle: 'Unfreeze your card?',
      unfreezeBody: 'Purchases up to what is available to spend will go through again.',
      unfreezeConfirm: 'Unfreeze card',
      cancel: 'Cancel',
    },
    limit: {
      title: 'Raise your limit',
      body: 'Your credit limit equals your security deposit ({limit}). Add to the deposit and the limit goes up by the same amount once your bank confirms it.',
    },
    close: {
      title: 'Close your account',
      body: 'Close the account from your profile: we return your security deposit after paying anything you owe.',
      link: 'Go to your profile',
    },
    noCardTitle: 'You do not have an active card yet',
    noCardBody:
      'Your card shows up here once your security deposit is confirmed. Start from your wallet.',
    adminFrozen: {
      title: 'Acme Credit froze your card',
      body: 'Only our team can unfreeze it. New purchases are declined; your payments, your security deposit and orders on hold do not change. Write to support to have it reviewed.',
    },
  },
  deposit: {
    title: 'Add your security deposit',
    intro:
      'Your security deposit (collateral) sets your credit limit. It stays yours: it is returned when you close the account, after paying anything you owe.',
    addTitle: 'Add to your security deposit',
    addIntro:
      'A larger security deposit raises your credit limit by the same amount once your bank confirms the transfer.',
    amountLabel: 'Deposit amount',
    amountHint: 'Between {min} and {max}.',
    submit: 'Add security deposit',
    addSubmit: 'Add to deposit',
    roomHint: 'You can add up to {room} more: the maximum security deposit per card is {cap}.',
    capReachedTitle: 'Your deposit is at the maximum',
    capReachedBody:
      'Your security deposit is already {cap}, the maximum per card, so your credit limit cannot go higher.',
    submitting: 'Requesting the transfer…',
    toast: {
      requested: 'Transfer of {amount} requested. Approve it at Acme Bank to finish.',
      failed:
        'We could not request your deposit. Check your connection and try again; retrying will not charge you twice.',
    },
  },
  payment: {
    title: 'Make a payment',
    intro:
      'Pay what you owe from your bank. What is available to spend goes back up once your bank confirms the payment.',
    amountLabel: 'Payment amount',
    amountHint: 'You owe {owed}.',
    submit: 'Make a payment',
    submitting: 'Requesting the transfer…',
    noDebtTitle: 'You do not owe anything',
    noDebtBody:
      'Posted purchases show up here as what you owe. Purchases on hold are paid once they post.',
    toast: {
      requested: 'Payment of {amount} requested. Approve it at Acme Bank to finish.',
      failed:
        'We could not request your payment. Check your connection and try again; retrying will not charge you twice.',
    },
  },
  transfer: {
    approve: 'Approve at Acme Bank (simulator)',
    waiting: 'Waiting for Acme Bank to confirm…',
    timedOutTitle: 'We have not heard from Acme Bank yet',
    timedOutBody:
      'If you already approved the transfer of {amount}, check again. If not, approve it first.',
    checkAgain: 'Check again',
    checking: 'Checking…',
    loadFailedTitle: 'We could not load your transfers',
    loadFailedBody: 'Acme Credit did not answer. Check your connection and try again.',
    deposit: {
      waitingTitle: 'Approve your deposit of {amount}',
      waitingBody:
        'Open Acme Bank (simulator) and approve the transfer. This page updates by itself once the bank confirms it.',
      confirmedTitle: 'Deposit of {amount} confirmed',
      confirmedBody: 'Your credit limit now includes it.',
      failedTitle: 'Your deposit of {amount} did not go through',
      failedBody:
        'Acme Bank did not approve the transfer, so nothing left your bank account. You can try again below.',
    },
    repayment: {
      waitingTitle: 'Approve your payment of {amount}',
      waitingBody:
        'Open Acme Bank (simulator) and approve the transfer. This page updates by itself once the bank confirms it.',
      confirmedTitle: 'Payment of {amount} confirmed',
      confirmedBody:
        'What you owe went down and what is available to spend went up by the same amount.',
      failedTitle: 'Your payment of {amount} did not go through',
      failedBody:
        'Acme Bank did not approve the transfer, so nothing left your bank account. You can try again below.',
    },
  },
  close: {
    title: 'Close your account?',
    bodyWithDebt:
      'Your security deposit of {collateral} first pays the {applied} you owe. The remaining {returned} is returned to you.',
    bodyNoDebt:
      'You owe nothing, so your whole security deposit of {collateral} is returned to you.',
    depositLabel: 'Security deposit',
    appliedLabel: 'Applied to what you owe',
    returnedLabel: 'Returned to you',
    holdsTitle: 'You have {amount} on hold',
    holdsBody:
      'We can close the account once those purchases post or are cancelled. Cancel them in Activity, or try again in a few minutes.',
    confirm: 'Close account',
    cancel: 'Keep my account',
    closing: 'Closing your account…',
    toast: {
      closed:
        'Your account is closed. {amount} of your security deposit is on its way back to you.',
      failed: 'We could not close your account. Check your connection and try again.',
    },
  },
  closed: {
    title: 'Your account is closed',
    body: 'Your card no longer works. You can open a new secured card at any time.',
    deposit: 'Security deposit',
    applied: 'Applied to what you owed',
    returned: 'Returned to you',
    openNew: 'Open a new card',
    loadFailedTitle: 'We could not load your settlement',
    loadFailedBody: 'Acme Credit did not answer. Check your connection and try again.',
  },
  store: {
    pageTitle: 'Store',
    pageIntro: 'Shop at partner merchants with your card. Each order is paid at one merchant.',
    loading: 'Loading the store',
    merchantsLabel: 'Merchant',
    categoriesLabel: 'Category',
    merchantsPrevious: 'Previous merchants',
    merchantsNext: 'More merchants',
    categoriesPrevious: 'Previous categories',
    categoriesNext: 'More categories',
    allCategories: 'All',
    allMerchants: 'All merchants',
    category: {
      food: 'Food',
      groceries: 'Groceries',
      electronics: 'Electronics',
      home: 'Home',
    },
    productsLabel: 'Products from {merchant}',
    add: 'Add',
    addLabel: 'Add {product} to the cart',
    quantityLabel: 'Quantity of {product}',
    decreaseLabel: 'One less {product}',
    increaseLabel: 'One more {product}',
    removeLabel: 'Remove {product} from the cart',
    noProductsTitle: 'Nothing in this category here',
    noProductsBody: 'Pick another category or another merchant.',
    noCardTitle: 'Your card is not active yet',
    noCardBody:
      'Shopping needs an active card. Add your security deposit in your wallet to activate it.',
    available: 'Available to spend',
    productsTitle: 'Products',
    pagesLabel: 'Product pages',
    added: 'Added: {product}',
    removed: 'Removed: {product}',
    cart: {
      title: 'Your cart',
      fromMerchant: 'From {merchant}',
      emptyTitle: 'Your cart is empty',
      emptyBody: 'Add something from a merchant to start an order.',
      itemsOne: '1 item',
      itemsOther: '{count} items',
      total: 'Total',
      checkout: 'Go to checkout',
      open: 'View cart · {items} · {total}',
      clear: 'Empty cart',
    },
    switch: {
      title: 'Start a new cart?',
      body: 'Your cart from {current} has {items}. Each order is paid at one merchant, so adding from {next} empties it first.',
      confirm: 'Empty it and switch',
      cancel: 'Keep my cart',
    },
  },
  checkout: {
    pageTitle: 'Checkout',
    pageIntro: 'Review your order and pay with your card.',
    resultIntro: 'The card network answered. Here is what happened to your order.',
    loading: 'Loading your order',
    linesTitle: 'Your order',
    editCart: 'Edit cart',
    lineQuantity: '{quantity} × {unit}',
    summaryTitle: 'Payment',
    payWith: 'Pay with',
    total: 'Total',
    available: 'Available to spend',
    leftAfter: 'Left after this order',
    overLimitTitle: 'This is more than you have available',
    overLimitBody:
      'The total of {total} is more than your available {available}. The card network will likely decline it: remove items or make a payment first.',
    frozenNotice:
      'Your card is frozen, so the network will decline this order. Unfreeze it in your wallet first.',
    confirm: 'Pay {total}',
    confirming: 'Sending to the card network…',
    emptyTitle: 'Your cart is empty',
    emptyBody: 'Add products from a merchant in the store, then come back to pay.',
    backToStore: 'Go to the store',
    noCardTitle: 'Your card is not active yet',
    noCardBody:
      'Paying needs an active card. Add your security deposit in your wallet to activate it.',
    result: {
      approvedTitle: 'Approved: {total} at {merchant}',
      receipt: 'Receipt',
      onHold: 'On hold → posts in a few seconds',
      onHoldBody:
        'The merchant posts it within seconds. Until then it shows as on hold in Activity, and you can still cancel it there.',
      newAvailable: 'Available to spend now',
      keepShopping: 'Keep shopping',
      seeActivity: 'See activity',
      declinedTitle: 'Declined: {total} at {merchant}',
      nothingCharged: 'Nothing was charged and your cart is still here.',
      makePayment: 'Make a payment',
      openWallet: 'Go to your wallet',
      editCart: 'Edit cart',
    },
    decline: {
      insufficient_funds:
        "This order of {total} was declined: it's more than your available {available}. Make a payment or remove items, then try again.",
      card_frozen:
        'This order of {total} was declined because your card is frozen. Unfreeze it in your wallet, then try again.',
      account_not_active:
        'This order of {total} was declined because your account is not active. Check its status in your wallet.',
      invalid_card:
        'This order of {total} was declined: the network did not recognize the card. Reload the page and try again.',
    },
    toast: {
      failed:
        'The card network did not answer. Try again; the same order will not be charged twice.',
    },
  },
  activity: {
    pageTitle: 'Activity',
    pageIntro: 'Your orders and every movement of your account, newest first.',
    loading: 'Loading your activity',
    listTitle: 'Movements',
    emptyTitle: 'No activity yet',
    emptyBody:
      'Your security deposit, orders and payments show up here with their status once you start.',
    loadFailedTitle: 'We could not load your activity',
    loadFailedBody: 'Acme Credit did not answer. Check your connection and try again.',
    pagesLabel: 'Movement pages',
    type: {
      deposit: 'Security deposit',
      purchase: 'Purchase',
      repayment: 'Payment',
      collateral_applied: 'Deposit applied to what you owed',
      collateral_released: 'Deposit returned to you',
    },
    orders: {
      title: 'Orders',
      summary: '{merchant} · {items}',
      viewDetail: 'View details',
      pagesLabel: 'Order pages',
      emptyTitle: 'No orders yet',
      emptyBody: 'Orders from the store show up here, from on hold to posted.',
      loadFailedTitle: 'We could not load your orders',
      loadFailedBody: 'Acme Credit did not answer. Check your connection and try again.',
      cancel: 'Cancel',
      cancelLabel: 'Cancel the order of {amount} at {merchant}',
      cancelling: 'Cancelling…',
      declineShort: {
        insufficient_funds: 'Over available',
        card_frozen: 'Card frozen',
        account_not_active: 'Account not active',
        invalid_card: 'Card not recognized',
      },
      toast: {
        voided: 'Order of {amount} at {merchant} cancelled. The hold is released.',
        voidFailed: 'We could not cancel the order. Check your connection and try again.',
      },
    },
    detail: {
      title: 'Order details',
      loading: 'Loading the order',
      merchant: 'Merchant',
      date: 'Date',
      status: 'Status',
      items: 'Items',
      lineQuantity: '{quantity} × {unit}',
      noItems: 'A card purchase, without item details.',
      total: 'Total',
      whatHappened: 'What happened',
      timelineTitle: 'Step by step',
      holdExpiry: 'Releases on its own',
      timeline: {
        createdAt: 'Ordered',
        approvedAt: 'Approved, amount on hold',
        declinedAt: 'Declined',
        capturedAt: 'Posted to your card',
        reversedAt: 'Cancelled, hold released',
        expiredAt: 'Hold expired and released',
        adminReleasedAt: 'Acme Credit released the hold',
      },
      outcome: {
        APPROVED:
          'On hold: {amount} is set aside from your available balance until the merchant posts it. You can still cancel it.',
        CAPTURED: 'Posted: {amount} was charged to your card.',
        DECLINED: 'Declined, nothing was charged: {reason}',
        REVERSED: 'Cancelled: the hold was released and nothing was charged.',
        REVERSED_expired:
          'Expired: the merchant did not post it in time, so the hold was released and nothing was charged.',
        REVERSED_admin_release:
          'Released by Acme Credit: our team released the hold and nothing was charged.',
      },
      declineReason: {
        insufficient_funds: 'the order was more than your available balance.',
        card_frozen: 'your card was frozen.',
        account_not_active: 'your account was not active.',
        invalid_card: 'the card network did not recognize the card.',
        unknown: 'the card network gave no reason.',
      },
      notFoundTitle: 'We could not find this order',
      notFoundBody:
        'This link does not match any order of your account. Close this panel to see your orders.',
    },
  },
  tour: {
    skip: 'Skip',
    next: 'Next',
    back: 'Back',
    done: 'Done',
    progress: '{current} of {total}',
    announcement: 'Step {current} of {total}: {title}',
    welcomeTitle: 'Hi! I am Credi',
    welcomeBody:
      'Let me show you your wallet in one minute. Use the arrow keys or the buttons, and leave any time with Esc.',
    cardTitle: 'Your secured card',
    cardBody:
      'Here is your card and its status. Tap it to see its details, freeze it or raise your limit.',
    availableTitle: 'Available to spend',
    availableBody:
      'Your limit minus what is on hold and what you owe. Every amount shows in full, cents included.',
    storeTitle: 'The store',
    storeBody:
      'Shop at partner merchants with your card. Each order stays on hold until the merchant posts it.',
    activityTitle: 'Your activity',
    activityBody: 'Follow every order, payment and deposit, step by step, from on hold to posted.',
    freezeTitle: 'Freeze your card',
    freezeBody:
      'On your card page you can freeze it any time: new purchases are declined and your payments keep working.',
    doneTitle: 'Ready to go!',
    doneBody: 'You can watch this tutorial again from your profile whenever you want.',
  },
  profile: {
    pageTitle: 'Profile',
    pageIntro: 'Your details, preferences and account.',
    loading: 'Loading your profile',
    signedInAs: 'Signed in as',
    tutorialTitle: 'Wallet tutorial',
    tutorialBody:
      'In one minute Credi shows you your card, what is available, the store and your activity.',
    tutorialAction: 'Watch tutorial',
    accountTitle: 'Your account',
    closeBody: 'Closing returns your security deposit, after paying anything you owe.',
    closeAction: 'Close account',
    noOpenAccount: 'You have no open account right now.',
  },
  errors: {
    unknown: 'Something went wrong. Try again; if it keeps happening, contact support.',
    common: {
      validation_failed:
        'Some details were not accepted. Check the highlighted fields and try again.',
      not_found: 'We could not find that. Reload the page and try again.',
      unauthenticated: 'Your session ended. Sign in again to continue.',
      forbidden: 'This account cannot do that.',
      rate_limited: 'Too many attempts in a short time. Wait a minute, then try again.',
      conflict: 'This changed while you were working. Reload the page and try again.',
      internal:
        'Something went wrong on our side. Try again in a moment; if it keeps happening, contact support.',
      payload_too_large: 'That request is too large. Shorten it and try again.',
    },
    auth: {
      invalid_credentials: 'That email and password do not match. Check them and try again.',
      email_taken:
        'An account with this email already exists. Sign in instead, or use another email.',
      session_expired: 'Your session expired. Sign in again to continue.',
    },
    idempotency: {
      key_required: 'We could not send that safely. Reload the page and try again.',
      key_reused:
        'This request was already sent with different details. Reload the page and start again.',
      in_progress:
        'We are still processing your previous request. Wait a few seconds, then try again.',
    },
    operation: {
      in_progress:
        'Another change to your account is in progress. Wait a few seconds, then try again.',
    },
    signature: {
      invalid: 'We could not verify that request. Reload the page and try again.',
    },
    account: {
      already_open: 'You already have an open account. Reload the page to see it.',
      not_active: 'Your card is not active, so this cannot be done now. Check your account status.',
      not_frozen: 'Your card is not frozen, so there is nothing to unfreeze. Reload the page.',
      closed: 'This account is closed. Open a new card to keep using Acme Credit.',
      pending_holds:
        'You have purchases on hold. We can close the account once they post or are cancelled; try again in a few minutes.',
      frozen_by_admin:
        'Acme Credit froze your card, so only our team can unfreeze it. Contact support to review it.',
    },
    deposit: {
      amount_out_of_range:
        'The security deposit must be between {depositMin} and {depositMax}. Change the amount and try again.',
    },
    repayment: {
      exceeds_debt: 'That is more than you owe. Enter an amount up to what you owe and try again.',
      no_debt: 'You do not owe anything right now, so there is nothing to pay.',
    },
    payment: {
      not_confirmed:
        'Acme Bank has not confirmed this transfer yet. Approve it there, then check again.',
      provider_unavailable:
        'Acme Bank is not answering right now, so nothing was requested. Try again in a few minutes.',
      deposit_cap_exceeded:
        'That deposit would take your security deposit over the maximum for one card. Enter a smaller amount.',
    },
    authorization: {
      not_capturable: 'This purchase cannot be posted any more. Reload the page to see its status.',
      not_reversible:
        'This order can no longer be cancelled: it has already posted or was released. Reload the page.',
      capture_exceeds_hold:
        'This purchase cannot be posted for more than was held. Reload the page to see its status.',
      hold_released:
        'This hold was released, so the purchase can no longer post. Reload the page to see its status.',
    },
  },
} satisfies Messages;
