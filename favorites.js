/* favorites.js - shared Supabase favorites helpers */

(function () {
  'use strict';

  const LOGIN_URL = 'https://t.me/santioago_bot?start=login';
  const SUPPORTED = ['en', 'cz', 'ru', 'ua'];
  const DEFAULT_LANG = 'ru';

  const copy = {
    en: {
      add: 'Save',
      added: 'Saved',
      remove: 'Remove',
      open: 'Open',
      events: 'Events',
      services: 'Services',
      empty: 'No saved items yet.',
      loading: 'Loading saved items...',
      loginRequired: 'Log in via Telegram to save items.',
      loginCta: 'Log in via Telegram',
      unavailable: 'Favorites are temporarily unavailable.'
    },
    cz: {
      add: 'Ulozit',
      added: 'Ulozeno',
      remove: 'Odebrat',
      open: 'Otevrit',
      events: 'Udalosti',
      services: 'Sluzby',
      empty: 'Zatim nemate ulozene polozky.',
      loading: 'Nacitani ulozenych polozek...',
      loginRequired: 'Pro ulozeni se prihlaste pres Telegram.',
      loginCta: 'Prihlasit pres Telegram',
      unavailable: 'Oblibene jsou docasne nedostupne.'
    },
    ru: {
      add: 'В избранное',
      added: 'В избранном',
      remove: 'Удалить',
      open: 'Открыть',
      events: 'События',
      services: 'Услуги',
      empty: 'Пока нет сохраненных элементов.',
      loading: 'Загружаем избранное...',
      loginRequired: 'Войдите через Telegram, чтобы сохранять избранное.',
      loginCta: 'Войти через Telegram',
      unavailable: 'Избранное временно недоступно.'
    },
    ua: {
      add: 'В обране',
      added: 'В обраному',
      remove: 'Видалити',
      open: 'Відкрити',
      events: 'Події',
      services: 'Послуги',
      empty: 'Поки немає збережених елементів.',
      loading: 'Завантажуємо обране...',
      loginRequired: 'Увійдіть через Telegram, щоб зберігати обране.',
      loginCta: 'Увійти через Telegram',
      unavailable: 'Обране тимчасово недоступне.'
    }
  };

  let favoritesCache = null;
  let favoritesRequest = null;

  function getLang() {
    const htmlLang = (document.documentElement.lang || '').toLowerCase();
    let pageLang = null;
    if (htmlLang.startsWith('cs') || htmlLang.startsWith('cz')) pageLang = 'cz';
    if (htmlLang.startsWith('uk')) pageLang = 'ua';
    if (htmlLang.startsWith('ru')) pageLang = 'ru';
    if (SUPPORTED.includes(htmlLang)) pageLang = htmlLang;

    const siteLang = localStorage.getItem('language');
    const calendarLang = localStorage.getItem('ma3-lang');

    if (location.pathname.endsWith('calendar.html')) {
      if (pageLang) return pageLang;
      if (calendarLang && SUPPORTED.includes(calendarLang)) return calendarLang;
    }

    if (siteLang && SUPPORTED.includes(siteLang)) return siteLang;
    if (pageLang) return pageLang;
    if (calendarLang && SUPPORTED.includes(calendarLang)) return calendarLang;

    return DEFAULT_LANG;
  }

  function label(key) {
    const lang = getLang();
    return (copy[lang] && copy[lang][key]) || copy.en[key] || key;
  }

  function getUser() {
    if (window.MA3Auth && window.MA3Auth.user) return window.MA3Auth.user;
    const id = localStorage.getItem('ma3-user-id');
    return {
      id,
      role: localStorage.getItem('ma3-user-role') || 'guest',
      name: localStorage.getItem('ma3-user-name') || null,
      isLoggedIn: !!id
    };
  }

  function getClient() {
    return window.supabaseClient || null;
  }

  function normalizeItem(itemOrFactory) {
    const raw = typeof itemOrFactory === 'function' ? itemOrFactory() : itemOrFactory;
    const item = raw || {};
    const type = item.type || item.item_type;
    const key = item.key || item.item_key || item.id;

    return {
      type: type ? String(type) : '',
      key: key ? String(key) : '',
      title: item.title ? String(item.title) : '',
      subtitle: item.subtitle ? String(item.subtitle) : '',
      url: item.url ? String(item.url) : '',
      metadata: item.metadata && typeof item.metadata === 'object' ? item.metadata : {}
    };
  }

  function sameFavorite(favorite, item) {
    return favorite.item_type === item.type && favorite.item_key === item.key;
  }

  function escapeAttribute(value) {
    if (window.CSS && typeof window.CSS.escape === 'function') {
      return window.CSS.escape(String(value));
    }
    return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  function ensureButtonMarkup(button) {
    if (button.querySelector('[data-favorite-label]')) return;

    button.innerHTML = `
      <svg class="favorite-toggle__icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78Z"></path>
      </svg>
      <span data-favorite-label></span>
    `;
  }

  function setButtonState(button, isActive, isBusy) {
    ensureButtonMarkup(button);
    button.classList.toggle('is-active', !!isActive);
    button.classList.toggle('is-busy', !!isBusy);
    button.disabled = !!isBusy;
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    button.setAttribute('title', isActive ? label('added') : label('add'));
    button.setAttribute('aria-label', isActive ? label('added') : label('add'));

    const text = button.querySelector('[data-favorite-label]');
    if (text) text.textContent = isActive ? label('added') : label('add');
  }

  function showLoginPrompt() {
    document.dispatchEvent(new CustomEvent('ma3-favorites-login-required'));
    alert(label('loginRequired'));
  }

  async function getFavorites(force) {
    const user = getUser();
    if (!user.isLoggedIn || !user.id) {
      favoritesCache = [];
      return favoritesCache;
    }

    if (favoritesCache && !force) return favoritesCache;
    if (favoritesRequest && !force) return favoritesRequest;

    const sb = getClient();
    if (!sb) {
      favoritesCache = [];
      return favoritesCache;
    }

    favoritesRequest = sb
      .rpc('get_profile_favorites', { p_user_id: user.id })
      .then(({ data, error }) => {
        if (error) throw error;
        favoritesCache = data || [];
        return favoritesCache;
      })
      .catch((err) => {
        console.warn('[Favorites] Could not load favorites:', err);
        favoritesCache = [];
        return favoritesCache;
      })
      .finally(() => {
        favoritesRequest = null;
      });

    return favoritesRequest;
  }

  async function addFavorite(itemOrFactory) {
    const user = getUser();
    const sb = getClient();
    const item = normalizeItem(itemOrFactory);

    if (!user.isLoggedIn || !user.id) {
      showLoginPrompt();
      return null;
    }

    if (!sb || !item.type || !item.key) {
      alert(label('unavailable'));
      return null;
    }

    const { data, error } = await sb.rpc('upsert_favorite', {
      p_user_id: user.id,
      p_item_type: item.type,
      p_item_key: item.key,
      p_title: item.title || item.key,
      p_subtitle: item.subtitle || null,
      p_url: item.url || null,
      p_metadata: item.metadata || {}
    });

    if (error) throw error;

    favoritesCache = null;
    document.dispatchEvent(new CustomEvent('ma3-favorites-changed', { detail: { action: 'add', item } }));
    return data;
  }

  async function removeFavorite(itemType, itemKey) {
    const user = getUser();
    const sb = getClient();

    if (!user.isLoggedIn || !user.id || !sb) return false;

    const { data, error } = await sb.rpc('delete_favorite', {
      p_user_id: user.id,
      p_item_type: itemType,
      p_item_key: itemKey
    });

    if (error) throw error;

    favoritesCache = null;
    document.dispatchEvent(new CustomEvent('ma3-favorites-changed', {
      detail: { action: 'remove', item: { type: itemType, key: itemKey } }
    }));
    return !!data;
  }

  async function toggleFavorite(itemOrFactory) {
    const item = normalizeItem(itemOrFactory);
    const user = getUser();

    if (!user.isLoggedIn || !user.id) {
      showLoginPrompt();
      return false;
    }

    const favorites = await getFavorites(false);
    const isActive = favorites.some((favorite) => sameFavorite(favorite, item));

    if (isActive) {
      await removeFavorite(item.type, item.key);
    } else {
      await addFavorite(item);
    }

    await refreshMatchingButtons(item);
    return !isActive;
  }

  async function syncButton(button) {
    const item = normalizeItem(button.__ma3FavoriteItem);
    if (!item.type || !item.key) return;

    button.dataset.favoriteType = item.type;
    button.dataset.favoriteKey = item.key;

    const user = getUser();
    if (!user.isLoggedIn || !user.id) {
      setButtonState(button, false, false);
      return;
    }

    const favorites = await getFavorites(false);
    setButtonState(button, favorites.some((favorite) => sameFavorite(favorite, item)), false);
  }

  async function refreshMatchingButtons(item) {
    const selector = `[data-favorite-type="${escapeAttribute(item.type)}"][data-favorite-key="${escapeAttribute(item.key)}"]`;
    const buttons = Array.from(document.querySelectorAll(selector));
    await Promise.all(buttons.map(syncButton));
  }

  function registerButton(button, itemOrFactory) {
    if (!button) return null;

    button.__ma3FavoriteItem = itemOrFactory;
    button.classList.add('favorite-toggle');
    if (!button.getAttribute('type')) button.setAttribute('type', 'button');

    const item = normalizeItem(itemOrFactory);
    if (item.type) button.dataset.favoriteType = item.type;
    if (item.key) button.dataset.favoriteKey = item.key;

    ensureButtonMarkup(button);
    setButtonState(button, false, false);

    if (!button.__ma3FavoriteBound) {
      button.__ma3FavoriteBound = true;
      button.addEventListener('click', async (event) => {
        event.preventDefault();
        event.stopPropagation();

        setButtonState(button, button.classList.contains('is-active'), true);
        try {
          await toggleFavorite(button.__ma3FavoriteItem);
        } catch (err) {
          console.warn('[Favorites] Toggle failed:', err);
          alert(label('unavailable'));
          setButtonState(button, button.classList.contains('is-active'), false);
        }
      });
    }

    syncButton(button);
    return button;
  }

  function createEmptyState(text) {
    const empty = document.createElement('div');
    empty.className = 'favorites-empty';
    empty.textContent = text;
    return empty;
  }

  function createFavoriteCard(favorite) {
    const card = document.createElement('article');
    card.className = `favorite-item favorite-item--${favorite.item_type}`;

    const body = document.createElement('div');
    body.className = 'favorite-item__body';

    const badge = document.createElement('span');
    badge.className = 'favorite-item__badge';
    badge.textContent = favorite.item_type === 'event' ? label('events') : label('services');

    const title = document.createElement('h3');
    title.className = 'favorite-item__title';
    title.textContent = favorite.title || favorite.item_key;

    body.appendChild(badge);
    body.appendChild(title);

    if (favorite.subtitle) {
      const subtitle = document.createElement('p');
      subtitle.className = 'favorite-item__subtitle';
      subtitle.textContent = favorite.subtitle;
      body.appendChild(subtitle);
    }

    const actions = document.createElement('div');
    actions.className = 'favorite-item__actions';

    if (favorite.url) {
      const open = document.createElement('a');
      open.className = 'favorite-item__open';
      open.href = favorite.url;
      open.textContent = label('open');
      actions.appendChild(open);
    }

    const remove = document.createElement('button');
    remove.className = 'favorite-item__remove';
    remove.type = 'button';
    remove.setAttribute('aria-label', label('remove'));
    remove.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 6h18"></path>
        <path d="M8 6V4h8v2"></path>
        <path d="M19 6l-1 14H6L5 6"></path>
      </svg>
      <span>${label('remove')}</span>
    `;
    remove.addEventListener('click', async () => {
      remove.disabled = true;
      try {
        await removeFavorite(favorite.item_type, favorite.item_key);
        const container = card.closest('[data-favorites-cabinet]');
        if (container) renderCabinet(container);
        await refreshMatchingButtons({ type: favorite.item_type, key: favorite.item_key });
      } catch (err) {
        console.warn('[Favorites] Remove failed:', err);
        alert(label('unavailable'));
        remove.disabled = false;
      }
    });
    actions.appendChild(remove);

    card.appendChild(body);
    card.appendChild(actions);
    return card;
  }

  function createGroup(titleText, items) {
    const group = document.createElement('section');
    group.className = 'favorites-group';

    const title = document.createElement('h3');
    title.className = 'favorites-group__title';
    title.textContent = titleText;
    group.appendChild(title);

    const list = document.createElement('div');
    list.className = 'favorites-group__list';
    items.forEach((favorite) => list.appendChild(createFavoriteCard(favorite)));
    group.appendChild(list);

    return group;
  }

  async function renderCabinet(containerOrSelector) {
    const container = typeof containerOrSelector === 'string'
      ? document.querySelector(containerOrSelector)
      : containerOrSelector;

    if (!container) return;

    const user = getUser();
    container.innerHTML = '';

    if (!user.isLoggedIn || !user.id) {
      const empty = createEmptyState(label('loginRequired'));
      const link = document.createElement('a');
      link.className = 'favorite-login-link';
      link.href = LOGIN_URL;
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = label('loginCta');
      empty.appendChild(link);
      container.appendChild(empty);
      return;
    }

    container.appendChild(createEmptyState(label('loading')));
    const favorites = await getFavorites(true);

    container.innerHTML = '';
    if (!favorites.length) {
      container.appendChild(createEmptyState(label('empty')));
      return;
    }

    const events = favorites.filter((favorite) => favorite.item_type === 'event');
    const services = favorites.filter((favorite) => favorite.item_type === 'service');

    if (events.length) container.appendChild(createGroup(label('events'), events));
    if (services.length) container.appendChild(createGroup(label('services'), services));
  }

  async function refreshAllButtons() {
    const buttons = Array.from(document.querySelectorAll('.favorite-toggle'));
    await Promise.all(buttons.map(syncButton));
  }

  document.addEventListener('ma3-auth-changed', () => {
    favoritesCache = null;
    refreshAllButtons();
    document.querySelectorAll('[data-favorites-cabinet]').forEach(renderCabinet);
  });

  document.addEventListener('ma3-favorites-changed', () => {
    document.querySelectorAll('[data-favorites-cabinet]').forEach(renderCabinet);
  });

  document.addEventListener('click', (event) => {
    if (!event.target.closest('.lang-btn')) return;
    setTimeout(() => {
      refreshAllButtons();
      document.querySelectorAll('[data-favorites-cabinet]').forEach(renderCabinet);
    }, 0);
  });

  window.MA3Favorites = {
    addFavorite,
    getFavorites,
    label,
    refreshAllButtons,
    registerButton,
    removeFavorite,
    renderCabinet,
    toggleFavorite
  };
})();
