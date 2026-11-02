const REACTION_KEY = 'borderless-feed-reactions-v1';
const state = {
  marketplace: [],
  rfqs: [],
  feed: [],
};

document.addEventListener('DOMContentLoaded', async () => {
  setupGroupedButtons();

  await loadMarketplace();
  await loadRfqs();
  await loadFeed();

  setupMarketplaceFilters();
  setupRfqBoardFilters();
  setupPreviewFilters();
  setupComposer();
  setupFeedFilters();
  setupFeedInteractions();
});

function setupGroupedButtons() {
  const groups = document.querySelectorAll('[data-group]');
  groups.forEach((group) => {
    group.addEventListener('click', (event) => {
      const button = event.target;
      if (!(button instanceof HTMLButtonElement)) {
        return;
      }
      const buttons = group.querySelectorAll('button');
      buttons.forEach((item) => item.classList.remove('active'));
      button.classList.add('active');
    });
  });
}

async function loadMarketplace() {
  const grid = document.getElementById('marketGrid');
  if (!grid) {
    return;
  }

  try {
    const response = await fetch('/api/marketplace');
    const data = await response.json();
    state.marketplace = Array.isArray(data.items) ? data.items : [];
    if (!state.marketplace.length) {
      return;
    }

    grid.innerHTML = state.marketplace.map((item) => renderMarketplaceCard(item)).join('');
  } catch {
    state.marketplace = Array.from(grid.querySelectorAll('.v2-product-card')).map((card) => ({
      id: card.getAttribute('data-order') || String(Math.random()),
      name: card.getAttribute('data-name') || '',
      exporter: card.getAttribute('data-exporter') || '',
      region: card.getAttribute('data-region') || 'all',
      price: Number(card.getAttribute('data-price') || 0),
      order: Number(card.getAttribute('data-order') || 0),
      image: card.querySelector('img')?.getAttribute('src') || '',
      grade: card.querySelector('.v2-card-body p')?.textContent?.split('•')[1]?.trim() || '',
      country: card.querySelector('.v2-meta span')?.textContent || '',
    }));
  }
}

async function loadRfqs() {
  const board = document.getElementById('rfqBoard');
  if (!board) {
    return;
  }

  try {
    const response = await fetch('/api/rfqs');
    const data = await response.json();
    state.rfqs = Array.isArray(data.items) ? data.items : [];
    if (!state.rfqs.length) {
      return;
    }

    board.innerHTML = state.rfqs.map((item) => renderRfqCard(item)).join('');
  } catch {
    state.rfqs = Array.from(board.querySelectorAll('.v2-rfq-card')).map((card) => ({
      role: card.getAttribute('data-role') || 'buyer',
      status: card.getAttribute('data-status') || 'open',
      qty: Number(card.getAttribute('data-qty') || 0),
      order: Number(card.getAttribute('data-order') || 0),
      title: card.querySelector('h3')?.textContent || '',
      description: card.querySelector('p')?.textContent || '',
      locationLabel: card.querySelector('.v2-meta span')?.textContent || '',
      daysLabel: card.querySelector('.v2-rfq-top span:last-child')?.textContent || '',
    }));
  }
}

async function loadFeed() {
  const feed = document.getElementById('feedStream');
  if (!feed) {
    return;
  }

  try {
    const response = await fetch('/api/feed');
    const data = await response.json();
    state.feed = Array.isArray(data.items) ? data.items : [];
    if (state.feed.length) {
      renderFeed();
      return;
    }
  } catch {
    // fallback below
  }

  state.feed = Array.from(feed.querySelectorAll('.v2-social-post')).map((post, index) => ({
    id: `seed-${index}`,
    type: post.getAttribute('data-type') || 'update',
    name: post.querySelector('.post-meta strong')?.textContent || 'Member',
    content: post.querySelector('p')?.textContent || '',
    image: post.querySelector('img')?.getAttribute('src') || '',
    createdAt: Date.now() - index * 600000,
    stats: { likes: 0, comments: 0, shares: 0, saves: 0 },
  }));
  renderFeed();
}

function setupMarketplaceFilters() {
  const grid = document.getElementById('marketGrid');
  const search = document.getElementById('marketSearch');
  const sort = document.getElementById('marketSort');
  const region = document.getElementById('marketRegion');
  if (!grid || !(search instanceof HTMLInputElement) || !(sort instanceof HTMLSelectElement) || !(region instanceof HTMLSelectElement)) {
    return;
  }

  const apply = () => {
    const query = search.value.trim().toLowerCase();
    const selectedRegion = region.value;
    const selectedSort = sort.value;

    let filtered = state.marketplace.filter((item) => {
      const name = (item.name || '').toLowerCase();
      const exporter = (item.exporter || '').toLowerCase();
      const matchQuery = !query || name.includes(query) || exporter.includes(query);
      const matchRegion = selectedRegion === 'all' || item.region === selectedRegion;
      return matchQuery && matchRegion;
    });

    filtered = filtered.sort((a, b) => {
      if (selectedSort === 'price-low') {
        return Number(a.price || 0) - Number(b.price || 0);
      }
      if (selectedSort === 'price-high') {
        return Number(b.price || 0) - Number(a.price || 0);
      }
      return Number(a.order || 0) - Number(b.order || 0);
    });

    grid.innerHTML = filtered.map((item) => renderMarketplaceCard(item)).join('');
  };

  search.addEventListener('input', apply);
  sort.addEventListener('change', apply);
  region.addEventListener('change', apply);
  apply();
}

function setupRfqBoardFilters() {
  const board = document.getElementById('rfqBoard');
  const role = document.getElementById('rfqRoleFilter');
  const status = document.getElementById('rfqStatusFilter');
  const sort = document.getElementById('rfqSort');
  if (!board || !(role instanceof HTMLSelectElement) || !(status instanceof HTMLSelectElement) || !(sort instanceof HTMLSelectElement)) {
    return;
  }

  const apply = () => {
    const selectedRole = role.value;
    const selectedStatus = status.value;
    const selectedSort = sort.value;

    let filtered = state.rfqs.filter((item) => {
      const roleMatch = selectedRole === 'all' || item.role === selectedRole;
      const statusMatch = selectedStatus === 'all' || item.status === selectedStatus;
      return roleMatch && statusMatch;
    });

    filtered = filtered.sort((a, b) => {
      if (selectedSort === 'qty-high') {
        return Number(b.qty || 0) - Number(a.qty || 0);
      }
      if (selectedSort === 'qty-low') {
        return Number(a.qty || 0) - Number(b.qty || 0);
      }
      return Number(a.order || 0) - Number(b.order || 0);
    });

    board.innerHTML = filtered.map((item) => renderRfqCard(item)).join('');
  };

  role.addEventListener('change', apply);
  status.addEventListener('change', apply);
  sort.addEventListener('change', apply);
  apply();
}

function setupPreviewFilters() {
  const buttons = document.querySelectorAll('.v2-mini-filters button');
  const tiles = document.querySelectorAll('#previewGrid .v2-thumb');
  if (!buttons.length || !tiles.length) {
    return;
  }

  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const filter = button.getAttribute('data-filter') || 'latest';
      tiles.forEach((tile) => {
        const tags = tile.getAttribute('data-tags') || '';
        const priceBand = tile.getAttribute('data-price') || 'mid';
        const visible = filter === 'price' ? priceBand === 'low' || tags.includes('price') : tags.includes(filter);
        tile.style.display = visible ? 'block' : 'none';
      });
    });
  });
}

function setupComposer() {
  const form = document.getElementById('postComposer');
  if (!(form instanceof HTMLFormElement)) {
    return;
  }

  const postTypeButtons = form.querySelectorAll('.v2-composer-type button, .composer-type button');
  const productFields = document.getElementById('productFields');
  const rfqFields = document.getElementById('rfqFields');
  const nameInput = document.getElementById('exporterName');
  const contentInput = document.getElementById('postContent');
  const mediaFile = document.getElementById('mediaFile');
  const productName = document.getElementById('productName');
  const productOrigin = document.getElementById('productOrigin');
  const productPrice = document.getElementById('productPrice');
  const rfqCommodity = document.getElementById('rfqCommodity');
  const rfqQuantity = document.getElementById('rfqQuantity');
  const rfqDeadline = document.getElementById('rfqDeadline');

  let type = 'update';

  postTypeButtons.forEach((button) => {
    button.addEventListener('click', () => {
      type = button.getAttribute('data-post-type') || 'update';
      if (productFields) {
        productFields.classList.toggle('hidden', type !== 'product');
      }
      if (rfqFields) {
        rfqFields.classList.toggle('hidden', type !== 'rfq');
      }
    });
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const content = contentInput instanceof HTMLTextAreaElement ? contentInput.value.trim() : '';
    if (!content) {
      return;
    }

    const file = mediaFile instanceof HTMLInputElement ? mediaFile.files?.[0] : undefined;
    let imageSource = '';
    if (file) {
      imageSource = await readFileAsDataUrl(file);
    }

    const postPayload = {
      type,
      name: nameInput instanceof HTMLInputElement ? nameInput.value.trim() || 'Member' : 'Member',
      content,
      image: imageSource,
      productName: productName instanceof HTMLInputElement ? productName.value.trim() : '',
      productOrigin: productOrigin instanceof HTMLInputElement ? productOrigin.value.trim() : '',
      productPrice: productPrice instanceof HTMLInputElement ? productPrice.value.trim() : '',
      rfqCommodity: rfqCommodity instanceof HTMLInputElement ? rfqCommodity.value.trim() : '',
      rfqQuantity: rfqQuantity instanceof HTMLInputElement ? rfqQuantity.value.trim() : '',
      rfqDeadline: rfqDeadline instanceof HTMLInputElement ? rfqDeadline.value.trim() : '',
    };

    try {
      const response = await fetch('/api/feed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(postPayload),
      });
      const data = await response.json();
      if (data.item) {
        state.feed.unshift(data.item);
        renderFeed();
      }
    } catch {
      const fallbackPost = {
        id: `f-${Date.now()}`,
        ...postPayload,
        createdAt: Date.now(),
        stats: { likes: 0, comments: 0, shares: 0, saves: 0 },
      };
      state.feed.unshift(fallbackPost);
      renderFeed();
    }

    form.reset();
    type = 'update';
    postTypeButtons.forEach((button) => {
      button.classList.toggle('active', (button.getAttribute('data-post-type') || 'update') === 'update');
    });
    if (productFields) {
      productFields.classList.add('hidden');
    }
    if (rfqFields) {
      rfqFields.classList.add('hidden');
    }
  });
}

function setupFeedFilters() {
  const feed = document.getElementById('feedStream');
  const buttons = document.querySelectorAll('.v2-feed-filter-row button, .feed-filter-row .feed-filter');
  if (!feed || !buttons.length) {
    return;
  }

  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const filter = button.getAttribute('data-feed-filter') || 'all';
      const posts = feed.querySelectorAll('.v2-social-post');
      posts.forEach((post) => {
        const type = post.getAttribute('data-type') || 'update';
        post.style.display = filter === 'all' || filter === type ? 'block' : 'none';
      });
    });
  });
}

function setupFeedInteractions() {
  const feed = document.getElementById('feedStream');
  if (!feed) {
    return;
  }

  feed.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const actionButton = target.closest('[data-action]');
    if (!actionButton) {
      return;
    }

    const card = actionButton.closest('.v2-social-post');
    if (!card) {
      return;
    }

    const postId = card.getAttribute('data-id');
    const action = actionButton.getAttribute('data-action');
    if (!postId || !action) {
      return;
    }

    const reactions = getReactionState();
    const key = `${postId}:${action}`;
    const alreadyActive = reactions[key] === true;
    const nextActive = !alreadyActive;
    reactions[key] = nextActive;
    setReactionState(reactions);
    updateActionCount(actionButton, nextActive);
    syncReaction(postId, action, nextActive, actionButton, alreadyActive);
  });
}

async function syncReaction(postId, action, nextActive, actionButton, previousActive) {
  try {
    const response = await fetch(`/api/feed/${encodeURIComponent(postId)}/reactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, active: nextActive }),
    });
    if (!response.ok) {
      throw new Error('Reaction sync failed');
    }
  } catch {
    const reactions = getReactionState();
    reactions[`${postId}:${action}`] = previousActive;
    setReactionState(reactions);
    updateActionCount(actionButton, previousActive);
  }
}

function updateActionCount(actionButton, active) {
  actionButton.classList.toggle('active', active);
  const countNode = actionButton.querySelector('[data-count]');
  if (!countNode) {
    return;
  }
  const current = Number(countNode.textContent || '0');
  const next = active ? current + 1 : Math.max(0, current - 1);
  countNode.textContent = String(next);
}

function renderFeed() {
  const feed = document.getElementById('feedStream');
  if (!feed) {
    return;
  }
  feed.innerHTML = state.feed.map((post) => renderFeedPost(post)).join('');
  applySavedReactions();
}

function renderFeedPost(post) {
  const label = post.type === 'product' ? 'Product post' : post.type === 'rfq' ? 'RFQ post' : 'Normal post';
  const imageBlock = post.image ? `<img src="${escapeHtml(post.image)}" alt="Post image" />` : '';

  let chips = [];
  if (post.type === 'product') {
    chips = [post.productName, post.productOrigin, post.productPrice].filter(Boolean);
  }
  if (post.type === 'rfq') {
    chips = [post.rfqCommodity, post.rfqQuantity, post.rfqDeadline].filter(Boolean);
  }
  const chipsBlock = chips.length ? `<div class="product-chip-row">${chips.map((chip) => `<span>${escapeHtml(chip)}</span>`).join('')}</div>` : '';

  const stats = post.stats || { likes: 0, comments: 0, shares: 0, saves: 0, bookmarks: 0 };

  return `
    <article class="v2-social-post" data-type="${escapeHtml(post.type || 'update')}" data-id="${escapeHtml(post.id || '')}">
      <div class="post-meta">
        <strong>${escapeHtml(post.name || 'Member')}</strong>
        <span>${escapeHtml(label)} · ${escapeHtml(formatRelativeTime(post.createdAt))}</span>
      </div>
      <p>${escapeHtml(post.content || '')}</p>
      ${imageBlock}
      ${chipsBlock}
      <div class="post-actions">
        <button type="button" data-action="like">Like <span data-count>${Number(stats.likes || 0)}</span></button>
        <button type="button" data-action="comment">Comment <span data-count>${Number(stats.comments || 0)}</span></button>
        <button type="button" data-action="share">Share <span data-count>${Number(stats.shares || 0)}</span></button>
        <button type="button" data-action="save">Save <span data-count>${Number(stats.saves || 0)}</span></button>
        <button type="button" data-action="bookmark">Bookmark <span data-count>${Number(stats.bookmarks || 0)}</span></button>
      </div>
    </article>
  `;
}

function applySavedReactions() {
  const reactions = getReactionState();
  const buttons = document.querySelectorAll('.post-actions [data-action]');
  buttons.forEach((button) => {
    const card = button.closest('.v2-social-post');
    const action = button.getAttribute('data-action');
    const postId = card?.getAttribute('data-id') || '';
    if (reactions[`${postId}:${action}`]) {
      button.classList.add('active');
    }
  });
}

function getReactionState() {
  try {
    const raw = localStorage.getItem(REACTION_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function setReactionState(next) {
  localStorage.setItem(REACTION_KEY, JSON.stringify(next));
}

function renderMarketplaceCard(item) {
  return `
    <article class="v2-product-card" data-name="${escapeHtml(item.name || '')}" data-exporter="${escapeHtml(item.exporter || '')}" data-region="${escapeHtml(item.region || '')}" data-price="${Number(item.price || 0)}" data-order="${Number(item.order || 0)}">
      <img src="${escapeHtml(item.image || '')}" alt="${escapeHtml(item.name || 'Product')}" />
      <div class="v2-card-body">
        <h3>${escapeHtml(item.name || '')}</h3>
        <p>${escapeHtml(item.exporter || '')} • ${escapeHtml(item.grade || 'Verified listing')}</p>
        <div class="v2-meta"><span>${escapeHtml(item.country || '')}</span><strong>USD ${Number(item.price || 0).toLocaleString()}/MT</strong></div>
      </div>
    </article>
  `;
}

function renderRfqCard(item) {
  const roleText = item.role === 'exporter' ? 'Exporter RFQ' : 'Buyer RFQ';
  const soft = item.role === 'exporter' ? ' v2-tag-soft' : '';
  return `
    <article class="v2-rfq-card" data-role="${escapeHtml(item.role || 'buyer')}" data-status="${escapeHtml(item.status || 'open')}" data-qty="${Number(item.qty || 0)}" data-order="${Number(item.order || 0)}">
      <div class="v2-rfq-top"><span class="v2-tag${soft}">${escapeHtml(roleText)}</span><span>${escapeHtml(item.daysLabel || '')}</span></div>
      <h3>${escapeHtml(item.title || '')}</h3>
      <p>${escapeHtml(item.description || '')}</p>
      <div class="v2-meta"><span>${escapeHtml(item.locationLabel || '')}</span><strong>${Number(item.qty || 0)} MT</strong></div>
    </article>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Unable to read uploaded image.'));
    reader.readAsDataURL(file);
  });
}

function formatRelativeTime(timestamp) {
  if (!timestamp) {
    return 'just now';
  }
  const elapsed = Date.now() - Number(timestamp);
  const minutes = Math.max(1, Math.round(elapsed / 60000));
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}
