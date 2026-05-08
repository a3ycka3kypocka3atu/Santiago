/* ═══════════════════════════════════════════════════════════
   MA3 STUDIO — CALENDAR ENGINE
   Supabase Integration · Role-based Views · Event Management
   ═══════════════════════════════════════════════════════════ */

// ── TELEGRAM AUTH CALLBACK (Must be global) ──
window.onTelegramAuth = function(user) {
  // Dispatch event to be handled inside our module
  const event = new CustomEvent('ma3-telegram-auth', { detail: user });
  document.dispatchEvent(event);
};

(function () {

  'use strict';

  // ── SUPABASE SETUP ──
  const SUPABASE_URL = 'https://ccwvyjszlrrluzplizsu.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_41TaV7iEZxB2Gp7qaUx29w_xo1MeUs1';

  let sb = null;
  if (window.supabase) {
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  } else {
    console.error('Supabase library not loaded.');
  }

  // ── USER STATE ──
  // For MVP: role is stored in localStorage or fetched from Supabase
  // Roles: 'guest', 'resident', 'instructor', 'admin'
  let currentUser = {
    role: localStorage.getItem('ma3-user-role') || 'guest',
    id: localStorage.getItem('ma3-user-id') || null,
    name: localStorage.getItem('ma3-user-name') || null,
    isLoggedIn: !!localStorage.getItem('ma3-user-id')
  };

  // ── CALENDAR STATE ──
  let currentDate = new Date();
  let currentYear = currentDate.getFullYear();
  let currentMonth = currentDate.getMonth();
  let selectedDay = null;
  let eventsCache = []; // All events for the current month

  // ── i18n (reuse from main site) ──
  const STORAGE_KEY = 'ma3-lang';
  const DEFAULT_LANG = 'en';
  const SUPPORTED = ['en', 'cz', 'ru', 'ua'];

  function detectLanguage() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED.includes(stored)) return stored;
    const nav = (navigator.language || '').toLowerCase();
    if (nav.startsWith('cs') || nav.startsWith('cz')) return 'cz';
    if (nav.startsWith('ru')) return 'ru';
    if (nav.startsWith('uk')) return 'ua';
    return DEFAULT_LANG;
  }

  let currentLang = detectLanguage();

  function applyTranslations(lang) {
    currentLang = lang;
    localStorage.setItem(STORAGE_KEY, lang);
    const langMap = { en: 'en', cz: 'cs', ru: 'ru', ua: 'uk' };
    document.documentElement.lang = langMap[lang] || 'en';

    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (typeof translations !== 'undefined' && translations[lang] && translations[lang][key]) {
        el.textContent = translations[lang][key];
      }
    });

    document.querySelectorAll('.lang-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.lang === lang);
    });

    // Re-render events if a day is selected
    if (selectedDay !== null) {
      renderEventsForDay(selectedDay);
    }
  }

  // ── MONTH NAMES (localized) ──
  const MONTH_NAMES = {
    en: ['January','February','March','April','May','June','July','August','September','October','November','December'],
    cz: ['Leden','Únor','Březen','Duben','Květen','Červen','Červenec','Srpen','Září','Říjen','Listopad','Prosinec'],
    ru: ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'],
    ua: ['Січень','Лютий','Березень','Квітень','Травень','Червень','Липень','Серпень','Вересень','Жовтень','Листопад','Грудень'],
  };

  // ── DOM ELEMENTS ──
  const calGrid = document.getElementById('cal-grid');
  const monthLabel = document.getElementById('cal-month-label');
  const prevBtn = document.getElementById('cal-prev');
  const nextBtn = document.getElementById('cal-next');
  const eventsList = document.getElementById('events-list');
  const eventsPanelTitle = document.getElementById('events-panel-title');
  const eventPopup = document.getElementById('event-popup');
  const eventPopupContent = document.getElementById('event-popup-content');
  const eventPopupClose = document.getElementById('event-popup-close');
  const clubGateClose = document.getElementById('club-gate-close');
  const clubGatePopup = document.getElementById('club-gate-popup');
  const userBadge = document.getElementById('user-badge');
  const guestCta = document.getElementById('guest-cta');
  const tgLoginContainer = document.getElementById('tg-login-container');
  const logoutBtn = document.getElementById('logout-btn');
  const upcomingTrack = document.getElementById('upcoming-track');

  // ═══════════════════════════════════════════════════════════
  //  CALENDAR RENDERING
  // ═══════════════════════════════════════════════════════════

  function updateMonthLabel() {
    const names = MONTH_NAMES[currentLang] || MONTH_NAMES.en;
    monthLabel.textContent = `${names[currentMonth]} ${currentYear}`;
  }

  function renderCalendar() {
    calGrid.innerHTML = '';
    updateMonthLabel();

    const firstDay = new Date(currentYear, currentMonth, 1);
    // Monday = 0, Sunday = 6 (ISO week)
    let startDay = firstDay.getDay() - 1;
    if (startDay < 0) startDay = 6;

    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const today = new Date();

    // Empty cells before the 1st
    for (let i = 0; i < startDay; i++) {
      const empty = document.createElement('div');
      empty.className = 'cal-day cal-day--empty';
      calGrid.appendChild(empty);
    }

    // Actual days
    for (let d = 1; d <= daysInMonth; d++) {
      const dayEl = document.createElement('button');
      dayEl.className = 'cal-day';
      dayEl.type = 'button';

      const dayNum = document.createElement('span');
      dayNum.className = 'cal-day__num';
      dayNum.textContent = d;
      dayEl.appendChild(dayNum);

      // Check if this day is today
      if (d === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear()) {
        dayEl.classList.add('cal-day--today');
      }

      // Check if selected
      if (d === selectedDay) {
        dayEl.classList.add('cal-day--selected');
      }

      // Event indicators
      const dayEvents = getEventsForDay(d);
      if (dayEvents.length > 0) {
        dayEl.classList.add('cal-day--has-events');
        const dots = document.createElement('div');
        dots.className = 'cal-day__dots';

        // Show up to 3 dots with color coding
        const types = [...new Set(dayEvents.map(e => e.type))];
        types.slice(0, 3).forEach(type => {
          const dot = document.createElement('span');
          dot.className = `cal-dot cal-dot--${type}`;
          dots.appendChild(dot);
        });

        dayEl.appendChild(dots);
      }

      dayEl.addEventListener('click', () => selectDay(d));
      calGrid.appendChild(dayEl);
    }
  }

  function selectDay(day) {
    selectedDay = day;
    renderCalendar();
    renderEventsForDay(day);
  }

  // ═══════════════════════════════════════════════════════════
  //  EVENTS FETCHING & RENDERING
  // ═══════════════════════════════════════════════════════════

  async function fetchEventsForMonth() {
    if (!sb) {
      // Fallback: use demo data if Supabase is not connected
      eventsCache = getDemoEvents();
      renderCalendar();
      renderUpcomingStrip();
      return;
    }

    const startOfMonth = new Date(currentYear, currentMonth, 1).toISOString();
    const endOfMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59).toISOString();

    try {
      // Fetch events based on role
      let query = sb
        .from('events')
        .select('*')
        .gte('start_time', startOfMonth)
        .lte('start_time', endOfMonth)
        .eq('status', 'confirmed')
        .order('start_time', { ascending: true });

      // Guest can only see public events; club events are fetched but shown as "locked"
      // We fetch ALL events and filter display client-side based on role
      // RLS will handle the security server-side
      const { data, error } = await query;

      if (error) {
        console.warn('Supabase fetch error, using demo data:', error.message);
        eventsCache = getDemoEvents();
      } else {
        eventsCache = data || [];
        // If no events from DB, show demo events for MVP demo
        if (eventsCache.length === 0) {
          eventsCache = getDemoEvents();
        }
      }
    } catch (err) {
      console.warn('Network error, using demo data:', err);
      eventsCache = getDemoEvents();
    }

    renderCalendar();
    renderUpcomingStrip();
  }

  // ═══════════════════════════════════════════════════════════
  //  UPCOMING EVENTS HORIZONTAL STRIP
  // ═══════════════════════════════════════════════════════════

  function renderUpcomingStrip() {
    if (!upcomingTrack) return;
    upcomingTrack.innerHTML = '';

    const now = new Date();
    const upcoming = eventsCache
      .filter(e => new Date(e.start_time) >= now)
      .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

    if (upcoming.length === 0) {
      upcomingTrack.innerHTML = '<div class="upcoming-empty"><p data-i18n="calNoUpcoming">No upcoming events this month</p></div>';
      return;
    }

    const monthNames = MONTH_NAMES[currentLang] || MONTH_NAMES.en;
    const dayNames = {
      en: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],
      cz: ['Ne','Po','Út','St','Čt','Pá','So'],
      ru: ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'],
      ua: ['Нд','Пн','Вт','Ср','Чт','Пт','Сб'],
    };

    const typeLabels = {
      public: { en: 'Public', cz: 'Veřejné', ru: 'Публичное', ua: 'Публічне' },
      club: { en: 'Club', cz: 'Klub', ru: 'Клуб', ua: 'Клуб' },
      internal: { en: 'Internal', cz: 'Interní', ru: 'Внутреннее', ua: 'Внутрішнє' },
    };

    upcoming.forEach((event, idx) => {
      const startTime = new Date(event.start_time);
      const endTime = new Date(event.end_time);
      const isClub = event.type === 'club';
      const isLocked = isClub && currentUser.role === 'guest';

      const card = document.createElement('div');
      card.className = `upcoming-card upcoming-card--${event.type}${isLocked ? ' upcoming-card--locked' : ''}`;
      card.style.animationDelay = `${idx * 0.06}s`;

      const dayOfWeek = (dayNames[currentLang] || dayNames.en)[startTime.getDay()];
      const dateLabel = `${dayOfWeek}, ${startTime.getDate()} ${monthNames[startTime.getMonth()]}`;
      const timeStr = `${formatTime(startTime)} — ${formatTime(endTime)}`;
      const typeBadge = typeLabels[event.type] ? (typeLabels[event.type][currentLang] || typeLabels[event.type].en) : event.type;

      const title = isLocked ? '🔒 Club Event' : event.title;

      card.innerHTML = `
        <div class="upcoming-card__accent upcoming-card__accent--${event.type}"></div>
        <div class="upcoming-card__body">
          <div class="upcoming-card__top">
            <span class="upcoming-card__badge upcoming-card__badge--${event.type}">${typeBadge}</span>
            <span class="upcoming-card__time">${timeStr}</span>
          </div>
          <h4 class="upcoming-card__title">${title}</h4>
          <p class="upcoming-card__date">${dateLabel}</p>
        </div>
      `;

      card.addEventListener('click', () => {
        if (isLocked) {
          openClubGate();
        } else {
          // Select the day on calendar and open popup
          const day = startTime.getDate();
          if (startTime.getMonth() === currentMonth && startTime.getFullYear() === currentYear) {
            selectDay(day);
          }
          openEventPopup(event);
        }
      });

      upcomingTrack.appendChild(card);
    });
  }

  function getEventsForDay(day) {
    return eventsCache.filter(event => {
      const eventDate = new Date(event.start_time);
      return eventDate.getDate() === day &&
             eventDate.getMonth() === currentMonth &&
             eventDate.getFullYear() === currentYear;
    });
  }

  function renderEventsForDay(day) {
    const events = getEventsForDay(day);
    const monthNames = MONTH_NAMES[currentLang] || MONTH_NAMES.en;

    // Update panel title
    eventsPanelTitle.textContent = `${day} ${monthNames[currentMonth]}`;

    if (events.length === 0) {
      const noEventsText = {
        en: 'No events this day',
        cz: 'Žádné události v tento den',
        ru: 'Нет событий в этот день',
        ua: 'Немає подій у цей день',
      };
      eventsList.innerHTML = `
        <div class="events-empty">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity="0.3"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/></svg>
          <p>${noEventsText[currentLang] || noEventsText.en}</p>
        </div>
      `;
      return;
    }

    eventsList.innerHTML = '';

    events.forEach(event => {
      const card = document.createElement('div');
      const isClub = event.type === 'club';
      const isLocked = isClub && currentUser.role === 'guest';

      card.className = `event-card event-card--${event.type}${isLocked ? ' event-card--locked' : ''}`;

      const startTime = new Date(event.start_time);
      const endTime = new Date(event.end_time);
      const timeStr = `${formatTime(startTime)} — ${formatTime(endTime)}`;

      // Type badge translations
      const typeLabels = {
        public: { en: 'Public', cz: 'Veřejné', ru: 'Публичное', ua: 'Публічне' },
        club: { en: 'Club', cz: 'Klub', ru: 'Клуб', ua: 'Клуб' },
        internal: { en: 'Internal', cz: 'Interní', ru: 'Внутреннее', ua: 'Внутрішнє' },
      };

      const lockedTitle = {
        en: 'Club Activity (Residents Only)',
        cz: 'Klubová aktivita (pouze pro rezidenty)',
        ru: 'Клубная активность (только для резидентов)',
        ua: 'Клубна активність (тільки для резидентів)',
      };

      const lockedDesc = {
        en: 'Join the club to see full details',
        cz: 'Vstupte do klubu pro zobrazení podrobností',
        ru: 'Вступите в клуб для просмотра деталей',
        ua: 'Вступіть до клубу для перегляду деталей',
      };

      const title = isLocked ? (lockedTitle[currentLang] || lockedTitle.en) : event.title;
      const desc = isLocked ? (lockedDesc[currentLang] || lockedDesc.en) : (event.description || '');
      const typeBadge = typeLabels[event.type] ? (typeLabels[event.type][currentLang] || typeLabels[event.type].en) : event.type;

      card.innerHTML = `
        <div class="event-card__header">
          <span class="event-card__badge event-card__badge--${event.type}">${typeBadge}</span>
          <span class="event-card__time">${timeStr}</span>
        </div>
        <h4 class="event-card__title">${title}</h4>
        ${desc ? `<p class="event-card__desc">${desc}</p>` : ''}
        ${isLocked ? '<div class="event-card__lock"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div>' : ''}
      `;

      card.addEventListener('click', () => {
        if (isLocked) {
          openClubGate();
        } else {
          openEventPopup(event);
        }
      });

      eventsList.appendChild(card);
    });
  }

  function formatTime(date) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  // ═══════════════════════════════════════════════════════════
  //  POPUPS
  // ═══════════════════════════════════════════════════════════

  function openEventPopup(event) {
    const startTime = new Date(event.start_time);
    const endTime = new Date(event.end_time);
    const monthNames = MONTH_NAMES[currentLang] || MONTH_NAMES.en;
    const dateStr = `${startTime.getDate()} ${monthNames[startTime.getMonth()]} ${startTime.getFullYear()}`;
    const timeStr = `${formatTime(startTime)} — ${formatTime(endTime)}`;

    const typeLabels = {
      public: { en: 'Public Event', cz: 'Veřejná událost', ru: 'Публичное событие', ua: 'Публічна подія' },
      club: { en: 'Club Event', cz: 'Klubová událost', ru: 'Клубное событие', ua: 'Клубна подія' },
      internal: { en: 'Internal', cz: 'Interní', ru: 'Внутреннее', ua: 'Внутрішнє' },
    };

    const bookBtnLabel = {
      en: 'Book / Sign up',
      cz: 'Rezervovat / Přihlásit se',
      ru: 'Записаться',
      ua: 'Записатися',
    };

    const typeBadge = typeLabels[event.type] ? (typeLabels[event.type][currentLang] || typeLabels[event.type].en) : event.type;

    eventPopupContent.innerHTML = `
      <div class="event-detail">
        <span class="event-detail__badge event-card__badge--${event.type}">${typeBadge}</span>
        <h2 class="event-detail__title">${event.title}</h2>
        <div class="event-detail__meta">
          <div class="event-detail__meta-item">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/></svg>
            <span>${dateStr}</span>
          </div>
          <div class="event-detail__meta-item">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
            <span>${timeStr}</span>
          </div>
        </div>
        ${event.description ? `<p class="event-detail__desc">${event.description}</p>` : ''}
        ${currentUser.isLoggedIn 
          ? `<button class="event-detail__book-btn" onclick="submitBooking('${event.id}')">${bookBtnLabel[currentLang] || bookBtnLabel.en}</button>`
          : `<button class="event-detail__book-btn" onclick="alert('Please log in via Telegram first.')">Log in to book</button>`
        }
      </div>
    `;

    eventPopup.classList.add('open');
    eventPopup.setAttribute('aria-hidden', 'false');
  }

  function openClubGate() {
    clubGatePopup.classList.add('open');
    clubGatePopup.setAttribute('aria-hidden', 'false');
  }

  function closePopup(popup) {
    popup.classList.remove('open');
    popup.setAttribute('aria-hidden', 'true');
  }

  // ── BOOKING LOGIC ──
  window.submitBooking = async function(eventId) {
    if (!currentUser.isLoggedIn || !currentUser.id) {
      alert('Please log in first.');
      return;
    }
    
    const btn = document.querySelector('.event-detail__book-btn');
    const originalText = btn.textContent;
    btn.textContent = '...';
    btn.disabled = true;

    try {
      const { error } = await sb.from('bookings').insert({
        event_id: eventId,
        user_id: currentUser.id,
        status: 'pending'
      });

      if (error) throw error;
      
      const successMsg = {
        en: 'Booking requested! Waiting for admin approval.',
        cz: 'Rezervace požadována! Čeká se na schválení.',
        ru: 'Заявка отправлена! Ожидает подтверждения.',
        ua: 'Заявка відправлена! Очікує підтвердження.'
      };
      
      btn.textContent = successMsg[currentLang] || successMsg.en;
      btn.classList.add('success');
      
      setTimeout(() => {
        closePopup(eventPopup);
      }, 2000);

    } catch (err) {
      console.error('Booking error:', err);
      btn.textContent = 'Error';
      btn.disabled = false;
      setTimeout(() => btn.textContent = originalText, 2000);
    }
  };

  // ═══════════════════════════════════════════════════════════
  //  DEMO EVENTS (shown when DB is empty or offline)
  // ═══════════════════════════════════════════════════════════

  function getDemoEvents() {
    const y = currentYear;
    const m = currentMonth;

    return [
      {
        id: 'demo-1', title: 'Morning Yoga', description: 'Open session for everyone. Bring your own mat.',
        start_time: new Date(y, m, 5, 9, 0).toISOString(),
        end_time: new Date(y, m, 5, 10, 30).toISOString(),
        type: 'public', status: 'confirmed',
      },
      {
        id: 'demo-2', title: 'Community Networking', description: 'Monthly meetup for conscious entrepreneurs and creators.',
        start_time: new Date(y, m, 8, 18, 0).toISOString(),
        end_time: new Date(y, m, 8, 20, 0).toISOString(),
        type: 'public', status: 'confirmed',
      },
      {
        id: 'demo-3', title: 'Breathwork & Cold Exposure', description: 'Deep breathing session followed by ice bath experience. Led by instructor Alex.',
        start_time: new Date(y, m, 12, 7, 0).toISOString(),
        end_time: new Date(y, m, 12, 8, 30).toISOString(),
        type: 'club', status: 'confirmed',
      },
      {
        id: 'demo-4', title: 'Startup Pitch Night', description: 'Present your project to the community and get feedback.',
        start_time: new Date(y, m, 15, 19, 0).toISOString(),
        end_time: new Date(y, m, 15, 21, 0).toISOString(),
        type: 'public', status: 'confirmed',
      },
      {
        id: 'demo-5', title: 'Private Meditation Circle', description: 'Guided meditation with sound healing. Residents only.',
        start_time: new Date(y, m, 15, 8, 0).toISOString(),
        end_time: new Date(y, m, 15, 9, 0).toISOString(),
        type: 'club', status: 'confirmed',
      },
      {
        id: 'demo-6', title: 'Open Mic & Jam Session', description: 'Bring your instrument or voice. All genres welcome!',
        start_time: new Date(y, m, 20, 20, 0).toISOString(),
        end_time: new Date(y, m, 20, 22, 30).toISOString(),
        type: 'public', status: 'confirmed',
      },
      {
        id: 'demo-7', title: 'Inner Circle Strategy Meeting', description: 'Monthly planning session for club leaders and coordinators.',
        start_time: new Date(y, m, 22, 16, 0).toISOString(),
        end_time: new Date(y, m, 22, 17, 30).toISOString(),
        type: 'club', status: 'confirmed',
      },
      {
        id: 'demo-8', title: 'Partner Yoga Workshop', description: 'Fun and connecting partner yoga for beginners.',
        start_time: new Date(y, m, 25, 10, 0).toISOString(),
        end_time: new Date(y, m, 25, 12, 0).toISOString(),
        type: 'public', status: 'confirmed',
      },
      {
        id: 'demo-9', title: 'Eco Lecture: Sustainable Living in Prague', description: 'Guest speaker on practical sustainability.',
        start_time: new Date(y, m, 28, 18, 30).toISOString(),
        end_time: new Date(y, m, 28, 20, 0).toISOString(),
        type: 'public', status: 'confirmed',
      },
    ];
  }

  // ═══════════════════════════════════════════════════════════
  //  USER ROLE UI
  // ═══════════════════════════════════════════════════════════

  function updateUserBadge() {
    const roleLabels = {
      guest: { en: 'Guest', cz: 'Host', ru: 'Гость', ua: 'Гість' },
      resident: { en: 'Resident', cz: 'Rezident', ru: 'Резидент', ua: 'Резидент' },
      instructor: { en: 'Instructor', cz: 'Instruktor', ru: 'Инструктор', ua: 'Інструктор' },
      admin: { en: 'Admin', cz: 'Admin', ru: 'Админ', ua: 'Адмін' },
    };

    // Show/hide login widget vs user badge
    if (currentUser.isLoggedIn) {
      if (tgLoginContainer) tgLoginContainer.style.display = 'none';
      if (userBadge) userBadge.style.display = 'flex';
      
      userBadge.className = `user-badge user-badge--${currentUser.role}`;
      const label = userBadge.querySelector('.user-badge__label');
      const roleData = roleLabels[currentUser.role] || roleLabels.guest;
      if (label) label.textContent = roleData[currentLang] || roleData.en;
    } else {
      if (tgLoginContainer) tgLoginContainer.style.display = 'flex';
      if (userBadge) userBadge.style.display = 'none';
    }

    // Show/hide guest CTA
    if (guestCta) {
      guestCta.style.display = (currentUser.role === 'guest' || !currentUser.isLoggedIn) ? 'flex' : 'none';
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  TELEGRAM AUTH HANDLER
  // ═══════════════════════════════════════════════════════════

  document.addEventListener('ma3-telegram-auth', async (e) => {
    const user = e.detail;
    if (!user || !sb) return;

    try {
      // 1. Try to fetch existing profile
      let { data: profile, error: fetchError } = await sb
        .from('profiles')
        .select('*')
        .eq('telegram_id', user.id)
        .single();

      if (fetchError && fetchError.code === 'PGRST116') {
        // Profile doesn't exist, create guest
        const fullName = user.first_name + (user.last_name ? ' ' + user.last_name : '');
        const { data: newProfile, error: insertError } = await sb
          .from('profiles')
          .insert({
            telegram_id: user.id,
            username: user.username,
            full_name: fullName,
            role: 'guest'
          })
          .select()
          .single();

        if (!insertError && newProfile) {
          profile = newProfile;
        }
      }

      if (profile) {
        // Update local state
        currentUser.id = profile.id;
        currentUser.role = profile.role;
        currentUser.name = profile.full_name;
        currentUser.isLoggedIn = true;

        localStorage.setItem('ma3-user-id', profile.id);
        localStorage.setItem('ma3-user-role', profile.role);
        localStorage.setItem('ma3-user-name', profile.full_name);

        updateUserBadge();
        fetchEventsForMonth(); // Refetch with new permissions
      }
    } catch (err) {
      console.error('Auth sync error:', err);
    }
  });

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      currentUser = { role: 'guest', id: null, name: null, isLoggedIn: false };
      localStorage.removeItem('ma3-user-id');
      localStorage.removeItem('ma3-user-role');
      localStorage.removeItem('ma3-user-name');
      updateUserBadge();
      fetchEventsForMonth();
    });
  }

  // ═══════════════════════════════════════════════════════════
  //  EVENT LISTENERS & INIT
  // ═══════════════════════════════════════════════════════════

  prevBtn.addEventListener('click', () => {
    currentMonth--;
    if (currentMonth < 0) { currentMonth = 11; currentYear--; }
    selectedDay = null;
    fetchEventsForMonth();
  });

  nextBtn.addEventListener('click', () => {
    currentMonth++;
    if (currentMonth > 11) { currentMonth = 0; currentYear++; }
    selectedDay = null;
    fetchEventsForMonth();
  });

  // Popup close handlers
  eventPopupClose.addEventListener('click', () => closePopup(eventPopup));
  clubGateClose.addEventListener('click', () => closePopup(clubGatePopup));

  [eventPopup, clubGatePopup].forEach(popup => {
    popup.addEventListener('click', (e) => {
      if (e.target === popup || e.target.classList.contains('popup-backdrop')) {
        closePopup(popup);
      }
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closePopup(eventPopup);
      closePopup(clubGatePopup);
    }
  });

  // Language switcher
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      applyTranslations(btn.dataset.lang);
      updateMonthLabel();
      updateUserBadge();
    });
  });

  // ── INIT ──
  async function init() {
    applyTranslations(currentLang);
    updateUserBadge();
    // Auto-select today on load
    const today = new Date();
    if (currentMonth === today.getMonth() && currentYear === today.getFullYear()) {
      selectedDay = today.getDate();
    }
    await fetchEventsForMonth();
    // After calendar renders, show today's events
    if (selectedDay !== null) {
      renderEventsForDay(selectedDay);
    }
  }

  if (document.readyState !== 'loading') {
    init();
  } else {
    document.addEventListener('DOMContentLoaded', init);
  }

})();
