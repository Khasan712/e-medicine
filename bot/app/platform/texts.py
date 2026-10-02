"""Our platform bot (uz / ru)."""

TEXTS = {
    'uz': {
        'start': ("🚀 <b>{business}</b> uchun Telegram botlarini yaratamiz.\n\n"
                  "Ikki qadam: avval mijozlar boti, keyin xodimlar boti. Pastdagi tugmani bosing — "
                  "Telegram botni o'zi yaratadi, qolganini men sozlayman."),
        'step_client': ("1/2 · 🛍 <b>Mijozlar boti</b> — mijozlar shu bot orqali do'konni ochadi va buyurtma "
                        "holatini oladi. Tavsiya: @{username}\n\nTugma ko'rinmasa: {link}"),
        'step_admin': ("2/2 · 🛠 <b>Xodimlar boti</b> — buyurtmani ovoz bilan kiritish va yangi buyurtmalarni "
                       "qabul qilish uchun. Tavsiya: @{username}\n\nTugma ko'rinmasa: {link}"),
        'btn_client': '🛍 Mijozlar botini yaratish',
        'btn_admin': '🛠 Xodimlar botini yaratish',
        'connected': '✅ @{username} ulandi va sozlandi.',
        'done': ("🎉 Tayyor! <b>{business}</b>\n\n"
                 "🛍 Mijozlar boti: @{client}\n🛠 Xodimlar boti: @{admin} — siz unga ulandingiz\n"
                 "🌐 Do'kon: {shop}\n📊 Admin panel: {panel}"),
        'invalid': "❌ Havola eskirgan yoki noto'g'ri. Platforma panelidan yangisini oling.",
        'unknown_bot': "🤔 Bu bot qaysi biznesga tegishli ekanini bilmayman. Avval paneldagi havolani oching.",
        'failed': ("⚠️ @{username} yaratildi, lekin Telegram bilan aloqa uzilib, uni ulab bo'lmadi. "
                   "«🔄 Qayta ulash» tugmasini bosing — yangi bot yaratish shart emas."),
        'btn_retry': '🔄 Qayta ulash',
        'still_failed': "Hali ulanmadi — birozdan so'ng yana bosing",
        'in_use': '⚠️ Bu bot boshqa biznesga ulangan.',
        'hello': "👋 Bu DeliveryHub platformasining boti. Biznes botlarini yaratish uchun paneldagi havolani oching.",
    },
    'ru': {
        'start': ('🚀 Создаём Telegram-ботов для <b>{business}</b>.\n\n'
                  'Два шага: сначала бот для клиентов, затем бот для сотрудников. Нажмите кнопку ниже — '
                  'Telegram сам создаст бота, остальное настрою я.'),
        'step_client': ('1/2 · 🛍 <b>Бот для клиентов</b> — через него клиенты открывают магазин и получают '
                        'статус заказа. Предлагаю: @{username}\n\nЕсли кнопки нет: {link}'),
        'step_admin': ('2/2 · 🛠 <b>Бот для сотрудников</b> — ввод заказов голосом и приём новых заказов. '
                       'Предлагаю: @{username}\n\nЕсли кнопки нет: {link}'),
        'btn_client': '🛍 Создать бота для клиентов',
        'btn_admin': '🛠 Создать бота для сотрудников',
        'connected': '✅ @{username} подключён и настроен.',
        'done': ('🎉 Готово! <b>{business}</b>\n\n'
                 '🛍 Бот для клиентов: @{client}\n🛠 Бот для сотрудников: @{admin} — вы уже подключены\n'
                 '🌐 Магазин: {shop}\n📊 Админ-панель: {panel}'),
        'invalid': '❌ Ссылка устарела или неверна. Получите новую в панели платформы.',
        'unknown_bot': '🤔 Не знаю, к какому бизнесу относится этот бот. Сначала откройте ссылку из панели.',
        'failed': ('⚠️ @{username} создан, но связь с Telegram прервалась и подключить его не удалось. '
                   'Нажмите «🔄 Подключить снова» — создавать нового бота не нужно.'),
        'btn_retry': '🔄 Подключить снова',
        'still_failed': 'Пока не удалось — нажмите ещё раз чуть позже',
        'in_use': '⚠️ Этот бот уже подключён к другому бизнесу.',
        'hello': '👋 Это бот платформы DeliveryHub. Чтобы создать ботов бизнеса, откройте ссылку из панели.',
    },
}


def t(lang, key, **kwargs):
    text = TEXTS.get(lang, TEXTS['uz'])[key]
    return text.format(**kwargs) if kwargs else text


def language_of(telegram_user):
    code = getattr(telegram_user, 'language_code', None) or ''
    return 'ru' if code.startswith('ru') else 'uz'
