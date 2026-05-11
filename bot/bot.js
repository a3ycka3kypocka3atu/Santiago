require('dotenv').config();
console.log('[Bot] Script started');
const { Telegraf, Markup, session } = require('telegraf');
const { createClient } = require('@supabase/supabase-js');

// ── ENV CONFIG ──
const BOT_TOKEN = process.env.BOT_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || '5756186570';
const PUBLIC_SITE_URL = process.env.PUBLIC_SITE_URL || 'https://brown-delta-28.vercel.app';

const ADMINS = ['andrisav', 'waysantiago24'];
const INSTRUCTORS = ['kateryna_mihailovna'];

if (!BOT_TOKEN || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing required environment variables.");
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

bot.use(session());

function getFullName(from) {
  return [from.first_name, from.last_name].filter(Boolean).join(' ') || from.username || 'Telegram User';
}

function buildPortalUrl(userId, page = 'index.html') {
  const base = PUBLIC_SITE_URL.endsWith('/') ? PUBLIC_SITE_URL : `${PUBLIC_SITE_URL}/`;
  const url = new URL(page, base);
  url.searchParams.set('userId', userId);
  return url.toString();
}

function applicationKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🤝 Стати Резидентом Клубу', 'apply_role_resident')],
    [Markup.button.callback('🧘 Стати Інструктором (Майстром)', 'apply_role_instructor')]
  ]);
}

async function showApplicationChoices(ctx) {
  await ctx.reply('Чудово! Ким ви хочете стати у нашій спільноті?', applicationKeyboard());
}

// ── MIDDLEWARE: UPSERT USER IN DB ──
bot.use(async (ctx, next) => {
  try {
    if (ctx.from) {
      const username = ctx.from.username?.toLowerCase();
      const isAdmin = username && ADMINS.includes(username);
      const isInstructor = username && INSTRUCTORS.includes(username);
      const initialRole = isAdmin ? 'admin' : (isInstructor ? 'instructor' : 'guest');
      const fullName = getFullName(ctx.from);
      
      let { data: profile, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('telegram_id', ctx.from.id)
        .single();

      if (fetchError && fetchError.code === 'PGRST116') {
        console.log(`[Bot] Creating profile for @${ctx.from.username || ctx.from.id}`);
        const { data: created, error: insertError } = await supabase
          .from('profiles')
          .insert({
            telegram_id: ctx.from.id,
            username: username || null,
            full_name: fullName,
            role: initialRole
          })
          .select()
          .single();

        if (insertError) {
          console.error('[Bot] Profile create error:', insertError);
          ctx.userRole = 'guest';
        } else {
          ctx.userRole = created.role;
          ctx.dbUser = created;
          ctx.isNewUser = true;
        }
      } else if (profile) {
        if (isAdmin && profile.role !== 'admin') {
          console.log(`[Bot] Upgrading @${ctx.from.username} to admin`);
          const { data: updated } = await supabase.from('profiles').update({ role: 'admin', username: username || profile.username, full_name: fullName }).eq('telegram_id', ctx.from.id).select().single();
          ctx.userRole = 'admin';
          ctx.dbUser = updated;
        } else if (isInstructor && profile.role !== 'instructor' && profile.role !== 'admin') {
          console.log(`[Bot] Upgrading @${ctx.from.username} to instructor`);
          const { data: updated } = await supabase.from('profiles').update({ role: 'instructor', username: username || profile.username, full_name: fullName }).eq('telegram_id', ctx.from.id).select().single();
          ctx.userRole = 'instructor';
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
  [Markup.button.callback('🚀 Вступити до клубу / Стати Майстром', 'apply_club')],
  [Markup.button.callback('⚙️ Панель Інструктора/Адміна', 'instructor_menu')]
]);

bot.start(async (ctx) => {
  const startPayload = ctx.startPayload;

  if (startPayload === 'login') {
    const portalUrl = buildPortalUrl(ctx.from.id);
    return ctx.reply(
      `🔑 Ви входите у систему як ${ctx.userRole}.\n\nНатисніть кнопку нижче, щоб відкрити портал:`,
      Markup.inlineKeyboard([
        [Markup.button.url('🔓 Відкрити портал', portalUrl)]
      ])
    );
  }

  if (startPayload === 'apply') {
    return showApplicationChoices(ctx);
  }

  if (startPayload === 'openmic') {
    ctx.session = { state: 'openmic_name' };
    return ctx.reply('Open Mic & Santiago Talks 🎤\n\nЯк до вас звертатися?');
  }

  ctx.reply(
    `Вітаємо у боті студії Santiago! 👋\n\nТут ви можете дізнатися більше про нас, подати заявку до клубу або Майстерні, або керувати розкладом (для інструкторів).`,
    mainMenu
  );
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
  ctx.reply('Клуб Santiago — це закрита спільнота для постійних резидентів. Резиденти отримують доступ до ексклюзивних подій, знижки на оренду та можливість брати участь у внутрішніх зустрічах.');
  ctx.answerCbQuery();
});

// ── CLUB & INSTRUCTOR APPLICATION BRANCH ──
bot.action('apply_club', async (ctx) => {
  await showApplicationChoices(ctx);
  await ctx.answerCbQuery();
});

bot.action(/apply_role_(resident|instructor)/, (ctx) => {
  const role = ctx.match[1];
  ctx.session = { 
    state: 'applying_name',
    applyingRole: role 
  };
  ctx.reply('Давайте розпочнемо. Як до вас звертатися (Ім\'я та Прізвище)?');
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

bot.action('create_service', (ctx) => {
  if (ctx.userRole !== 'instructor' && ctx.userRole !== 'admin') return ctx.answerCbQuery('Доступ заборонено.', { show_alert: true });
  ctx.session = { state: 'service_title' };
  ctx.reply('Створення послуги: Крок 1/8\n\nВведіть назву послуги (напр. "Курс Медитації"):');
  ctx.answerCbQuery();
});

// ── ADMIN APPROVAL HANDLERS ──
bot.action(/approve_role_(\d+)_(.+)/, async (ctx) => {
  const username = ctx.from.username?.toLowerCase();
  if (!username || !ADMINS.includes(username)) {
    return ctx.answerCbQuery('Тільки для головних адмінів.', { show_alert: true });
  }

  const userId = ctx.match[1];
  const role = ctx.match[2];

  const { error } = await supabase
    .from('profiles')
    .update({ role: role })
    .eq('telegram_id', userId);

  if (error) {
    console.error('[Bot] Approval error:', error);
    return ctx.answerCbQuery('Помилка при оновленні ролі.');
  }

  await ctx.editMessageText(ctx.callbackQuery.message.text + `\n\n✅ **СХВАЛЕНО: ${role.toUpperCase()}**`);
  
  try {
    await bot.telegram.sendMessage(userId, `✨ Вітаємо! Вашу заявку схвалено. Тепер ви — ${role === 'instructor' ? 'Інструктор' : 'Резидент Клубу'}. Ласкаво просимо!`);
  } catch (err) {
    console.log('[Bot] Could not notify user of approval');
  }
  
  ctx.answerCbQuery();
});

bot.action(/reject_role_(\d+)/, async (ctx) => {
  const username = ctx.from.username?.toLowerCase();
  if (!username || !ADMINS.includes(username)) return ctx.answerCbQuery('Тільки для адміна.');
  const userId = ctx.match[1];
  await ctx.editMessageText(ctx.callbackQuery.message.text + '\n\n❌ **ВІДХИЛЕНО**');
  try {
    await bot.telegram.sendMessage(userId, 'На жаль, вашу заявку на роль відхилено. Ви все ще можете користуватися ботом як Гість.');
  } catch (err) {}
  ctx.answerCbQuery();
});

bot.action(/event_type_(public|club|internal)/, async (ctx) => {
  if (!ctx.session || !ctx.session.eventTitle) return ctx.answerCbQuery('Помилка сесії.', { show_alert: true });
  const type = ctx.match[1];
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
    ctx.reply('❌ Помилка при створенні події.');
  } else {
    ctx.reply(`✅ Подію "${ctx.session.eventTitle}" успішно створено!`);
  }
  ctx.session = null;
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
    if (ctx.session.applyingRole === 'instructor') {
      ctx.session.state = 'applying_bio';
      ctx.reply('Ви обрали роль Інструктора. 🧘\n\nБудь ласка, розкажіть детальніше про вашу практику: якими методами ви володієте, який у вас досвід та що б ви хотіли проводити у Santiago?');
    } else {
      await finishApplication(ctx);
    }
    return;
  }

  if (state === 'applying_bio') {
    ctx.session.appBio = text;
    await finishApplication(ctx);
    return;
  }

  if (state === 'openmic_name') {
    ctx.session.openmicName = text;
    ctx.session.state = 'openmic_topic';
    ctx.reply('Про що ви хочете виступити? Напишіть тему або формат.');
    return;
  }

  if (state === 'openmic_topic') {
    ctx.session.openmicTopic = text;
    ctx.session.state = 'openmic_contact';
    ctx.reply('Залиште контакт для звʼязку або напишіть, коли вам зручно обговорити деталі.');
    return;
  }

  if (state === 'openmic_contact') {
    ctx.session.openmicContact = text;
    await finishOpenMicApplication(ctx);
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
    ctx.reply('Крок 3/4\n\nВведіть дату та час початку (YYYY-MM-DD HH:MM):');
    return;
  }
  if (state === 'event_date') {
    const dateObj = new Date(text);
    if (isNaN(dateObj.getTime())) {
      ctx.reply('❌ Неправильний формат. Спробуйте ще раз (YYYY-MM-DD HH:MM):');
      return;
    }
    ctx.session.eventStart = dateObj.toISOString();
    ctx.session.eventEnd = new Date(dateObj.getTime() + 90 * 60000).toISOString();
    ctx.session.state = null;
    ctx.reply('Крок 4/4\n\nОберіть тип події:', Markup.inlineKeyboard([
      [Markup.button.callback('🟢 Публічна', 'event_type_public')],
      [Markup.button.callback('🟣 Клубна', 'event_type_club')],
      [Markup.button.callback('⚪️ Внутрішня', 'event_type_internal')]
    ]));
    return;
  }

  // Service Creation States (Omitted for brevity, but could be added back)
  if (state === 'service_title') {
    ctx.session.serviceTitle = text;
    ctx.session.state = null;
    ctx.reply(`Послуга "${text}" збережена (режим розробки).`);
    return;
  }

  return next();
});

async function finishApplication(ctx) {
  const role = ctx.session.applyingRole || 'resident';
  const adminId = ADMIN_CHAT_ID;

  const { error: profileUpdateError } = await supabase
    .from('profiles')
    .update({
      full_name: ctx.session.appName,
      occupation: ctx.session.appOcc,
      bio: ctx.session.appBio || null
    })
    .eq('telegram_id', ctx.from.id);

  if (profileUpdateError) {
    console.error('[Bot] Could not update application profile:', profileUpdateError);
  }

  const summary = `🚀 **Нова заявка на роль: ${role.toUpperCase()}**\n\n` +
    `👤 **Ім'я:** ${ctx.session.appName}\n` +
    `🆔 **User:** @${ctx.from.username || 'n/a'} (ID: ${ctx.from.id})\n` +
    `💼 **Діяльність:** ${ctx.session.appOcc}\n` +
    (ctx.session.appBio ? `📝 **Біо/Досвід:** ${ctx.session.appBio}\n` : '') +
    `\n🔗 [Відкрити чат](tg://user?id=${ctx.from.id})`;

  const adminMarkup = Markup.inlineKeyboard([
    [
      Markup.button.callback('✅ Схвалити', `approve_role_${ctx.from.id}_${role}`),
      Markup.button.callback('❌ Відхилити', `reject_role_${ctx.from.id}`)
    ]
  ]);

  try {
    await bot.telegram.sendMessage(adminId, summary, { parse_mode: 'Markdown', ...adminMarkup });
    ctx.reply('Дякуємо! Ваша заявка надіслана адміністраторам. Ми зв\'яжемося з вами найближчим часом. ✨');
  } catch (err) {
    console.error('[Bot] Admin notification error:', err);
    ctx.reply('Дякуємо! Ваша заявка збережена.');
  }
  
  ctx.session.state = null;
  ctx.reply('Повернутися в головне меню:', mainMenu);
}

async function finishOpenMicApplication(ctx) {
  const adminId = ADMIN_CHAT_ID;
  const summary = `🎤 **Нова заявка на Open Mic / Santiago Talks**\n\n` +
    `👤 **Ім'я:** ${ctx.session.openmicName}\n` +
    `🆔 **User:** @${ctx.from.username || 'n/a'} (ID: ${ctx.from.id})\n` +
    `🎯 **Тема/формат:** ${ctx.session.openmicTopic}\n` +
    `📬 **Контакт/час:** ${ctx.session.openmicContact}\n` +
    `\n🔗 [Відкрити чат](tg://user?id=${ctx.from.id})`;

  try {
    await bot.telegram.sendMessage(adminId, summary, { parse_mode: 'Markdown' });
    await ctx.reply('Дякуємо! Заявка на Open Mic надіслана команді Santiago. Ми звʼяжемося з вами найближчим часом. ✨');
  } catch (err) {
    console.error('[Bot] Open Mic notification error:', err);
    await ctx.reply('Дякуємо! Ми отримали вашу заявку, але зараз не змогли відправити сповіщення адміністратору.');
  }

  ctx.session = null;
  ctx.reply('Повернутися в головне меню:', mainMenu);
}

bot.launch().then(() => console.log('[Bot] Launch successful'));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
