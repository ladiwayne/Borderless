const simulationState = { scenarios: [], selectedScenario: null, role: 'buyer', run: null };
const stageNames = ['Discover', 'Verify', 'Match', 'Transact', 'Finance', 'Prepare', 'Move', 'Settle', 'Learn'];
const stageCopy = ['Structure the first signal.', 'Make the counterparty trustworthy.', 'Bring the right businesses together.', 'Turn intent into agreed terms.', 'Connect the transaction to capital.', 'Get the trade ready to move.', 'Coordinate the physical route.', 'Complete the exchange.', 'Make the next trade easier.'];

window.addEventListener('DOMContentLoaded', async () => {
  const app = document.querySelector('[data-simulation-app]');
  if (!app) return;
  document.querySelectorAll('[data-role]').forEach((button) => button.addEventListener('click', () => {
    document.querySelectorAll('[data-role]').forEach((item) => item.classList.remove('active'));
    button.classList.add('active'); simulationState.role = button.dataset.role;
  }));
  document.querySelector('[data-start-simulation]')?.addEventListener('click', startSimulation);
  document.querySelector('[data-reset-simulation]')?.addEventListener('click', resetSimulation);
  document.querySelector('[data-advance-simulation]')?.addEventListener('click', advanceSimulation);
  document.querySelector('[data-simulation-message]')?.addEventListener('submit', sendSimulationMessage);
  try {
    const response = await fetch('/api/simulation/scenarios');
    simulationState.scenarios = (await response.json()).items || [];
    document.querySelector('[data-scenario-list]').innerHTML = simulationState.scenarios.map((scenario, index) => `<button class="simulation-scenario ${index === 0 ? 'selected' : ''}" data-scenario-id="${scenario.id}" type="button"><span>0${index + 1}</span><strong>${scenario.name}</strong><small>${scenario.product} · ${scenario.origin} → ${scenario.destination}</small></button>`).join('');
    simulationState.selectedScenario = simulationState.scenarios[0];
    document.querySelectorAll('[data-scenario-id]').forEach((button) => button.addEventListener('click', () => {
      document.querySelectorAll('[data-scenario-id]').forEach((item) => item.classList.remove('selected'));
      button.classList.add('selected'); simulationState.selectedScenario = simulationState.scenarios.find((item) => item.id === button.dataset.scenarioId);
    }));
  } catch (error) { document.querySelector('[data-scenario-list]').innerHTML = `<div class="phase-empty">${error.message}</div>`; }
});

async function startSimulation() {
  const response = await fetch('/api/simulation/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scenarioId: simulationState.selectedScenario.id, role: simulationState.role }) });
  simulationState.run = (await response.json()).item;
  document.querySelector('[data-simulation-start]').classList.add('hidden');
  document.querySelector('[data-simulation-run]').classList.remove('hidden');
  renderSimulation();
}

async function advanceSimulation() {
  if (!simulationState.run) return;
  const response = await fetch(`/api/simulation/${simulationState.run.id}/action`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'advance' }) });
  simulationState.run = (await response.json()).item;
  renderSimulation();
}

async function sendSimulationMessage(event) {
  event.preventDefault();
  const input = event.currentTarget.querySelector('input');
  if (!input.value.trim() || !simulationState.run) return;
  const response = await fetch(`/api/simulation/${simulationState.run.id}/message`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: input.value }) });
  simulationState.run = (await response.json()).simulation;
  input.value = ''; renderSimulation();
}

function resetSimulation() { simulationState.run = null; document.querySelector('[data-simulation-run]').classList.add('hidden'); document.querySelector('[data-simulation-start]').classList.remove('hidden'); }
function renderSimulation() {
  const run = simulationState.run; const currentIndex = Math.min(run.stageIndex, 8); const currentStage = stageNames[currentIndex];
  setText('[data-simulation-title]', run.scenario.name); setText('[data-simulation-description]', run.scenario.description); setText('[data-simulation-role]', `${run.role === 'buyer' ? 'Buyer' : 'Exporter'} mode`); setText('[data-simulation-progress]', `${run.progress}%`); document.querySelector('[data-simulation-progress-bar]').style.width = `${run.progress}%`; setText('[data-current-stage-number]', String(currentIndex + 1).padStart(2, '0')); setText('[data-current-stage]', run.status === 'complete' ? 'Trade complete' : currentStage); setText('[data-current-stage-copy]', run.status === 'complete' ? 'The transaction is now part of trade history.' : stageCopy[currentIndex]); setText('[data-action-phase]', currentIndex < 3 ? `PHASE ${currentIndex === 0 ? '0' : 'I'} · ${currentIndex === 0 ? 'MANUAL VALIDATION' : 'MARKET ACCESS + TRUST'}` : 'PHASE II+ · SIMULATED ROADMAP'); setText('[data-action-title]', run.status === 'complete' ? 'Replay the journey' : actionTitle(currentStage)); setText('[data-action-detail]', run.status === 'complete' ? 'Reset and choose another route through the trade lab.' : actionDetail(currentStage)); setText('[data-context-product]', run.scenario.product); setText('[data-context-quantity]', run.scenario.quantity); setText('[data-context-route]', `${run.scenario.origin} → ${run.scenario.destination}`); setText('[data-trust-score]', run.trust); document.querySelector('[data-trust-ring]').style.setProperty('--score', `${run.trust * 3.6}deg`); setText('[data-event-count]', `${run.events.length} events`); document.querySelector('[data-advance-simulation]').disabled = run.status === 'complete'; document.querySelector('[data-advance-simulation]').innerHTML = run.status === 'complete' ? 'Simulation complete' : `Complete ${currentStage.toLowerCase()} <span>→</span>`;
  document.querySelector('[data-stage-track]').innerHTML = stageNames.map((name, index) => `<div class="simulation-stage ${index < run.stageIndex ? 'done' : ''} ${index === currentIndex && run.status !== 'complete' ? 'current' : ''}"><span>${String(index + 1).padStart(2, '0')}</span><strong>${name}</strong></div>`).join('');
  document.querySelector('[data-simulation-events]').innerHTML = run.events.slice().reverse().map((event) => `<div class="simulation-event"><i></i><div><strong>${event.title}</strong><p>${event.detail}</p><small>${event.actor} · ${event.time}</small></div></div>`).join('');
  document.querySelector('[data-simulation-record]').innerHTML = `<div><span>Quote</span><strong>${run.quote?.amount || 'Not created'}</strong></div><div><span>Documents</span><strong>${run.documents.length} attached</strong></div><div><span>Milestones</span><strong>${run.milestones.length ? `${run.milestones.filter((item) => item.status === 'complete').length}/${run.milestones.length} complete` : 'Not started'}</strong></div>`;
  document.querySelector('[data-simulation-messages]').innerHTML = run.messages.length ? run.messages.map((message) => `<div><strong>${message.actor}</strong><p>${message.text}</p><small>${message.time}</small></div>`).join('') : '<span>No messages yet.</span>';
}
function actionTitle(stage) { return { Discover: 'Capture the requirement', Verify: 'Review business trust', Match: 'Confirm the counterparty', Transact: 'Accept the simulated quote', Finance: 'Attach a finance pathway', Prepare: 'Prepare trade documents', Move: 'Coordinate the route', Settle: 'Record delivery and payment', Learn: 'Update trade history' }[stage]; }
function actionDetail(stage) { return { Discover: 'Turn the need or available product into a clear trade brief.', Verify: 'Review identity, certifications, and company information.', Match: 'Connect the buyer and exporter around a qualified opportunity.', Transact: 'Agree on quantity, price, specifications, and delivery terms.', Finance: 'See how capital could attach to a verified transaction.', Prepare: 'Add the documents and compliance requirements needed to move.', Move: 'Follow the simulated route from origin to destination.', Settle: 'Record the completed exchange between both parties.', Learn: 'Capture performance and make the next transaction easier.' }[stage]; }
function setText(selector, value) { const element = document.querySelector(selector); if (element) element.textContent = value; }
