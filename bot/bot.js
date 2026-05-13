require('dotenv').config();
console.log('[Bot] Script started');
const { Telegraf, Markup, session } = require('telegraf');
const { createClient } = require('@supabase/supabase-js');
const { randomUUID } = require('crypto');

// ── ENV CONFIG ──
const BOT_TOKEN = process.env.BOT_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || '5756186570';
const PUBLIC_SITE_URL = process.env.PUBLIC_SITE_URL || 'https://brown-delta-28.vercel.app';
const NOTIFICATION_POLL_MS = Number(process.env.NOTIFICATION_POLL_MS || 60000);
const NOTIFICATION_TIME_ZONE = process.env.NOTIFICATION_TIME_ZONE || 'Europe/Prague';

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

function buildPublicUrl(page = 'calendar.html') {
  const base = PUBLIC_SITE_URL.endsWith('/') ? PUBLIC_SITE_URL : `${PUBLIC_SITE_URL}/`;
  return new URL(page || 'calendar.html', base).toString();
}

function formatEventDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'час уточнюється';

  return new Intl.DateTimeFormat('uk-UA', {
    timeZone: NOTIFICATION_TIME_ZONE,
    day: '2-digit',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function buildReminderText(notification) {
  const payload = notification.payload || {};
  const title = payload.title || 'подія Santiago';
  const when = formatEventDateTime(payload.start_time);

  if (notification.kind === 'event_reminder_24h') {
    return `Нагадування Santiago\n\nЗавтра подія: ${title}\nПочаток: ${when}`;
  }

  if (notification.kind === 'event_reminder_3h') {
    return `Нагадування Santiago\n\nСьогодні подія: ${title}\nПочаток: ${when}`;
  }

  return `Оновлення Santiago\n\n${title}\nПочаток: ${when}`;
}

function reminderKeyboard(notification) {
  const payload = notification.payload || {};
  const page = payload.url || 'calendar.html';
  return Markup.inlineKeyboard([
    [Markup.button.url('Відкрити календар', buildPublicUrl(page))]
  ]);
}

function portalLoginKeyboard(userId, label = '🔓 Відкрити кабінет') {
  return Markup.inlineKeyboard([
    [Markup.button.url(label, buildPortalUrl(userId, 'cabinet.html'))]
  ]);
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

function buildMainMenu(role = 'guest', options = {}) {
  const includeAdminBack = options.includeAdminBack === true;

  if (role === 'admin') {
    return Markup.inlineKeyboard([
      [Markup.button.callback('👋 Стати Відвідувачем', 'apply_visitor')],
      [Markup.button.callback('🤝 Стати Учасником Клубу', 'apply_role_resident')],
      [Markup.button.callback('🧘 Стати Ментором', 'apply_role_instructor')],
      [Markup.button.callback('✨ Створити щось', 'create_something')],
      [Markup.button.callback('📋 Заявки на створення', 'admin_submissions_pending')],
      [
        Markup.button.callback('👁 Як відвідувач', 'preview_menu_guest'),
        Markup.button.callback('👁 Як учасник клубу', 'preview_menu_resident')
      ]
    ]);
  }

  if (role === 'instructor') {
    const rows = [
      [Markup.button.callback('✨ Створити щось', 'create_something')]
    ];
    if (includeAdminBack) rows.push([Markup.button.callback('↩️ Адмін меню', 'preview_menu_admin')]);
    return Markup.inlineKeyboard(rows);
  }

  if (role === 'resident') {
    const rows = [
      [Markup.button.callback('🧘 Стати Ментором', 'apply_role_instructor')]
    ];
    if (includeAdminBack) rows.push([Markup.button.callback('↩️ Адмін меню', 'preview_menu_admin')]);
    return Markup.inlineKeyboard(rows);
  }

  const rows = [
    [Markup.button.callback('👋 Стати Відвідувачем', 'apply_visitor')],
    [Markup.button.callback('🤝 Стати Учасником Клубу', 'apply_role_resident')],
    [Markup.button.callback('🧘 Стати Ментором', 'apply_role_instructor')]
  ];
  if (includeAdminBack) rows.push([Markup.button.callback('↩️ Адмін меню', 'preview_menu_admin')]);
  return Markup.inlineKeyboard(rows);
}

function createSomethingKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('👤 Заявка на профіль', 'create_profile')],
    [Markup.button.callback('🛒 Заявка на послугу', 'create_service')],
    [Markup.button.callback('🏗️ Заявка на проєкт', 'create_project')],
    [Markup.button.callback('📅 Заявка на подію', 'create_event')]
  ]);
}

function previewMenuLabel(role) {
  if (role === 'admin') return 'Ваше адмін меню:';
  if (role === 'resident') return 'Так меню бачить учасник клубу:';
  return 'Так меню бачить новий користувач:';
}

function clubApplicationKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('📝 Залишити заявку', 'submit_resident_application')]
  ]);
}

function roleApprovalKeyboard(userId, role) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('✅ Схвалити', `approve_role_${userId}_${role}`),
      Markup.button.callback('❌ Відхилити', `reject_role_${userId}`)
    ]
  ]);
}

function getRoleLabel(role) {
  if (role === 'instructor') return 'Ментор';
  if (role === 'resident') return 'Учасник клубу';
  if (role === 'admin') return 'Адмін';
  return 'Відвідувач';
}

const SUBMISSION_TYPES = {
  profile: {
    label: 'профіль ментора',
    titlePrompt: 'Як має називатися ваш публічний профіль? Напишіть імʼя/назву, як на сайті.',
    descriptionPrompt: 'Опишіть себе: практика, досвід, напрямки, для кого ви працюєте.',
    detailsPrompt: 'Додайте посилання, контакти, Instagram/сайт/портфоліо, фото або що ще потрібно адміну для сторінки.'
  },
  service: {
    label: 'послугу',
    titlePrompt: 'Назва послуги?',
    descriptionPrompt: 'Опишіть послугу: що людина отримує, формат, тривалість, кому підходить.',
    detailsPrompt: 'Ціна, бажана сторінка, фото/посилання, чи це public/club/internal, і все що треба знати адміну.'
  },
  project: {
    label: 'проєкт',
    titlePrompt: 'Назва проєкту?',
    descriptionPrompt: 'Опишіть ідею, ціль, кому це потрібно і яку роль Santiago має зіграти.',
    detailsPrompt: 'Додайте посилання, матеріали, команду, бажаний формат на сайті і наступні кроки.'
  },
  event: {
    label: 'подію',
    titlePrompt: 'Назва події або програми?',
    descriptionPrompt: 'Опишіть подію: тема, для кого, що буде відбуватись, хто веде.',
    detailsPrompt: 'Напишіть бажані дати/час, тривалість, чи треба студія, public/club/internal, ціну і ліміти учасників. Якщо потрібні файли або фото, надішліть їх тут з підписом.'
  }
};

function canCreateContent(ctx) {
  return ctx.userRole === 'instructor' || ctx.userRole === 'admin';
}

function isAdminContext(ctx) {
  const username = ctx.from && ctx.from.username ? ctx.from.username.toLowerCase() : '';
  return ctx.userRole === 'admin' || (username && ADMINS.includes(username));
}

function compactText(value, max = 900) {
  const text = String(value || '').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function getMessageText(message = {}) {
  return message.text || message.caption || '';
}

function getMessageAttachments(message = {}) {
  const attachments = [];

  if (message.document) {
    attachments.push({
      type: 'document',
      file_id: message.document.file_id,
      file_name: message.document.file_name || null,
      mime_type: message.document.mime_type || null
    });
  }

  if (message.photo && message.photo.length) {
    const photo = message.photo[message.photo.length - 1];
    attachments.push({
      type: 'photo',
      file_id: photo.file_id,
      file_unique_id: photo.file_unique_id || null
    });
  }

  ['video', 'audio', 'voice', 'animation'].forEach((type) => {
    if (message[type]) {
      attachments.push({
        type,
        file_id: message[type].file_id,
        file_name: message[type].file_name || null,
        mime_type: message[type].mime_type || null
      });
    }
  });

  return attachments;
}

function submissionActionKeyboard(submissionId) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('✅ Так / в роботу', `submission_approve_${submissionId}`),
      Markup.button.callback('↩️ Треба інфо', `submission_needs_info_${submissionId}`)
    ],
    [
      Markup.button.callback('❌ Ні', `submission_reject_${submissionId}`),
      Markup.button.callback('🔗 Готово + лінк', `submission_published_${submissionId}`)
    ]
  ]);
}

function submissionStatusLabel(status) {
  const labels = {
    pending: 'Очікує',
    needs_info: 'Треба інфо',
    approved: 'В роботі',
    rejected: 'Відхилено',
    published: 'Опубліковано',
    archived: 'Архів'
  };
  return labels[status] || status || 'Очікує';
}

function getSubmissionDisplayStatus(submission) {
  return (submission.payload && submission.payload.workflow_status) || submission.status || 'pending';
}

function buildSubmissionAdminText(submission) {
  const payload = submission.payload || {};
  const author = payload.telegram || {};
  const attachments = payload.attachments || [];
  const status = getSubmissionDisplayStatus(submission);
  const config = SUBMISSION_TYPES[submission.kind] || SUBMISSION_TYPES.event;

  return `🧩 Заявка: ${config.label.toUpperCase()}\n\n` +
    `Статус: ${submissionStatusLabel(status)}\n` +
    `ID: ${submission.id}\n` +
    `Автор: ${author.name || 'n/a'} (@${author.username || 'n/a'}, TG ${submission.telegram_id || author.id || 'n/a'})\n` +
    `Назва: ${submission.title}\n\n` +
    `Опис:\n${compactText(submission.description, 1000)}\n\n` +
    `Деталі / час / ціна / лінки:\n${compactText(submission.details, 1000)}\n\n` +
    `Файли в Telegram: ${attachments.length ? `${attachments.length} нижче/у чаті` : 'немає'}\n` +
    `Чат: tg://user?id=${submission.telegram_id || author.id || ''}`;
}

function buildSubmissionUserMessage(workflowStatus, adminMessage, publishedUrl) {
  if (workflowStatus === 'approved') {
    return '✅ Вашу заявку прийнято в роботу. Адмін оформить матеріали на сайті і напише, коли буде готово.';
  }

  if (workflowStatus === 'needs_info') {
    return `↩️ По вашій заявці потрібно трохи більше інформації.${adminMessage ? `\n\nКоментар адміна:\n${adminMessage}` : ''}`;
  }

  if (workflowStatus === 'rejected') {
    return `❌ Зараз заявку не беремо в публікацію.${adminMessage ? `\n\nКоментар адміна:\n${adminMessage}` : ''}`;
  }

  if (workflowStatus === 'published') {
    return `🔗 Готово, матеріал опубліковано.${publishedUrl ? `\n\nПосилання: ${publishedUrl}` : ''}${adminMessage ? `\n\nКоментар адміна:\n${adminMessage}` : ''}`;
  }

  return adminMessage || 'Статус заявки оновлено.';
}

function statusToDbStatus(workflowStatus) {
  if (workflowStatus === 'rejected') return 'rejected';
  if (workflowStatus === 'approved' || workflowStatus === 'published') return 'approved';
  return 'pending';
}

function extractFirstUrl(text) {
  const match = String(text || '').match(/https?:\/\/[^\s]+/i);
  return match ? match[0] : null;
}

async function startSubmission(ctx, kind) {
  if (!canCreateContent(ctx)) {
    return ctx.reply('Цей розділ доступний для менторів/інструкторів та адміністраторів. Якщо ви хочете стати ментором, подайте заявку через меню клубу.');
  }

  const config = SUBMISSION_TYPES[kind] || SUBMISSION_TYPES.event;
  ctx.session = {
    state: 'submission_title',
    submissionKind: kind
  };
  await ctx.reply(`Створюємо заявку на ${config.label}. Адмін перевірить матеріали перед публікацією.\n\n${config.titlePrompt}`);
}

async function fetchSubmission(submissionId) {
  const { data, error } = await supabase
    .from('submissions')
    .select('id, kind, title, description, details, submitted_by, telegram_id, status, payload, created_at, updated_at')
    .eq('id', submissionId)
    .single();

  if (error) throw error;
  return data;
}

async function sendSubmissionToAdmin(ctx, submission) {
  await ctx.reply(buildSubmissionAdminText(submission), submissionActionKeyboard(submission.id));
}

async function listPendingSubmissions(ctx) {
  if (!isAdminContext(ctx)) {
    return ctx.reply('Це меню тільки для адміна/master.');
  }

  const { data, error } = await supabase
    .from('submissions')
    .select('id, kind, title, description, details, submitted_by, telegram_id, status, payload, created_at, updated_at')
    .in('status', ['pending', 'approved'])
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('[Bot] Pending submissions fetch error:', error);
    return ctx.reply('Не вдалося завантажити заявки. Перевір Supabase.');
  }

  const visible = (data || []).filter((submission) => {
    const status = getSubmissionDisplayStatus(submission);
    return ['pending', 'needs_info', 'approved'].includes(status);
  });

  if (!visible.length) {
    return ctx.reply('Нових заявок на створення зараз немає.');
  }

  await ctx.reply(`Показую останні заявки: ${visible.length}`);
  for (const submission of visible) {
    await sendSubmissionToAdmin(ctx, submission);
  }
}

async function updateSubmissionWorkflow(submissionId, workflowStatus, options = {}) {
  const submission = await fetchSubmission(submissionId);
  const payload = {
    ...(submission.payload || {}),
    workflow_status: workflowStatus,
    reviewed_at: new Date().toISOString()
  };

  if (options.adminId) payload.reviewed_by_telegram_id = options.adminId;
  if (options.adminMessage) payload.admin_message = options.adminMessage;
  if (options.publishedUrl) payload.published_url = options.publishedUrl;

  const { data, error } = await supabase
    .from('submissions')
    .update({
      status: statusToDbStatus(workflowStatus),
      payload,
      updated_at: new Date().toISOString()
    })
    .eq('id', submissionId)
    .select('id, kind, title, description, details, submitted_by, telegram_id, status, payload, created_at, updated_at')
    .single();

  if (error) throw error;
  return data;
}

async function notifySubmissionOwner(submission, workflowStatus, adminMessage, publishedUrl) {
  if (!submission.telegram_id) return;

  try {
    await bot.telegram.sendMessage(
      submission.telegram_id,
      buildSubmissionUserMessage(workflowStatus, adminMessage, publishedUrl),
      portalLoginKeyboard(submission.telegram_id, 'Відкрити кабінет')
    );
  } catch (err) {
    console.warn('[Bot] Could not notify submission owner:', err.message);
  }
}

async function approveSubmission(ctx, submissionId) {
  const updated = await updateSubmissionWorkflow(submissionId, 'approved', {
    adminId: ctx.from.id
  });

  await notifySubmissionOwner(updated, 'approved');
  await ctx.reply(`✅ Заявка "${updated.title}" прийнята в роботу.`);
}

async function startSubmissionResponse(ctx, submissionId, workflowStatus) {
  const prompts = {
    needs_info: 'Напишіть повідомлення для автора: що саме потрібно додати?',
    rejected: 'Напишіть коротку причину відмови для автора.',
    published: 'Надішліть фінальний лінк на сторінку. Можна додати коментар у цьому ж повідомленні.'
  };

  ctx.session = {
    state: 'admin_submission_response',
    submissionId,
    workflowStatus
  };

  await ctx.reply(prompts[workflowStatus] || 'Напишіть повідомлення для автора.');
}

async function finishAdminSubmissionResponse(ctx, text) {
  const submissionId = ctx.session.submissionId;
  const workflowStatus = ctx.session.workflowStatus;
  const publishedUrl = workflowStatus === 'published' ? extractFirstUrl(text) : null;
  const adminMessage = workflowStatus === 'published'
    ? text.replace(publishedUrl || '', '').trim()
    : text.trim();

  if (workflowStatus === 'published' && !publishedUrl) {
    await ctx.reply('Для публікації потрібен лінк. Надішліть URL сторінки.');
    return;
  }

  const updated = await updateSubmissionWorkflow(submissionId, workflowStatus, {
    adminId: ctx.from.id,
    adminMessage,
    publishedUrl
  });

  await notifySubmissionOwner(updated, workflowStatus, adminMessage, publishedUrl);
  ctx.session = null;
  await ctx.reply(`Готово. Статус заявки "${updated.title}": ${submissionStatusLabel(workflowStatus)}.`);
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
            id: randomUUID(),
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

  if (startPayload && startPayload.startsWith('create_')) {
    const kind = startPayload.replace('create_', '');
    if (SUBMISSION_TYPES[kind]) {
      return startSubmission(ctx, kind);
    }
  }

  ctx.reply(
    `Вітаємо у боті студії Santiago! 👋\n\nОберіть, що хочете зробити:`,
    buildMainMenu(ctx.userRole)
  );
});

// ── CLUB & INSTRUCTOR APPLICATION BRANCH ──
bot.action('apply_club', async (ctx) => {
  await showApplicationChoices(ctx);
  await ctx.answerCbQuery();
});

bot.action('apply_visitor', async (ctx) => {
  await ctx.reply(
    'Ваш профіль відвідувача готовий. Відкрийте кабінет, щоб увійти на платформу.',
    portalLoginKeyboard(ctx.from.id)
  );
  await ctx.answerCbQuery();
});

bot.action('apply_role_resident', async (ctx) => {
  await ctx.reply(
    'Участь у клубі Santiago дає доступ до закритих подій, спільноти, спеціальних форматів і можливості бути ближче до внутрішнього життя простору.\n\nЯкщо хочете приєднатися, залиште заявку, і адмін її розгляне.',
    clubApplicationKeyboard()
  );
  await ctx.answerCbQuery();
});

bot.action('submit_resident_application', async (ctx) => {
  await finishResidentApplication(ctx);
  await ctx.answerCbQuery();
});

bot.action(/preview_menu_(guest|resident|admin)/, async (ctx) => {
  if (ctx.userRole !== 'admin') {
    return ctx.answerCbQuery('Тільки для адміна.', { show_alert: true });
  }

  const role = ctx.match[1];
  await ctx.reply(previewMenuLabel(role), buildMainMenu(role, { includeAdminBack: role !== 'admin' }));
  await ctx.answerCbQuery();
});

bot.action('apply_role_instructor', (ctx) => {
  ctx.session = { 
    state: 'mentor_application_materials',
    applyingRole: 'instructor'
  };
  ctx.reply('Напишіть одним повідомленням про себе як ментора: досвід, напрямки, що хочете проводити, посилання, портфоліо або біографію. Можна також надіслати файл/фото з описом у підписі.');
  ctx.answerCbQuery();
});

// ── INSTRUCTOR WIZARD BRANCH ──
bot.action('create_something', async (ctx) => {
  if (ctx.userRole !== 'instructor' && ctx.userRole !== 'admin') {
    return ctx.answerCbQuery('У вас немає доступу до цього меню.', { show_alert: true });
  }

  ctx.reply(
    'Що хочете створити?',
    createSomethingKeyboard()
  );
  ctx.answerCbQuery();
});

bot.action(/create_(profile|service|project|event)/, async (ctx) => {
  await startSubmission(ctx, ctx.match[1]);
  ctx.answerCbQuery();
});

bot.command('submissions', async (ctx) => {
  await listPendingSubmissions(ctx);
});

bot.action('admin_submissions_pending', async (ctx) => {
  await listPendingSubmissions(ctx);
  await ctx.answerCbQuery();
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
    await bot.telegram.sendMessage(
      userId,
      `✨ Вітаємо! Вашу заявку схвалено. Тепер ви — ${getRoleLabel(role)}. Відкрийте кабінет, щоб платформа оновила ваш доступ.`,
      portalLoginKeyboard(userId)
    );
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

bot.action(/submission_(approve|reject|needs_info|published)_([0-9a-f-]+)/, async (ctx) => {
  if (!isAdminContext(ctx)) {
    return ctx.answerCbQuery('Тільки для адміна/master.', { show_alert: true });
  }

  const action = ctx.match[1];
  const submissionId = ctx.match[2];

  try {
    if (action === 'approve') {
      await approveSubmission(ctx, submissionId);
    } else if (action === 'reject') {
      await startSubmissionResponse(ctx, submissionId, 'rejected');
    } else {
      await startSubmissionResponse(ctx, submissionId, action);
    }

    await ctx.answerCbQuery();
  } catch (err) {
    console.error('[Bot] Submission action error:', err);
    await ctx.answerCbQuery('Не вдалося оновити заявку.', { show_alert: true });
  }
});

bot.action(/event_type_(public|club|internal)/, async (ctx) => {
  if (!ctx.session || !ctx.session.eventTitle) return ctx.answerCbQuery('Помилка сесії.', { show_alert: true });
  const type = ctx.match[1];
  const { data: profile } = await supabase.from('profiles').select('id').eq('telegram_id', ctx.from.id).single();

  const { error } = await supabase.from('events').insert({
    id: randomUUID(),
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

// Mentor application can be text, a file, a photo, or any Telegram message with a caption.
bot.on('message', async (ctx, next) => {
  if (ctx.session && ctx.session.state === 'admin_submission_response' && !ctx.message.text) {
    await ctx.reply('Для відповіді автору потрібен текст або лінк. Надішліть, будь ласка, текстовим повідомленням.');
    return;
  }

  if (ctx.session && ctx.session.state === 'submission_details' && !ctx.message.text) {
    const attachments = getMessageAttachments(ctx.message);
    if (!attachments.length) return next();

    ctx.session.submissionDetails = getMessageText(ctx.message) || 'Файл/медіа без тексту. Дивіться переслане повідомлення в Telegram.';
    ctx.session.submissionAttachments = attachments;
    await finishContentSubmission(ctx);
    return;
  }

  if (!ctx.session || ctx.session.state !== 'mentor_application_materials') return next();

  await finishMentorApplication(ctx);
});

// ── TEXT HANDLER (STATE MACHINE) ──
bot.on('text', async (ctx, next) => {
  if (!ctx.session || !ctx.session.state) return next();

  const state = ctx.session.state;
  const text = ctx.message.text;

  if (state === 'admin_submission_response') {
    await finishAdminSubmissionResponse(ctx, text);
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

  if (state === 'submission_title') {
    const config = SUBMISSION_TYPES[ctx.session.submissionKind] || SUBMISSION_TYPES.event;
    ctx.session.submissionTitle = text;
    ctx.session.state = 'submission_description';
    ctx.reply(config.descriptionPrompt);
    return;
  }

  if (state === 'submission_description') {
    const config = SUBMISSION_TYPES[ctx.session.submissionKind] || SUBMISSION_TYPES.event;
    ctx.session.submissionDescription = text;
    ctx.session.state = 'submission_details';
    ctx.reply(config.detailsPrompt);
    return;
  }

  if (state === 'submission_details') {
    ctx.session.submissionDetails = text;
    await finishContentSubmission(ctx);
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

async function finishResidentApplication(ctx) {
  const adminId = ADMIN_CHAT_ID;
  const summary = `🤝 Нова заявка в клуб Santiago\n\n` +
    `👤 Ім'я: ${getFullName(ctx.from)}\n` +
    `🆔 User: @${ctx.from.username || 'n/a'} (ID: ${ctx.from.id})\n` +
    `🔗 Чат: tg://user?id=${ctx.from.id}`;

  try {
    await bot.telegram.sendMessage(adminId, summary, roleApprovalKeyboard(ctx.from.id, 'resident'));
    await ctx.reply('Дякуємо! Заявка в клуб надіслана адміну. Коли її схвалять, ви отримаєте кнопку входу в кабінет.');
  } catch (err) {
    console.error('[Bot] Resident application admin notification error:', err);
    await ctx.reply('Заявку отримано, але зараз не вдалося відправити повідомлення адміну. Спробуйте ще раз або напишіть адміну напряму.');
  }

  ctx.session = null;
  await ctx.reply('Повернутися в головне меню:', buildMainMenu(ctx.userRole));
}

async function finishMentorApplication(ctx) {
  const adminId = ADMIN_CHAT_ID;
  const message = ctx.message || {};
  const materialsText = message.text || message.caption || '';

  if (materialsText) {
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: getFullName(ctx.from),
        bio: materialsText
      })
      .eq('telegram_id', ctx.from.id);

    if (error) {
      console.error('[Bot] Could not update mentor application profile:', error);
    }
  }

  const summary = `🧘 Нова заявка ментора\n\n` +
    `👤 Ім'я: ${getFullName(ctx.from)}\n` +
    `🆔 User: @${ctx.from.username || 'n/a'} (ID: ${ctx.from.id})\n` +
    (materialsText ? `\n📝 Матеріали:\n${materialsText}\n` : '\n📝 Матеріали: файл/медіа переслано нижче.\n') +
    `\n🔗 Чат: tg://user?id=${ctx.from.id}`;

  try {
    await bot.telegram.sendMessage(adminId, summary, roleApprovalKeyboard(ctx.from.id, 'instructor'));
    if (!message.text) {
      await ctx.forwardMessage(adminId);
    }
    await ctx.reply('Дякуємо! Заявка ментора надіслана адміну. Після схвалення ви отримаєте доступ до відповідного кабінету.');
  } catch (err) {
    console.error('[Bot] Mentor application admin notification error:', err);
    await ctx.reply('Заявку отримано, але зараз не вдалося відправити повідомлення адміну. Спробуйте ще раз або напишіть адміну напряму.');
  }

  ctx.session = null;
  await ctx.reply('Повернутися в головне меню:', buildMainMenu(ctx.userRole));
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
  ctx.reply('Повернутися в головне меню:', buildMainMenu(ctx.userRole));
}

async function finishContentSubmission(ctx) {
  const kind = ctx.session.submissionKind || 'event';
  const config = SUBMISSION_TYPES[kind] || SUBMISSION_TYPES.event;
  const adminId = ADMIN_CHAT_ID;
  const profileId = ctx.dbUser ? ctx.dbUser.id : null;
  const sourceMessage = ctx.message || {};
  const attachments = ctx.session.submissionAttachments || getMessageAttachments(sourceMessage);

  const payload = {
    title: ctx.session.submissionTitle,
    description: ctx.session.submissionDescription,
    details: ctx.session.submissionDetails,
    workflow_status: 'pending',
    attachments,
    telegram: {
      id: ctx.from.id,
      username: ctx.from.username || null,
      name: getFullName(ctx.from)
    }
  };

  let savedSubmission = null;

  try {
    const { data, error } = await supabase.from('submissions').insert({
      id: randomUUID(),
      kind,
      title: payload.title,
      description: payload.description,
      details: payload.details,
      submitted_by: profileId,
      telegram_id: ctx.from.id,
      status: 'pending',
      payload
    }).select('id, kind, title, description, details, submitted_by, telegram_id, status, payload, created_at, updated_at').single();
    if (error) console.warn('[Bot] Submission DB save skipped/failed:', error.message);
    if (data) savedSubmission = data;
  } catch (err) {
    console.warn('[Bot] Submission table unavailable:', err.message);
  }

  const summary = `🧩 Нова заявка: ${config.label.toUpperCase()}\n\n` +
    `👤 Автор: ${getFullName(ctx.from)} (@${ctx.from.username || 'n/a'}, ID: ${ctx.from.id})\n` +
    `🏷️ Назва: ${payload.title}\n\n` +
    `📝 Опис:\n${compactText(payload.description, 1000)}\n\n` +
    `📌 Деталі / час / ціна / лінки:\n${compactText(payload.details, 1000)}\n\n` +
    `📎 Файли в Telegram: ${attachments.length ? attachments.length : 'немає'}\n\n` +
    `🔗 Чат: tg://user?id=${ctx.from.id}`;

  try {
    if (savedSubmission) {
      await bot.telegram.sendMessage(adminId, summary, submissionActionKeyboard(savedSubmission.id));
    } else {
      await bot.telegram.sendMessage(adminId, summary);
    }
    if (attachments.length) {
      await ctx.forwardMessage(adminId);
    }
    await ctx.reply(`Дякуємо! Заявка на ${config.label} надіслана адміну. Після перевірки її можна буде оформити на сайті/календарі.`);
  } catch (err) {
    console.error('[Bot] Content submission admin notification error:', err);
    await ctx.reply('Заявку отримано, але зараз не вдалося відправити повідомлення адміну. Спробуйте ще раз або напишіть адміну напряму.');
  }

  ctx.session = null;
  await ctx.reply('Повернутися в головне меню:', buildMainMenu(ctx.userRole));
}

let notificationWorkerBusy = false;

async function markNotification(id, patch) {
  const { error } = await supabase
    .from('subscription_notifications')
    .update({
      ...patch,
      updated_at: new Date().toISOString()
    })
    .eq('id', id);

  if (error) console.error('[Bot] Notification status update error:', error);
}

async function processDueNotification(notification) {
  const { data: subscription, error: subscriptionError } = await supabase
    .from('subscriptions')
    .select('status, preferences')
    .eq('id', notification.subscription_id)
    .single();

  if (subscriptionError || !subscription || subscription.status !== 'active') {
    await markNotification(notification.id, { status: 'cancelled' });
    return;
  }

  if (notification.kind.startsWith('event_reminder') &&
      subscription.preferences &&
      subscription.preferences.event_reminders === false) {
    await markNotification(notification.id, { status: 'cancelled' });
    return;
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('telegram_id, full_name')
    .eq('id', notification.user_id)
    .single();

  if (profileError || !profile || !profile.telegram_id) {
    await markNotification(notification.id, {
      status: 'failed',
      failed_at: new Date().toISOString(),
      error: profileError ? profileError.message : 'profile_telegram_id_missing'
    });
    return;
  }

  try {
    await bot.telegram.sendMessage(
      profile.telegram_id,
      buildReminderText(notification),
      reminderKeyboard(notification)
    );

    await markNotification(notification.id, {
      status: 'sent',
      sent_at: new Date().toISOString(),
      error: null
    });
  } catch (err) {
    console.error('[Bot] Reminder send error:', err);
    await markNotification(notification.id, {
      status: 'failed',
      failed_at: new Date().toISOString(),
      error: err.message || 'telegram_send_failed'
    });
  }
}

async function processDueNotifications() {
  if (notificationWorkerBusy) return;
  notificationWorkerBusy = true;

  try {
    const { data: notifications, error } = await supabase
      .from('subscription_notifications')
      .select('id, subscription_id, user_id, target_type, target_key, kind, send_at, payload')
      .eq('status', 'pending')
      .lte('send_at', new Date().toISOString())
      .order('send_at', { ascending: true })
      .limit(25);

    if (error) {
      console.error('[Bot] Notification fetch error:', error);
      return;
    }

    for (const notification of notifications || []) {
      await processDueNotification(notification);
    }
  } catch (err) {
    console.error('[Bot] Notification worker error:', err);
  } finally {
    notificationWorkerBusy = false;
  }
}

function startNotificationWorker() {
  if (!Number.isFinite(NOTIFICATION_POLL_MS) || NOTIFICATION_POLL_MS <= 0) {
    console.log('[Bot] Notification worker disabled');
    return;
  }

  console.log(`[Bot] Notification worker polling every ${NOTIFICATION_POLL_MS}ms`);
  setTimeout(processDueNotifications, 5000);
  setInterval(processDueNotifications, NOTIFICATION_POLL_MS);
}

bot.launch().then(() => {
  console.log('[Bot] Launch successful');
  startNotificationWorker();
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
