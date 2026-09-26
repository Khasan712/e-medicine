# e-medicine — kichik bizneslar uchun yetkazib berish platformasi

Mijozlar masofadan buyurtma beradi (Telegram bot, Telegram Mini App yoki sayt), tadbirkor hammasini
bitta admin panelda ko'radi va boshqaradi. Tadbirkorning o'zi ham buyurtma yarata oladi — qo'lda yoki ovoz bilan.

| Qism | Manzil | Nima qiladi |
|---|---|---|
| Admin panel (`dashboard`) | `/` | Buyurtmalar, mijozlar, mahsulotlar, statistika, **Sotuv** bo'limi |
| Sotuv (`dashboard/sales.py`) | `/sales/` | Admin panelda buyurtma yaratish: qo'lda yoki **ovoz bilan (AI)** |
| Onlayn do'kon (`shop`) | `/shop/` | Mijozlar uchun sayt **va** Telegram Mini App (bitta sahifa) |
| Telegram bot (`bot/`) | — | Chat orqali buyurtma, Mini App tugmasi, saytga Telegram orqali kirish |
| Django admin | `/django-admin/` | Texnik boshqaruv |

Stek: Django 5.1, PostgreSQL 16, Alpine.js, Tailwind (dashboard), aiogram 3 + SQLAlchemy (bot), Google Gemini API.

## Ishga tushirish

```bash
cp .env.example .env        # qiymatlarni to'ldiring
docker compose up -d --build
docker compose exec app python manage.py createsuperuser   # admin panelga kirish uchun
```

Sayt: `http://localhost:9092/shop/` · Admin panel: `http://localhost:9092/`

Testlar: `docker compose exec app python manage.py test shop dashboard`

## Onlayn do'kon (`/shop/`) — sayt + Telegram Mini App

- Rasmli menyu, kategoriyalar, qidiruv, savat, rasmiylashtirish (yetkazib berish / olib ketish, naqd / karta, geolokatsiya),
  buyurtma holatini kuzatish, "yana buyurtma berish", o'zbek / rus tili, yorug' / qorong'i mavzu.
- **Ro'yxatdan o'tish / kirish** (mijozlar `app.Client` jadvalida — bot bilan umumiy):
  - **Telefon raqam** — SMS kod (`SMS_BACKEND`: `eskiz`, `telegram_gateway` yoki dev uchun `console`).
  - **Telegram (saytda)** — "Telegram orqali kirish" botni `?start=login_<token>` bilan ochadi, bot tasdiqlaydi, sayt avtomatik kiradi.
  - **Telegram Mini App** — `initData` imzosi tekshiriladi va mijoz avtomatik kiradi (hech narsa kiritish shart emas).
- Buyurtma `source` maydoni bilan saqlanadi: `bot`, `web`, `miniapp`, `admin` — admin panelda belgi va filtr bor.
- Yangi buyurtma haqida mijozga (agar Telegram'i bo'lsa) va `ORDERS_NOTIFY_CHAT_ID` guruhiga xabar ketadi.

**Mini App'ni ulash:** `bot/.env` ga `WEBAPP_URL=https://<domen>/shop/` yozing (HTTPS shart) va botni qayta ishga tushiring —
bot chat pastidagi **menyu tugmasini** o'zi o'rnatadi va `/start` da "Onlayn do'konni ochish" tugmasini ko'rsatadi.
Reply-klaviatura tugmasi ishlatilmaydi: u Mini App'ga foydalanuvchi ma'lumotini (`initData`) bermaydi.

## Sotuv bo'limi (`/sales/`) — qo'lda va ovoz bilan buyurtma

- Mahsulotni bosib qo'shish, mijoz (ixtiyoriy), yetkazish/olib ketish, to'lov, holat, izoh → **Buyurtma yaratish** (`Ctrl+Enter`).
- Mijoz kartasi **yaratilmaydi**: buyurtma `client=NULL`, ism/telefon buyurtmaning o'zida, `source=admin`, `created_by` = xodim.
- **Mikrofon (AI):** tadbirkor buyurtmani aytadi — maydonlar to'ldiriladi, tekshirib, tugmani bosadi.
  "yana bitta …", "… ni olib tashla", "hammasini tozala" kabi tahrir buyruqlari ham ishlaydi; "Qaytarish" (undo) bor.
  Klaviatura: `Space` — yozishni boshlash/to'xtatish, `Esc` — bekor qilish, `/` — mahsulot qidirish.

### Ovozli yordamchi qanday ishlaydi (Gemini)

1. Gapirayotganda brauzer mikrofon ovozini (16 kHz PCM) **Gemini Live API** ga to'g'ridan-to'g'ri uzatadi
   (`gemini-3.5-transcribe-live`) — so'zlar ekranda jonli chiqadi. API kalit brauzerga berilmaydi: server
   bir martalik, faqat shu modelga cheklangan **ephemeral token** chiqaradi.
2. To'xtaganda matn + joriy forma + mahsulotlar katalogi **Gemini Flash-Lite** ga (`gemini-3.5-flash-lite`, JSON schema,
   ~1.5 s) yuboriladi; u yangilangan formani qaytaradi (mahsulotlar katalog ID'lariga bog'lanadi, topilmaganlari alohida
   ko'rsatiladi). Model band bo'lsa (503) avtomatik `GEMINI_PARSE_FALLBACK_MODELS` dagi keyingi modelga o'tiladi.
3. Live ishlamasa, yozib olingan audio serverda `gemini-3.5-transcribe` bilan matnga aylantiriladi
   (mahsulot nomlari `custom_vocabulary` sifatida beriladi), u ham ishlamasa — audio to'g'ridan-to'g'ri Flash'ga.

`GEMINI_API_KEY` bo'lmasa ham sahifa ishlaydi: yozma buyruqlar lokal parser bilan tahlil qilinadi, mikrofon esa
brauzerning o'z nutq tanish xizmatiga tayanadi (demo; Safari o'zbek tilini qo'llamaydi). Kalit bilan ovoz barcha zamonaviy
brauzerlarda (Chrome, Safari, Edge) ishlaydi. Kalit: <https://aistudio.google.com/apikey>. `.env` o'zgargach:
`docker compose up -d --force-recreate app`.

## Asosiy sozlamalar (`.env`)

| O'zgaruvchi | Tavsif |
|---|---|
| `SHOP_NAME`, `SHOP_TAGLINE`, `SHOP_SUPPORT_PHONE`, `SHOP_DELIVERY_TIME`, `SHOP_MIN_ORDER` | Do'kon ko'rinishi va minimal buyurtma |
| `SMS_BACKEND` + `ESKIZ_*` / `TELEGRAM_GATEWAY_TOKEN` | Telefon orqali kirish kodlari. `console` — faqat server logiga (dev) |
| `SHOP_OTP_DEBUG` | Faqat lokal: kodni ekranda ko'rsatadi. **Production'da yoqmang** |
| `ORDERS_NOTIFY_CHAT_ID` | Yangi buyurtmalar haqida xabar boradigan chat/guruh ID |
| `GEMINI_API_KEY`, `GEMINI_*_MODEL`, `GEMINI_PARSE_FALLBACK_MODELS`, `GEMINI_LIVE_ENABLED` | Ovozli yordamchi |
| `bot/.env`: `WEBAPP_URL` | Mini App manzili (HTTPS) |

To'liq ro'yxat: `.env.example`.
