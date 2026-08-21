(function () {
  'use strict';

  const track = document.getElementById('home-events-track');
  if (!track) return;

  const sb = window.supabaseClient;
  const DEFAULT_LANG = 'en';
  const MAX_EVENTS = 5;
  const LOOKAHEAD_MONTHS = 6;
  const EVENTS_UNAVAILABLE_TEXT = 'Events temporarily unavailable';

  const emptyLabel = 'No upcoming events';

  function getLang() {
    return DEFAULT_LANG;
  }

  function getLocale(lang) {
    return 'en-US';
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char]));
  }

  function renderEmpty() {
    const lang = getLang();
    track.innerHTML = `
      <div class="event-card glass-card home-events-status">
        <h3>${emptyLabel}</h3>
        <p>${new Date().toLocaleDateString(getLocale(lang), { month: 'long', year: 'numeric' })}</p>
      </div>
    `;
  }

  function renderUnavailable() {
    track.innerHTML = `
      <div class="event-card glass-card home-events-status" role="status">
        <h3>${EVENTS_UNAVAILABLE_TEXT}</h3>
        <p>Please try again later.</p>
      </div>
    `;
  }

  function expandRecurrence(event, startDate, endDate) {
    if (!event.recurrence_rule || !window.RRule) return [event];

    try {
      const rule = window.RRule.fromString(event.recurrence_rule);
      const duration = event.duration_minutes || Math.max(60, Math.round((new Date(event.end_time) - new Date(event.start_time)) / 60000));
      return rule.between(startDate, endDate, true).map(date => ({
        ...event,
        id: `${event.id}_${date.getTime()}`,
        start_time: date.toISOString(),
        end_time: new Date(date.getTime() + duration * 60000).toISOString()
      }));
    } catch (err) {
      console.warn('[HomeEvents] Recurrence expansion failed:', err);
      return [event];
    }
  }

  function eventVisibleForRole(event) {
    const role = window.MA3Auth?.user?.role || 'guest';
    if (role === 'admin' || role === 'instructor') return true;
    if (role === 'resident') return event.type === 'public' || event.type === 'club';
    return event.type === 'public';
  }

  function renderEvents(events) {
    if (!events.length) {
      renderEmpty();
      return;
    }

    const lang = getLang();
    const locale = getLocale(lang);
    const formatter = new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    track.innerHTML = events.slice(0, MAX_EVENTS).map(event => {
      const title = escapeHtml(event.title);
      const date = formatter.format(new Date(event.start_time));
      return `
        <a class="event-card glass-card home-event-card" href="calendar.html" aria-label="${title}">
          <h3>${title}</h3>
          <p>${date}</p>
        </a>
      `;
    }).join('');
  }

  async function loadEvents() {
    if (!sb) {
      renderUnavailable();
      return;
    }

    const now = new Date();
    const lookahead = new Date(now);
    lookahead.setMonth(lookahead.getMonth() + LOOKAHEAD_MONTHS);

    try {
      const { data, error } = await sb
        .from('events')
        .select('*')
        .eq('type', 'public')
        .eq('status', 'confirmed')
        .lte('start_time', lookahead.toISOString())
        .order('start_time', { ascending: true });

      if (error) throw error;

      const upcoming = (data || [])
        .filter(eventVisibleForRole)
        .flatMap(event => expandRecurrence(event, now, lookahead))
        .filter(event => new Date(event.start_time) >= now)
        .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

      renderEvents(upcoming);
    } catch (err) {
      console.warn('[HomeEvents] Could not load events:', err);
      renderUnavailable();
    }
  }

  document.addEventListener('ma3-auth-changed', loadEvents);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadEvents);
  } else {
    loadEvents();
  }
})();
