/* ═══════════════════════════════════════════════════════════
   SANTIAGO — CALENDAR ENGINE
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
  let eventStatsCache = new Map(); // Public participation counts/names by event id
  let bookingStatusCache = new Map(); // Logged-in user's private booking state by event id
  let currentFilter = 'all'; // 'all' | 'online' | 'offline_studio' | 'offline_external'
  let preselectedServiceId = null;  // Pre-filter from URL param ?service=ID
  let preselectedInstructor = null; // Pre-filter from URL param ?instructor=NAME
  let showOnlyMyEvents = false;     // Pre-filter from URL param ?mine=1
  const TELEGRAM_BOT_URL = 'https://t.me/santioago_bot';
  const MASTER_DRAFT_EVENTS_KEY = 'ma3-master-calendar-drafts';
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  let masterEventMode = 'attach';
  let masterProfileEventsCache = [];

  // ── Parse URL pre-filter params ──
  (function parseUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const svc = params.get('service');
    const instr = params.get('instructor');
    const mine = params.get('mine');
    if (svc) {
      preselectedServiceId = svc.trim();
      currentFilter = 'all'; // Don't override location filter, just scroll/highlight
    }
    if (instr) {
      preselectedInstructor = instr.trim().toLowerCase();
    }
    if (mine === '1') {
      showOnlyMyEvents = true;
    }
  })();

  // ── i18n (reuse from main site) ──
  const STORAGE_KEY = 'language';
  const LEGACY_STORAGE_KEY = 'ma3-lang';
  const DEFAULT_LANG = 'en';
  const SUPPORTED = ['en', 'cz', 'ru', 'ua'];

  function detectLanguage() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED.includes(stored)) return stored;
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy && SUPPORTED.includes(legacy)) {
      localStorage.setItem(STORAGE_KEY, legacy);
      return legacy;
    }
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
    localStorage.setItem(LEGACY_STORAGE_KEY, lang);
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

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function isMasterUser() {
    return currentUser && currentUser.isLoggedIn && ['instructor', 'admin'].includes(currentUser.role);
  }

  function buildTelegramStartUrl(payload) {
    return `${TELEGRAM_BOT_URL}?start=${encodeURIComponent(payload)}`;
  }

  function isUuid(value) {
    return UUID_RE.test(String(value || ''));
  }

  function formatDatePayload(day) {
    const month = String(currentMonth + 1).padStart(2, '0');
    const date = String(day).padStart(2, '0');
    return `${currentYear}-${month}-${date}`;
  }

  const MASTER_CTA_LABELS = {
    action: {
      en: 'Add event',
      cz: 'Přidat událost',
      ru: 'Добавить событие',
      ua: 'Додати подію'
    },
    selected: {
      en: 'The selected date will be passed into the event request.',
      cz: 'Vybrané datum se předá do žádosti o událost.',
      ru: 'Выбранная дата будет передана в заявку на событие.',
      ua: 'Обрана дата передасться в заявку на подію.'
    },
    empty: {
      en: 'Select a day in the calendar to pass the date into the request.',
      cz: 'Vyberte den v kalendáři, aby se datum předalo do žádosti.',
      ru: 'Выберите день в календаре, чтобы передать дату в заявку.',
      ua: 'Оберіть день у календарі, щоб передати дату в заявку.'
    }
  };

  function updateMasterCalendarCta() {
    if (!masterCalendarCta || !masterCreateEventLink || !masterCreateEventLabel || !masterCreateEventHint) return;

    if (!isMasterUser()) {
      masterCalendarCta.hidden = true;
      return;
    }

    const datePayload = selectedDay ? formatDatePayload(selectedDay) : null;
    masterCalendarCta.hidden = false;
    masterCreateEventLabel.textContent = MASTER_CTA_LABELS.action[currentLang] || MASTER_CTA_LABELS.action.en;
    masterCreateEventHint.textContent = datePayload
      ? `${MASTER_CTA_LABELS.selected[currentLang] || MASTER_CTA_LABELS.selected.en} ${datePayload}`
      : (MASTER_CTA_LABELS.empty[currentLang] || MASTER_CTA_LABELS.empty.en);
  }

  function renderMasterDayActions(day) {
    if (!isMasterUser()) return '';
    const selectedDate = formatDatePayload(day);
    return `
      <div class="master-calendar-actions">
        <button class="master-calendar-actions__button" type="button" data-master-open-event data-master-event-date="${selectedDate}">Přidat událost na tento den</button>
        <span>Připojte existující událost, pošlete novou adminovi, nebo si zapište krátkou jednorázovou položku.</span>
      </div>
    `;
  }

  function renderAttachEventAction(event) {
    if (!isMasterUser()) return '';
    const eventId = getEventBaseId(event);
    if (!eventId) return '';
    return `
      <div class="event-card__actions">
        <button class="event-card__master-link" type="button" data-master-attach-event="${escapeHtml(eventId)}">Naplánovat znovu</button>
      </div>
    `;
  }

  function getEventBaseId(event) {
    return event && event.original_id ? event.original_id : String(event && event.id ? event.id : '').split('_')[0];
  }

  function getEventStats(event) {
    const eventId = getEventBaseId(event);
    return eventStatsCache.get(eventId) || {
      event_id: eventId,
      capacity: event && event.capacity ? event.capacity : null,
      participant_count: 0,
      participants: []
    };
  }

  function getBookingStatus(event) {
    return bookingStatusCache.get(getEventBaseId(event)) || null;
  }

  function isCurrentUserAttending(event) {
    if (!currentUser || !currentUser.id) return false;
    const stats = getEventStats(event);
    return (stats.participants || []).some(participant => participant.profile_id === currentUser.id);
  }

  async function refreshEventState() {
    if (!sb || !eventsCache.length) {
      eventStatsCache = new Map();
      bookingStatusCache = new Map();
      return;
    }

    const eventIds = [...new Set(eventsCache.map(event => getEventBaseId(event)).filter(isUuid))];
    if (!eventIds.length) return;

    try {
      const { data, error } = await sb.rpc('get_event_public_stats', { p_event_ids: eventIds });
      if (error) throw error;

      eventStatsCache = new Map((data || []).map(row => [
        row.event_id,
        {
          ...row,
          participant_count: Number(row.participant_count || 0),
          participants: Array.isArray(row.participants) ? row.participants : []
        }
      ]));
    } catch (err) {
      console.warn('[Calendar] Public event stats unavailable:', err.message || err);
      eventStatsCache = new Map();
    }

    if (!currentUser.isLoggedIn || !currentUser.id) {
      bookingStatusCache = new Map();
      return;
    }

    try {
      const { data, error } = await sb.rpc('get_profile_booking_status', {
        p_user_id: currentUser.id,
        p_event_ids: eventIds
      });
      if (error) throw error;

      bookingStatusCache = new Map((data || []).map(row => [row.event_id, row.status]));
    } catch (err) {
      console.warn('[Calendar] Booking status unavailable:', err.message || err);
      bookingStatusCache = new Map();
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
  const masterCalendarCta = document.getElementById('master-calendar-cta');
  const masterCreateEventLink = document.getElementById('master-create-event-link');
  const masterCreateEventLabel = document.getElementById('master-create-event-label');
  const masterCreateEventHint = document.getElementById('master-create-event-hint');
  const masterEventPopup = document.getElementById('master-event-popup');
  const masterEventPopupClose = document.getElementById('master-event-popup-close');
  const masterEventForm = document.getElementById('master-event-form');
  const masterEventModeBadge = document.getElementById('master-event-mode-badge');
  const masterEventSourceWrap = document.getElementById('master-event-source-wrap');
  const masterEventSource = document.getElementById('master-event-source');
  const masterEventName = document.getElementById('master-event-name');
  const masterEventDescription = document.getElementById('master-event-description');
  const masterEventDate = document.getElementById('master-event-date');
  const masterEventTime = document.getElementById('master-event-time');
  const masterEventDuration = document.getElementById('master-event-duration');
  const masterEventType = document.getElementById('master-event-type');
  const masterEventLocation = document.getElementById('master-event-location');
  const masterEventStatus = document.getElementById('master-event-status');
  const masterEventSubmit = document.getElementById('master-event-submit');

  // ═══════════════════════════════════════════════════════════
  //  MASTER EVENT DRAFTS
  // ═══════════════════════════════════════════════════════════

  function getMasterDraftOwnerId() {
    return currentUser && currentUser.id ? String(currentUser.id) : 'guest';
  }

  function readMasterDraftEvents() {
    try {
      const parsed = JSON.parse(localStorage.getItem(MASTER_DRAFT_EVENTS_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      return [];
    }
  }

  function writeMasterDraftEvents(items) {
    localStorage.setItem(MASTER_DRAFT_EVENTS_KEY, JSON.stringify(items.slice(-120)));
  }

  function saveMasterDraftEvent(event) {
    const all = readMasterDraftEvents().filter(item => item.id !== event.id);
    all.push(event);
    writeMasterDraftEvents(all);
  }

  function getMasterDraftEventsForMonth() {
    const ownerId = getMasterDraftOwnerId();
    const start = new Date(currentYear, currentMonth, 1);
    const end = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59);
    return readMasterDraftEvents().filter(event => {
      if (String(event.owner_id || '') !== ownerId) return false;
      const eventStart = new Date(event.start_time);
      return eventStart >= start && eventStart <= end;
    });
  }

  function getSelectedDateValue() {
    if (selectedDay) return formatDatePayload(selectedDay);
    const today = new Date();
    if (today.getMonth() === currentMonth && today.getFullYear() === currentYear) {
      return formatDatePayload(today.getDate());
    }
    return `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
  }

  function setMasterEventStatus(text, type) {
    if (!masterEventStatus) return;
    masterEventStatus.textContent = text || '';
    masterEventStatus.classList.toggle('is-error', type === 'error');
    masterEventStatus.classList.toggle('is-success', type === 'success');
  }

  function setMasterEventMode(mode) {
    masterEventMode = ['attach', 'create', 'quick'].includes(mode) ? mode : 'attach';
    document.querySelectorAll('[data-master-event-mode]').forEach(button => {
      button.classList.toggle('is-active', button.dataset.masterEventMode === masterEventMode);
    });

    if (masterEventSourceWrap) masterEventSourceWrap.hidden = masterEventMode !== 'attach';
    if (masterEventModeBadge) {
      const labels = {
        attach: 'Připojit',
        create: 'Žádost adminovi',
        quick: 'Krátký zápis'
      };
      masterEventModeBadge.textContent = labels[masterEventMode] || labels.attach;
    }
    if (masterEventSubmit) {
      const labels = {
        attach: 'Přidat do kalendáře',
        create: 'Poslat adminovi a zobrazit',
        quick: 'Zapsat do kalendáře'
      };
      masterEventSubmit.textContent = labels[masterEventMode] || labels.attach;
    }
  }

  function getFallbackMasterProfileEvents() {
    const ownerId = getMasterDraftOwnerId();
    const byOwner = eventsCache.filter(event => (
      !event.is_local_master_event &&
      String(event.instructor_id || '') === ownerId &&
      isUuid(getEventBaseId(event))
    ));
    const seen = new Set();
    return byOwner.filter(event => {
      const id = getEventBaseId(event);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }

  async function loadMasterProfileEvents() {
    if (!isMasterUser() || !currentUser.id) return [];
    if (!sb) {
      masterProfileEventsCache = getFallbackMasterProfileEvents();
      return masterProfileEventsCache;
    }

    try {
      const { data, error } = await sb
        .from('events')
        .select('id,title,description,start_time,end_time,type,status,instructor_id,location_type,service_id,capacity')
        .eq('instructor_id', currentUser.id)
        .eq('status', 'confirmed')
        .order('start_time', { ascending: false })
        .limit(60);
      if (error) throw error;
      masterProfileEventsCache = data || [];
    } catch (err) {
      console.warn('[Calendar] Master profile events unavailable:', err.message || err);
      masterProfileEventsCache = getFallbackMasterProfileEvents();
    }

    return masterProfileEventsCache;
  }

  function renderMasterEventSourceOptions(selectedId) {
    if (!masterEventSource) return;
    if (!masterProfileEventsCache.length) {
      masterEventSource.innerHTML = '<option value="">Žádné události v profilu mastera</option>';
      masterEventSource.disabled = true;
      return;
    }

    masterEventSource.disabled = false;
    masterEventSource.innerHTML = masterProfileEventsCache.map(event => {
      const start = event.start_time ? ` · ${new Date(event.start_time).toLocaleDateString()}` : '';
      const id = getEventBaseId(event);
      return `<option value="${escapeHtml(id)}"${String(id) === String(selectedId) ? ' selected' : ''}>${escapeHtml(event.title)}${escapeHtml(start)}</option>`;
    }).join('');
    syncMasterEventFromSource();
  }

  function syncMasterEventFromSource() {
    if (!masterEventSource || masterEventMode !== 'attach') return;
    const selected = masterProfileEventsCache.find(event => String(getEventBaseId(event)) === String(masterEventSource.value));
    if (!selected) return;

    if (masterEventName) masterEventName.value = selected.title || '';
    if (masterEventDescription) masterEventDescription.value = selected.description || '';
    if (masterEventType) masterEventType.value = selected.type || 'public';
    if (masterEventLocation) masterEventLocation.value = selected.location_type || 'offline_studio';

    const start = new Date(selected.start_time);
    const end = new Date(selected.end_time);
    const duration = Math.max(30, Math.round((end - start) / 60000));
    if (masterEventDuration && Number.isFinite(duration)) {
      const hasOption = [...masterEventDuration.options].some(option => Number(option.value) === duration);
      masterEventDuration.value = hasOption ? String(duration) : '60';
    }
  }

  async function openMasterEventPopup(options = {}) {
    if (!isMasterUser()) {
      alert('Tato akce je dostupná pro mastera nebo admina.');
      return;
    }

    const mode = options.mode || 'attach';
    setMasterEventMode(mode);
    setMasterEventStatus('', null);

    if (masterEventDate) masterEventDate.value = options.date || getSelectedDateValue();
    if (masterEventTime) masterEventTime.value = '18:00';
    if (masterEventDuration) masterEventDuration.value = '60';
    if (masterEventName) masterEventName.value = '';
    if (masterEventDescription) masterEventDescription.value = '';
    if (masterEventType) masterEventType.value = 'public';
    if (masterEventLocation) masterEventLocation.value = 'offline_studio';

    if (masterEventPopup) {
      masterEventPopup.classList.add('open');
      masterEventPopup.setAttribute('aria-hidden', 'false');
    }

    await loadMasterProfileEvents();
    renderMasterEventSourceOptions(options.eventId);

    if (mode !== 'attach') {
      if (masterEventName) masterEventName.focus();
    } else if (masterEventTime) {
      masterEventTime.focus();
    }
  }

  function buildMasterDraftEvent(submissionId) {
    const dateValue = masterEventDate ? masterEventDate.value : '';
    const timeValue = masterEventTime ? masterEventTime.value : '';
    const duration = Number(masterEventDuration ? masterEventDuration.value : 60) || 60;
    const start = new Date(`${dateValue}T${timeValue || '18:00'}:00`);
    const end = new Date(start.getTime() + duration * 60000);
    const sourceEvent = masterEventMode === 'attach'
      ? masterProfileEventsCache.find(event => String(getEventBaseId(event)) === String(masterEventSource && masterEventSource.value))
      : null;

    return {
      id: `local_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      title: (masterEventName && masterEventName.value.trim()) || (sourceEvent && sourceEvent.title) || 'Událost',
      description: (masterEventDescription && masterEventDescription.value.trim()) || (sourceEvent && sourceEvent.description) || '',
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      type: (masterEventType && masterEventType.value) || (sourceEvent && sourceEvent.type) || 'public',
      status: masterEventMode === 'create' ? 'pending' : 'confirmed',
      instructor_id: currentUser.id,
      owner_id: getMasterDraftOwnerId(),
      location_type: (masterEventLocation && masterEventLocation.value) || (sourceEvent && sourceEvent.location_type) || 'offline_studio',
      service_id: sourceEvent && sourceEvent.service_id ? sourceEvent.service_id : null,
      capacity: sourceEvent && sourceEvent.capacity ? sourceEvent.capacity : null,
      is_local_master_event: true,
      master_event_mode: masterEventMode,
      source_event_id: sourceEvent ? getEventBaseId(sourceEvent) : null,
      submission_id: submissionId || null
    };
  }

  function buildMasterSubmissionDetails(draftEvent) {
    const start = new Date(draftEvent.start_time);
    const end = new Date(draftEvent.end_time);
    const sourceLine = draftEvent.source_event_id ? `Zdrojová událost: ${draftEvent.source_event_id}` : null;
    return [
      `Čas: ${start.toLocaleString()} - ${formatTime(end)}`,
      `Viditelnost: ${draftEvent.type}`,
      `Místo: ${draftEvent.location_type}`,
      sourceLine,
      '',
      draftEvent.description
    ].filter(Boolean).join('\n');
  }

  async function submitMasterEventForm(event) {
    event.preventDefault();

    if (!currentUser || !currentUser.isLoggedIn || !currentUser.id) {
      setMasterEventStatus('Přihlaste se přes Telegram.', 'error');
      return;
    }

    if (masterEventMode === 'attach' && (!masterEventSource || !masterEventSource.value)) {
      setMasterEventStatus('Nejdřív vyberte událost z profilu mastera.', 'error');
      return;
    }

    if (!masterEventDate.value || !masterEventTime.value || !masterEventName.value.trim()) {
      setMasterEventStatus('Doplňte název, datum a čas.', 'error');
      return;
    }

    const originalText = masterEventSubmit ? masterEventSubmit.textContent : '';
    if (masterEventSubmit) {
      masterEventSubmit.disabled = true;
      masterEventSubmit.textContent = 'Ukládám...';
    }
    setMasterEventStatus('', null);

    let submissionId = null;
    const draftEvent = buildMasterDraftEvent();
    let persistedToCalendar = false;
    let usedLocalFallback = false;

    try {
      if (masterEventMode === 'create') {
        if (!sb) throw new Error('Supabase unavailable');
        const details = buildMasterSubmissionDetails(draftEvent);
        const { data, error } = await sb.rpc('create_master_submission', {
          p_user_id: currentUser.id,
          p_kind: 'event',
          p_title: draftEvent.title,
          p_description: draftEvent.description || details,
          p_details: details,
          p_mode: 'create_event_from_calendar'
        });
        if (error) throw error;
        submissionId = data || null;
        draftEvent.submission_id = submissionId;
      } else if (sb) {
        try {
          const { data, error } = await sb.rpc('create_master_calendar_event', {
            p_user_id: currentUser.id,
            p_title: draftEvent.title,
            p_description: draftEvent.description,
            p_start_time: draftEvent.start_time,
            p_end_time: draftEvent.end_time,
            p_type: draftEvent.type,
            p_location_type: draftEvent.location_type,
            p_source_event_id: isUuid(draftEvent.source_event_id) ? draftEvent.source_event_id : null,
            p_mode: masterEventMode
          });
          if (error) throw error;
          if (data) draftEvent.id = data;
          draftEvent.is_local_master_event = false;
          draftEvent.status = 'confirmed';
          persistedToCalendar = true;
        } catch (persistErr) {
          usedLocalFallback = true;
          console.warn('[Calendar] Master calendar RPC unavailable, using local draft:', persistErr.message || persistErr);
        }
      } else {
        usedLocalFallback = true;
      }

      if (masterEventMode === 'create' || usedLocalFallback) {
        saveMasterDraftEvent(draftEvent);
      }
      eventsCache = eventsCache.filter(item => item.id !== draftEvent.id).concat(draftEvent);
      selectedDay = new Date(draftEvent.start_time).getDate();
      renderCalendar();
      renderUpcomingStrip();
      renderEventsForDay(selectedDay);
      setMasterEventStatus(
        masterEventMode === 'create'
          ? 'Žádost odešla adminovi. Dočasná událost je vidět v kalendáři.'
          : persistedToCalendar
          ? 'Událost je uložená v kalendáři.'
          : usedLocalFallback
          ? 'Událost je dočasně zapsaná v tomto zařízení. Po nasazení databázové migrace se uloží natrvalo.'
          : 'Událost je zapsaná v kalendáři.',
        'success'
      );
      setTimeout(() => closePopup(masterEventPopup), 700);
    } catch (err) {
      console.warn('[Calendar] Master event submit failed:', err);
      setMasterEventStatus('Nepodařilo se uložit. Zkontrolujte připojení nebo databázovou migraci.', 'error');
    } finally {
      if (masterEventSubmit) {
        masterEventSubmit.disabled = false;
        masterEventSubmit.textContent = originalText || 'Uložit do kalendáře';
      }
    }
  }

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
    updateMasterCalendarCta();

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
    updateMasterCalendarCta();
  }

  function resetEventsPanel() {
    const selectDayText = (typeof translations !== 'undefined' && translations[currentLang] && translations[currentLang].calSelectDay)
      ? translations[currentLang].calSelectDay
      : 'Select a day';
    const noEventsText = (typeof translations !== 'undefined' && translations[currentLang] && translations[currentLang].calNoEvents)
      ? translations[currentLang].calNoEvents
      : 'Click a date to view events';

    eventsPanelTitle.textContent = selectDayText;
    eventsList.innerHTML = `
      <div class="events-empty">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity="0.3"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/></svg>
        <p>${noEventsText}</p>
      </div>
    `;
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

    if (showOnlyMyEvents && currentUser && currentUser.id) {
      eventsCache = eventsCache.filter(e => String(e.instructor_id || '') === String(currentUser.id));
    }

    const localDrafts = getMasterDraftEventsForMonth();
    if (localDrafts.length) {
      const existingIds = new Set(eventsCache.map(event => String(event.id)));
      eventsCache = eventsCache.concat(localDrafts.filter(event => !existingIds.has(String(event.id))));
    }

    await refreshEventState();
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
          original_id: event.original_id || event.id,
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
          <h4 class="upcoming-card__title">${escapeHtml(title)}</h4>
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
        ${renderMasterDayActions(day)}
      `;
      return;
    }

    eventsList.innerHTML = renderMasterDayActions(day);

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
      const stats = getEventStats(event);
      const participantCount = Number(stats.participant_count || 0);
      const capacity = stats.capacity || event.capacity || null;
      const capacityText = capacity
        ? `${participantCount} / ${capacity}`
        : (participantCount ? `${participantCount} coming` : '');
      
      let typeBadge = typeLabels[event.type] ? (typeLabels[event.type][currentLang] || typeLabels[event.type].en) : event.type;
      if (isClub) typeBadge = '🔒 ' + typeBadge;

      card.innerHTML = `
        <div class="event-card__header">
          <span class="event-card__badge event-card__badge--${event.type}">${typeBadge}</span>
          <span class="event-card__time">${timeStr}</span>
        </div>
        <h4 class="event-card__title">${escapeHtml(title)}</h4>
        ${desc ? `<p class="event-card__desc">${escapeHtml(desc)}</p>` : ''}
        ${capacityText ? `<p class="event-card__desc event-card__desc--stats">${capacityText}</p>` : ''}
        ${renderAttachEventAction(event)}
      `;

      card.querySelectorAll('a, button').forEach((control) => {
        control.addEventListener('click', (clickEvent) => clickEvent.stopPropagation());
      });

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

    const participationLabels = {
      join: { en: 'I will come', cz: 'Přijdu', ru: 'Я приду', ua: 'Я прийду' },
      leave: { en: 'I cannot come', cz: 'Nepřijdu', ru: 'Не приду', ua: 'Не прийду' },
      login: { en: 'Log in to join', cz: 'Přihlaste se', ru: 'Войти, чтобы отметиться', ua: 'Увійти, щоб відмітитись' }
    };

    const bookingLabels = {
      pending: { en: 'Booking pending', cz: 'Rezervace čeká', ru: 'Заявка ожидает', ua: 'Заявка очікує' },
      confirmed: { en: 'Booking confirmed', cz: 'Rezervace potvrzena', ru: 'Запись подтверждена', ua: 'Запис підтверджено' },
      rejected: { en: 'Booking rejected', cz: 'Rezervace odmítnuta', ru: 'Заявка отклонена', ua: 'Заявку відхилено' },
      cancelled: { en: 'Booking cancelled', cz: 'Rezervace zrušena', ru: 'Запись отменена', ua: 'Запис скасовано' }
    };

    const typeBadge = typeLabels[event.type] ? (typeLabels[event.type][currentLang] || typeLabels[event.type].en) : event.type;
    const baseEventId = getEventBaseId(event);
    const stats = getEventStats(event);
    const participantCount = Number(stats.participant_count || 0);
    const capacity = stats.capacity || event.capacity || null;
    const participants = stats.participants || [];
    const userAttending = isCurrentUserAttending(event);
    const bookingStatus = getBookingStatus(event);
    const bookingLabel = bookingStatus && bookingLabels[bookingStatus]
      ? (bookingLabels[bookingStatus][currentLang] || bookingLabels[bookingStatus].en)
      : null;
    const participantNames = participants
      .slice(0, 8)
      .map(participant => `<span>${escapeHtml(participant.name || 'Santiago user')}</span>`)
      .join('');
    const participantMore = participants.length > 8 ? `<span>+${participants.length - 8}</span>` : '';
    const statsText = event.is_local_master_event
      ? (event.master_event_mode === 'create' ? 'Dočasně v kalendáři, čeká na admina' : 'Zapsáno masterem')
      : capacity
      ? `${participantCount} / ${capacity} places`
      : `${participantCount} coming`;
    const eventFavoriteItem = () => ({
      type: 'event',
      key: baseEventId || `${event.title}-${event.start_time}`,
      title: event.title,
      subtitle: `${dateStr} · ${timeStr}`,
      url: 'calendar.html',
      metadata: {
        event_id: baseEventId,
        start_time: event.start_time,
        end_time: event.end_time,
        type: event.type,
        service_id: event.service_id || null,
        location_type: event.location_type || null
      }
    });

    eventPopupContent.innerHTML = `
      <div class="event-detail">
        <span class="event-detail__badge event-card__badge--${event.type}">${typeBadge}</span>
        <h2 class="event-detail__title">${escapeHtml(event.title)}</h2>
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
        ${event.description ? `<p class="event-detail__desc">${escapeHtml(event.description)}</p>` : ''}
        <div class="event-detail__stats">
          <strong>${statsText}</strong>
          ${capacity ? `<span>${Math.max(capacity - participantCount, 0)} places left</span>` : ''}
        </div>
        ${participants.length && !event.is_local_master_event ? `<div class="event-detail__participants">${participantNames}${participantMore}</div>` : ''}
        ${event.service_id ? `<a href="${event.detail_page || 'services.html'}" class="event-detail__service-link" target="_blank" data-i18n="event.viewService">View Service Details →</a>` : ''}
        <div class="event-detail__actions">
          <button class="event-detail__favorite-btn" type="button" data-event-favorite aria-label="Save event"></button>
          <button class="event-detail__reminder-btn" type="button" data-event-reminder aria-label="Remind me"></button>
          ${!event.is_local_master_event && currentUser.isLoggedIn
            ? `<button class="event-detail__participation-btn ${userAttending ? 'is-active' : ''}" type="button" onclick="toggleEventParticipation('${baseEventId}', ${!userAttending})">${userAttending ? (participationLabels.leave[currentLang] || participationLabels.leave.en) : (participationLabels.join[currentLang] || participationLabels.join.en)}</button>`
            : (!event.is_local_master_event ? `<button class="event-detail__participation-btn" type="button" onclick="alert('Please log in via Telegram first.')">${participationLabels.login[currentLang] || participationLabels.login.en}</button>` : '')
          }
          ${!event.is_local_master_event && currentUser.isLoggedIn
            ? `<button class="event-detail__book-btn" ${bookingStatus === 'pending' || bookingStatus === 'confirmed' ? 'disabled' : ''} onclick="submitBooking('${baseEventId}')">${bookingLabel || (bookBtnLabel[currentLang] || bookBtnLabel.en)}</button>`
            : (!event.is_local_master_event ? `<button class="event-detail__book-btn" onclick="alert('Please log in via Telegram first.')">Log in to book</button>` : '')
          }
          ${isMasterUser() && baseEventId && !event.is_local_master_event
            ? `<button class="event-detail__book-btn event-detail__master-link" type="button" data-master-attach-event="${escapeHtml(baseEventId)}">Naplánovat znovu</button>`
            : ''
          }
        </div>
      </div>
    `;

    const favoriteButton = eventPopupContent.querySelector('[data-event-favorite]');
    if (favoriteButton && window.MA3Favorites) {
      window.MA3Favorites.registerButton(favoriteButton, eventFavoriteItem);
    }

    const reminderButton = eventPopupContent.querySelector('[data-event-reminder]');
    if (reminderButton && window.MA3Subscriptions) {
      window.MA3Subscriptions.registerReminderButton(reminderButton, eventFavoriteItem);
    }

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
  window.toggleEventParticipation = async function(eventId, shouldAttend) {
    if (!currentUser.isLoggedIn || !currentUser.id) {
      alert('Please log in first.');
      return;
    }

    const btn = document.querySelector('.event-detail__participation-btn');
    const originalText = btn ? btn.textContent : '';
    if (btn) {
      btn.textContent = '...';
      btn.disabled = true;
    }

    try {
      const { error } = await sb.rpc('upsert_event_participation', {
        p_event_id: eventId,
        p_user_id: currentUser.id,
        p_attending: shouldAttend
      });

      if (error) throw error;

      await refreshEventState();
      const event = eventsCache.find(item => getEventBaseId(item) === eventId);
      if (event) openEventPopup(event);
    } catch (err) {
      console.error('Participation error:', err);
      if (btn) {
        btn.textContent = 'Error';
        setTimeout(() => {
          btn.textContent = originalText;
          btn.disabled = false;
        }, 1800);
      }
    }
  };

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
        en: 'Booking requested. Status is now in your cabinet.',
        cz: 'Rezervace odeslána. Stav je ve vašem kabinetu.',
        ru: 'Заявка отправлена. Статус теперь в кабинете.',
        ua: 'Заявка відправлена. Статус тепер у кабінеті.'
      };
      
      btn.textContent = successMsg[currentLang] || successMsg.en;
      btn.classList.add('success');
      await refreshEventState();
      
      setTimeout(() => {
        const event = eventsCache.find(item => getEventBaseId(item) === eventId);
        if (event) openEventPopup(event);
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
    updateMasterCalendarCta();
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
      instructor: { en: 'Master', cz: 'Mistr', ru: 'Мастер', ua: 'Майстер' },
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
    resetEventsPanel();
    fetchEventsForMonth();
  });

  nextBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    currentMonth++;
    if (currentMonth > 11) { currentMonth = 0; currentYear++; }
    selectedDay = null;
    resetEventsPanel();
    fetchEventsForMonth();
  });

  // Popup close handlers
  eventPopupClose.addEventListener('click', () => closePopup(eventPopup));
  clubGateClose.addEventListener('click', () => closePopup(clubGatePopup));
  if (masterEventPopupClose) {
    masterEventPopupClose.addEventListener('click', () => closePopup(masterEventPopup));
  }

  if (masterCreateEventLink) {
    masterCreateEventLink.addEventListener('click', () => openMasterEventPopup({ mode: 'attach' }));
  }

  if (masterEventForm) {
    masterEventForm.addEventListener('submit', submitMasterEventForm);
  }

  document.querySelectorAll('[data-master-event-mode]').forEach(button => {
    button.addEventListener('click', () => {
      setMasterEventMode(button.dataset.masterEventMode);
      if (masterEventMode === 'attach') {
        syncMasterEventFromSource();
      } else {
        if (masterEventName) masterEventName.value = '';
        if (masterEventDescription) masterEventDescription.value = '';
        if (masterEventType) masterEventType.value = 'public';
        if (masterEventLocation) masterEventLocation.value = 'offline_studio';
      }
      setMasterEventStatus('', null);
    });
  });

  if (masterEventSource) {
    masterEventSource.addEventListener('change', syncMasterEventFromSource);
  }

  if (eventsList) {
    eventsList.addEventListener('click', (event) => {
      const openButton = event.target.closest('[data-master-open-event]');
      if (openButton) {
        openMasterEventPopup({ mode: 'attach', date: openButton.dataset.masterEventDate });
        return;
      }

      const attachButton = event.target.closest('[data-master-attach-event]');
      if (attachButton) {
        openMasterEventPopup({ mode: 'attach', eventId: attachButton.dataset.masterAttachEvent });
      }
    });
  }

  if (eventPopupContent) {
    eventPopupContent.addEventListener('click', (event) => {
      const attachButton = event.target.closest('[data-master-attach-event]');
      if (!attachButton) return;
      closePopup(eventPopup);
      openMasterEventPopup({ mode: 'attach', eventId: attachButton.dataset.masterAttachEvent });
    });
  }

  [eventPopup, clubGatePopup, masterEventPopup].forEach(popup => {
    if (!popup) return;
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
      closePopup(masterEventPopup);
    }
  });

  // Language switcher
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      applyTranslations(btn.dataset.lang);
      updateMonthLabel();
      updateUserBadge();
      updateMasterCalendarCta();
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
    renderCalendar();
    resetEventsPanel();
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
