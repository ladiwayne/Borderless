function escapeResearchText(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

async function researchJson(url, options) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'The request could not be completed.');
  return data;
}

function formatResearchDate(value) {
  if (!value) return 'Date pending';
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function setResearchMessage(element, message, type = 'error') {
  if (!element) return;
  element.textContent = message;
  element.className = `research-message research-message-${type}`;
}

function activeStatusLabel(status) {
  return ({ researching: 'Researching', review: 'Team review', complete: 'Results ready', cancelled: 'Cancelled' })[status] || status;
}

function renderResearchRequest(request) {
  const canCancel = ['researching', 'review'].includes(request.status);
  return `<article class="research-request-row"><span><strong>${escapeResearchText(request.product)} in ${escapeResearchText(request.market)}</strong><small>${request.type === 'buyers' ? 'Find buyers' : 'Find suppliers'} · ${escapeResearchText(request.id)} · Submitted ${formatResearchDate(request.submittedAt)} · Response by ${formatResearchDate(request.expectedResponseAt)}</small></span><span class="research-request-row-actions"><span class="research-status research-status-${escapeResearchText(request.status)}">${escapeResearchText(activeStatusLabel(request.status))}</span><a class="research-button research-button-secondary" href="research.html?request=${encodeURIComponent(request.id)}">Open request</a>${canCancel ? `<button class="research-button research-remove-button" type="button" data-cancel-account-request="${escapeResearchText(request.id)}">Cancel</button>` : ''}</span></article>`;
}

function bindRequestCancelButtons(container) {
  container.querySelectorAll('[data-cancel-account-request]').forEach((button) => button.addEventListener('click', async () => {
    if (!window.confirm('Cancel this research request?')) return;
    button.disabled = true;
    try {
      await researchJson(`/api/research-requests/${encodeURIComponent(button.dataset.cancelAccountRequest)}/cancel`, { method: 'POST' });
      if (document.querySelector('[data-account-page]')) setupAccountPage();
      else setupResearchRequestList();
    } catch (error) {
      setResearchMessage(document.querySelector('[data-account-auth-message]') || document.querySelector('[data-research-message]'), error.message);
      button.disabled = false;
    }
  }));
}

async function setupResearchRequestForm() {
  const form = document.querySelector('[data-research-form]');
  if (!form) return;
  const authPrompt = document.querySelector('[data-research-auth-required]');
  const history = document.querySelector('[data-research-history]');
  const message = document.querySelector('[data-research-message]');
  try {
    const account = await researchJson('/api/account/me');
    if (!account.authenticated) throw new Error('Sign in to submit and track research requests.');
    form.hidden = false;
    if (authPrompt) authPrompt.hidden = true;
    if (history) history.hidden = false;
  } catch {
    form.hidden = true;
    if (authPrompt) authPrompt.hidden = false;
    if (history) history.hidden = true;
    return;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submitButton = form.querySelector('[type="submit"]');
    submitButton.disabled = true;
    setResearchMessage(message, 'Sending your request to the research team.', 'pending');
    try {
      const data = await researchJson('/api/research-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(new FormData(form).entries())),
      });
      window.location.href = `research.html?request=${encodeURIComponent(data.item.id)}`;
    } catch (error) {
      setResearchMessage(message, error.message);
      submitButton.disabled = false;
    }
  });
}

async function setupResearchRequestList() {
  const list = document.querySelector('[data-my-research-list]');
  if (!list) return;
  try {
    const account = await researchJson('/api/account/me');
    if (!account.authenticated) {
      list.innerHTML = '<p class="research-empty">Sign in to see your request history.</p>';
      return;
    }
    const data = await researchJson('/api/research-requests');
    list.innerHTML = data.items.slice(0, 3).map(renderResearchRequest).join('') || '<p class="research-empty">Your requests will appear here after you submit a search.</p>';
    bindRequestCancelButtons(list);
  } catch (error) {
    list.innerHTML = `<p class="research-empty">${escapeResearchText(error.message)}</p>`;
  }
}

async function toggleSavedCompany(id, button) {
  const wasSaved = button?.getAttribute('aria-pressed') === 'true';
  try {
    const data = await researchJson(`/api/account/saved-companies/${encodeURIComponent(id)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ saved: !wasSaved }),
    });
    if (button) {
      button.textContent = data.saved ? 'Saved' : 'Save company';
      button.setAttribute('aria-pressed', String(data.saved));
    }
    return data.saved;
  } catch (error) {
    setResearchMessage(document.querySelector('[data-research-page-message]') || document.querySelector('[data-company-message]'), error.message);
    return wasSaved;
  }
}

function renderResearchResult(business, requestId) {
  const role = business.role === 'supplier' ? 'Supplier' : 'Buyer';
  const reasons = (business.matchReasons || []).map((reason) => `<span>${escapeResearchText(reason)}</span>`).join('');
  return `<article class="research-result-row">
    <div class="research-result-identity"><span class="research-result-initial">${escapeResearchText(business.name.slice(0, 1))}</span><div><h3>${escapeResearchText(business.name)}</h3><p>${escapeResearchText(role)} · ${escapeResearchText(business.country)}</p><span class="research-verification">${escapeResearchText(business.verificationStatus)} business</span></div></div>
    <div class="research-result-products"><strong>${escapeResearchText((business.categories || []).join(', ') || 'Agricultural trade')}</strong><small>${escapeResearchText((business.markets || []).join(', '))}</small></div>
    <div><span class="research-activity research-activity-${String(business.tradeActivity).toLowerCase()}">${escapeResearchText(business.tradeActivity)} activity</span><small class="research-recent-activity">${escapeResearchText(business.recentActivity)}</small></div>
    <div class="research-result-actions"><a class="research-button research-button-secondary" href="company.html?business=${encodeURIComponent(business.id)}&request=${encodeURIComponent(requestId)}">View company</a><button class="research-button research-save-button" type="button" data-save-company="${escapeResearchText(business.id)}" aria-pressed="${business.isSaved}">${business.isSaved ? 'Saved' : 'Save company'}</button></div>
    <div class="research-result-provenance"><strong>Why matched</strong><span>${reasons}</span><small>${escapeResearchText(business.matchSource || 'Borderless research team')} · Reviewed ${formatResearchDate(business.reviewedAt)}</small></div>
  </article>`;
}

function bindSaveButtons(container) {
  container.querySelectorAll('[data-save-company]').forEach((button) => button.addEventListener('click', () => toggleSavedCompany(button.dataset.saveCompany, button)));
}

async function setupResearchResults() {
  const page = document.querySelector('[data-research-results]');
  if (!page) return;
  const requestId = new URLSearchParams(window.location.search).get('request');
  const heading = document.querySelector('[data-request-heading]');
  const details = document.querySelector('[data-request-details]');
  const status = document.querySelector('[data-request-status]');
  const resultList = document.querySelector('[data-research-results-list]');
  const filters = ['[data-results-search]', '[data-results-type]', '[data-results-country]', '[data-results-activity]'].map((selector) => document.querySelector(selector));
  let request;
  let savedCompanyIds = new Set();
  const renderResults = () => {
    if (!request || request.status !== 'complete') return;
    const [search, type, country, activity] = filters;
    const filtered = request.results.filter((business) => {
      const searchText = [business.name, business.country, ...(business.categories || []), ...(business.markets || [])].join(' ').toLowerCase();
      const businessType = business.role === 'supplier' ? 'supplier' : 'buyer';
      return (!search?.value || searchText.includes(search.value.trim().toLowerCase()))
        && (!type?.value || type.value === 'all' || businessType === type.value)
        && (!country?.value || country.value === 'all' || business.country === country.value)
        && (!activity?.value || activity.value === 'all' || business.tradeActivity.toLowerCase() === activity.value);
    });
    resultList.innerHTML = filtered.map((business) => renderResearchResult({ ...business, isSaved: savedCompanyIds.has(business.id) }, request.id)).join('') || '<p class="research-empty">No companies match these filters.</p>';
    bindSaveButtons(resultList);
  };

  if (!requestId) {
    setResearchMessage(document.querySelector('[data-research-page-message]'), 'Choose a request from your account or start a new search.');
    return;
  }
  try {
    const account = await researchJson('/api/account/me');
    if (!account.authenticated) {
      setResearchMessage(document.querySelector('[data-research-page-message]'), 'Sign in to view this private request and its results.');
      document.querySelector('[data-research-pending]').hidden = true;
      return;
    }
    const data = await researchJson(`/api/research-requests/${encodeURIComponent(requestId)}`);
    request = data.item;
    const statusLabel = activeStatusLabel(request.status);
    heading.textContent = `${request.type === 'buyers' ? 'Buyers' : 'Suppliers'} for ${request.product}`;
    details.textContent = `${request.market}${request.origin ? ` · Origin: ${request.origin}` : ''}${request.hsCode ? ` · HS ${request.hsCode}` : ''} · Request ${request.id}`;
    status.textContent = statusLabel;
    status.className = `research-status research-status-${request.status}`;
    const responseTarget = document.querySelector('[data-request-response-target]');
    if (responseTarget) responseTarget.textContent = `Expected response by ${formatResearchDate(request.expectedResponseAt)}. Our team targets two business days.`;

    document.querySelectorAll('[data-research-step]').forEach((step, index) => {
      step.classList.toggle('is-complete', request.status === 'complete' ? index < 3 : index === 0);
      step.classList.toggle('is-current', ['researching', 'review'].includes(request.status) && index === 1);
    });

    const controls = document.querySelector('[data-request-controls]');
    const editForm = document.querySelector('[data-request-edit]');
    if (['researching', 'review'].includes(request.status)) {
      controls.hidden = false;
      const editButton = document.querySelector('[data-toggle-request-edit]');
      editButton.hidden = request.status !== 'researching';
      editButton.addEventListener('click', () => {
        editForm.hidden = !editForm.hidden;
        editForm.elements.type.value = request.type;
        editForm.elements.product.value = request.product;
        editForm.elements.market.value = request.market;
        editForm.elements.origin.value = request.origin || '';
        editForm.elements.hsCode.value = request.hsCode || '';
      });
      editForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        try {
          await researchJson(`/api/research-requests/${encodeURIComponent(request.id)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(Object.fromEntries(new FormData(editForm).entries())),
          });
          window.location.reload();
        } catch (error) { setResearchMessage(document.querySelector('[data-research-page-message]'), error.message); }
      });
      document.querySelector('[data-cancel-request]').addEventListener('click', async (event) => {
        if (!window.confirm('Cancel this research request?')) return;
        event.currentTarget.disabled = true;
        try {
          await researchJson(`/api/research-requests/${encodeURIComponent(request.id)}/cancel`, { method: 'POST' });
          window.location.reload();
        } catch (error) {
          setResearchMessage(document.querySelector('[data-research-page-message]'), error.message);
          event.currentTarget.disabled = false;
        }
      });
    } else if (request.status === 'cancelled') {
      document.querySelector('[data-research-pending] .phase-kicker').textContent = 'Request cancelled';
      document.querySelector('[data-research-pending] h2').textContent = 'This request was cancelled.';
      document.querySelector('[data-research-pending] > p:not(.phase-kicker)').textContent = 'No further research will be completed for this request.';
      document.querySelectorAll('[data-research-step]').forEach((step) => {
        step.classList.remove('is-current');
      });
      controls.hidden = true;
    }

    if (request.status === 'complete') {
      document.querySelector('[data-research-pending]').hidden = true;
      document.querySelector('[data-research-results-content]').hidden = false;
      const countryFilter = document.querySelector('[data-results-country]');
      const countries = [...new Set(request.results.map((business) => business.country))].sort();
      countryFilter.innerHTML = '<option value="all">All countries</option>' + countries.map((item) => `<option value="${escapeResearchText(item)}">${escapeResearchText(item)}</option>`).join('');
      filters.forEach((control) => {
        control.addEventListener('input', renderResults);
        control.addEventListener('change', renderResults);
      });
      const account = await researchJson('/api/account/overview');
      savedCompanyIds = new Set(account.savedCompanies.map((business) => business.id));
      renderResults();
    } else {
      document.querySelector('[data-research-results-content]').hidden = true;
      document.querySelector('[data-research-pending]').hidden = false;
    }
  } catch (error) {
    setResearchMessage(document.querySelector('[data-research-page-message]'), error.message);
  }
}

async function setupCompanyProfile() {
  const page = document.querySelector('[data-company-profile]');
  if (!page) return;
  const params = new URLSearchParams(window.location.search);
  const businessId = params.get('business');
  const message = document.querySelector('[data-company-message]');
  if (!businessId) {
    setResearchMessage(message, 'Select a company from the directory or research results.');
    return;
  }
  try {
    const data = await researchJson(`/api/businesses/${encodeURIComponent(businessId)}`);
    const business = data.item;
    document.querySelector('[data-company-name]').textContent = business.name;
    document.querySelector('[data-company-role-country]').textContent = `${business.role === 'supplier' ? 'Supplier' : 'Buyer'} · ${business.country}`;
    document.querySelector('[data-company-description]').textContent = business.description || 'Business details have not been added yet.';
    document.querySelector('[data-company-status]').textContent = business.verificationStatus;
    document.querySelector('[data-company-markets]').textContent = business.markets.join(', ') || 'Not listed';
    document.querySelector('[data-company-categories]').textContent = business.categories.join(', ') || 'Not listed';
    document.querySelector('[data-company-certifications]').textContent = business.certifications.join(', ') || 'Not listed';
    document.querySelector('[data-company-established]').textContent = business.yearEstablished || 'Not listed';
    document.querySelector('[data-company-products]').innerHTML = (business.products || []).map((product) => `<article class="company-product-row"><strong>${escapeResearchText(product.name)}</strong><span>${escapeResearchText(product.grade)}</span><span>${escapeResearchText(product.country)}</span></article>`).join('') || '<p class="research-empty">No public product listings are available.</p>';

    const account = await researchJson('/api/account/overview');
    if (!account.authenticated) {
      document.querySelector('[data-company-save]').disabled = true;
      document.querySelector('[data-company-contact-open]').disabled = true;
      setResearchMessage(message, 'Sign in to save this company or request an introduction.');
      return;
    }
    const saved = account.savedCompanies.some((company) => company.id === business.id);
    const saveButton = document.querySelector('[data-company-save]');
    saveButton.disabled = false;
    saveButton.textContent = saved ? 'Saved' : 'Save company';
    saveButton.setAttribute('aria-pressed', String(saved));
    saveButton.addEventListener('click', () => toggleSavedCompany(business.id, saveButton));

    const eligibleRequests = account.requests.filter((request) => request.status === 'complete' && request.results.some((company) => company.id === business.id));
    const introPanel = document.querySelector('[data-company-intro-panel]');
    const introForm = document.querySelector('[data-company-intro-form]');
    const contactButton = document.querySelector('[data-company-contact-open]');
    const requestSelect = document.querySelector('[data-intro-request]');
    requestSelect.innerHTML = eligibleRequests.map((request) => `<option value="${escapeResearchText(request.id)}">${escapeResearchText(request.product)} in ${escapeResearchText(request.market)} (${escapeResearchText(request.id)})</option>`).join('');
    if (params.get('request') && eligibleRequests.some((request) => request.id === params.get('request'))) requestSelect.value = params.get('request');
    contactButton.disabled = !eligibleRequests.length;
    contactButton.title = eligibleRequests.length ? '' : 'Complete a research request that includes this company first.';
    contactButton.addEventListener('click', () => {
      introPanel.hidden = false;
      introPanel.scrollIntoView({ block: 'nearest' });
    });
    introForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const submitButton = introForm.querySelector('[type="submit"]');
      submitButton.disabled = true;
      try {
        const formData = new FormData(introForm);
        const result = await researchJson(`/api/research-requests/${encodeURIComponent(formData.get('requestId'))}/introductions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ businessId: business.id, message: formData.get('message') }),
        });
        introForm.reset();
        setResearchMessage(message, `Introduction request sent to Borderless for ${result.item.company.name}. Track its status in Account.`, 'pending');
        introPanel.hidden = true;
      } catch (error) {
        setResearchMessage(message, error.message);
      } finally {
        submitButton.disabled = false;
      }
    });
  } catch (error) {
    setResearchMessage(message, error.message);
  }
}

async function setupAccountPage() {
  const page = document.querySelector('[data-account-page]');
  if (!page) return;
  const authPanel = document.querySelector('[data-account-auth]');
  const content = document.querySelector('[data-account-content]');
  const authMessage = document.querySelector('[data-account-auth-message]');
  const loginForm = document.querySelector('[data-account-login]');
  const registerForm = document.querySelector('[data-account-register]');
  const modes = document.querySelectorAll('[data-account-mode]');
  const showMode = (mode) => {
    loginForm.hidden = mode !== 'login';
    registerForm.hidden = mode !== 'register';
    modes.forEach((button) => {
      const active = button.dataset.accountMode === mode;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
    });
  };
  const nextPage = () => {
    const next = new URLSearchParams(window.location.search).get('next');
    window.location.href = ['sourcing-hub.html', 'account.html'].includes(next) ? next : 'account.html';
  };
  modes.forEach((button) => button.addEventListener('click', () => showMode(button.dataset.accountMode)));
  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await researchJson('/api/account/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(new FormData(loginForm).entries())) });
      nextPage();
    } catch (error) { setResearchMessage(authMessage, error.message); }
  });
  registerForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await researchJson('/api/account/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(new FormData(registerForm).entries())) });
      nextPage();
    } catch (error) { setResearchMessage(authMessage, error.message); }
  });

  try {
    const data = await researchJson('/api/account/overview');
    if (!data.authenticated) throw new Error('Sign in to access your saved companies and research history.');
    authPanel.hidden = true;
    content.hidden = false;
    document.querySelector('[data-account-identity]').textContent = `${data.item.name} · ${data.item.email}`;
    document.querySelector('[data-account-requests]').innerHTML = data.requests.map(renderResearchRequest).join('') || '<p class="research-empty">No searches yet. Start with a product and market.</p>';
    document.querySelector('[data-account-saved]').innerHTML = data.savedCompanies.map((business) => `<article class="account-saved-row"><div><strong>${escapeResearchText(business.name)}</strong><small>${escapeResearchText(business.role)} · ${escapeResearchText(business.country)} · ${escapeResearchText(business.categories.join(', '))}</small></div><a class="research-button research-button-secondary" href="company.html?business=${encodeURIComponent(business.id)}">View company</a><button class="research-button research-remove-button" type="button" data-remove-saved="${escapeResearchText(business.id)}">Remove</button></article>`).join('') || '<p class="research-empty">Saved companies will be collected here.</p>';
    document.querySelector('[data-account-introductions]').innerHTML = data.introductions.map((entry) => `<article class="account-introduction-row"><div><strong>${escapeResearchText(entry.company?.name || 'Company')}</strong><small>${escapeResearchText(entry.message)} · ${formatResearchDate(entry.createdAt)}</small></div><span class="research-status research-status-${escapeResearchText(entry.status)}">${escapeResearchText(entry.status)}</span></article>`).join('') || '<p class="research-empty">Introduction requests you send will be tracked here.</p>';
    bindRequestCancelButtons(content);
    content.querySelectorAll('[data-remove-saved]').forEach((button) => button.addEventListener('click', async () => {
      await researchJson(`/api/account/saved-companies/${encodeURIComponent(button.dataset.removeSaved)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ saved: false }) });
      setupAccountPage();
    }));
    document.querySelector('[data-account-logout]').addEventListener('click', async () => {
      await researchJson('/api/account/logout', { method: 'POST' });
      window.location.reload();
    });
  } catch {
    authPanel.hidden = false;
    content.hidden = true;
    showMode('login');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  setupResearchRequestForm();
  setupResearchRequestList();
  setupResearchResults();
  setupCompanyProfile();
  setupAccountPage();
});
