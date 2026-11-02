const phaseState = {
  businesses: [],
  opportunities: [],
  selectedOpportunity: null,
};

if (!document.querySelector('script[src="theme.js"]')) {
  const themeScript = document.createElement('script');
  themeScript.src = 'theme.js';
  document.head.appendChild(themeScript);
}

document.addEventListener('DOMContentLoaded', () => {
  setupPhaseGroups();
  setupDashboard();
  setupBusinessDirectory();
  setupProfile();
  setupOpportunities();
  setupAdmin();
  setupOnboarding();
  setupProductListing();
  setupRfqCreation();
});

function setupPhaseGroups() {
  document.querySelectorAll('[data-phase-group]').forEach((group) => {
    group.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-phase-filter]');
      if (!button) return;
      group.querySelectorAll('button').forEach((item) => item.classList.remove('active'));
      button.classList.add('active');
    });
  });
}

async function getJson(url, options) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Request failed.');
  return data;
}

function setText(selector, value) {
  const element = document.querySelector(selector);
  if (element) element.textContent = value;
}

async function setupDashboard() {
  const dashboard = document.querySelector('[data-phase-dashboard]');
  if (!dashboard) return;
  try {
    const data = await getJson('/api/dashboard');
    Object.entries(data.stats).forEach(([key, value]) => setText(`[data-stat="${key}"]`, value));
    const opportunityList = document.querySelector('[data-dashboard-opportunities]');
    if (opportunityList) opportunityList.innerHTML = data.opportunities.map(renderOpportunityRow).join('');
    const productList = document.querySelector('[data-dashboard-products]');
    if (productList) productList.innerHTML = data.latestProducts.map(renderProductRow).join('');
  } catch (error) {
    setText('[data-phase-error]', error.message);
  }
}

async function setupBusinessDirectory() {
  const directory = document.querySelector('[data-business-directory]');
  if (!directory) return;
  const search = document.querySelector('[data-business-search]');
  const role = document.querySelector('[data-business-role]');
  const status = document.querySelector('[data-business-status]');
  const render = async () => {
    const params = new URLSearchParams({ q: search?.value || '', role: role?.value || 'all', status: status?.value || 'all' });
    try {
      const data = await getJson(`/api/businesses?${params}`);
      phaseState.businesses = data.items;
      directory.innerHTML = data.items.map(renderBusinessCard).join('') || '<div class="phase-empty">No businesses match those filters.</div>';
    } catch (error) { directory.innerHTML = `<div class="phase-empty">${error.message}</div>`; }
  };
  [search, role, status].forEach((control) => control?.addEventListener('input', render));
  [role, status].forEach((control) => control?.addEventListener('change', render));
  render();
}

async function setupProfile() {
  const profile = document.querySelector('[data-phase-profile]');
  if (!profile) return;
  const businessId = new URLSearchParams(window.location.search).get('business') || profile.dataset.businessId || 'b1';
  const status = document.querySelector('[data-profile-status]');
  const form = document.querySelector('[data-verification-form]');
  try {
    const data = await getJson(`/api/businesses/${businessId}`);
    const business = data.item;
    document.querySelectorAll('[data-profile-field]').forEach((element) => {
      const key = element.dataset.profileField;
      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) element.value = business[key] || '';
      else element.textContent = business[key] || '';
    });
    if (status) { status.textContent = business.verificationStatus; status.className = `phase-status phase-status-${business.verificationStatus}`; }
    const products = document.querySelector('[data-profile-products]');
    if (products) products.innerHTML = (business.products || []).map(renderProductRow).join('') || '<div class="phase-empty">No products listed yet.</div>';
  } catch (error) { setText('[data-phase-error]', error.message); }
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const data = await getJson(`/api/businesses/${businessId}/verification`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      if (status) { status.textContent = data.item.verificationStatus; status.className = 'phase-status phase-status-pending'; }
      setText('[data-phase-success]', data.message);
    } catch (error) { setText('[data-phase-error]', error.message); }
  });
}

async function setupOpportunities() {
  const board = document.querySelector('[data-opportunity-board]');
  if (!board) return;
  const statusFilter = document.querySelector('[data-opportunity-status]');
  const render = async () => {
    try {
      const data = await getJson('/api/opportunities');
      phaseState.opportunities = statusFilter?.value && statusFilter.value !== 'all' ? data.items.filter((item) => item.status === statusFilter.value) : data.items;
      board.innerHTML = phaseState.opportunities.map(renderOpportunityCard).join('') || '<div class="phase-empty">No opportunities in this stage.</div>';
      board.querySelectorAll('[data-opportunity-id]').forEach((card) => card.addEventListener('click', () => loadOpportunity(card.dataset.opportunityId)));
    } catch (error) { board.innerHTML = `<div class="phase-empty">${error.message}</div>`; }
  };
  statusFilter?.addEventListener('change', render);
  await render();
  const opportunityId = new URLSearchParams(window.location.search).get('opportunity');
  if (opportunityId) await loadOpportunity(opportunityId);
  const form = document.querySelector('[data-message-form]');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!phaseState.selectedOpportunity) return;
    const input = form.querySelector('input');
    if (!input.value.trim()) return;
    try { await getJson(`/api/opportunities/${phaseState.selectedOpportunity.id}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: input.value }) }); input.value = ''; await loadOpportunity(phaseState.selectedOpportunity.id); }
    catch (error) { setText('[data-phase-error]', error.message); }
  });
}

async function loadOpportunity(id) {
  try {
    const data = await getJson(`/api/opportunities/${id}`);
    phaseState.selectedOpportunity = data.item;
    const detail = document.querySelector('[data-opportunity-detail]');
    if (!detail) return;
    detail.innerHTML = `<div class="phase-detail-kicker">Opportunity ${data.item.id.toUpperCase()}</div><h2>${data.item.title}</h2><div class="phase-detail-meta"><span class="phase-status phase-status-${data.item.status}">${data.item.status}</span><strong>${data.item.value}</strong></div><p>${data.item.buyer.name} and ${data.item.supplier.name} are connected through this managed sourcing opportunity.</p><label>Next action<select data-opportunity-status-edit><option ${data.item.status === 'new' ? 'selected' : ''}>new</option><option ${data.item.status === 'sourcing' ? 'selected' : ''}>sourcing</option><option ${data.item.status === 'matched' ? 'selected' : ''}>matched</option><option ${data.item.status === 'verified' ? 'selected' : ''}>verified</option><option ${data.item.status === 'rfq' ? 'selected' : ''}>rfq</option><option ${data.item.status === 'negotiation' ? 'selected' : ''}>negotiation</option><option ${data.item.status === 'qualified' ? 'selected' : ''}>qualified</option><option ${data.item.status === 'closed' ? 'selected' : ''}>closed</option></select></label><div class="phase-message-list">${data.item.messages.map((message) => `<div><strong>${message.from}</strong><p>${message.text}</p><small>${message.time}</small></div>`).join('') || '<div class="phase-empty">No messages yet. Start the conversation.</div>'}</div><form class="phase-message-form" data-message-form><input placeholder="Add an operational note or message" /><button type="submit">Send</button></form>`;
    detail.querySelector('select')?.addEventListener('change', async (event) => { await getJson(`/api/opportunities/${id}/status`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: event.target.value }) }); await loadOpportunity(id); });
    detail.querySelector('[data-message-form]')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const input = event.currentTarget.querySelector('input');
      if (!input.value.trim()) return;
      await getJson(`/api/opportunities/${id}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: input.value }) });
      await loadOpportunity(id);
    });
  } catch (error) { setText('[data-phase-error]', error.message); }
}

function escapePhaseHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

async function setupAdmin() {
  const admin = document.querySelector('[data-phase-admin]');
  if (!admin) return;
  const render = async () => {
    try {
      const data = await getJson('/api/admin/overview');
      Object.entries(data.stats).forEach(([key, value]) => setText(`[data-admin-stat="${key}"]`, value));
      const researchQueue = document.querySelector('[data-admin-research-queue]');
      if (researchQueue) {
        let researchFilter = researchQueue.closest('.phase-panel')?.querySelector('[data-admin-research-filter]');
        if (!researchFilter) {
          researchFilter = document.createElement('select');
          researchFilter.className = 'phase-research-queue-filter';
          researchFilter.dataset.adminResearchFilter = '';
          researchFilter.setAttribute('aria-label', 'Filter research queue');
          researchFilter.innerHTML = '<option value="all">All active requests</option><option value="researching">Researching</option><option value="review">Ready for review</option>';
          researchQueue.closest('.phase-panel-heading')?.appendChild(researchFilter);
        }
        if (!researchFilter.dataset.bound) {
          researchFilter.addEventListener('change', () => render());
          researchFilter.dataset.bound = 'true';
        }
        const businessesData = await getJson('/api/businesses');
        const visibleRequests = (data.researchQueue || []).filter((request) => researchFilter.value === 'all' || request.status === researchFilter.value);
        researchQueue.innerHTML = visibleRequests.map((request) => `<article class="phase-research-queue-item">
          <div class="phase-research-queue-summary"><div><strong>${escapePhaseHtml(request.product)} in ${escapePhaseHtml(request.market)}</strong><p>${request.type === 'buyers' ? 'Find buyers' : 'Find suppliers'}${request.origin ? ` · Origin: ${escapePhaseHtml(request.origin)}` : ''}${request.hsCode ? ` · HS ${escapePhaseHtml(request.hsCode)}` : ''}</p><small>${escapePhaseHtml(request.id)} · ${escapePhaseHtml(request.requester?.name || 'Member')} · Due ${new Date(request.expectedResponseAt).toLocaleDateString()}</small></div><span class="research-status research-status-${escapePhaseHtml(request.status)}">${escapePhaseHtml(request.status)}</span></div>
          <form class="phase-research-review-form" data-review-research="${escapePhaseHtml(request.id)}"><label>Assigned to<input name="assignedTo" value="${escapePhaseHtml(request.assignedTo || 'Borderless research team')}" /></label><label>Stage<select name="status"><option value="researching" ${request.status === 'researching' ? 'selected' : ''}>Researching</option><option value="review" ${request.status === 'review' ? 'selected' : ''}>Ready for review</option></select></label><label class="phase-research-note-field">Internal note<textarea name="internalNote" placeholder="Research notes for the team only"></textarea></label><button class="phase-button phase-button-secondary" type="submit">Save review update</button></form>
          <form class="phase-research-publish-form" data-publish-research="${escapePhaseHtml(request.id)}"><fieldset><legend>Select researched companies</legend><div class="phase-research-company-options">${businessesData.items.filter((business) => business.role === (request.type === 'buyers' ? 'buyer' : 'supplier')).map((business) => `<label><input type="checkbox" name="businessIds" value="${escapePhaseHtml(business.id)}" /><span><strong>${escapePhaseHtml(business.name)}</strong><small>${escapePhaseHtml(business.role)} · ${escapePhaseHtml(business.country)} · ${escapePhaseHtml((business.categories || []).join(', '))}</small></span></label>`).join('')}</div></fieldset><button class="phase-button phase-button-primary" type="submit">Publish matches</button></form>
        </article>`).join('') || '<div class="phase-empty">No research requests are waiting for review.</div>';
        researchQueue.querySelectorAll('[data-review-research]').forEach((form) => form.addEventListener('submit', async (event) => {
          event.preventDefault();
          const formData = new FormData(form);
          const submitButton = form.querySelector('[type="submit"]');
          submitButton.disabled = true;
          try {
            await getJson(`/api/admin/research-requests/${encodeURIComponent(form.dataset.reviewResearch)}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(Object.fromEntries(formData.entries())),
            });
            await render();
          } catch (error) {
            setText('[data-phase-error]', error.message);
            submitButton.disabled = false;
          }
        }));
        researchQueue.querySelectorAll('[data-publish-research]').forEach((form) => form.addEventListener('submit', async (event) => {
          event.preventDefault();
          const button = form.querySelector('[type="submit"]');
          const businessIds = Array.from(form.querySelectorAll('input[name="businessIds"]:checked'), (input) => input.value);
          button.disabled = true;
          try {
            await getJson(`/api/research-requests/${encodeURIComponent(form.dataset.publishResearch)}/results`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ businessIds }),
            });
            await render();
          } catch (error) {
            setText('[data-phase-error]', error.message);
            button.disabled = false;
          }
        }));
      }
      let introductionQueue = document.querySelector('[data-admin-introduction-queue]');
      if (!introductionQueue && researchQueue) {
        const introductionPanel = document.createElement('section');
        introductionPanel.className = 'phase-panel';
        introductionPanel.id = 'introduction-queue';
        introductionPanel.innerHTML = '<div class="phase-panel-heading"><div><p class="phase-kicker">Member follow-up</p><h2>Introduction requests</h2></div><span class="phase-panel-caption">Record follow-up with interested counterparties</span></div><div class="phase-queue" data-admin-introduction-queue><div class="phase-empty">Loading introduction requests...</div></div>';
        researchQueue.closest('.phase-panel')?.insertAdjacentElement('afterend', introductionPanel);
        introductionQueue = introductionPanel.querySelector('[data-admin-introduction-queue]');
      }
      if (introductionQueue) {
        introductionQueue.innerHTML = (data.introductionQueue || []).map((entry) => `<article class="phase-queue-item"><div><strong>${escapePhaseHtml(entry.company?.name || 'Company')}</strong><p>${escapePhaseHtml(entry.requester?.name || 'Member')} (${escapePhaseHtml(entry.requester?.email || 'No email')})</p><p>${escapePhaseHtml(entry.message)}</p><small>Request ${escapePhaseHtml(entry.requestId)} · ${new Date(entry.createdAt).toLocaleDateString()}</small></div><div class="phase-queue-actions"><button data-intro-status="reviewing" data-introduction-id="${escapePhaseHtml(entry.id)}">Mark reviewing</button><button data-intro-status="introduced" data-introduction-id="${escapePhaseHtml(entry.id)}">Mark introduced</button><button class="phase-button-muted" data-intro-status="closed" data-introduction-id="${escapePhaseHtml(entry.id)}">Close</button></div></article>`).join('') || '<div class="phase-empty">No introduction requests are waiting.</div>';
        introductionQueue.querySelectorAll('[data-introduction-id]').forEach((button) => button.addEventListener('click', async () => {
          await getJson(`/api/admin/research-introductions/${encodeURIComponent(button.dataset.introductionId)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: button.dataset.introStatus }),
          });
          await render();
        }));
      }
      const queue = document.querySelector('[data-verification-queue]');
      if (queue) queue.innerHTML = data.verificationQueue.map((entry) => `<article class="phase-queue-item"><div><strong>${entry.business.name}</strong><p>${entry.reason}</p><small>${entry.requestedAt} · ${entry.business.country}</small></div><div class="phase-queue-actions"><button data-decision="verified" data-verification-id="${entry.id}">Approve</button><button class="phase-button-muted" data-decision="rejected" data-verification-id="${entry.id}">Request changes</button></div></article>`).join('') || '<div class="phase-empty">Verification queue is clear.</div>';
      queue?.querySelectorAll('[data-verification-id]').forEach((button) => button.addEventListener('click', async () => { await getJson(`/api/admin/verifications/${button.dataset.verificationId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decision: button.dataset.decision }) }); await render(); }));
    } catch (error) { setText('[data-phase-error]', error.message); }
  };
  render();
}

function setupOnboarding() {
  const form = document.querySelector('[data-onboarding-form]');
  if (!form) return;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    try {
      const data = await getJson('/api/businesses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(formData.entries())) });
      setText('[data-phase-success]', `${data.item.name} is registered and pending verification.`);
      form.reset();
    } catch (error) { setText('[data-phase-error]', error.message); }
  });
}

function setupProductListing() {
  const form = document.querySelector('[data-product-listing-form]');
  if (!form) return;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    try {
      const data = await getJson('/api/marketplace', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(formData.entries())) });
      setText('[data-phase-success]', `${data.item.name} is now listed in the marketplace.`);
      form.reset();
    } catch (error) { setText('[data-phase-error]', error.message); }
  });
}

function setupRfqCreation() {
  const form = document.querySelector('[data-rfq-creation-form]');
  if (!form) return;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    try {
      const data = await getJson('/api/rfqs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(formData.entries())) });
      setText('[data-phase-success]', `${data.item.title} was added to the RFQ board.`);
      form.reset();
    } catch (error) { setText('[data-phase-error]', error.message); }
  });
}

function renderBusinessCard(business) {
  const category = (business.categories[0] || '').toLowerCase();
  const image = category.includes('coffee') ? 'assets/coffee.jpg'
    : category.includes('cocoa') ? 'assets/cocoa.jpg'
      : category.includes('cashew') || category.includes('nuts') ? 'assets/cashew.jpg'
        : category.includes('avocado') || category.includes('produce') ? 'assets/avocado.jpg'
          : category.includes('sesame') ? 'assets/sesame.jpg'
            : category.includes('maize') || category.includes('corn') ? 'assets/maize.jpg'
              : category.includes('rice') ? 'assets/rice.jpg'
                : category.includes('pulse') || category.includes('bean') ? 'assets/pulses.jpg'
                  : 'assets/market.jpg';
  return `<a class="phase-business-card" href="company.html?business=${encodeURIComponent(business.id)}"><div class="phase-avatar phase-avatar-image"><img src="${image}" alt="${escapePhaseHtml(business.categories[0] || 'Agricultural trade')}" /></div><div><div class="phase-card-top"><strong>${escapePhaseHtml(business.name)}</strong><span class="phase-status phase-status-${escapePhaseHtml(business.verificationStatus)}">${escapePhaseHtml(business.verificationStatus)}</span></div><p>${escapePhaseHtml(business.role)} · ${escapePhaseHtml(business.country)}</p><small>${escapePhaseHtml(business.categories.join(', '))}</small></div><span class="phase-business-link">View profile</span></a>`;
}
function renderOpportunityCard(item) { return `<article class="phase-opportunity-card" data-opportunity-id="${item.id}"><div class="phase-card-top"><span class="phase-status phase-status-${item.status}">${item.status}</span><span class="phase-priority phase-priority-${item.priority}">${item.priority}</span></div><h3>${item.title}</h3><p>${item.nextAction}</p><div class="phase-card-bottom"><span>${item.updatedAt}</span><strong>${item.value}</strong></div></article>`; }
function renderOpportunityRow(item) { return `<a class="phase-table-row" href="opportunities.html?opportunity=${item.id}"><span><strong>${item.title}</strong><small>${item.nextAction}</small></span><span class="phase-status phase-status-${item.status}">${item.status}</span><b>${item.value}</b></a>`; }
function renderProductRow(item) { return `<a class="phase-product-row" href="index.html#marketplace"><img src="${item.image}" alt="${item.name}" /><span><strong>${item.name}</strong><small>${item.exporter} · ${item.country}</small></span><b>USD ${Number(item.price).toLocaleString()} / MT</b></a>`; }

window.loadPhaseOpportunity = loadOpportunity;
