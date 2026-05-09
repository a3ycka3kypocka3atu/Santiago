require('dotenv').config();
console.log('[Bot] Script started');
const { Telegraf, Markup, session } = require('telegraf');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

// ── ENV CONFIG ──
const BOT_TOKEN = process.env.BOT_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;

if (!BOT_TOKEN || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing required environment variables.");
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

bot.use(session());

// ── MIDDLEWARE: UPSERT USER IN DB ──
bot.use(async (ctx, next) => {
  try {
    if (ctx.from) {
      const isAdmin = ctx.from.username && ctx.from.username.toLowerCase() === 'andrisav';
      const initialRole = isAdmin ? 'admin' : 'guest';
      
      let { data: profile, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('telegram_id', ctx.from.id)
        .single();

      if (fetchError && fetchError.code === 'PGRST116') {
        console.log(`[Bot] No profile for @${ctx.from.username}, will create/ask later`);
        ctx.userRole = initialRole;
        ctx.isNewUser = true;
      } else if (profile) {
        if (isAdmin && profile.role !== 'admin') {
          console.log(`[Bot] Upgrading @${ctx.from.username} to admin`);
          const { data: updated } = await supabase.from('profiles').update({ role: 'admin' }).eq('telegram_id', ctx.from.id).select().single();
          ctx.userRole = 'admin';
          ctx.dbUser = updated;
        } else {
          ctx.userRole = profile.role;
          ctx.dbUser = profile;
        }
      } else {
        ctx.userRole = 'guest';
      }
    }
  } catch (err) {
    console.error('[Bot] Middleware error:', err);
  }
  return next();
});

// ── START COMMAND & MAIN MENU ──
const mainMenu = Markup.inlineKeyboard([
  [Markup.button.callback('ℹ️ Про проєкт (FAQ)', 'faq_about')],
  [Markup.button.callback('🧘 Напрямки', 'faq_directions')],
  [Markup.button.callback('🔑 Як працює клуб', 'faq_club')],
  [Markup.button.callback('🚀 Вступити до клубу', 'apply_club')],
  [Markup.button.callback('⚙️ Панель Інструктора/Адміна', 'instructor_menu')]
]);

bot.start(async (ctx) => {
  const startPayload = ctx.startPayload;
  
  // If user is new and not admin, ask who they are
  if (ctx.isNewUser && ctx.userRole !== 'admin') {
    return ctx.reply(
      'Вітаємо! Хто ви у нашому просторі?',
      Markup.inlineKeyboard([
        [Markup.button.callback('🌟 Клубний учасник', 'set_role_resident')],
        [Markup.button.callback('🧘 Інструктор', 'set_role_instructor')],
        [Markup.button.callback('👀 Гість / Відвідувач', 'set_role_guest')]
      ])
    );
  }

  // If new admin, create profile immediately
  if (ctx.isNewUser && ctx.userRole === 'admin') {
    const { data: newProfile, error } = await supabase.from('profiles').insert({
      id: crypto.randomUUID(),
      telegram_id: ctx.from.id,
      username: ctx.from.username,
      full_name: ctx.from.first_name + (ctx.from.last_name ? ' ' + ctx.from.last_name : ''),
      role: 'admin'
    }).select().single();
    
    if (error) console.error('[Bot] Admin creation error:', error);
    ctx.dbUser = newProfile;
  }

  if (startPayload === 'login') {
    const portalUrl = `https://a3ycka3kypocka3atu.github.io/-/index.html?userId=${ctx.from.id}`;
    return ctx.reply(
      `🔑 Ви входите у систему як ${ctx.userRole}.\n\nНатисніть кнопку нижче, щоб відкрити портал:`,
      Markup.inlineKeyboard([
        [Markup.button.url('🔓 Відкрити портал', portalUrl)]
      ])
    );
  }

  ctx.reply(
    `Вітаємо у боті студії Santiago! 👋\n\nТут ви можете дізнатися більше про нас, подати заявку до клубу або керувати розкладом (для інструкторів).`,
    mainMenu
  );
});

// Role selection handlers
bot.action(/set_role_(resident|instructor|guest)/, async (ctx) => {
  const role = ctx.match[1];
  const { data, error } = await supabase.from('profiles').insert({
    id: crypto.randomUUID(),
    telegram_id: ctx.from.id,
    username: ctx.from.username,
    full_name: ctx.from.first_name + (ctx.from.last_name ? ' ' + ctx.from.last_name : ''),
    role: role
  }).select().single();

  if (error) {
    console.error('[Bot] Role selection error:', error);
    return ctx.answerCbQuery('Помилка при збереженні профілю.');
  }

  ctx.reply(`✅ Дякуємо! Тепер ви зареєстровані як ${role}. Ви можете увійти на платформу.`);
  ctx.reply('Виберіть дію:', mainMenu);
  ctx.answerCbQuery();
});

// ── FAQ BRANCH ──
bot.action('faq_about', (ctx) => {
  ctx.reply('Santiago — це простір для тілесних і духовних практик, нетворкінгу та розвитку.\n\nМи об\'єднуємо майстрів та тих, хто шукає свій шлях.');
  ctx.answerCbQuery();
});

bot.action('faq_directions', (ctx) => {
  ctx.reply('Наші основні напрямки:\n- Йога та медитація\n- Тілесна терапія та масаж\n- Цвяхостояння\n- Бізнес-нетворкінг (для резидентів клубу)');
  ctx.answerCbQuery();
});

bot.action('faq_club', (ctx) => {
  ctx.reply('Клуб Santiago — це закрита спільнота для постійних резидентів. Резиденти отримують доступ до ексклюзивних подій, знижки на оренду та можливість брати участь у внутрішніх зустрічах.\n\nЩоб стати резидентом, подайте заявку через меню.');
  ctx.answerCbQuery();
});

// ── CLUB APPLICATION BRANCH ──
bot.action('apply_club', (ctx) => {
  ctx.session = { state: 'applying_name' };
  ctx.reply('Чудово! Давайте розпочнемо. \n\nЯк до вас звертатися (Ім\'я та Прізвище)?');
  ctx.answerCbQuery();
});

// ── INSTRUCTOR WIZARD BRANCH ──
bot.action('instructor_menu', async (ctx) => {
  if (ctx.userRole !== 'instructor' && ctx.userRole !== 'admin') {
    return ctx.answerCbQuery('У вас немає доступу до цього меню.', { show_alert: true });
  }

  ctx.reply(
    'Панель Інструктора',
    Markup.inlineKeyboard([
      [Markup.button.callback('➕ Створити нову подію', 'create_event')],
      [Markup.button.callback('🛒 Створити послугу', 'create_service')]
    ])
  );
  ctx.answerCbQuery();
});

bot.action('create_event', (ctx) => {
  if (ctx.userRole !== 'instructor' && ctx.userRole !== 'admin') return ctx.answerCbQuery('Доступ заборонено.', { show_alert: true });
  
  ctx.session = { state: 'event_title' };
  ctx.reply('Створення події: Крок 1/4\n\nВведіть назву події (напр. "Ранкова Йога"):');
  ctx.answerCbQuery();
});

// ── TEXT HANDLER (STATE MACHINE) ──
bot.on('text', async (ctx, next) => {
  if (!ctx.session || !ctx.session.state) return next();

  const state = ctx.session.state;
  const text = ctx.message.text;

  // Club Application States
  if (state === 'applying_name') {
    ctx.session.appName = text;
    ctx.session.state = 'applying_occ';
    ctx.reply('Чим ви займаєтесь (ваша професія чи проєкт)?');
    return;
  }
  if (state === 'applying_occ') {
    ctx.session.appOcc = text;
    ctx.session.state = 'applying_mot';
    ctx.reply('Чому ви хочете приєднатися до клубу?');
    return;
  }
  if (state === 'applying_mot') {
    ctx.session.appMot = text;
    ctx.session.state = null; // Clear state
    
    ctx.reply('Дякуємо! Вашу заявку відправлено адміністраторам. Ми повідомимо вас про результати.');

    // Save to profiles (update)
    await supabase.from('profiles').update({
      full_name: ctx.session.appName,
      occupation: ctx.session.appOcc,
      motivation: ctx.session.appMot
    }).eq('telegram_id', ctx.from.id);

    // Notify Admins
    if (ADMIN_CHAT_ID) {
      bot.telegram.sendMessage(
        ADMIN_CHAT_ID,
        `🔔 **Нова заявка в Клуб**\n\nІм'я: ${ctx.session.appName}\nTG: @${ctx.from.username || 'немає'} (${ctx.from.id})\n\n**Чим займається**: ${ctx.session.appOcc}\n**Мотивація**: ${ctx.session.appMot}`,
        Markup.inlineKeyboard([
          [Markup.button.callback(`✅ Схвалити`, `approve_${ctx.from.id}`)],
          [Markup.button.callback(`❌ Відхилити`, `reject_${ctx.from.id}`)]
        ])
      );
    }
    return;
  }

  // Event Creation States
  if (state === 'event_title') {
    ctx.session.eventTitle = text;
    ctx.session.state = 'event_desc';
    ctx.reply('Крок 2/4\n\nВведіть короткий опис події:');
    return;
  }
  if (state === 'event_desc') {
    ctx.session.eventDesc = text;
    ctx.session.state = 'event_date';
    ctx.reply('Крок 3/4\n\nВведіть дату та час початку у форматі YYYY-MM-DD HH:MM (напр. 2026-06-01 10:00):');
    return;
  }
  if (state === 'event_date') {
    // Very basic validation
    const dateObj = new Date(text);
    if (isNaN(dateObj.getTime())) {
      ctx.reply('❌ Неправильний формат дати. Спробуйте ще раз у форматі YYYY-MM-DD HH:MM (напр. 2026-06-01 10:00):');
      return;
    }
    ctx.session.eventStart = dateObj.toISOString();
    
    // Assume 1.5 hours duration for MVP
    const endObj = new Date(dateObj.getTime() + 90 * 60000);
    ctx.session.eventEnd = endObj.toISOString();

    ctx.session.state = null; // Clear state
    
    ctx.reply('Крок 4/4\n\nОберіть тип події:', Markup.inlineKeyboard([
      [Markup.button.callback('🟢 Публічна (Для всіх)', 'event_type_public')],
      [Markup.button.callback('🟣 Клубна (Тільки резиденти)', 'event_type_club')],
      [Markup.button.callback('⚪️ Внутрішня (Тільки стаф)', 'event_type_internal')]
    ]));
    return;
  }

  return next();
});

// ── EVENT TYPE SELECTION ──
bot.action(/event_type_(public|club|internal)/, async (ctx) => {
  if (!ctx.session || !ctx.session.eventTitle) return ctx.answerCbQuery('Помилка сесії. Спробуйте знову.', { show_alert: true });
  if (ctx.userRole !== 'instructor' && ctx.userRole !== 'admin') return ctx.answerCbQuery('Доступ заборонено.', { show_alert: true });

  const type = ctx.match[1];
  
  // Get instructor ID from profiles
  const { data: profile } = await supabase.from('profiles').select('id').eq('telegram_id', ctx.from.id).single();

  const { error } = await supabase.from('events').insert({
    title: ctx.session.eventTitle,
    description: ctx.session.eventDesc,
    start_time: ctx.session.eventStart,
    end_time: ctx.session.eventEnd,
    type: type,
    instructor_id: profile ? profile.id : null,
    status: 'confirmed'
  });

  if (error) {
    console.error('Error creating event:', error);
    ctx.reply('❌ Помилка при створенні події.');
  } else {
    ctx.reply(`✅ Подію "${ctx.session.eventTitle}" успішно створено та додано в розклад!`);
  }
  
  ctx.session = null;
  ctx.answerCbQuery();
});

// ── SERVICE CREATION WIZARD ──
bot.action('create_service', (ctx) => {
  if (ctx.userRole !== 'instructor' && ctx.userRole !== 'admin') return ctx.answerCbQuery('Доступ заборонено.', { show_alert: true });

  ctx.session = { state: 'service_title' };
  ctx.reply('Створення послуги: Крок 1/8\n\nВведіть назву послуги (напр. "Курс Медитації"):');
  ctx.answerCbQuery();
});

bot.on('text', async (ctx, next) => {
  if (!ctx.session || !ctx.session.state) return next();

  const state = ctx.session.state;
  const text = ctx.message.text;

  // Service Creation States
  if (state === 'service_title') {
    ctx.session.serviceTitle = text;
    ctx.session.state = 'service_desc';
    ctx.reply('Крок 2/8\n\nВведіть опис послуги:');
    return;
  }
  if (state === 'service_desc') {
    ctx.session.serviceDesc = text;
    ctx.session.state = 'service_price';
    ctx.reply('Крок 3/8\n\nВведіть ціну (напр. "1200 CZK" або "Індивідуально"):');
    return;
  }
  if (state === 'service_price') {
    ctx.session.servicePrice = text;
    ctx.session.state = 'service_duration';
    ctx.reply('Крок 4/8\n\nВведіть тривалість у хвилинах (напр. "60"):');
    return;
  }
  if (state === 'service_duration') {
    const duration = parseInt(text, 10);
    if (isNaN(duration) || duration <= 0) {
      ctx.reply('❌ Неправильне значення. Введіть число хвилин (напр. "60"):');
      return;
    }
    ctx.session.serviceDuration = duration;
    ctx.session.state = 'service_location_type';
    ctx.reply('Крок 5/8\n\nОберіть тип локації:', Markup.inlineKeyboard([
      [Markup.button.callback('💻 Онлайн (Zoom, курси)', 'service_loc_online')],
      [Markup.button.callback('🏠 У студії', 'service_loc_offline_studio')],
      [Markup.button.callback('🏢 Виїзне (оренда)', 'service_loc_offline_external')]
    ]));
    return;
  }
  if (state === 'service_recurrence_yes') {
    ctx.session.state = 'service_rrule';
    ctx.reply('Крок 7/8\n\nНалаштуйте повторення:\n\nПриклади:\n• Щоп\'ятниці о 09:30 — FREQ=WEEKLY;BYDAY=FR;BYHOUR=9;BYMINUTE=30\n• ЩоMonday о 18:00 — FREQ=WEEKLY;BYDAY=MO;BYHOUR=18;BYMINUTE=0\n• Кожного 15-го числа — FREQ=MONTHLY;BYMONTHDAY=15;BYHOUR=10;BYMINUTE=0\n\nВведіть RRULE规则的 частину (після "RRULE:"):');
    return;
  }
  if (state === 'service_rrule') {
    ctx.session.serviceRrule = text.trim().toUpperCase();
    ctx.session.state = 'service_slug';
    ctx.reply('Крок 8/8\n\nВведіть slug для URL (напр. "meditation-course"). Це буде частиною посилання на сторінку послуги:');
    return;
  }
  if (state === 'service_slug') {
    ctx.session.serviceSlug = text.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
    ctx.session.state = null;

    // Get instructor ID
    const { data: profile } = await supabase.from('profiles').select('id').eq('telegram_id', ctx.from.id).single();

    const { error } = await supabase.from('services').insert({
      slug: ctx.session.serviceSlug,
      title: ctx.session.serviceTitle,
      description: ctx.session.serviceDesc,
      price: ctx.session.servicePrice,
      duration_minutes: ctx.session.serviceDuration,
      location_type: ctx.session.serviceLocationType || 'offline_studio',
      recurrence_rule: ctx.session.serviceRrule || null,
      is_evergreen: ctx.session.serviceIsEvergreen || false,
      detail_page: `offer-${ctx.session.serviceSlug}.html`,
      instructor_id: profile ? profile.id : null,
      status: 'published'
    });

    if (error) {
      console.error('Error creating service:', error);
      ctx.reply('❌ Помилка при створенні послуги.');
    } else {
      ctx.reply(`✅ Послугу "${ctx.session.serviceTitle}" успішно створено!`);
    }

    ctx.session = null;
    return;
  }

  return next();
});

// ── SERVICE LOCATION TYPE ──
bot.action(/service_loc_(online|offline_studio|offline_external)/, (ctx) => {
  if (ctx.userRole !== 'instructor' && ctx.userRole !== 'admin') return ctx.answerCbQuery('Доступ заборонено.', { show_alert: true });
  if (!ctx.session || ctx.session.state !== 'service_location_type') return ctx.answerCbQuery('Помилка сесії.', { show_alert: true });

  const locType = ctx.match[1];
  ctx.session.serviceLocationType = locType;
  ctx.session.state = 'service_evergreen';

  ctx.reply('Крок 6/8\n\nЧи це постійна послуга без фіксованих дат (напр. курс у записі)?', Markup.inlineKeyboard([
    [Markup.button.callback('✅ Так, always available', 'service_evergreen_yes')],
    [Markup.button.callback('❌ Ні, є розклад', 'service_evergreen_no')]
  ]));
  ctx.answerCbQuery();
});

// ── SERVICE EVERGREEN CHOICE ──
bot.action(/service_evergreen_(yes|no)/, (ctx) => {
  if (ctx.userRole !== 'instructor' && ctx.userRole !== 'admin') return ctx.answerCbQuery('Доступ заборонено.', { show_alert: true });
  if (!ctx.session || ctx.session.state !== 'service_evergreen') return ctx.answerCbQuery('Помилка сесії.', { show_alert: true });

  const isEvergreen = ctx.match[1] === 'yes';
  ctx.session.serviceIsEvergreen = isEvergreen;

  if (isEvergreen) {
    ctx.session.state = 'service_slug';
    ctx.reply('Крок 8/8\n\nВведіть slug для URL (напр. "meditation-course"):');
  } else {
    ctx.session.state = 'service_recurrence_yes';
    ctx.reply('Крок 7/8\n\nЧи повторюється послуга регулярно?', Markup.inlineKeyboard([
      [Markup.button.callback('🔄 Так, регулярне заняття', 'service_recurring_yes')],
      [Markup.button.callback('📅 Одноразова послуга', 'service_recurring_no')]
    ]));
  }
  ctx.answerCbQuery();
});

// ── SERVICE RECURRENCE CHOICE ──
bot.action(/service_recurring_(yes|no)/, (ctx) => {
  if (ctx.userRole !== 'instructor' && ctx.userRole !== 'admin') return ctx.answerCbQuery('Доступ заборонено.', { show_alert: true });
  if (!ctx.session || ctx.session.state !== 'service_recurrence_yes') return ctx.answerCbQuery('Помилка сесії.', { show_alert: true });

  if (ctx.match[1] === 'yes') {
    ctx.session.state = 'service_rrule';
    ctx.reply('Крок 7/8 (RRULE)\n\nНалаштуйте повторення:\n\nПриклади:\n• Щоп\'ятниці о 09:30 — FREQ=WEEKLY;BYDAY=FR;BYHOUR=9;BYMINUTE=30\n• ЩоMonday о 18:00 — FREQ=WEEKLY;BYDAY=MO;BYHOUR=18;BYMINUTE=0\n• Кожного 15-го числа — FREQ=MONTHLY;BYMONTHDAY=15;BYHOUR=10;BYMINUTE=0\n\nВведіть RRULE правило (після "RRULE:"):');
  } else {
    ctx.session.serviceRrule = null;
    ctx.session.state = 'service_slug';
    ctx.reply('Крок 8/8\n\nВведіть slug для URL (напр. "meditation-course"):');
  }
  ctx.answerCbQuery();
});

// ── ADMIN APPROVALS ──
bot.action(/approve_(\d+)/, async (ctx) => {
  const tgId = ctx.match[1];
  
  const { error } = await supabase
    .from('profiles')
    .update({ role: 'resident' })
    .eq('telegram_id', tgId);

  if (error) {
    console.error(error);
    return ctx.answerCbQuery('Помилка.', { show_alert: true });
  }

  ctx.editMessageText(ctx.callbackQuery.message.text + '\n\n✅ СХВАЛЕНО');
  bot.telegram.sendMessage(tgId, '🎉 Вітаємо! Ваша заявка до клубу схвалена. Тепер ви маєте доступ до клубних подій на сайті.');
});

bot.action(/reject_(\d+)/, (ctx) => {
  const tgId = ctx.match[1];
  ctx.editMessageText(ctx.callbackQuery.message.text + '\n\n❌ ВІДХИЛЕНО');
  bot.telegram.sendMessage(tgId, 'На жаль, вашу заявку на вступ до клубу наразі відхилено.');
});

// ── GROUP HANDLERS ──
bot.on('new_chat_members', (ctx) => {
  const newMembers = ctx.message.new_chat_members;
  newMembers.forEach(member => {
    if (member.is_bot) return;
    
    const name = member.username ? `@${member.username}` : member.first_name;
    const welcomeMsg = `Вітаємо у Santiago Club, ${name}! 🌿

Сантьяго — це більше, ніж студія. Це наш закритий простір для тілесних і духовних практик, нетворкінгу, інкубатор ідей та колівінг.

Наш сайт: <a href="https://brown-delta-28.vercel.app/index.html">santiago.com</a>

Щоб підтримувати наш «Цифровий Дзен» та порядок, група поділена на тематичні гілки. Будь ласка, орієнтуйся на них та пиши повідомлення у відповідні розділи:

• <a href="https://t.me/c/3925457957/16">🦆 Знакомство</a> — розкажи тут трохи про себе: хто ти, чим займаєшся, які проєкти шукаєш та чим можеш поділитися зі спільнотою.
• <a href="https://t.me/c/3925457957/19">☀️ Клуб Сантьяго</a> — інформація про клуб, офіційні повідомлення та важливі організаційні питання екосистеми.
• <a href="https://t.me/c/3925457957/2">💬 General</a> — загальні питання, побут колівінгу та вільне спілкування.
• <a href="https://t.me/c/3925457957/24">🌿 Программа студии</a> — розклад занять інструкторів, вільні години залу та обговорення практик.
• <a href="https://t.me/c/3925457957/17">💡 Идеи</a> та <a href="https://t.me/c/3925457957/18">🌟 Проекты</a> — наш Інкубатор. Ділимося новими задумами, пітчимо ідеї, шукаємо команду та обговорюємо спільну реалізацію.
• <a href="https://t.me/c/3925457957/20">❤️ Анонсы</a> — найважливіші новини екосистеми, офіційні заходи та оновлення нашого маркетплейсу.
• <a href="https://t.me/c/3925457957/21">🌈 Нетворкинг</a> — організація спільних зустрічей, виїздів, неформальне спілкування та запити на взаємодопомогу.

Раді вітати серед своїх! ✨`;

    ctx.reply(welcomeMsg, { disable_web_page_preview: true, parse_mode: 'HTML' });
  });
});

bot.command('testwelcome', (ctx) => {
  const name = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name;
  const welcomeMsg = `Вітаємо у Santiago Club, ${name}! 🌿

Сантьяго — це більше, ніж студія. Це наш закритий простір для тілесних і духовних практик, нетворкінгу, інкубатор ідей та колівінг.

Наш сайт: <a href="https://brown-delta-28.vercel.app/index.html">santiago.com</a>

Щоб підтримувати наш «Цифровий Дзен» та порядок, група поділена на тематичні гілки. Будь ласка, орієнтуйся на них та пиши повідомлення у відповідні розділи:

• <a href="https://t.me/c/3925457957/16">🦆 Знакомство</a> — розкажи тут трохи про себе: хто ти, чим займаєшся, які проєкти шукаєш та чим можеш поділитися зі спільнотою.
• <a href="https://t.me/c/3925457957/19">☀️ Клуб Сантьяго</a> — інформація про клуб, офіційні повідомлення та важливі організаційні питання екосистеми.
• <a href="https://t.me/c/3925457957/2">💬 General</a> — загальні питання, побут колівінгу та вільне спілкування.
• <a href="https://t.me/c/3925457957/24">🌿 Программа студии</a> — розклад занять інструкторів, вільні години залу та обговорення практик.
• <a href="https://t.me/c/3925457957/17">💡 Идеи</a> та <a href="https://t.me/c/3925457957/18">🌟 Проекты</a> — наш Інкубатор. Ділимося новими задумами, пітчимо ідеї, шукаємо команду та обговорюємо спільну реалізацію.
• <a href="https://t.me/c/3925457957/20">❤️ Анонсы</a> — найважливіші новини екосистеми, офіційні заходи та оновлення нашого маркетплейсу.
• <a href="https://t.me/c/3925457957/21">🌈 Нетворкинг</a> — організація спільних зустрічей, виїздів, неформальне спілкування та запити на взаємодопомогу.

Раді вітати серед своїх! ✨`;

  ctx.reply(welcomeMsg, { disable_web_page_preview: true, parse_mode: 'HTML' });
});

// Launch bot
bot.launch().then(() => console.log('Bot is running...'));

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
