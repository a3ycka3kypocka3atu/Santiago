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

  // ── AUTH & USER STATE ──
  const Auth = window.MA3Auth;
  let currentUser = Auth ? Auth.user : { role: 'guest', id: null, isLoggedIn: false };
  let sb = window.supabaseClient;

  // ── CALENDAR STATE ──
  let currentDate = new Date();
  let currentYear = currentDate.getFullYear();
  let currentMonth = currentDate.getMonth();
  let selectedDay = null;
  let eventsCache = []; // All events for the current month
  let servicesCache = []; // Evergreen services for Always Available section
  let currentFilter = 'all'; // 'all' | 'online' | 'offline_studio' | 'offline_external'
  let preselectedServiceId = null;  // Pre-filter from URL param ?service=ID
  let preselectedInstructor = null; // Pre-filter from URL param ?instructor=NAME

  // ── Parse URL pre-filter params ──
  (function parseUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const svc = params.get('service');
    const instr = params.get('instructor');
    if (svc) {
      preselectedServiceId = svc.trim();
      currentFilter = 'all'; // Don't override location filter, just scroll/highlight
    }
    if (instr) {
      preselectedInstructor = instr.trim().toLowerCase();
    }
  })();

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
  const logoutBtn = document.getElementById('logout-btn');
  const upcomingTrack = document.getElementById('upcoming-track');
  const tgLoginContainer = document.getElementById('telegram-login-container');

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
      eventsCache = [];
    } else {

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

      const { data, error } = await query;

      if (error) {
        console.warn('Supabase fetch error, showing empty calendar:', error.message);
        eventsCache = [];
      } else {
        eventsCache = data || [];
      }
    } catch (err) {
      console.warn('Network error, showing empty calendar:', err);
      eventsCache = [];
    }
    } // end of else (sb exists)

    // Role-based filtering logic (applies to both demo and real data)
    eventsCache = eventsCache.filter(e => {
      if (currentUser.role === 'admin' || currentUser.role === 'instructor') return true;
      if (currentUser.role === 'resident') return e.type === 'public' || e.type === 'club';
      return e.type === 'public'; // Guest/Visitor — shows public, hides club/internal
    });

    renderCalendar();
    renderUpcomingStrip();
  }

  async function fetchEvergreenServices() {
    if (!sb) return;
    try {
      const { data, error } = await sb
        .from('services')
        .select('*')
        .eq('is_evergreen', true)
        .eq('status', 'published')
        .eq('location_type', 'online');
      if (!error && data) {
        servicesCache = data || [];
        renderAlwaysAvailable();
      }
    } catch (e) {
      // Silently fail - evergreen section is optional
    }
  }

  function expandRecurrence(event, startOfMonth, endOfMonth) {
    if (!event.recurrence_rule) return [event];
    try {
      const { RRule } = window;
      if (!RRule) return [event];
      const rule = RRule.fromString(event.recurrence_rule);
      const occurrences = rule.between(startOfMonth, endOfMonth, true);
      return occurrences.map(date => {
        const duration = event.duration_minutes || 60;
        return {
          ...event,
          id: `${event.id}_${date.getTime()}`,
          start_time: date.toISOString(),
          end_time: new Date(date.getTime() + duration * 60000).toISOString()
        };
      });
    } catch (e) {
      return [event];
    }
  }

  function renderAlwaysAvailable() {
    const section = document.getElementById('always-available');
    const track = document.getElementById('always-available-track');
    if (!section || !track) return;

    if (servicesCache.length === 0 || currentFilter !== 'online') {
      section.style.display = 'none';
      return;
    }

    section.style.display = 'block';
    track.innerHTML = '';

    const typeLabels = {
      en: 'Online Course',
      cz: 'Online kurz',
      ru: 'Онлайн курс',
      ua: 'Онлайн курс',
    };

    servicesCache.forEach((service, idx) => {
      const card = document.createElement('div');
      card.className = 'upcoming-card upcoming-card--public';
      card.style.animationDelay = `${idx * 0.06}s`;
      card.innerHTML = `
        <div class="upcoming-card__accent upcoming-card__accent--public"></div>
        <div class="upcoming-card__body">
          <div class="upcoming-card__top">
            <span class="upcoming-card__badge upcoming-card__badge--public">${typeLabels[currentLang] || typeLabels.en}</span>
          </div>
          <h4 class="upcoming-card__title">${service.title}</h4>
          <p class="upcoming-card__date">${service.price || ''}</p>
        </div>
      `;
      card.addEventListener('click', () => {
        if (service.detail_page) {
          window.location.href = service.detail_page;
        }
      });
      track.appendChild(card);
    });
  }

  // ═══════════════════════════════════════════════════════════
  //  UPCOMING EVENTS HORIZONTAL STRIP
  // ═══════════════════════════════════════════════════════════

  function renderUpcomingStrip() {
    if (!upcomingTrack) return;
    upcomingTrack.innerHTML = '';

    const now = new Date();
    const startOfMonth = new Date(currentYear, currentMonth, 1);
    const endOfMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59);

    // Expand recurrence and filter by location type
    const expandedAll = [];
    eventsCache.forEach(event => {
      const expanded = expandRecurrence(event, startOfMonth, endOfMonth);
      expanded.forEach(e => expandedAll.push(e));
    });

    const filtered = expandedAll
      .filter(e => new Date(e.start_time) >= now)
      .filter(e => currentFilter === 'all' || e.location_type === currentFilter)
      .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

    if (filtered.length === 0) {
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

    filtered.forEach((event, idx) => {
      const startTime = new Date(event.start_time);
      const endTime = new Date(event.end_time);
      const isClub = event.type === 'club';
      
      const card = document.createElement('div');
      card.className = `upcoming-card upcoming-card--${event.type}`;
      card.style.animationDelay = `${idx * 0.06}s`;

      const dayOfWeek = (dayNames[currentLang] || dayNames.en)[startTime.getDay()];
      const dateLabel = `${dayOfWeek}, ${startTime.getDate()} ${monthNames[startTime.getMonth()]}`;
      const timeStr = `${formatTime(startTime)} — ${formatTime(endTime)}`;
      
      let typeBadge = typeLabels[event.type] ? (typeLabels[event.type][currentLang] || typeLabels[event.type].en) : event.type;
      if (isClub) typeBadge = '🔒 ' + typeBadge; // Add lock icon to Club badge

      const title = event.title;

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
        // Select the day on calendar and open popup
        const day = startTime.getDate();
        if (startTime.getMonth() === currentMonth && startTime.getFullYear() === currentYear) {
          selectDay(day);
        }
        openEventPopup(event);
      });

      upcomingTrack.appendChild(card);
    });
  }

  function getEventsForDay(day) {
    const startOfMonth = new Date(currentYear, currentMonth, 1);
    const endOfMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59);
    return eventsCache.filter(event => {
      // Expand recurrence
      const expanded = expandRecurrence(event, startOfMonth, endOfMonth);
      return expanded.some(e => {
        const eventDate = new Date(e.start_time);
        const matchesDay = eventDate.getDate() === day &&
                           eventDate.getMonth() === currentMonth &&
                           eventDate.getFullYear() === currentYear;
        const matchesFilter = currentFilter === 'all' || e.location_type === currentFilter;
        return matchesDay && matchesFilter;
      });
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

      card.className = `event-card event-card--${event.type}`;

      const startTime = new Date(event.start_time);
      const endTime = new Date(event.end_time);
      const timeStr = `${formatTime(startTime)} — ${formatTime(endTime)}`;

      // Type badge translations
      const typeLabels = {
        public: { en: 'Public', cz: 'Veřejné', ru: 'Публичное', ua: 'Публічне' },
        club: { en: 'Club', cz: 'Klub', ru: 'Клуб', ua: 'Клуб' },
        internal: { en: 'Internal', cz: 'Interní', ru: 'Внутреннее', ua: 'Внутрішнє' },
      };

      const title = event.title;
      const desc = event.description || '';
      
      let typeBadge = typeLabels[event.type] ? (typeLabels[event.type][currentLang] || typeLabels[event.type].en) : event.type;
      if (isClub) typeBadge = '🔒 ' + typeBadge;

      card.innerHTML = `
        <div class="event-card__header">
          <span class="event-card__badge event-card__badge--${event.type}">${typeBadge}</span>
          <span class="event-card__time">${timeStr}</span>
        </div>
        <h4 class="event-card__title">${title}</h4>
        ${desc ? `<p class="event-card__desc">${desc}</p>` : ''}
      `;

      card.addEventListener('click', () => {
        openEventPopup(event);
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
        ${event.service_id ? `<a href="${event.detail_page || 'services.html'}" class="event-detail__service-link" target="_blank" data-i18n="event.viewService">View Service Details →</a>` : ''}
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
      const { error } = await sb.rpc('request_event_booking', {
        p_event_id: eventId,
        p_user_id: currentUser.id
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

  // Listen for global auth changes
  document.addEventListener('ma3-auth-changed', (e) => {
    currentUser = e.detail;
    updateUserBadge();
    fetchEventsForMonth();
    fetchEvergreenServices();
  });

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
      if (Auth) Auth.logout();
    });
  }

  // ═══════════════════════════════════════════════════════════
  //  EVENT LISTENERS & INIT
  // ═══════════════════════════════════════════════════════════

  prevBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    currentMonth--;
    if (currentMonth < 0) { currentMonth = 11; currentYear--; }
    selectedDay = null;
    fetchEventsForMonth();
  });

  nextBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    currentMonth++;
    if (currentMonth > 11) { currentMonth = 0; currentYear++; }
    selectedDay = null;
    fetchEventsForMonth();
  });

  // Calendar card: clicking ANYWHERE on the card expands/collapses
  const calCard = document.querySelector('.cal-card');
  if (calCard) {
    calCard.style.cursor = 'pointer';
    calCard.addEventListener('click', (e) => {
      // Don't toggle when clicking on specific interactive elements inside
      if (e.target.closest('.cal-day') || e.target.closest('.filter-tab') || e.target.closest('.cal-ctrl-btn')) return;
      calCard.classList.toggle('collapsed');
    });
  }

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
      renderAlwaysAvailable();
    });
  });

  // Location filter tabs
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentFilter = tab.dataset.filter;
      renderCalendar();
      renderUpcomingStrip();
      renderAlwaysAvailable();
      if (selectedDay !== null) {
        renderEventsForDay(selectedDay);
      }
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
    await fetchEvergreenServices();
    // After calendar renders, show today's events
    if (selectedDay !== null) {
      renderEventsForDay(selectedDay);
    }

    // ── Pre-filter from URL params ──
    if (preselectedInstructor) {
      // Highlight the instructor filter tab if one matches
      const instrLower = preselectedInstructor.toLowerCase();
      const tabMap = {
        'ivan protinak': 'ivan',
        'иван протиняк': 'ivan',
        'katerina': 'katerina',
        'катерина': 'katerina',
      };
      const instrKey = Object.keys(tabMap).find(k => instrLower.includes(k));
      const instrValue = instrKey ? tabMap[instrKey] : instrLower;

      // Scroll to upcoming strip to show instructor's events
      const upcoming = document.querySelector('.upcoming-strip');
      if (upcoming) {
        upcoming.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }

    if (preselectedServiceId) {
      // Highlight service filter
      const svcTab = document.querySelector(`.filter-tab[data-service-id="${preselectedServiceId}"]`);
      if (svcTab) {
        document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
        svcTab.classList.add('active');
      }
    }
  }

  if (document.readyState !== 'loading') {
    init();
  } else {
    document.addEventListener('DOMContentLoaded', init);
  }

})();
