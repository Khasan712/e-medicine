/* Dashboard "Sales": manual + voice order entry (Alpine.js component `salesPos`). */
(function () {
  'use strict';

  const TEXT = {
    uz: {
      idle: 'Mikrofonni bosing va buyurtmani ayting', starting: 'Mikrofon ulanmoqda…', listening: 'Tinglayapman…',
      processing: 'AI tahlil qilmoqda…', done: 'Tayyor', stop: "To'xtatish", cancel: 'Bekor qilish', undo: 'Qaytarish',
      engineLive: 'Gemini Live · real vaqtda', engineRecord: 'Gemini · yozib olish', engineBrowser: 'Demo · brauzer',
      engineText: 'Matn', engineLocal: 'lokal tahlil', engineGemini: 'Gemini AI',
      applied: "Maydonlar to'ldirildi", nothingChanged: "O'zgarish topilmadi", unmatched: 'Topilmadi',
      submitHint: '«Yarat» dedingiz — tekshirib, Buyurtma yaratish tugmasini bosing',
      noMic: "Brauzer mikrofonni qo'llab-quvvatlamaydi", micDenied: "Mikrofonga ruxsat berilmadi",
      noEngine: "Ovoz uchun GEMINI_API_KEY sozlang yoki Chrome'dan foydalaning. Hozircha yozib yuborishingiz mumkin",
      nothingHeard: "Hech narsa eshitilmadi — mikrofonga yaqinroq, aniqroq gapiring", tooShort: 'Juda qisqa — bosib turib gapiring',
      speechUnavailable: "Bu brauzerning nutq tanish xizmati ishlamadi. GEMINI_API_KEY qo'shing yoki Google Chrome'da oching",
      speechLanguage: "Brauzer bu tilni tanimaydi (Safari o'zbek tilini qo'llamaydi). GEMINI_API_KEY qo'shing yoki yozib yuboring",
      speechDenied: "Mikrofon yoki nutq tanishga ruxsat berilmagan — brauzer sozlamalarini tekshiring", speechNoMic: 'Mikrofon topilmadi',
      demoNote: "Demo: kalitsiz ovoz brauzerga bog'liq (faqat Chrome). To'liq AI uchun .env ga GEMINI_API_KEY qo'shing",
      aiFailed: "AI javob bermadi. Qayta urinib ko'ring", notConfigured: 'GEMINI_API_KEY sozlanmagan',
      created: 'Buyurtma yaratildi', open: 'Ochish', addItems: "Avval mahsulot qo'shing", error: 'Xatolik yuz berdi',
      heard: 'Eshitildi', youSaid: 'Siz', ai: 'AI', items: 'ta', live: 'LIVE',
      status_ordered: 'Qabul qilindi', status_on_the_way: "Yo'lda", status_completed: 'Yakunlandi',
    },
    ru: {
      idle: 'Нажмите на микрофон и продиктуйте заказ', starting: 'Подключаем микрофон…', listening: 'Слушаю…',
      processing: 'AI анализирует…', done: 'Готово', stop: 'Остановить', cancel: 'Отмена', undo: 'Вернуть',
      engineLive: 'Gemini Live · в реальном времени', engineRecord: 'Gemini · запись', engineBrowser: 'Демо · браузер',
      engineText: 'Текст', engineLocal: 'локальный разбор', engineGemini: 'Gemini AI',
      applied: 'Поля заполнены', nothingChanged: 'Изменений не найдено', unmatched: 'Не найдено',
      submitHint: 'Вы сказали «создай» — проверьте и нажмите «Создать заказ»',
      noMic: 'Браузер не поддерживает микрофон', micDenied: 'Нет доступа к микрофону',
      noEngine: 'Для голоса укажите GEMINI_API_KEY или используйте Chrome. Пока можно написать текстом',
      nothingHeard: 'Ничего не услышал — говорите ближе к микрофону и чётче', tooShort: 'Слишком коротко — говорите дольше',
      speechUnavailable: 'Распознавание речи в этом браузере не сработало. Добавьте GEMINI_API_KEY или откройте в Google Chrome',
      speechLanguage: 'Браузер не распознаёт этот язык (Safari не поддерживает узбекский). Добавьте GEMINI_API_KEY или напишите текстом',
      speechDenied: 'Нет доступа к микрофону или распознаванию речи — проверьте настройки браузера', speechNoMic: 'Микрофон не найден',
      demoNote: 'Демо: без ключа голос зависит от браузера (только Chrome). Для полного AI добавьте GEMINI_API_KEY в .env',
      aiFailed: 'AI не ответил. Попробуйте ещё раз', notConfigured: 'GEMINI_API_KEY не настроен',
      created: 'Заказ создан', open: 'Открыть', addItems: 'Сначала добавьте товары', error: 'Произошла ошибка',
      heard: 'Услышано', youSaid: 'Вы', ai: 'AI', items: 'шт', live: 'LIVE',
      status_ordered: 'Принят', status_on_the_way: 'В пути', status_completed: 'Выполнен',
    },
  };

  const FIELDS = ['customer_name', 'phone', 'address', 'delivery_type', 'payment_method', 'status', 'comment'];
  const CHOICE_FIELDS = ['delivery_type', 'payment_method', 'status'];
  const MAX_RECORDING_MS = 90 * 1000;
  const TAIL_MS = 350; // keep recording briefly after "stop" so the last word is not cut off
  const BAR_COUNT = 32;

  // Downsamples microphone audio to 16 kHz mono 16-bit PCM in 100 ms chunks (Gemini Live input format).
  const PCM_WORKLET = `
    class PcmDownsampler extends AudioWorkletProcessor {
      constructor() {
        super();
        this.ratio = sampleRate / 16000;
        this.next = this.ratio;
        this.position = 0;
        this.sum = 0;
        this.count = 0;
        this.chunk = new Int16Array(1600);
        this.length = 0;
        this.port.onmessage = (event) => {
          if (event.data !== 'flush') return;
          if (this.length) this.port.postMessage(this.chunk.slice(0, this.length).buffer);
          this.length = 0;
          this.port.postMessage('flushed');
        };
      }
      process(inputs) {
        const channel = inputs[0] && inputs[0][0];
        if (!channel) return true;
        for (let i = 0; i < channel.length; i++) {
          this.sum += channel[i];
          this.count += 1;
          this.position += 1;
          if (this.position >= this.next) {
            const value = Math.max(-1, Math.min(1, this.sum / this.count));
            this.chunk[this.length++] = value < 0 ? value * 0x8000 : value * 0x7fff;
            this.sum = 0;
            this.count = 0;
            this.next += this.ratio;
            if (this.length === this.chunk.length) {
              this.port.postMessage(this.chunk.buffer.slice(0));
              this.length = 0;
            }
          }
        }
        return true;
      }
    }
    registerProcessor('pcm-downsampler', PcmDownsampler);
  `;
  let workletUrl = null;
  // The recording session lives outside Alpine: reactive proxies would break identity checks
  // and wrap MediaRecorder/AudioContext helpers.
  let active = null;

  function toBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(binary);
  }

  function joinText(parts) {
    return parts.join(' ').replace(/\s+/g, ' ').trim();
  }

  function withTimeout(promise, ms, code) {
    return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error(code || 'timeout')), ms))]);
  }

  /** 16 kHz PCM capture that starts together with the microphone (nothing said is lost while Live connects). */
  async function startPcm(session, onChunk) {
    if (!workletUrl) workletUrl = URL.createObjectURL(new Blob([PCM_WORKLET], { type: 'application/javascript' }));
    await session.context.audioWorklet.addModule(workletUrl);
    session.pcm = new AudioWorkletNode(session.context, 'pcm-downsampler');
    session.sink = session.context.createGain();
    session.sink.gain.value = 0;
    session.source.connect(session.pcm);
    session.pcm.connect(session.sink);
    session.sink.connect(session.context.destination);
    session.pcm.port.onmessage = (event) => {
      if (event.data === 'flushed') { if (session.flushed) session.flushed(); return; }
      onChunk(event.data);
    };
  }

  function flushPcm(session) {
    if (!session.pcm) return Promise.resolve();
    return new Promise((resolve) => {
      session.flushed = resolve;
      session.pcm.port.postMessage('flush');
      setTimeout(resolve, 150);
    });
  }

  /** Real-time captions through the Gemini Live API (browser connects with a server-minted ephemeral token).
   *  Captions are feedback while speaking; the final order is understood from the full recording. */
  class LiveCaptions {
    constructor({ onText }) {
      this.onText = onText;
      this.finals = [];
      this.interim = '';
      this.queue = []; // audio captured before the socket was ready
      this.ready = false;
    }

    push(chunk) {
      if (this.ready && this.socket.readyState === WebSocket.OPEN) this.send(chunk);
      else if (!this.failed && this.queue.length < 900) this.queue.push(chunk); // up to 90 s
    }

    send(chunk) {
      this.socket.send(JSON.stringify({ realtimeInput: { audio: { data: toBase64(chunk), mimeType: 'audio/pcm;rate=16000' } } }));
    }

    async connect(session) {
      this.socket = new WebSocket(`${session.url}?access_token=${encodeURIComponent(session.token)}`);
      const ready = new Promise((resolve, reject) => {
        this.resolveReady = resolve;
        this.rejectReady = reject;
      });
      this.socket.onopen = () => this.socket.send(JSON.stringify(session.setup));
      this.socket.onmessage = async (event) => {
        const raw = typeof event.data === 'string' ? event.data : await event.data.text();
        let message;
        try { message = JSON.parse(raw); } catch (e) { return; }
        this.handle(message);
      };
      this.socket.onerror = () => this.rejectReady(new Error('live_socket_error'));
      this.socket.onclose = (event) => {
        this.closed = true;
        if (event.code !== 1000 && !this.stopping) {
          this.failed = true;
          console.warn('Gemini Live closed', event.code, event.reason);
        }
        this.rejectReady(new Error(`live_closed_${event.code}`));
        if (this.finish) this.finish();
      };
      await withTimeout(ready, 7000, 'live_setup_timeout');
    }

    handle(message) {
      if (message.setupComplete || message.setup_complete) {
        this.ready = true;
        this.queue.forEach((chunk) => this.send(chunk)); // what was said while connecting
        this.queue = [];
        this.resolveReady();
        return;
      }
      const content = message.serverContent || message.server_content;
      if (!content) return;
      const interim = content.interimInputTranscription || content.interim_input_transcription;
      const final = content.inputTranscription || content.input_transcription;
      if (interim && interim.text) this.interim = interim.text;
      if (final && final.text) {
        this.finals.push(final.text);
        this.interim = '';
      }
      this.onText(this.text(true));
      if (this.finish && ((final && final.finished) || content.turnComplete || content.turn_complete)) this.finish();
    }

    text(withInterim = false) {
      return joinText(withInterim ? [...this.finals, this.interim] : this.finals);
    }

    async stop(waitMs = 700) {
      this.stopping = true;
      if (this.socket && this.socket.readyState === WebSocket.OPEN && this.ready) {
        this.socket.send(JSON.stringify({ realtimeInput: { audioStreamEnd: true } }));
        await new Promise((resolve) => { this.finish = resolve; setTimeout(resolve, waitMs); });
      }
      if (this.socket && this.socket.readyState <= WebSocket.OPEN) this.socket.close(1000);
      return this.text(true);
    }
  }

  // Errors after which the browser's speech service will not recover by restarting.
  const FATAL_SPEECH_ERRORS = ['not-allowed', 'service-not-allowed', 'network', 'language-not-supported', 'audio-capture', 'bad-grammar'];

  /** Fallback captions with the browser's Web Speech API (used when no Gemini key is configured).
   *  Quality depends on the browser: Chrome sends audio to Google; Safari uses Apple dictation, which has no Uzbek. */
  class BrowserCaptions {
    static supported() { return !!(window.SpeechRecognition || window.webkitSpeechRecognition); }

    constructor({ onText, onFatal, lang }) {
      const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.onText = onText;
      this.onFatal = onFatal;
      this.final = '';
      this.interim = '';
      this.active = true;
      this.restarts = [];
      this.recognition = new Recognition();
      this.recognition.lang = lang === 'ru' ? 'ru-RU' : 'uz-UZ';
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.onresult = (event) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) this.final += result[0].transcript + ' ';
          else interim += result[0].transcript;
        }
        this.interim = interim;
        this.onText(joinText([this.final, this.interim]));
      };
      this.recognition.onerror = (event) => {
        this.error = event.error;
        if (FATAL_SPEECH_ERRORS.includes(event.error)) this.fail(event.error);
      };
      this.recognition.onend = () => {
        if (this.active) {
          // Chrome ends a session after a pause; restart it, but never spin on a broken service.
          const now = Date.now();
          this.restarts = this.restarts.filter((time) => now - time < 3000).concat(now);
          if (this.restarts.length > 4) { this.fail(this.error || 'network'); return; }
          try { this.recognition.start(); } catch (e) { /* already started */ }
        } else if (this.done) this.done();
      };
    }

    fail(code) {
      if (this.failed) return;
      this.failed = code;
      this.active = false;
      if (this.onFatal) this.onFatal(code);
    }

    start() { this.recognition.start(); }

    stop() {
      this.active = false;
      return new Promise((resolve) => {
        const finish = () => resolve(joinText([this.final, this.interim]));
        this.done = finish;
        try { this.recognition.stop(); } catch (e) { finish(); }
        setTimeout(finish, 1500);
      });
    }
  }

  function pickMimeType() {
    if (!window.MediaRecorder || !MediaRecorder.isTypeSupported) return '';
    return ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/webm', 'audio/mp4'].find((type) => MediaRecorder.isTypeSupported(type)) || '';
  }

  document.addEventListener('alpine:init', () => {
    window.Alpine.data('salesPos', (config) => ({
      cfg: config,
      lang: config.lang === 'ru' ? 'ru' : 'uz',
      products: config.products,
      categories: config.categories,
      byId: Object.fromEntries(config.products.map((p) => [p.id, p])),
      recent: config.recent,
      stats: config.stats,
      search: '',
      category: null,
      items: [],
      form: { customer_name: '', phone: '', address: '', delivery_type: 'pickup', payment_method: 'cash', status: 'completed', comment: '' },
      statusAuto: true,
      creating: false,
      flashed: {},
      aiFields: {},
      toasts: [],
      command: '',
      undoState: null,
      voice: { state: 'idle', engine: '', caption: '', transcript: '', reply: '', unmatched: [], error: '', seconds: 0, submit: false, resultEngine: '' },

      init() {
        this.$watch('form.delivery_type', (value) => {
          if (this.statusAuto) this.form.status = value === 'delivery' ? 'ordered' : 'completed';
        });
        window.addEventListener('keydown', (event) => this.onKey(event));
      },

      // ---------------------------------------------------------------- helpers
      t(key) { return (TEXT[this.lang] && TEXT[this.lang][key]) || TEXT.uz[key] || key; },
      name(p) { return p ? (this.lang === 'ru' ? p.name_ru || p.name_uz : p.name_uz || p.name_ru) : ''; },
      unit(p) { return p ? (this.lang === 'ru' ? p.unit_ru : p.unit_uz) : ''; },
      money(n) { return `${Math.round(n || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} UZS`; },
      initial(text) { return (String(text || '?').trim()[0] || '?').toUpperCase(); },
      csrf() { return this.cfg.csrfToken; },
      toast(text, type = 'info', link = null) {
        const id = Date.now() + Math.random();
        this.toasts.push({ id, text, type, link });
        setTimeout(() => { this.toasts = this.toasts.filter((t) => t.id !== id); }, link ? 6000 : 3200);
      },
      flash(key) {
        this.flashed = { ...this.flashed, [key]: Date.now() };
        setTimeout(() => {
          const copy = { ...this.flashed };
          delete copy[key];
          this.flashed = copy;
        }, 1600);
      },
      isFlashed(key) { return !!this.flashed[key]; },
      touch(field) {
        if (this.aiFields[field]) {
          const copy = { ...this.aiFields };
          delete copy[field];
          this.aiFields = copy;
        }
      },
      setStatus(status) { this.form.status = status; this.statusAuto = false; this.touch('status'); },
      onKey(event) {
        const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement && document.activeElement.tagName);
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); this.createOrder(); return; }
        if (event.key === 'Escape' && this.voice.state === 'listening') { event.preventDefault(); this.stopVoice(true); return; }
        if (typing) return;
        // A focused button already reacts to Space natively (e.g. the mic button itself).
        const onButton = document.activeElement && document.activeElement.tagName === 'BUTTON';
        if (event.code === 'Space' && !event.repeat && !onButton) { event.preventDefault(); this.toggleVoice(); }
        if (event.key === '/') { event.preventDefault(); this.$refs.search.focus(); }
      },

      // ---------------------------------------------------------------- catalog & items
      get visibleProducts() {
        const query = this.search.trim().toLowerCase();
        return this.products.filter((p) => (this.category === null || p.category_id === this.category)
          && (!query || `${p.name_uz} ${p.name_ru}`.toLowerCase().includes(query)));
      },
      qty(id) { const item = this.items.find((i) => i.product_id === id); return item ? item.quantity : 0; },
      setQty(id, quantity) {
        const index = this.items.findIndex((i) => i.product_id === id);
        if (quantity <= 0) { if (index >= 0) this.items.splice(index, 1); return; }
        quantity = Math.min(quantity, 99);
        if (index >= 0) this.items[index].quantity = quantity;
        else this.items.push({ product_id: id, quantity });
      },
      add(p) { this.setQty(p.id, this.qty(p.id) + 1); this.flash('item-' + p.id); },
      get lines() {
        return this.items.filter((i) => this.byId[i.product_id]).map((i) => ({ ...i, product: this.byId[i.product_id] }));
      },
      get itemsCount() { return this.lines.reduce((sum, l) => sum + l.quantity, 0); },
      get total() { return this.lines.reduce((sum, l) => sum + l.quantity * l.product.price, 0); },
      reset() {
        this.items = [];
        this.form = { customer_name: '', phone: '', address: '', delivery_type: 'pickup', payment_method: 'cash', status: 'completed', comment: '' };
        this.statusAuto = true;
        this.aiFields = {};
        this.undoState = null;
        this.voice = { ...this.voice, state: 'idle', caption: '', transcript: '', reply: '', unmatched: [], error: '', submit: false };
      },

      // ---------------------------------------------------------------- create
      async createOrder() {
        if (this.creating) return;
        if (!this.lines.length) { this.toast(this.t('addItems'), 'error'); return; }
        this.creating = true;
        try {
          const response = await fetch(this.cfg.urls.create, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRFToken': this.csrf() },
            body: JSON.stringify({ items: this.items, ...this.form }),
          });
          const data = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(data.error || 'error');
          this.recent = [data.order, ...this.recent].slice(0, 8);
          this.stats = data.stats;
          this.flash('sale-' + data.order.id);
          this.toast(`${this.t('created')} · #${data.order.id}`, 'success', data.order.url);
          this.reset();
        } catch (e) {
          this.toast(this.t('error'), 'error');
        } finally {
          this.creating = false;
        }
      },

      // ---------------------------------------------------------------- AI: text command
      snapshot() { return { items: JSON.parse(JSON.stringify(this.items)), form: { ...this.form }, statusAuto: this.statusAuto }; },
      formState() { return { ...this.form, items: this.items }; },
      async sendCommand() {
        const text = this.command.trim();
        if (!text || this.voice.state === 'processing') return;
        this.command = '';
        this.voice = { ...this.voice, state: 'processing', caption: text, error: '', reply: '', unmatched: [], submit: false };
        await this.understand({ text }, this.snapshot());
      },

      async understand({ text, audio, liveText }, before) {
        try {
          let response;
          if (audio) {
            const body = new FormData();
            body.append('audio', audio, 'voice.' + (audio.type.includes('mp4') ? 'm4a' : audio.type.includes('ogg') ? 'ogg' : 'webm'));
            body.append('state', JSON.stringify(this.formState()));
            if (liveText) body.append('live_text', liveText);
            response = await fetch(this.cfg.urls.voiceParse, { method: 'POST', headers: { 'X-CSRFToken': this.csrf() }, body });
          } else {
            response = await fetch(this.cfg.urls.voiceParse, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'X-CSRFToken': this.csrf() },
              body: JSON.stringify({ text, state: this.formState() }),
            });
          }
          const data = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(data.error || 'error');
          this.apply(data.result, data.engine, before);
        } catch (e) {
          const key = { not_configured: 'notConfigured', empty_transcript: 'nothingHeard', ai_failed: 'aiFailed', transcription_failed: 'aiFailed' }[e.message];
          this.voice = { ...this.voice, state: 'idle', error: this.t(key || 'aiFailed') };
        }
      },

      apply(result, engine, before) {
        this.undoState = before;
        let changes = 0;
        let delay = 0;
        FIELDS.forEach((field) => {
          const value = result[field] || '';
          if (CHOICE_FIELDS.includes(field) && !value) return;
          if (value === this.form[field]) return;
          changes += 1;
          const run = () => {
            if (field === 'status') this.statusAuto = false;
            this.form[field] = value;
            this.aiFields = { ...this.aiFields, [field]: true };
            this.flash(field);
          };
          setTimeout(run, delay);
          delay += 110;
        });

        const next = (result.items || []).filter((i) => this.byId[i.product_id]);
        const previous = Object.fromEntries(this.items.map((i) => [i.product_id, i.quantity]));
        next.forEach((i) => { if (previous[i.product_id] !== i.quantity) { changes += 1; this.flash('item-' + i.product_id); } });
        if (this.items.some((i) => !next.find((n) => n.product_id === i.product_id))) changes += 1;
        this.items = next.map((i) => ({ product_id: i.product_id, quantity: i.quantity }));

        this.voice = {
          ...this.voice,
          state: 'done',
          transcript: result.transcript || this.voice.caption,
          reply: result.reply || (changes ? this.t('applied') : this.t('nothingChanged')),
          unmatched: result.unmatched || [],
          submit: !!result.submit && this.items.length > 0,
          resultEngine: engine,
          error: '',
        };
      },

      undo() {
        if (!this.undoState) return;
        this.items = this.undoState.items;
        this.form = this.undoState.form;
        this.statusAuto = this.undoState.statusAuto;
        this.aiFields = {};
        this.undoState = null;
        this.voice = { ...this.voice, state: 'idle', reply: '', transcript: '', unmatched: [], submit: false };
      },

      // ---------------------------------------------------------------- AI: voice
      get voiceEngineLabel() {
        // Reflect what the current session actually uses (Live can fall back to recording).
        if (this.voice.engine === 'record') return this.t('engineRecord');
        if (this.cfg.voice.live) return this.t('engineLive');
        if (this.cfg.voice.gemini) return this.t('engineRecord');
        return BrowserCaptions.supported() ? this.t('engineBrowser') : '';
      },
      toggleVoice() {
        if (this.voice.state === 'listening') this.stopVoice();
        else if (['idle', 'done'].includes(this.voice.state)) this.startVoice();
      },

      async startVoice() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { this.voice.error = this.t('noMic'); return; }
        if (!this.cfg.voice.gemini && !BrowserCaptions.supported()) { this.voice.error = this.t('noEngine'); return; }

        this.before = this.snapshot();
        this.voice = { ...this.voice, state: 'starting', engine: '', caption: '', transcript: '', reply: '', unmatched: [], error: '', seconds: 0, submit: false };
        const session = { chunks: [], startedAt: 0 };
        active = session;
        try {
          session.stream = await navigator.mediaDevices.getUserMedia({
            audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          });
        } catch (e) {
          active = null;
          this.voice = { ...this.voice, state: 'idle', error: this.t('micDenied') };
          return;
        }

        session.context = new (window.AudioContext || window.webkitAudioContext)();
        if (session.context.state === 'suspended') await session.context.resume().catch(() => {});
        session.source = session.context.createMediaStreamSource(session.stream);
        session.analyser = session.context.createAnalyser();
        session.analyser.fftSize = 256;
        session.analyser.smoothingTimeConstant = 0.7;
        session.source.connect(session.analyser);

        if (this.cfg.voice.gemini && window.MediaRecorder) {
          try {
            const mimeType = pickMimeType();
            session.recorder = new MediaRecorder(session.stream, mimeType ? { mimeType } : undefined);
            session.recorder.ondataavailable = (event) => { if (event.data.size) session.chunks.push(event.data); };
            session.recorder.start(250);
          } catch (e) {
            session.recorder = null; // live captions can still work without a recording
          }
        }

        const onText = (text) => { if (active === session) this.voice.caption = text; };
        if (this.cfg.voice.live && window.AudioWorkletNode) {
          // Capture starts before "listening" is shown; audio is queued until Live is connected.
          session.live = new LiveCaptions({ onText });
          try {
            await startPcm(session, (chunk) => { if (session.live) session.live.push(chunk); });
          } catch (e) {
            session.live = null;
          }
        }

        session.startedAt = Date.now();
        this.voice.state = 'listening';
        this.meter(session);
        session.timer = setInterval(() => {
          this.voice.seconds = Math.floor((Date.now() - session.startedAt) / 1000);
          if (Date.now() - session.startedAt > MAX_RECORDING_MS) this.stopVoice();
        }, 250);

        if (this.cfg.voice.live && window.AudioWorkletNode) {
          this.voice.engine = 'live';
          this.connectLive(session);
        } else if (this.cfg.voice.gemini) {
          this.voice.engine = 'record';
        } else {
          this.voice.engine = 'browser';
          session.browser = new BrowserCaptions({
            onText, lang: this.lang, onFatal: (code) => { if (active === session) this.stopVoice(true, code); },
          });
          try { session.browser.start(); } catch (e) { this.stopVoice(true, 'network'); }
        }
      },

      async connectLive(session) {
        const live = session.live;
        if (!live) { this.voice.engine = 'record'; return; }
        try {
          const response = await fetch(this.cfg.urls.voiceToken, { method: 'POST', headers: { 'X-CSRFToken': this.csrf() } });
          const token = await response.json();
          if (!response.ok) throw new Error(token.error || 'token_failed');
          await live.connect(token);
        } catch (e) {
          console.warn('Live captions unavailable; the recording is transcribed after you stop:', e);
          live.failed = true;
          if (session.live === live) session.live = null;
          if (active === session) this.voice.engine = 'record';
          if (live.socket && live.socket.readyState <= WebSocket.OPEN) live.socket.close(1000);
        }
      },

      meter(session) {
        const data = new Uint8Array(session.analyser.frequencyBinCount);
        const bars = this.$root.querySelectorAll('[data-bar]');
        const draw = () => {
          if (active !== session || this.voice.state !== 'listening') {
            bars.forEach((bar) => { bar.style.transform = 'scaleY(0.12)'; });
            return;
          }
          session.analyser.getByteFrequencyData(data);
          let peak = 0;
          const middle = (bars.length - 1) / 2;
          bars.forEach((bar, index) => {
            // Symmetric wave: low (speech-heavy) frequencies in the middle, higher ones towards the edges.
            const value = data[Math.min(data.length - 1, 1 + Math.round(Math.abs(index - middle)))] / 255;
            peak = Math.max(peak, value);
            bar.style.transform = `scaleY(${Math.max(0.12, Math.min(1, value * 1.35))})`;
          });
          this.$root.style.setProperty('--voice-level', peak.toFixed(2));
          session.frame = requestAnimationFrame(draw);
        };
        draw();
      },

      speechErrorText(code) {
        const key = {
          'not-allowed': 'speechDenied', 'service-not-allowed': 'speechDenied', 'audio-capture': 'speechNoMic',
          'language-not-supported': 'speechLanguage', network: 'speechUnavailable', 'bad-grammar': 'speechUnavailable',
        }[code];
        return this.t(key || 'nothingHeard');
      },

      async stopVoice(cancel = false, failure = null) {
        const session = active;
        if (!session || this.voice.state !== 'listening') return;
        const duration = Date.now() - session.startedAt;
        this.voice.state = cancel || failure ? 'idle' : 'processing';
        clearInterval(session.timer);
        cancelAnimationFrame(session.frame);

        // People press stop right after the last word: keep listening a moment so it is not cut off.
        if (!cancel && !failure) await new Promise((resolve) => setTimeout(resolve, TAIL_MS));
        await flushPcm(session);

        const stopRecorder = () => new Promise((resolve) => {
          if (!session.recorder || session.recorder.state === 'inactive') { resolve(null); return; }
          session.recorder.onstop = () => resolve(new Blob(session.chunks, { type: session.recorder.mimeType || 'audio/webm' }));
          session.recorder.stop();
        });
        const [liveText, browserText, audio] = await Promise.all([
          session.live ? session.live.stop().catch(() => '') : Promise.resolve(''),
          session.browser ? session.browser.stop() : Promise.resolve(''),
          stopRecorder(),
        ]);
        if (session.pcm) { session.pcm.port.onmessage = null; session.pcm.disconnect(); }
        session.stream.getTracks().forEach((track) => track.stop());
        session.context.close().catch(() => {});
        active = null;
        this.$root.style.setProperty('--voice-level', '0');

        if (failure) { this.voice = { ...this.voice, state: 'idle', caption: '', error: this.speechErrorText(failure) }; return; }
        if (cancel) { this.voice = { ...this.voice, state: 'idle', caption: '' }; return; }
        const heard = liveText || browserText;
        if (duration < 700 && !heard) { this.voice = { ...this.voice, state: 'idle', error: this.t('tooShort') }; return; }

        if (audio && audio.size > 0 && this.cfg.voice.gemini) {
          // The complete recording is the source of truth; live captions are sent as a fallback only.
          if (heard) this.voice.caption = heard;
          await this.understand({ audio, liveText: heard }, this.before);
        } else if (heard) {
          this.voice.caption = heard;
          await this.understand({ text: heard }, this.before);
        } else {
          const reason = session.browser && session.browser.error;
          this.voice = { ...this.voice, state: 'idle', error: reason ? this.speechErrorText(reason) : this.t('nothingHeard') };
        }
      },

      get timer() {
        const s = this.voice.seconds;
        return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
      },
    }));
  });
})();
