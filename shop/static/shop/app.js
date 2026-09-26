/* Customer web shop: one page for the website and the Telegram Mini App (Alpine.js). */
(function () {
  'use strict';

  const CONFIG = JSON.parse(document.getElementById('shop-config').textContent);
  const API = CONFIG.api;
  const tg = window.Telegram && window.Telegram.WebApp;
  const IN_TG = !!(tg && tg.initData);
  const KEYS = { token: 'shop.token', cart: 'shop.cart', lang: 'shop.lang', theme: 'shop.theme', contact: 'shop.contact' };

  const store = {
    get(key, fallback = null) {
      try {
        const value = localStorage.getItem(key);
        return value === null ? fallback : JSON.parse(value);
      } catch (e) { return fallback; }
    },
    set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* private mode */ } },
    remove(key) { try { localStorage.removeItem(key); } catch (e) { /* private mode */ } },
  };

  const I18N = {
    uz: {
      currency: "so'm", min: 'daqiqa', menu: 'Menyu', orders: 'Buyurtmalarim', profile: 'Profil',
      heroTitle: 'Sevimli taomlaringiz — eshigingiz oldida', heroText: "Buyurtma bering, qolganini bizga qo'yib bering.",
      cashOrCard: 'Naqd yoki karta', searchPlaceholder: 'Taom qidirish…', popular: "Ko'p buyurtma qilinadi", other: 'Boshqa',
      top: 'Top', add: "Qo'shish", addToCart: "Savatga qo'shish", update: 'Saqlash', addedToCart: "Savatga qo'shildi",
      cart: 'Savat', cartEmpty: "Savatingiz bo'sh", cartEmptyText: "Menyudan yoqqan taomlaringizni qo'shing",
      toMenu: "Menyuga o'tish", pcs: 'ta', total: 'Jami', products: 'Mahsulotlar', checkout: 'Rasmiylashtirish', clear: 'Tozalash',
      checkoutTitle: 'Rasmiylashtirish', contact: "Aloqa ma'lumotlari", yourName: 'Ismingiz', phone: 'Telefon raqam',
      shareTgPhone: 'Telegram raqamini ulashish', receive: 'Qabul qilish usuli', delivery: 'Yetkazib berish', pickup: 'Olib ketish',
      address: 'Manzil', addressPlaceholder: "Tuman, ko'cha, uy, xonadon, mo'ljal", locate: 'Joylashuvni aniqlash',
      locating: 'Aniqlanmoqda…', locationSet: 'Joylashuv aniqlandi', locationFailed: "Joylashuvni aniqlab bo'lmadi",
      onMap: "xaritada ko'rish", pickupNote: "Buyurtmani o'zingiz olib ketasiz — tayyor bo'lganda xabar beramiz.",
      payment: "To'lov usuli", cash: 'Naqd', card: 'Karta', paymentNote: "To'lov buyurtmani olganingizda amalga oshiriladi",
      comment: 'Izoh', commentPlaceholder: 'Masalan: piyozsiz, domofon 25', placeOrder: 'Buyurtma berish',
      required: "To'ldirilishi shart", invalidPhone: "Telefon raqam noto'g'ri", minOrder: 'Minimal buyurtma',
      orderPlaced: 'Buyurtma qabul qilindi!', orderPlacedText: "Operatorimiz tez orada siz bilan bog'lanadi.",
      trackOrder: 'Buyurtmani kuzatish', backToMenu: 'Menyuga qaytish', orderNo: 'Buyurtma',
      ordersEmpty: "Hali buyurtmalar yo'q", ordersEmptyText: 'Birinchi buyurtmangizni hoziroq bering — bir necha daqiqa ketadi.',
      reorder: 'Yana buyurtma berish', details: 'Tafsilotlar', refresh: 'Yangilash',
      status_ordered: 'Qabul qilindi', status_on_the_way: "Yo'lda", status_completed: 'Yetkazildi', status_rejected: 'Bekor qilindi',
      status_completed_pickup: 'Topshirildi', rejectedText: 'Buyurtma bekor qilindi. Savollar bo‘lsa, biz bilan bog‘laning.',
      guest: 'Mehmon', loginPrompt: "Buyurtma berish va tarixni ko'rish uchun kiring", login: 'Kirish',
      loginTitle: "Kirish yoki ro'yxatdan o'tish", loginText: 'Buyurtmalaringizni kuzatish uchun bir marta tasdiqlang',
      viaTelegram: 'Telegram orqali kirish', viaPhone: 'Telefon raqam orqali', or: 'yoki', getCode: 'Kod olish',
      phoneTitle: 'Telefon raqamingiz', phoneText: 'Raqamingizga 6 xonali tasdiqlash kodini yuboramiz',
      codeTitle: 'Kodni kiriting', codeSentTo: 'Kod yuborildi:', resendIn: 'Qayta yuborish', resend: 'Kodni qayta yuborish',
      changeNumber: "Raqamni o'zgartirish", confirm: 'Tasdiqlash', tgTitle: "Telegram'da tasdiqlang",
      tgText: "Botda «Start» tugmasini bosing — shundan so'ng bu sahifada avtomatik kirasiz.", openTelegram: "Telegram'ni ochish",
      waiting: 'Tasdiqlash kutilmoqda…', linkExpired: 'Havola eskirdi. Qaytadan urinib ko‘ring.', tryAgain: 'Qayta urinish',
      nameTitle: 'Ismingiz nima?', nameText: "Buyurtmalarda shu ism ko'rsatiladi", continue: 'Davom etish', welcome: 'Xush kelibsiz',
      language: 'Til', theme: 'Mavzu', theme_auto: 'Avtomatik', theme_light: "Yorug'", theme_dark: "Qorong'i", support: 'Aloqa markazi',
      logout: 'Chiqish', loggedOut: 'Hisobdan chiqdingiz', loadError: "Menyuni yuklab bo'lmadi", retry: 'Qayta urinish',
      nothingFound: 'Hech narsa topilmadi', nothingFoundText: "Boshqa so'z bilan qidirib ko'ring", results: 'Qidiruv natijalari',
      emptyMenu: 'Menyu tez orada', emptyMenuText: "Mahsulotlar qo'shilishi bilan shu yerda paydo bo'ladi",
      productGone: "Ba'zi mahsulotlar endi mavjud emas — savat yangilandi", productsUnavailable: 'Bu mahsulotlar hozir mavjud emas',
      devCode: 'Test rejimi — kod:', telegramAccount: 'Telegram akkaunt', connected: 'Ulangan',
      errNetwork: "Internet bilan aloqa yo'q", errGeneric: "Xatolik yuz berdi. Qayta urinib ko'ring", errInvalidCode: "Kod noto'g'ri",
      errCodeExpired: 'Kod muddati tugagan. Yangi kod oling', errTooMany: "Juda ko'p urinish. Birozdan so'ng qayta urinib ko'ring",
      errTooSoon: 'Yangi kod olish uchun biroz kuting', errSms: "SMS yuborib bo'lmadi. Telegram orqali kiring",
      errTelegram: 'Telegram orqali kirish vaqtincha ishlamayapti',
    },
    ru: {
      currency: 'сум', min: 'мин', menu: 'Меню', orders: 'Мои заказы', profile: 'Профиль',
      heroTitle: 'Любимая еда — прямо к вашей двери', heroText: 'Сделайте заказ, остальное мы берём на себя.',
      cashOrCard: 'Наличные или карта', searchPlaceholder: 'Поиск блюд…', popular: 'Часто заказывают', other: 'Другое',
      top: 'Хит', add: 'Добавить', addToCart: 'В корзину', update: 'Сохранить', addedToCart: 'Добавлено в корзину',
      cart: 'Корзина', cartEmpty: 'Корзина пуста', cartEmptyText: 'Добавьте любимые блюда из меню',
      toMenu: 'Перейти в меню', pcs: 'шт', total: 'Итого', products: 'Товары', checkout: 'Оформить', clear: 'Очистить',
      checkoutTitle: 'Оформление заказа', contact: 'Контактные данные', yourName: 'Ваше имя', phone: 'Номер телефона',
      shareTgPhone: 'Поделиться номером из Telegram', receive: 'Способ получения', delivery: 'Доставка', pickup: 'Самовывоз',
      address: 'Адрес', addressPlaceholder: 'Район, улица, дом, квартира, ориентир', locate: 'Определить местоположение',
      locating: 'Определяем…', locationSet: 'Местоположение определено', locationFailed: 'Не удалось определить местоположение',
      onMap: 'на карте', pickupNote: 'Вы заберёте заказ сами — сообщим, когда он будет готов.',
      payment: 'Способ оплаты', cash: 'Наличные', card: 'Карта', paymentNote: 'Оплата при получении заказа',
      comment: 'Комментарий', commentPlaceholder: 'Например: без лука, домофон 25', placeOrder: 'Заказать',
      required: 'Обязательное поле', invalidPhone: 'Неверный номер телефона', minOrder: 'Минимальный заказ',
      orderPlaced: 'Заказ принят!', orderPlacedText: 'Оператор свяжется с вами в ближайшее время.',
      trackOrder: 'Отследить заказ', backToMenu: 'Вернуться в меню', orderNo: 'Заказ',
      ordersEmpty: 'Заказов пока нет', ordersEmptyText: 'Сделайте первый заказ прямо сейчас — это займёт пару минут.',
      reorder: 'Повторить заказ', details: 'Подробнее', refresh: 'Обновить',
      status_ordered: 'Принят', status_on_the_way: 'В пути', status_completed: 'Доставлен', status_rejected: 'Отменён',
      status_completed_pickup: 'Выдан', rejectedText: 'Заказ отменён. Если есть вопросы — свяжитесь с нами.',
      guest: 'Гость', loginPrompt: 'Войдите, чтобы заказывать и видеть историю заказов', login: 'Войти',
      loginTitle: 'Вход или регистрация', loginText: 'Подтвердите один раз, чтобы отслеживать заказы',
      viaTelegram: 'Войти через Telegram', viaPhone: 'По номеру телефона', or: 'или', getCode: 'Получить код',
      phoneTitle: 'Ваш номер телефона', phoneText: 'Мы отправим 6-значный код подтверждения',
      codeTitle: 'Введите код', codeSentTo: 'Код отправлен на', resendIn: 'Повторно через', resend: 'Отправить код ещё раз',
      changeNumber: 'Изменить номер', confirm: 'Подтвердить', tgTitle: 'Подтвердите в Telegram',
      tgText: 'Нажмите «Start» в боте — после этого вы автоматически войдёте на этой странице.', openTelegram: 'Открыть Telegram',
      waiting: 'Ожидаем подтверждения…', linkExpired: 'Ссылка устарела. Попробуйте ещё раз.', tryAgain: 'Попробовать снова',
      nameTitle: 'Как вас зовут?', nameText: 'Это имя будет указано в заказах', continue: 'Продолжить', welcome: 'Добро пожаловать',
      language: 'Язык', theme: 'Тема', theme_auto: 'Автоматически', theme_light: 'Светлая', theme_dark: 'Тёмная', support: 'Служба поддержки',
      logout: 'Выйти', loggedOut: 'Вы вышли из аккаунта', loadError: 'Не удалось загрузить меню', retry: 'Повторить',
      nothingFound: 'Ничего не найдено', nothingFoundText: 'Попробуйте другой запрос', results: 'Результаты поиска',
      emptyMenu: 'Меню скоро появится', emptyMenuText: 'Товары появятся здесь, как только их добавят',
      productGone: 'Некоторых товаров больше нет — корзина обновлена', productsUnavailable: 'Эти товары сейчас недоступны',
      devCode: 'Тестовый режим — код:', telegramAccount: 'Аккаунт Telegram', connected: 'Подключён',
      errNetwork: 'Нет соединения с интернетом', errGeneric: 'Что-то пошло не так. Попробуйте ещё раз', errInvalidCode: 'Неверный код',
      errCodeExpired: 'Срок действия кода истёк. Получите новый', errTooMany: 'Слишком много попыток. Попробуйте позже',
      errTooSoon: 'Подождите немного перед повторной отправкой', errSms: 'Не удалось отправить SMS. Войдите через Telegram',
      errTelegram: 'Вход через Telegram временно недоступен',
    },
  };

  const MONTHS = {
    uz: ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'],
    ru: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
  };
  const ERROR_KEYS = {
    network: 'errNetwork', invalid_phone: 'invalidPhone', invalid_code: 'errInvalidCode', code_expired: 'errCodeExpired',
    too_many_attempts: 'errTooMany', too_many_requests: 'errTooMany', too_soon: 'errTooSoon', sms_failed: 'errSms',
    telegram_unavailable: 'errTelegram', product_not_found: 'productGone',
  };
  const STATUS_STEPS = ['ordered', 'on_the_way', 'completed'];

  const pad = (n) => String(n).padStart(2, '0');
  const formatMoney = (n) => Math.round(n || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const localDigits = (value) => String(value || '').replace(/\D/g, '').replace(/^998(?=\d{9})/, '').slice(0, 9);
  const formatLocalPhone = (d) => [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean).join(' ');

  async function request(path, { method = 'GET', body, token } = {}) {
    const headers = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = 'Bearer ' + token;
    let response;
    try {
      response = await fetch(API + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
    } catch (e) {
      throw Object.assign(new Error('network'), { code: 'network', status: 0, data: {} });
    }
    let data = {};
    try { data = await response.json(); } catch (e) { /* empty body */ }
    if (!response.ok) {
      throw Object.assign(new Error(data.error || 'error'), { code: data.error || 'error', status: response.status, data });
    }
    return data;
  }

  const emptyAuth = () => ({
    step: 'choose', phone: '', code: '', name: '', loading: false, error: '', resendIn: 0, debugCode: '', tgUrl: '', tgToken: '',
  });

  document.addEventListener('alpine:init', () => {
    window.Alpine.data('shop', () => ({
      cfg: CONFIG,
      inTelegram: IN_TG,
      lang: 'uz',
      theme: 'auto',
      loading: true,
      loadError: false,
      categories: [],
      products: [],
      popularIds: [],
      byId: {},
      client: null,
      token: null,
      view: 'menu',
      search: '',
      activeCat: null,
      cart: {},
      bump: false,
      scrolled: false,
      sheet: null,
      product: null,
      productQty: 1,
      form: { name: '', phone: '', address: '', lat: '', lng: '', delivery_type: 'delivery', payment_method: 'cash', comment: '' },
      errors: {},
      placing: false,
      locating: false,
      auth: emptyAuth(),
      afterAuth: null,
      orders: [],
      ordersLoaded: false,
      ordersLoading: false,
      order: null,
      lastOrder: null,
      toasts: [],
      timers: {},

      // ------------------------------------------------------------------ lifecycle
      init() {
        const tgLang = IN_TG && tg.initDataUnsafe && tg.initDataUnsafe.user && tg.initDataUnsafe.user.language_code;
        const browserLang = (tgLang || navigator.language || '').toLowerCase();
        this.lang = store.get(KEYS.lang) || (browserLang.startsWith('ru') ? 'ru' : 'uz');
        this.theme = store.get(KEYS.theme) || 'auto';
        this.token = IN_TG ? null : store.get(KEYS.token);
        this.cart = store.get(KEYS.cart) || {};
        Object.assign(this.form, store.get(KEYS.contact) || {});
        document.documentElement.lang = this.lang;
        this.applyTheme();

        if (IN_TG) this.setupTelegram();
        else window.addEventListener('popstate', (event) => this.onPopState(event));
        window.addEventListener('scroll', () => { this.scrolled = window.scrollY > 4; }, { passive: true });
        const media = window.matchMedia('(prefers-color-scheme: dark)');
        if (media.addEventListener) media.addEventListener('change', () => this.applyTheme());

        this.$watch('sheet', () => { this.lockScroll(); this.syncTelegram(); });
        this.$watch('view', () => this.syncTelegram());
        this.$watch('productQty', () => this.syncTelegram());
        this.$watch('placing', () => this.syncTelegram());
        this.$watch('lang', () => this.syncTelegram());
        this.load();
      },

      async load() {
        this.loading = true;
        this.loadError = false;
        try {
          if (IN_TG) await this.loginWithTelegram();
          const data = await request('bootstrap/', { token: this.token });
          this.categories = data.categories;
          this.products = data.products;
          this.popularIds = data.popular;
          this.byId = Object.fromEntries(data.products.map((p) => [p.id, p]));
          if (data.client) this.setClient(data.client);
          else if (this.token) this.logout(true); // expired or foreign token
          this.dropMissingFromCart();
          if (this.activeCat === null && this.sections.length) this.activeCat = this.sections[0].id;
          this.$nextTick(() => this.observeSections());
        } catch (e) {
          this.loadError = true;
        } finally {
          this.loading = false;
          this.syncTelegram();
        }
      },

      // ------------------------------------------------------------------ Telegram Mini App
      setupTelegram() {
        document.documentElement.classList.add('tg');
        tg.ready();
        tg.expand();
        try { if (tg.disableVerticalSwipes) tg.disableVerticalSwipes(); } catch (e) { /* old client */ }
        tg.onEvent('themeChanged', () => this.applyTheme());
        tg.BackButton.onClick(() => this.back());
        tg.MainButton.onClick(() => this.onMainButton());
      },

      async loginWithTelegram() {
        try {
          const data = await request('auth/telegram/webapp/', { method: 'POST', body: { init_data: tg.initData } });
          this.token = data.token;
          this.setClient(data.client);
        } catch (e) {
          console.warn('Telegram sign-in failed', e);
        }
      },

      syncTelegram() {
        if (!IN_TG) return;
        if (this.sheet || this.view !== 'menu') tg.BackButton.show();
        else tg.BackButton.hide();

        let text = null;
        if (this.sheet === 'product' && this.product) text = `${this.qty(this.product.id) ? this.t('update') : this.t('addToCart')} · ${this.money(this.product.price * this.productQty)}`;
        else if (this.sheet === 'cart' && this.cartCount) text = `${this.t('checkout')} · ${this.money(this.cartTotal)}`;
        else if (this.sheet === 'checkout') text = `${this.t('placeOrder')} · ${this.money(this.cartTotal)}`;
        else if (!this.sheet && this.view === 'menu' && this.cartCount) text = `${this.t('cart')} · ${this.cartCount} · ${this.money(this.cartTotal)}`;

        const button = tg.MainButton;
        if (!text) { button.hide(); return; }
        const brand = getComputedStyle(document.documentElement).getPropertyValue('--brand').trim() || '#FF5A1F';
        button.setParams({ text, color: brand, text_color: '#ffffff', is_active: !this.placing, is_visible: true });
        if (this.placing) button.showProgress(false);
        else button.hideProgress();
      },

      onMainButton() {
        if (this.sheet === 'product') this.addFromSheet();
        else if (this.sheet === 'cart') this.goCheckout();
        else if (this.sheet === 'checkout') this.placeOrder();
        else if (!this.sheet) this.openCart();
      },

      haptic(kind) {
        if (!IN_TG || !tg.HapticFeedback) return;
        try {
          if (kind === 'impact') tg.HapticFeedback.impactOccurred('light');
          else if (kind === 'select') tg.HapticFeedback.selectionChanged();
          else tg.HapticFeedback.notificationOccurred(kind);
        } catch (e) { /* unsupported */ }
      },

      // ------------------------------------------------------------------ helpers
      t(key) { return (I18N[this.lang] && I18N[this.lang][key]) || I18N.uz[key] || key; },
      name(item) { return item ? (this.lang === 'ru' ? item.name_ru || item.name_uz : item.name_uz || item.name_ru) : ''; },
      desc(p) { return p ? (this.lang === 'ru' ? p.desc_ru || p.desc_uz : p.desc_uz || p.desc_ru) : ''; },
      unit(p) { return p ? (this.lang === 'ru' ? p.unit_ru : p.unit_uz) : ''; },
      money(n) { return `${formatMoney(n)} ${this.t('currency')}`; },
      initial(text) { return (String(text || '?').trim()[0] || '?').toUpperCase(); },
      date(iso) {
        const d = new Date(iso);
        const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
        const month = MONTHS[this.lang][d.getMonth()];
        return this.lang === 'ru' ? `${d.getDate()} ${month}, ${time}` : `${d.getDate()}-${month}, ${time}`;
      },
      statusText(order) {
        if (order.status === 'completed' && order.delivery_type === 'pickup') return this.t('status_completed_pickup');
        return this.t('status_' + order.status);
      },
      errorText(e) { return this.t(ERROR_KEYS[e && e.code] || 'errGeneric'); },
      toast(text, type = 'info') {
        const id = Date.now() + Math.random();
        this.toasts.push({ id, text, type });
        setTimeout(() => { this.toasts = this.toasts.filter((toast) => toast.id !== id); }, 2800);
      },
      get clientName() {
        if (!this.client) return '';
        return [this.client.first_name, this.client.last_name].filter(Boolean).join(' ');
      },
      get clientPhone() { return this.phone(this.client && this.client.phone); },
      phone(value) {
        const digits = String(value || '').replace(/\D/g, '');
        if (digits.length === 12 && digits.startsWith('998')) return `+998 ${formatLocalPhone(digits.slice(3))}`;
        return value || '';
      },

      applyTheme() {
        const systemDark = IN_TG ? tg.colorScheme === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
        const dark = this.theme === 'dark' || (this.theme === 'auto' && systemDark);
        document.documentElement.dataset.theme = dark ? 'dark' : 'light';
        const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
        const meta = document.getElementById('theme-color');
        if (meta) meta.setAttribute('content', bg);
        if (IN_TG) {
          try {
            tg.setHeaderColor(bg);
            tg.setBackgroundColor(bg);
            if (tg.setBottomBarColor) tg.setBottomBarColor(bg);
          } catch (e) { /* old client */ }
        }
      },
      setTheme(theme) { this.theme = theme; store.set(KEYS.theme, theme); this.applyTheme(); this.syncTelegram(); },
      cycleTheme() { this.setTheme({ auto: 'light', light: 'dark', dark: 'auto' }[this.theme]); },
      setLang(lang) {
        this.lang = lang;
        store.set(KEYS.lang, lang);
        document.documentElement.lang = lang;
        if (this.client) request('me/', { method: 'PATCH', token: this.token, body: { lang } }).catch(() => {});
      },
      lockScroll() { document.documentElement.style.overflow = this.sheet ? 'hidden' : ''; },

      // ------------------------------------------------------------------ navigation
      // Website: every open sheet / non-menu view is a history entry, so the phone's back gesture closes it.
      // Telegram: the native BackButton does the same (no history entries are created).
      openSheet(name) {
        const wasOpen = !!this.sheet;
        this.sheet = name;
        if (!IN_TG && !wasOpen) history.pushState({ view: this.view, sheet: true }, '');
      },
      closeSheet() {
        if (!this.sheet) return;
        this.sheet = null;
        if (!IN_TG && history.state && history.state.sheet) history.back();
      },
      go(view) {
        if (!IN_TG) {
          const state = history.state || {};
          const depth = (state.sheet ? 1 : 0) + (state.view && state.view !== 'menu' ? 1 : 0);
          if (view === 'menu') { if (depth) history.go(-depth); }
          else if (state.sheet || state.view) history.replaceState({ view }, '');
          else history.pushState({ view }, '');
        }
        this.sheet = null;
        this.setView(view);
      },
      setView(view) {
        if (view === this.view) return;
        this.view = view;
        window.scrollTo({ top: 0 });
        if (view === 'orders') this.loadOrders();
        if (view === 'menu') this.$nextTick(() => this.observeSections());
      },
      onPopState(event) {
        this.sheet = null; // sheets are not restored on forward/back
        this.setView((event.state && event.state.view) || 'menu');
      },
      back() {
        if (this.sheet) this.closeSheet();
        else if (this.view !== 'menu') this.go('menu');
      },

      // ------------------------------------------------------------------ catalog
      get popular() { return this.popularIds.map((id) => this.byId[id]).filter(Boolean); },
      get heroImages() {
        const source = this.popular.length >= 3 ? this.popular : this.products;
        return source.filter((p) => p.image).slice(0, 3);
      },
      get sections() {
        const known = new Set(this.categories.map((c) => c.id));
        const groups = this.categories
          .map((c) => ({ id: c.id, title: this.name(c), products: this.products.filter((p) => p.category_id === c.id) }))
          .filter((group) => group.products.length);
        const other = this.products.filter((p) => !known.has(p.category_id));
        if (other.length) groups.push({ id: 0, title: this.t('other'), products: other });
        return groups;
      },
      get results() {
        const query = this.search.trim().toLowerCase();
        if (!query) return null;
        return this.products.filter((p) => `${p.name_uz} ${p.name_ru} ${p.desc_uz} ${p.desc_ru}`.toLowerCase().includes(query));
      },
      isPopular(p) { return this.popular.length >= 3 && this.popularIds.includes(p.id); },

      observeSections() {
        if (this.observer) this.observer.disconnect();
        const offset = this.stickyOffset();
        this.observer = new IntersectionObserver((entries) => {
          if (this.scrollingTo) return;
          const visible = entries.filter((entry) => entry.isIntersecting)
            .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
          if (visible.length) {
            this.activeCat = Number(visible[0].target.dataset.cat);
            this.centerChip();
          }
        }, { rootMargin: `-${offset}px 0px -55% 0px` });
        document.querySelectorAll('[data-cat]').forEach((el) => this.observer.observe(el));
      },
      stickyOffset() {
        const header = document.querySelector('.header');
        const toolbar = document.querySelector('.toolbar');
        return (header ? header.offsetHeight : 64) + (toolbar ? toolbar.offsetHeight : 100) + 8;
      },
      scrollToCat(id) {
        this.search = '';
        this.activeCat = id;
        this.centerChip();
        this.$nextTick(() => {
          const el = document.querySelector(`[data-cat="${id}"]`);
          if (!el) return;
          this.scrollingTo = true;
          clearTimeout(this.timers.scroll);
          window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - this.stickyOffset() + 4, behavior: 'smooth' });
          this.timers.scroll = setTimeout(() => { this.scrollingTo = false; }, 800);
        });
      },
      centerChip() {
        this.$nextTick(() => {
          const bar = this.$refs.chips;
          const chip = bar && bar.querySelector(`[data-id="${this.activeCat}"]`);
          if (chip) bar.scrollTo({ left: chip.offsetLeft - bar.clientWidth / 2 + chip.clientWidth / 2, behavior: 'smooth' });
        });
      },

      // ------------------------------------------------------------------ cart
      qty(id) { return this.cart[id] || 0; },
      setQty(id, quantity) {
        const cart = { ...this.cart };
        if (quantity <= 0) delete cart[id];
        else cart[id] = Math.min(quantity, 99);
        this.cart = cart;
        store.set(KEYS.cart, cart);
        this.syncTelegram();
      },
      add(p) { this.setQty(p.id, this.qty(p.id) + 1); this.haptic('impact'); this.pulseCart(); },
      dec(p) { this.setQty(p.id, this.qty(p.id) - 1); this.haptic('select'); },
      clearCart() { this.cart = {}; store.set(KEYS.cart, {}); this.syncTelegram(); },
      get cartItems() {
        return Object.entries(this.cart)
          .map(([id, qty]) => ({ product: this.byId[id], qty }))
          .filter((item) => item.product);
      },
      get cartCount() { return this.cartItems.reduce((sum, item) => sum + item.qty, 0); },
      get cartTotal() { return this.cartItems.reduce((sum, item) => sum + item.qty * item.product.price, 0); },
      get belowMinimum() { return this.cfg.minOrder > 0 && this.cartTotal < this.cfg.minOrder; },
      dropMissingFromCart() {
        const missing = Object.keys(this.cart).filter((id) => !this.byId[id]);
        if (!missing.length) return false;
        const cart = { ...this.cart };
        missing.forEach((id) => delete cart[id]);
        this.cart = cart;
        store.set(KEYS.cart, cart);
        return true;
      },
      pulseCart() {
        this.bump = false;
        requestAnimationFrame(() => { this.bump = true; setTimeout(() => { this.bump = false; }, 420); });
      },
      openCart() { this.openSheet('cart'); },

      // ------------------------------------------------------------------ product sheet
      openProduct(p) {
        this.product = p;
        this.productQty = Math.max(1, this.qty(p.id));
        this.openSheet('product');
      },
      addFromSheet() {
        if (!this.product) return;
        const isNew = !this.qty(this.product.id);
        this.setQty(this.product.id, this.productQty);
        this.haptic('impact');
        this.pulseCart();
        this.closeSheet();
        if (isNew) this.toast(this.t('addedToCart'), 'success');
      },

      // ------------------------------------------------------------------ checkout
      goCheckout() {
        if (!this.cartCount || this.belowMinimum) return;
        if (!this.client) {
          this.afterAuth = () => this.goCheckout();
          this.openAuth();
          return;
        }
        if (!this.form.name) this.form.name = this.clientName;
        if (!this.form.phone && this.client.phone) this.form.phone = this.clientPhone;
        if (!this.form.address && !this.form.lat && this.client.address) this.form.address = this.client.address;
        this.errors = {};
        this.openSheet('checkout');
      },
      async locate() {
        this.locating = true;
        try {
          const position = await this.position();
          this.form.lat = position.lat.toFixed(6);
          this.form.lng = position.lng.toFixed(6);
          this.errors.address = '';
          this.toast(this.t('locationSet'), 'success');
        } catch (e) {
          this.toast(this.t('locationFailed'), 'error');
        } finally {
          this.locating = false;
        }
      },
      position() {
        const browser = () => new Promise((resolve, reject) => {
          if (!navigator.geolocation) { reject(new Error('unsupported')); return; }
          navigator.geolocation.getCurrentPosition(
            (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
            reject,
            { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
          );
        });
        const manager = IN_TG && tg.isVersionAtLeast && tg.isVersionAtLeast('8.0') && tg.LocationManager;
        if (!manager) return browser();
        return new Promise((resolve, reject) => {
          const ask = () => {
            if (!manager.isLocationAvailable) { browser().then(resolve, reject); return; }
            manager.getLocation((data) => (data ? resolve({ lat: data.latitude, lng: data.longitude }) : reject(new Error('denied'))));
          };
          if (manager.isInited) ask(); else manager.init(ask);
        });
      },
      clearLocation() { this.form.lat = ''; this.form.lng = ''; },
      get mapUrl() { return `https://maps.google.com/?q=${this.form.lat},${this.form.lng}`; },
      shareTelegramPhone() {
        if (!IN_TG || !tg.requestContact) return;
        tg.requestContact((shared, result) => {
          if (!shared) return;
          const phone = result && result.responseUnsafe && result.responseUnsafe.contact && result.responseUnsafe.contact.phone_number;
          if (phone) this.form.phone = phone.startsWith('+') ? phone : '+' + phone;
          this.errors.phone = '';
        });
      },
      validateCheckout() {
        const errors = {};
        if (!this.form.name.trim()) errors.name = this.t('required');
        if (this.form.phone.replace(/\D/g, '').length < 9) errors.phone = this.t('invalidPhone');
        if (this.form.delivery_type === 'delivery' && !this.form.address.trim() && !this.form.lat) errors.address = this.t('required');
        this.errors = errors;
        return !Object.keys(errors).length;
      },
      async placeOrder() {
        if (this.placing) return;
        if (!this.validateCheckout()) { this.haptic('error'); return; }
        this.placing = true;
        const f = this.form;
        try {
          const data = await request('orders/', {
            method: 'POST',
            token: this.token,
            body: {
              items: this.cartItems.map((item) => ({ product_id: item.product.id, quantity: item.qty })),
              name: f.name.trim(), phone: f.phone, address: f.address.trim(), lat: f.lat, lng: f.lng,
              delivery_type: f.delivery_type, payment_method: f.payment_method, comment: f.comment.trim(),
              platform: IN_TG ? 'miniapp' : 'web', lang: this.lang,
            },
          });
          this.lastOrder = data.order;
          this.orders = [data.order, ...this.orders.filter((o) => o.id !== data.order.id)];
          this.clearCart();
          store.set(KEYS.contact, { name: f.name, phone: f.phone, address: f.address, lat: f.lat, lng: f.lng, delivery_type: f.delivery_type, payment_method: f.payment_method });
          this.form.comment = '';
          this.sheet = 'success';
          this.haptic('success');
        } catch (e) {
          this.haptic('error');
          if (e.status === 401) {
            this.logout(true);
            this.afterAuth = () => this.goCheckout();
            this.auth = emptyAuth();
            this.sheet = 'auth';
          } else if (e.code === 'validation') {
            const fields = e.data.fields || {};
            this.errors = Object.fromEntries(Object.keys(fields).map((k) => [k, k === 'phone' ? this.t('invalidPhone') : this.t('required')]));
          } else if (e.code === 'product_not_found') {
            this.toast(this.t('productGone'), 'error');
            this.load();
          } else {
            this.toast(this.errorText(e), 'error');
          }
        } finally {
          this.placing = false;
        }
      },

      // ------------------------------------------------------------------ auth
      setClient(client) {
        this.client = client;
        if (client && client.lang && !store.get(KEYS.lang)) this.lang = client.lang;
      },
      saveToken(token) {
        this.token = token;
        if (!IN_TG) store.set(KEYS.token, token);
      },
      openAuth() {
        this.auth = emptyAuth();
        this.openSheet('auth');
      },
      onPhoneInput(event) {
        this.auth.phone = formatLocalPhone(localDigits(event.target.value));
        event.target.value = this.auth.phone;
        this.auth.error = '';
      },
      get authDigits() { return localDigits(this.auth.phone); },
      async requestCode() {
        if (this.authDigits.length !== 9) { this.auth.error = this.t('invalidPhone'); return; }
        this.auth.loading = true;
        this.auth.error = '';
        try {
          const data = await request('auth/phone/request/', { method: 'POST', body: { phone: '+998' + this.authDigits } });
          this.auth.debugCode = data.debug_code || '';
          this.enterCodeStep(data.resend_in || 60);
        } catch (e) {
          if (e.code === 'too_soon') this.enterCodeStep(e.data.retry_after || 60);
          else this.auth.error = this.errorText(e);
        } finally {
          this.auth.loading = false;
        }
      },
      enterCodeStep(resendIn) {
        this.auth.step = 'code';
        this.auth.code = '';
        this.auth.resendIn = resendIn;
        clearInterval(this.timers.resend);
        this.timers.resend = setInterval(() => {
          this.auth.resendIn -= 1;
          if (this.auth.resendIn <= 0) clearInterval(this.timers.resend);
        }, 1000);
        this.$nextTick(() => this.$refs.otp && this.$refs.otp.focus());
      },
      onCodeInput() {
        this.auth.code = this.auth.code.replace(/\D/g, '').slice(0, 6);
        this.auth.error = '';
        if (this.auth.code.length === 6) this.verifyCode();
      },
      async verifyCode() {
        if (this.auth.code.length !== 6 || this.auth.loading) return;
        this.auth.loading = true;
        this.auth.error = '';
        try {
          const data = await request('auth/phone/verify/', {
            method: 'POST', body: { phone: '+998' + this.authDigits, code: this.auth.code, lang: this.lang },
          });
          this.onAuthenticated(data);
        } catch (e) {
          this.auth.error = this.errorText(e);
          this.auth.code = '';
          this.haptic('error');
          this.$nextTick(() => this.$refs.otp && this.$refs.otp.focus());
        } finally {
          this.auth.loading = false;
        }
      },
      async telegramLogin() {
        this.auth.loading = true;
        this.auth.error = '';
        try {
          const data = await request('auth/telegram/start/', { method: 'POST', body: {} });
          this.auth.tgUrl = data.url;
          this.auth.tgToken = data.token;
          this.auth.step = 'telegram';
          window.open(data.url, '_blank', 'noopener');
          this.pollTelegram(data.token, Date.now() + data.expires_in * 1000);
        } catch (e) {
          this.auth.error = this.errorText(e);
        } finally {
          this.auth.loading = false;
        }
      },
      pollTelegram(token, deadline) {
        clearTimeout(this.timers.poll);
        const tick = async () => {
          if (this.sheet !== 'auth' || this.auth.tgToken !== token) return;
          if (Date.now() > deadline) { this.auth.error = this.t('linkExpired'); return; }
          try {
            const data = await request('auth/telegram/check/?token=' + encodeURIComponent(token));
            if (data.status === 'confirmed') { this.onAuthenticated(data); return; }
            if (data.status === 'expired') { this.auth.error = this.t('linkExpired'); return; }
          } catch (e) {
            if (e.status === 404) { this.auth.error = this.t('linkExpired'); return; }
          }
          this.timers.poll = setTimeout(tick, 2000);
        };
        this.timers.poll = setTimeout(tick, 2000);
      },
      onAuthenticated(data) {
        this.saveToken(data.token);
        this.setClient(data.client);
        this.haptic('success');
        this.orders = [];
        this.ordersLoaded = false;
        if (!this.client.first_name) {
          this.auth.step = 'name';
          this.auth.error = '';
          this.$nextTick(() => this.$refs.nameInput && this.$refs.nameInput.focus());
          return;
        }
        this.finishAuth();
      },
      async saveName() {
        const parts = this.auth.name.trim().split(/\s+/).filter(Boolean);
        if (!parts.length) { this.auth.error = this.t('required'); return; }
        this.auth.loading = true;
        try {
          const data = await request('me/', {
            method: 'PATCH', token: this.token,
            body: { first_name: parts[0], last_name: parts.slice(1).join(' '), lang: this.lang },
          });
          this.setClient(data.client);
          this.finishAuth();
        } catch (e) {
          this.auth.error = this.errorText(e);
        } finally {
          this.auth.loading = false;
        }
      },
      finishAuth() {
        this.toast(`${this.t('welcome')}${this.client.first_name ? ', ' + this.client.first_name : ''}!`, 'success');
        const next = this.afterAuth;
        this.afterAuth = null;
        if (next) next(); else this.closeSheet();
        if (this.view === 'orders') this.loadOrders();
      },
      logout(silent = false) {
        this.token = null;
        this.client = null;
        store.remove(KEYS.token);
        this.orders = [];
        this.ordersLoaded = false;
        if (!silent) {
          this.toast(this.t('loggedOut'));
          this.go('menu');
        }
      },

      // ------------------------------------------------------------------ orders
      async loadOrders(silent = false) {
        clearTimeout(this.timers.orders);
        if (!this.client) return;
        if (!silent && !this.ordersLoaded) this.ordersLoading = true;
        try {
          const data = await request('orders/', { token: this.token });
          this.orders = data.orders;
          this.ordersLoaded = true;
          if (this.order) this.order = this.orders.find((o) => o.id === this.order.id) || this.order;
        } catch (e) {
          if (e.status === 401) this.logout(true);
          else if (!silent) this.toast(this.errorText(e), 'error');
        } finally {
          this.ordersLoading = false;
        }
        if (this.view === 'orders' || this.sheet === 'order') {
          this.timers.orders = setTimeout(() => this.loadOrders(true), 20000);
        }
      },
      openOrder(order) {
        this.order = order;
        this.openSheet('order');
      },
      trackLastOrder() {
        const order = this.lastOrder;
        this.sheet = null;
        if (!IN_TG) history.replaceState({ view: 'orders' }, '');
        this.setView('orders');
        this.$nextTick(() => this.openOrder(order));
      },
      steps(order) { return order.delivery_type === 'pickup' ? ['ordered', 'completed'] : STATUS_STEPS; },
      stepState(order, step) {
        const current = STATUS_STEPS.indexOf(order.status);
        const index = STATUS_STEPS.indexOf(step);
        if (index < current || (index === current && order.status === 'completed')) return 'done';
        return index === current ? 'current' : '';
      },
      stepIcon(order, step) {
        if (step === 'ordered') return '#i-receipt';
        if (step === 'on_the_way') return '#i-truck';
        return order.delivery_type === 'pickup' ? '#i-bag' : '#i-check';
      },
      stepLabel(order, step) {
        if (step === 'completed' && order.delivery_type === 'pickup') return this.t('status_completed_pickup');
        return this.t('status_' + step);
      },
      itemsLine(order) { return order.items.map((i) => `${this.name(i)} × ${i.quantity}`).join(', '); },
      reorder(order) {
        let added = 0;
        order.items.forEach((item) => {
          if (this.byId[item.product_id]) {
            this.setQty(item.product_id, this.qty(item.product_id) + item.quantity);
            added += 1;
          }
        });
        if (!added) { this.toast(this.t('productsUnavailable'), 'error'); return; }
        this.haptic('success');
        this.openSheet('cart');
      },
    }));
  });
})();
