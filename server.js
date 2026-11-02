const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5500;
const DATA_DIRECTORY = process.env.BORDERLESS_DATA_DIR || path.join(path.dirname(__dirname), '.borderless-data');
const DATA_FILE = path.join(DATA_DIRECTORY, 'borderless-data.json');
const SESSION_COOKIE = 'borderless_session';
const SESSION_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const sessions = new Map();
const REACTION_STAT_MAP = {
  like: 'likes',
  comment: 'comments',
  share: 'shares',
  save: 'saves',
  bookmark: 'bookmarks',
};

const commodityImages = {
  avocado: '/assets/avocado.jpg',
  sesame: '/assets/sesame.jpg',
  cashew: '/assets/cashew.jpg',
  rice: '/assets/rice.jpg',
  cocoa: '/assets/cocoa.jpg',
  maize: '/assets/maize.jpg',
  coffee: '/assets/coffee.jpg',
  pineapple: '/assets/pineapple.jpg',
  pulses: '/assets/pulses.jpg',
};

app.use(express.json({ limit: '6mb' }));
app.use(express.static(path.join(__dirname)));

const marketplaceProducts = [
  { id: 'p1', name: 'Hass Avocado', exporter: 'Danson Tanzania', grade: 'Grade A', country: 'Tanzania', region: 'east-africa', price: 1250, image: commodityImages.avocado, order: 1 },
  { id: 'p2', name: 'White Sesame', exporter: 'Northstar Exporters', grade: '99.5% purity', country: 'Nigeria', region: 'west-africa', price: 740, image: commodityImages.sesame, order: 2 },
  { id: 'p3', name: 'Raw Cashew', exporter: 'Benin Agro Alliance', grade: 'W240', country: 'Benin', region: 'west-africa', price: 980, image: commodityImages.cashew, order: 3 },
  { id: 'p4', name: 'Long Grain Rice', exporter: 'Lazio Grain Co', grade: 'Export ready', country: 'Italy', region: 'mediterranean', price: 640, image: commodityImages.rice, order: 4 },
  { id: 'p5', name: 'Fermented Cocoa', exporter: 'Kampala Cacao', grade: 'Premium beans', country: 'Uganda', region: 'east-africa', price: 1450, image: commodityImages.cocoa, order: 5 },
  { id: 'p6', name: 'Yellow Maize', exporter: 'Rift Valley Produce', grade: 'Feed grade', country: 'Kenya', region: 'east-africa', price: 560, image: commodityImages.maize, order: 6 }
];

const rfqs = [
  { id: 'r1', role: 'buyer', status: 'urgent', qty: 40, order: 1, title: 'White sesame seed, 40 MT, FOB Lagos', description: 'Need inspection certificate, moisture profile, and two shipment slots in August.', locationLabel: 'Destination: UAE', daysLabel: 'Urgent · 2 days left' },
  { id: 'r2', role: 'exporter', status: 'open', qty: 15, order: 2, title: 'Looking for reefer logistics partner for avocado', description: 'Weekly cold-chain movement to Rotterdam, 15 MT average load.', locationLabel: 'Origin: Tanzania', daysLabel: 'Open · 5 days left' },
  { id: 'r3', role: 'buyer', status: 'open', qty: 25, order: 3, title: 'Raw cashew kernel W240, 25 MT CIF Jeddah', description: 'Buyer requests lab test, broken ratio details, and sample timeline before final quote.', locationLabel: 'Destination: Saudi Arabia', daysLabel: 'Open · 4 days left' },
  { id: 'r4', role: 'buyer', status: 'urgent', qty: 60, order: 4, title: 'Yellow maize feed grade, 60 MT, CFR Mombasa', description: 'Immediate supplier confirmation required with SGS report and packing details.', locationLabel: 'Destination: Kenya', daysLabel: 'Urgent · 24h left' }
];

const feedPosts = [
  {
    id: 'f1',
    type: 'product',
    name: 'Danson Tanzania Limited',
    content: 'Uploaded 3 new products. Export slot available for week 33 dispatch.',
    image: commodityImages.avocado,
    productName: 'Hass Avocado',
    productOrigin: 'Tanzania',
    productPrice: 'Grade A',
    createdAt: Date.now() - 120000,
    stats: { likes: 18, comments: 5, shares: 2, saves: 7 },
  },
  {
    id: 'f2',
    type: 'rfq',
    name: 'FreshHarvest Buyer Group',
    content: 'Seeking 60 MT yellow maize with SGS and CFR Mombasa terms. Prefer delivery in 10 days.',
    image: commodityImages.maize,
    rfqCommodity: 'Yellow Maize',
    rfqQuantity: '60 MT',
    rfqDeadline: '10 days',
    createdAt: Date.now() - 1560000,
    stats: { likes: 12, comments: 4, shares: 3, saves: 4, bookmarks: 1 },
  },
  {
    id: 'f3',
    type: 'update',
    name: 'Northstar Exporters',
    content: 'Sesame stock replenished. We can lock FOB rates for buyers confirming before Friday.',
    image: commodityImages.sesame,
    createdAt: Date.now() - 2700000,
    stats: { likes: 9, comments: 2, shares: 1, saves: 2, bookmarks: 0 },
  },
  { id: 'f4', type: 'product', name: 'Kigali Fresh Routes', content: 'New washed arabica coffee lots are ready for buyers seeking traceable East African origin.', image: commodityImages.coffee, productName: 'Washed Arabica Coffee', productOrigin: 'Rwanda', productPrice: 'Specialty grade', createdAt: Date.now() - 3600000, stats: { likes: 16, comments: 3, shares: 4, saves: 6, bookmarks: 1 } },
  { id: 'f5', type: 'rfq', name: 'Dubai FoodLink Imports', content: 'Looking for 30 MT of Hass avocado with cold-chain compliance for weekly Dubai arrivals.', image: commodityImages.avocado, rfqCommodity: 'Hass Avocado', rfqQuantity: '30 MT', rfqDeadline: '5 days', createdAt: Date.now() - 4800000, stats: { likes: 11, comments: 4, shares: 2, saves: 5, bookmarks: 1 } },
  { id: 'f6', type: 'product', name: 'Abidjan Cacao Cooperative', content: 'Traceable fermented cocoa beans from this season are now available for long-term offtake conversations.', image: commodityImages.cocoa, productName: 'Fermented Cocoa', productOrigin: 'Cote d’Ivoire', productPrice: 'Traceable lots', createdAt: Date.now() - 6200000, stats: { likes: 22, comments: 6, shares: 5, saves: 9, bookmarks: 2 } },
  { id: 'f7', type: 'update', name: 'Maputo Grain House', content: 'Our Southern Africa maize program has opened two new delivery windows for September.', image: commodityImages.maize, createdAt: Date.now() - 7600000, stats: { likes: 8, comments: 2, shares: 2, saves: 3, bookmarks: 0 } },
  { id: 'f8', type: 'product', name: 'Nairobi Tea & Produce', content: 'Farm-verified macadamia kernels and export-grade avocado are available from our Kenya network.', image: commodityImages.cashew, productName: 'Macadamia Kernels', productOrigin: 'Kenya', productPrice: 'Export grade', createdAt: Date.now() - 9000000, stats: { likes: 14, comments: 4, shares: 3, saves: 6, bookmarks: 1 } },
  { id: 'f9', type: 'rfq', name: 'Jeddah Meridian Foods', content: 'Seeking 25 MT of cleaned sesame with certificate of analysis and reliable CIF Jeddah terms.', image: commodityImages.sesame, rfqCommodity: 'Cleaned Sesame', rfqQuantity: '25 MT', rfqDeadline: '4 days', createdAt: Date.now() - 10400000, stats: { likes: 13, comments: 5, shares: 3, saves: 5, bookmarks: 2 } },
  { id: 'f10', type: 'update', name: 'Addis Pulse Exporters', content: 'New Ethiopia origin pulse lots have completed quality review and are ready for buyer sampling.', image: commodityImages.pulses, createdAt: Date.now() - 12000000, stats: { likes: 10, comments: 1, shares: 3, saves: 4, bookmarks: 0 } },
  { id: 'f11', type: 'product', name: 'Dakar Cashew Works', content: 'W240 cashew kernels, vacuum packed and ready for inspection scheduling.', image: commodityImages.cashew, productName: 'Cashew Kernel W240', productOrigin: 'Senegal', productPrice: 'W240', createdAt: Date.now() - 13700000, stats: { likes: 18, comments: 3, shares: 4, saves: 8, bookmarks: 2 } },
  { id: 'f12', type: 'rfq', name: 'Rotterdam Fresh Exchange', content: 'Looking for a consistent 15 MT weekly pineapple program from West Africa into Rotterdam.', image: commodityImages.pineapple, rfqCommodity: 'Pineapple', rfqQuantity: '15 MT weekly', rfqDeadline: '7 days', createdAt: Date.now() - 15600000, stats: { likes: 15, comments: 4, shares: 2, saves: 7, bookmarks: 1 } },
];

const businesses = [
  {
    id: 'b1', name: 'Danson Tanzania Limited', role: 'supplier', country: 'Tanzania',
    markets: ['Netherlands', 'Kenya', 'UAE'], categories: ['Avocado', 'Fresh produce'],
    verificationStatus: 'verified', yearEstablished: '2014', certifications: ['Global GAP', 'Phytosanitary ready'],
    description: 'Export-focused grower and packhouse supplying consistent Grade A Hass avocado.',
    productsListed: 8, rfqsCreated: 2, opportunities: 6,
  },
  {
    id: 'b2', name: 'FreshHarvest Buyer Group', role: 'buyer', country: 'United Arab Emirates',
    markets: ['UAE', 'Saudi Arabia', 'Kenya'], categories: ['Grains', 'Oilseeds'],
    verificationStatus: 'pending', yearEstablished: '2019', certifications: ['Importer licence'],
    description: 'Regional food importer sourcing reliable agricultural supply for distribution partners.',
    productsListed: 0, rfqsCreated: 7, opportunities: 3,
  },
  {
    id: 'b3', name: 'Northstar Exporters', role: 'supplier', country: 'Nigeria',
    markets: ['UAE', 'India', 'Turkey'], categories: ['Sesame', 'Cashew'],
    verificationStatus: 'verified', yearEstablished: '2011', certifications: ['SON certified'],
    description: 'Specialist exporter of cleaned sesame and responsibly sourced cashew from West Africa.',
    productsListed: 12, rfqsCreated: 1, opportunities: 9,
  },
  { id: 'b4', name: 'Kigali Fresh Routes', role: 'supplier', country: 'Rwanda', markets: ['Kenya', 'Uganda', 'UAE'], categories: ['Coffee', 'Horticulture'], verificationStatus: 'verified', yearEstablished: '2016', certifications: ['Rwanda FDA'], description: 'Specialist exporter connecting East African growers with buyers seeking consistent supply.', productsListed: 7, rfqsCreated: 2, opportunities: 4 },
  { id: 'b5', name: 'Abidjan Cacao Cooperative', role: 'supplier', country: 'Cote d’Ivoire', markets: ['France', 'Netherlands', 'Ghana'], categories: ['Cocoa', 'Cocoa products'], verificationStatus: 'verified', yearEstablished: '2008', certifications: ['Rainforest Alliance'], description: 'Cooperative network supplying traceable fermented cocoa beans.', productsListed: 9, rfqsCreated: 3, opportunities: 5 },
  { id: 'b6', name: 'Lagos Agro Commodities', role: 'supplier', country: 'Nigeria', markets: ['Egypt', 'India', 'UAE'], categories: ['Ginger', 'Hibiscus', 'Sesame'], verificationStatus: 'pending', yearEstablished: '2020', certifications: ['Export permit submitted'], description: 'Agri-commodity exporter with consolidated supply from Northern Nigeria.', productsListed: 5, rfqsCreated: 1, opportunities: 2 },
  { id: 'b7', name: 'Maputo Grain House', role: 'supplier', country: 'Mozambique', markets: ['Malawi', 'Zimbabwe', 'Tanzania'], categories: ['Maize', 'Pulses'], verificationStatus: 'verified', yearEstablished: '2013', certifications: ['SENASA equivalent'], description: 'Regional grain supplier serving Southern African food and feed buyers.', productsListed: 6, rfqsCreated: 2, opportunities: 4 },
  { id: 'b8', name: 'Nairobi Tea & Produce', role: 'supplier', country: 'Kenya', markets: ['Egypt', 'United Kingdom', 'UAE'], categories: ['Tea', 'Avocado', 'Macadamia'], verificationStatus: 'verified', yearEstablished: '2010', certifications: ['Global GAP'], description: 'Kenyan producer and exporter with farm-level traceability.', productsListed: 11, rfqsCreated: 1, opportunities: 7 },
  { id: 'b9', name: 'Accra Harvest Link', role: 'supplier', country: 'Ghana', markets: ['Nigeria', 'Togo', 'Netherlands'], categories: ['Pineapple', 'Cocoa', 'Plantain'], verificationStatus: 'pending', yearEstablished: '2021', certifications: ['Documents under review'], description: 'Fresh produce aggregator sourcing from smallholder farms in Ghana.', productsListed: 4, rfqsCreated: 1, opportunities: 2 },
  { id: 'b10', name: 'Addis Pulse Exporters', role: 'supplier', country: 'Ethiopia', markets: ['Saudi Arabia', 'UAE', 'Italy'], categories: ['Coffee', 'Sesame', 'Pulses'], verificationStatus: 'verified', yearEstablished: '2007', certifications: ['ECX registered'], description: 'Export partner for specialty coffee and Ethiopian pulses.', productsListed: 10, rfqsCreated: 2, opportunities: 6 },
  { id: 'b11', name: 'Dakar Cashew Works', role: 'supplier', country: 'Senegal', markets: ['India', 'Vietnam', 'Turkey'], categories: ['Cashew', 'Peanuts'], verificationStatus: 'verified', yearEstablished: '2015', certifications: ['HACCP'], description: 'West African processor and exporter of graded nuts and kernels.', productsListed: 8, rfqsCreated: 2, opportunities: 4 },
  { id: 'b12', name: 'Lusaka Farm Gate', role: 'supplier', country: 'Zambia', markets: ['DRC', 'Tanzania', 'South Africa'], categories: ['Soybean', 'Maize', 'Wheat'], verificationStatus: 'pending', yearEstablished: '2018', certifications: ['Registration submitted'], description: 'Commercial farm network supplying staple crops across Southern Africa.', productsListed: 5, rfqsCreated: 1, opportunities: 2 },
  { id: 'b13', name: 'Dubai FoodLink Imports', role: 'buyer', country: 'United Arab Emirates', markets: ['East Africa', 'West Africa', 'India'], categories: ['Fresh produce', 'Grains'], verificationStatus: 'verified', yearEstablished: '2012', certifications: ['Importer licence', 'ISO 22000'], description: 'Food distribution group sourcing dependable agricultural supply for the Gulf.', productsListed: 0, rfqsCreated: 8, opportunities: 6 },
  { id: 'b14', name: 'Jeddah Meridian Foods', role: 'buyer', country: 'Saudi Arabia', markets: ['Sudan', 'Ethiopia', 'Nigeria'], categories: ['Sesame', 'Pulses', 'Nuts'], verificationStatus: 'verified', yearEstablished: '2006', certifications: ['SFDA registered'], description: 'Saudi food manufacturer and importer seeking reliable commodity partners.', productsListed: 0, rfqsCreated: 6, opportunities: 5 },
  { id: 'b15', name: 'Rotterdam Fresh Exchange', role: 'buyer', country: 'Netherlands', markets: ['Kenya', 'Tanzania', 'Ghana'], categories: ['Avocado', 'Pineapple', 'Mango'], verificationStatus: 'verified', yearEstablished: '2015', certifications: ['BRCGS'], description: 'European produce buyer coordinating weekly supply into Rotterdam.', productsListed: 0, rfqsCreated: 7, opportunities: 8 },
  { id: 'b16', name: 'Cairo Grain Procurement', role: 'buyer', country: 'Egypt', markets: ['Sudan', 'Ethiopia', 'Kenya'], categories: ['Maize', 'Wheat', 'Sesame'], verificationStatus: 'pending', yearEstablished: '2017', certifications: ['Importer review'], description: 'Industrial food buyer seeking predictable grain and oilseed supply.', productsListed: 0, rfqsCreated: 5, opportunities: 3 },
  { id: 'b17', name: 'Mumbai Origin Foods', role: 'buyer', country: 'India', markets: ['Nigeria', 'Senegal', 'Tanzania'], categories: ['Cashew', 'Sesame', 'Cocoa'], verificationStatus: 'verified', yearEstablished: '2009', certifications: ['FSSAI registered'], description: 'Ingredient buyer sourcing African commodities for food manufacturing.', productsListed: 0, rfqsCreated: 9, opportunities: 7 },
  { id: 'b18', name: 'Nairobi Retail Supply Co', role: 'buyer', country: 'Kenya', markets: ['Uganda', 'Tanzania', 'Zambia'], categories: ['Rice', 'Pulses', 'Fresh produce'], verificationStatus: 'verified', yearEstablished: '2018', certifications: ['KEBS registered'], description: 'Retail and hospitality supplier buying across East African corridors.', productsListed: 0, rfqsCreated: 4, opportunities: 3 },
  { id: 'b19', name: 'Lome Food Processors', role: 'buyer', country: 'Togo', markets: ['Ghana', 'Benin', 'Nigeria'], categories: ['Maize', 'Cassava', 'Soybean'], verificationStatus: 'pending', yearEstablished: '2022', certifications: ['Documents under review'], description: 'Regional processor looking for dependable raw agricultural inputs.', productsListed: 0, rfqsCreated: 3, opportunities: 2 },
  { id: 'b20', name: 'Paris Cacao & Coffee House', role: 'buyer', country: 'France', markets: ['Cote d’Ivoire', 'Ghana', 'Ethiopia'], categories: ['Cocoa', 'Coffee'], verificationStatus: 'verified', yearEstablished: '2005', certifications: ['Rainforest Alliance buyer'], description: 'Specialty ingredient buyer with long-term African sourcing programs.', productsListed: 0, rfqsCreated: 6, opportunities: 5 },
  { id: 'b21', name: 'Mombasa Milling Partners', role: 'buyer', country: 'Kenya', markets: ['Tanzania', 'Uganda', 'Zambia'], categories: ['Maize', 'Wheat', 'Rice'], verificationStatus: 'verified', yearEstablished: '2014', certifications: ['KEBS registered'], description: 'Millers and food manufacturers sourcing staple grains for East African markets.', productsListed: 0, rfqsCreated: 5, opportunities: 4 },
];

const opportunities = [
  {
    id: 'o1', title: 'Yellow maize feed grade, 60 MT', rfqId: 'r4', buyerId: 'b2', supplierId: 'b1', productId: 'p6',
    status: 'matched', priority: 'high', nextAction: 'Verify supplier documents', value: 'USD 33,600', updatedAt: 'Today, 09:42',
    messages: [{ id: 'm1', from: 'FreshHarvest Buyer Group', text: 'Please confirm SGS inspection and packing details.', time: 'Today, 09:42' }],
  },
  {
    id: 'o2', title: 'White sesame seed, 40 MT, FOB Lagos', rfqId: 'r1', buyerId: 'b2', supplierId: 'b3', productId: 'p2',
    status: 'rfq', priority: 'medium', nextAction: 'Review supplier response', value: 'USD 29,600', updatedAt: 'Yesterday, 16:18',
    messages: [{ id: 'm2', from: 'Northstar Exporters', text: 'Our inspection certificate and moisture profile are ready to share.', time: 'Yesterday, 16:18' }],
  },
  {
    id: 'o3', title: 'Hass avocado supply for Rotterdam', rfqId: 'r2', buyerId: 'b2', supplierId: 'b1', productId: 'p1',
    status: 'sourcing', priority: 'low', nextAction: 'Borderless sourcing team to identify logistics partner', value: 'To be confirmed', updatedAt: 'Aug 18, 11:05',
    messages: [],
  },
];

const verificationQueue = [
  { id: 'v1', businessId: 'b2', requestedAt: 'Today, 08:14', reason: 'New buyer profile submitted for review' },
];
const researchRequests = [];
const researchIntroductions = [];
const users = [];

function persistData() {
  fs.mkdirSync(DATA_DIRECTORY, { recursive: true });
  const temporaryFile = `${DATA_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(temporaryFile, JSON.stringify({ users, researchRequests, researchIntroductions }, null, 2));
  fs.renameSync(temporaryFile, DATA_FILE);
}

function loadPersistentData() {
  if (!fs.existsSync(DATA_FILE)) return;
  const stored = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  if (Array.isArray(stored.users)) users.push(...stored.users);
  if (Array.isArray(stored.researchRequests)) researchRequests.push(...stored.researchRequests);
  if (Array.isArray(stored.researchIntroductions)) researchIntroductions.push(...stored.researchIntroductions);
}

function createPasswordHash(password, salt = crypto.randomBytes(16).toString('hex')) {
  return { salt, hash: crypto.scryptSync(password, salt, 64).toString('hex') };
}

function findUserFromRequest(req) {
  const cookie = String(req.headers.cookie || '').split(';').map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  const sessionId = cookie?.slice(SESSION_COOKIE.length + 1);
  if (!sessionId) return null;
  const session = sessions.get(sessionId);
  if (!session || session.expiresAt <= Date.now()) {
    sessions.delete(sessionId);
    return null;
  }
  return users.find((user) => user.id === session.userId) || null;
}

function requireUser(req, res) {
  const user = findUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: 'Sign in to access your account and research requests.' });
    return null;
  }
  return user;
}

function requireLocalAdmin(req, res) {
  const remoteAddress = String(req.socket.remoteAddress || req.ip || '').replace(/^::ffff:/, '');
  if (remoteAddress === '127.0.0.1' || remoteAddress === '::1') return true;
  res.status(403).json({ error: 'Operations endpoints are available only from the local machine.' });
  return false;
}

function startUserSession(res, user) {
  const sessionId = crypto.randomBytes(32).toString('hex');
  sessions.set(sessionId, { userId: user.id, expiresAt: Date.now() + SESSION_MAX_AGE });
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${sessionId}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_MAX_AGE / 1000}${secure}`);
}

function clearUserSession(req, res) {
  const cookie = String(req.headers.cookie || '').split(';').map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  if (cookie) sessions.delete(cookie.slice(SESSION_COOKIE.length + 1));
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
}

const simulationScenarios = [
  { id: 'avocado', name: 'The Rotterdam avocado route', product: 'Hass Avocado', quantity: '15 MT', origin: 'Tanzania', destination: 'Netherlands', buyer: 'Rotterdam Fresh Exchange', exporter: 'Danson Tanzania Limited', description: 'A European buyer needs a dependable weekly avocado program from East Africa.' },
  { id: 'sesame', name: 'Sesame into the Gulf', product: 'White Sesame', quantity: '40 MT', origin: 'Nigeria', destination: 'United Arab Emirates', buyer: 'Dubai FoodLink Imports', exporter: 'Northstar Exporters', description: 'A Gulf importer needs verified sesame supply with quality documents before committing.' },
  { id: 'cocoa', name: 'Traceable cocoa for France', product: 'Fermented Cocoa', quantity: '20 MT', origin: 'Cote d’Ivoire', destination: 'France', buyer: 'Paris Cacao & Coffee House', exporter: 'Abidjan Cacao Cooperative', description: 'A specialty buyer is looking for a traceable cocoa partner for a new season.' },
];

const simulationRuns = new Map();
const simulationStages = ['discover', 'verify', 'match', 'transact', 'finance', 'prepare', 'move', 'settle', 'learn'];

loadPersistentData();

function createSimulation(scenarioId, role) {
  const scenario = simulationScenarios.find((item) => item.id === scenarioId) || simulationScenarios[0];
  const id = `sim_${Date.now()}`;
  const run = {
    id, scenarioId: scenario.id, role: role === 'exporter' ? 'exporter' : 'buyer', stageIndex: 0, status: 'active', scenario,
    trust: 22, progress: 8, events: [{ stage: 'discover', title: 'Simulation started', detail: `${scenario.product} requirement opened for ${scenario.quantity}.`, actor: 'Borderless', time: 'Just now' }],
    messages: [], documents: [], milestones: [], quote: null, createdAt: Date.now(),
  };
  simulationRuns.set(id, run);
  return run;
}

app.post('/api/account/register', (req, res) => {
  const name = String(req.body?.name || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 10) {
    return res.status(400).json({ error: 'Enter your name, a valid email, and a password with at least 10 characters.' });
  }
  if (users.some((user) => user.email === email)) return res.status(409).json({ error: 'An account with that email already exists.' });
  const credentials = createPasswordHash(password);
  const user = { id: `u_${crypto.randomUUID()}`, name, email, ...credentials, savedCompanyIds: [], createdAt: new Date().toISOString() };
  users.push(user);
  persistData();
  startUserSession(res, user);
  res.status(201).json({ item: { id: user.id, name: user.name, email: user.email } });
});

app.post('/api/account/login', (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const user = users.find((item) => item.email === email);
  if (!user) return res.status(401).json({ error: 'Email or password is incorrect.' });
  const submittedHash = createPasswordHash(password, user.salt).hash;
  if (!crypto.timingSafeEqual(Buffer.from(submittedHash, 'hex'), Buffer.from(user.hash, 'hex'))) {
    return res.status(401).json({ error: 'Email or password is incorrect.' });
  }
  startUserSession(res, user);
  res.json({ item: { id: user.id, name: user.name, email: user.email } });
});

app.post('/api/account/logout', (req, res) => {
  clearUserSession(req, res);
  res.json({ ok: true });
});

app.get('/api/account/me', (req, res) => {
  const user = findUserFromRequest(req);
  if (!user) return res.json({ authenticated: false, item: null });
  res.json({ authenticated: true, item: { id: user.id, name: user.name, email: user.email } });
});

app.get('/api/account/overview', (req, res) => {
  const user = findUserFromRequest(req);
  if (!user) return res.json({ authenticated: false, item: null, requests: [], savedCompanies: [], introductions: [] });
  const savedCompanies = (user.savedCompanyIds || []).map((id) => businesses.find((business) => business.id === id)).filter(Boolean);
  const introductions = researchIntroductions.filter((entry) => entry.userId === user.id).map((entry) => ({
    ...entry,
    company: businesses.find((business) => business.id === entry.businessId),
  }));
  res.json({
    authenticated: true,
    item: { id: user.id, name: user.name, email: user.email },
    requests: researchRequests.filter((request) => request.userId === user.id).map(getResearchDetails),
    savedCompanies,
    introductions,
  });
});

app.post('/api/account/saved-companies/:businessId', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  const business = businesses.find((item) => item.id === req.params.businessId);
  if (!business) return res.status(404).json({ error: 'Company not found.' });
  const saved = Boolean(req.body?.saved);
  const existing = new Set(user.savedCompanyIds || []);
  if (saved) existing.add(business.id);
  else existing.delete(business.id);
  user.savedCompanyIds = [...existing];
  persistData();
  res.json({ item: business, saved });
});

app.get('/api/marketplace', (_req, res) => {
  res.json({ items: marketplaceProducts });
});

app.get('/api/rfqs', (_req, res) => {
  res.json({ items: rfqs });
});

function addBusinessDays(date, count) {
  const result = new Date(date);
  let remaining = count;
  while (remaining > 0) {
    result.setDate(result.getDate() + 1);
    if (result.getDay() !== 0 && result.getDay() !== 6) remaining -= 1;
  }
  return result.toISOString();
}

function buildMatchReasons(request, business) {
  const searchTerms = request.product.toLowerCase().split(/[^a-z0-9]+/).filter((term) => term.length > 2);
  const category = business.categories.find((item) => searchTerms.some((term) => item.toLowerCase().includes(term) || term.includes(item.toLowerCase())));
  const market = [business.country, ...(business.markets || [])].find((item) => item.toLowerCase().includes(request.market.toLowerCase()) || request.market.toLowerCase().includes(item.toLowerCase()));
  const reasons = [];
  if (category) reasons.push(`Lists ${category}`);
  if (market) reasons.push(`Serves ${market}`);
  if (business.verificationStatus === 'verified') reasons.push('Business is verified');
  return reasons.length ? reasons : ['Selected by a Borderless researcher for manual review'];
}

function getResearchDetails(request) {
  const { internalNotes, userId, ...publicRequest } = request;
  const results = request.resultBusinessIds
    .map((id) => businesses.find((business) => business.id === id))
    .filter(Boolean)
    .map((business) => {
      const review = (request.resultReviews || []).find((item) => item.businessId === business.id);
      return {
        ...business,
        tradeActivity: business.opportunities >= 6 ? 'High' : business.opportunities >= 3 ? 'Medium' : 'Emerging',
        recentActivity: `${business.opportunities} recorded opportunities`,
        matchReasons: review?.reasons || buildMatchReasons(request, business),
        matchSource: review?.source || 'Borderless research team',
        reviewedAt: review?.reviewedAt || request.completedAt,
        products: marketplaceProducts.filter((product) =>
          product.exporter.toLowerCase().includes(business.name.split(' ')[0].toLowerCase())
        ),
      };
    });
  return { ...publicRequest, results };
}

app.get('/api/research-requests', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  res.json({ items: researchRequests.filter((request) => request.userId === user.id).map(getResearchDetails) });
});

app.post('/api/research-requests', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  const payload = req.body || {};
  const type = String(payload.type || 'buyers');
  const product = String(payload.product || '').trim();
  const market = String(payload.market || '').trim();
  if (!['buyers', 'suppliers'].includes(type) || !product || !market) {
    return res.status(400).json({ error: 'Choose a buyer or supplier search and provide a product and market.' });
  }
  const request = {
    id: `BR-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    userId: user.id,
    type,
    product,
    market,
    origin: String(payload.origin || '').trim(),
    hsCode: String(payload.hsCode || '').trim(),
    status: 'researching',
    assignedTo: 'Borderless research team',
    submittedAt: new Date().toISOString(),
    expectedResponseAt: addBusinessDays(new Date(), 2),
    internalNotes: [],
    resultBusinessIds: [],
  };
  researchRequests.unshift(request);
  persistData();
  res.status(201).json({ item: getResearchDetails(request) });
});

app.get('/api/research-requests/:id', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  const request = researchRequests.find((item) => item.id === req.params.id);
  if (!request) return res.status(404).json({ error: 'Research request not found.' });
  if (request.userId !== user.id) return res.status(403).json({ error: 'This request belongs to another account.' });
  res.json({ item: getResearchDetails(request) });
});

app.patch('/api/research-requests/:id', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  const request = researchRequests.find((item) => item.id === req.params.id);
  if (!request) return res.status(404).json({ error: 'Research request not found.' });
  if (request.userId !== user.id) return res.status(403).json({ error: 'This request belongs to another account.' });
  if (request.status !== 'researching') return res.status(409).json({ error: 'Only requests still being researched can be changed.' });
  const payload = req.body || {};
  const type = String(payload.type || request.type);
  const product = String(payload.product || request.product).trim();
  const market = String(payload.market || request.market).trim();
  if (!['buyers', 'suppliers'].includes(type) || !product || !market) return res.status(400).json({ error: 'Choose a buyer or supplier search and provide a product and market.' });
  request.type = type;
  request.product = product;
  request.market = market;
  request.origin = String(payload.origin ?? request.origin).trim();
  request.hsCode = String(payload.hsCode ?? request.hsCode).trim();
  request.updatedAt = new Date().toISOString();
  persistData();
  res.json({ item: getResearchDetails(request) });
});

app.post('/api/research-requests/:id/cancel', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  const request = researchRequests.find((item) => item.id === req.params.id);
  if (!request) return res.status(404).json({ error: 'Research request not found.' });
  if (request.userId !== user.id) return res.status(403).json({ error: 'This request belongs to another account.' });
  if (!['researching', 'review'].includes(request.status)) return res.status(409).json({ error: 'This request can no longer be cancelled.' });
  request.status = 'cancelled';
  request.cancelledAt = new Date().toISOString();
  persistData();
  res.json({ item: getResearchDetails(request) });
});

app.post('/api/research-requests/:id/results', (req, res) => {
  const request = researchRequests.find((item) => item.id === req.params.id);
  const businessIds = Array.isArray(req.body?.businessIds) ? req.body.businessIds : [];
  const expectedRole = request?.type === 'buyers' ? 'buyer' : 'supplier';
  const validIds = [...new Set(businessIds.map(String))].filter((id) =>
    businesses.some((business) => business.id === id && business.role === expectedRole)
  );
  if (!request) return res.status(404).json({ error: 'Research request not found.' });
  if (!validIds.length) return res.status(400).json({ error: `Select at least one ${expectedRole} before publishing results.` });
  const reviewedAt = new Date().toISOString();
  request.resultBusinessIds = validIds;
  request.resultReviews = validIds.map((businessId) => ({
    businessId,
    reviewedAt,
    source: 'Borderless research team',
    reasons: buildMatchReasons(request, businesses.find((business) => business.id === businessId)),
  }));
  request.status = 'complete';
  request.completedAt = reviewedAt;
  persistData();
  res.json({ item: getResearchDetails(request) });
});

app.post('/api/research-requests/:id/introductions', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  const request = researchRequests.find((item) => item.id === req.params.id && item.userId === user.id);
  if (!request) return res.status(404).json({ error: 'Research request not found.' });
  if (request.status !== 'complete') return res.status(409).json({ error: 'Wait until the research results are published before requesting an introduction.' });
  const businessId = String(req.body?.businessId || '');
  const message = String(req.body?.message || '').trim();
  if (!request.resultBusinessIds.includes(businessId)) return res.status(400).json({ error: 'Choose a company from this request’s results.' });
  if (!message) return res.status(400).json({ error: 'Add a short note for the Borderless team.' });
  const existing = researchIntroductions.find((item) => item.requestId === request.id && item.businessId === businessId && item.userId === user.id && item.status !== 'closed');
  if (existing) return res.status(409).json({ error: 'You already have an open introduction request for this company.' });
  const introduction = {
    id: `intro_${crypto.randomUUID().slice(0, 8)}`,
    requestId: request.id,
    businessId,
    userId: user.id,
    message,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  researchIntroductions.unshift(introduction);
  persistData();
  res.status(201).json({ item: { ...introduction, company: businesses.find((business) => business.id === businessId) } });
});

app.patch('/api/admin/research-requests/:id', (req, res) => {
  if (!requireLocalAdmin(req, res)) return;
  const request = researchRequests.find((item) => item.id === req.params.id);
  if (!request) return res.status(404).json({ error: 'Research request not found.' });
  const assignedTo = String(req.body?.assignedTo || request.assignedTo).trim();
  const status = String(req.body?.status || request.status);
  if (!['researching', 'review'].includes(status)) return res.status(400).json({ error: 'Choose a supported research status.' });
  request.assignedTo = assignedTo || 'Borderless research team';
  request.status = status;
  const note = String(req.body?.internalNote || '').trim();
  if (note) request.internalNotes.push({ text: note, author: 'Borderless research team', createdAt: new Date().toISOString() });
  request.updatedAt = new Date().toISOString();
  persistData();
  res.json({ item: getResearchDetails(request) });
});

app.patch('/api/admin/research-introductions/:id', (req, res) => {
  if (!requireLocalAdmin(req, res)) return;
  const introduction = researchIntroductions.find((item) => item.id === req.params.id);
  if (!introduction) return res.status(404).json({ error: 'Introduction request not found.' });
  const status = String(req.body?.status || '');
  if (!['reviewing', 'introduced', 'closed'].includes(status)) return res.status(400).json({ error: 'Choose a supported introduction status.' });
  introduction.status = status;
  introduction.updatedAt = new Date().toISOString();
  persistData();
  res.json({ item: introduction });
});

app.get('/api/feed', (_req, res) => {
  res.json({ items: feedPosts.sort((a, b) => b.createdAt - a.createdAt) });
});

app.post('/api/feed', (req, res) => {
  const payload = req.body || {};
  if (!payload.content || !String(payload.content).trim()) {
    return res.status(400).json({ error: 'Post content is required.' });
  }

  const post = {
    id: `f${Date.now()}`,
    type: payload.type || 'update',
    name: payload.name || 'Member',
    content: String(payload.content),
    image: payload.image || '',
    productName: payload.productName || '',
    productOrigin: payload.productOrigin || '',
    productPrice: payload.productPrice || '',
    rfqCommodity: payload.rfqCommodity || '',
    rfqQuantity: payload.rfqQuantity || '',
    rfqDeadline: payload.rfqDeadline || '',
    createdAt: Date.now(),
    stats: { likes: 0, comments: 0, shares: 0, saves: 0, bookmarks: 0 },
  };

  feedPosts.unshift(post);
  return res.status(201).json({ item: post });
});

app.post('/api/feed/:id/reactions', (req, res) => {
  const postId = req.params.id;
  const action = String(req.body?.action || '').trim();
  const active = Boolean(req.body?.active);
  const statKey = REACTION_STAT_MAP[action];

  if (!statKey) {
    return res.status(400).json({ error: 'Invalid reaction action.' });
  }

  const post = feedPosts.find((item) => item.id === postId);
  if (!post) {
    return res.status(404).json({ error: 'Post not found.' });
  }

  post.stats = {
    likes: Number(post.stats?.likes || 0),
    comments: Number(post.stats?.comments || 0),
    shares: Number(post.stats?.shares || 0),
    saves: Number(post.stats?.saves || 0),
    bookmarks: Number(post.stats?.bookmarks || 0),
  };

  const current = Number(post.stats[statKey] || 0);
  post.stats[statKey] = active ? current + 1 : Math.max(0, current - 1);
  return res.json({ item: post, action, active });
});

app.get('/api/businesses', (req, res) => {
  const query = String(req.query.q || '').trim().toLowerCase();
  const role = String(req.query.role || 'all');
  const status = String(req.query.status || 'all');
  const items = businesses.filter((business) => {
    const matchesQuery = !query || [business.name, business.country, ...business.categories].join(' ').toLowerCase().includes(query);
    const matchesRole = role === 'all' || business.role === role;
    const matchesStatus = status === 'all' || business.verificationStatus === status;
    return matchesQuery && matchesRole && matchesStatus;
  });
  res.json({ items });
});

app.post('/api/businesses', (req, res) => {
  const payload = req.body || {};
  if (!payload.name || !payload.role || !payload.country) return res.status(400).json({ error: 'Business name, role, and country are required.' });
  const business = {
    id: `b${Date.now()}`, name: String(payload.name), role: String(payload.role), country: String(payload.country),
    markets: String(payload.markets || '').split(',').map((item) => item.trim()).filter(Boolean),
    categories: String(payload.categories || '').split(',').map((item) => item.trim()).filter(Boolean),
    verificationStatus: 'pending', yearEstablished: String(payload.yearEstablished || ''), certifications: [],
    description: String(payload.description || ''), productsListed: 0, rfqsCreated: 0, opportunities: 0,
  };
  businesses.unshift(business);
  verificationQueue.unshift({ id: `v${Date.now()}`, businessId: business.id, requestedAt: 'Just now', reason: 'New business submitted for verification' });
  res.status(201).json({ item: business });
});

app.get('/api/businesses/:id', (req, res) => {
  const business = businesses.find((item) => item.id === req.params.id);
  if (!business) return res.status(404).json({ error: 'Business not found.' });
  const products = marketplaceProducts.filter((product) => product.exporter.toLowerCase().includes(business.name.split(' ')[0].toLowerCase()));
  res.json({ item: { ...business, products } });
});

app.post('/api/marketplace', (req, res) => {
  const payload = req.body || {};
  if (!payload.name || !payload.exporter || !payload.country) return res.status(400).json({ error: 'Product name, exporter, and country are required.' });
  const product = { id: `p${Date.now()}`, name: String(payload.name), exporter: String(payload.exporter), grade: String(payload.grade || 'Specification pending'), country: String(payload.country), region: String(payload.region || 'all'), price: Number(payload.price || 0), image: payload.image || commodityImages.pulses, order: marketplaceProducts.length + 1 };
  marketplaceProducts.unshift(product);
  res.status(201).json({ item: product });
});

app.post('/api/rfqs', (req, res) => {
  const payload = req.body || {};
  if (!payload.title || !payload.qty || !payload.destination) return res.status(400).json({ error: 'Requirement, quantity, and destination are required.' });
  const rfq = { id: `r${Date.now()}`, role: 'buyer', status: 'open', qty: Number(payload.qty), order: 0, title: String(payload.title), description: String(payload.description || 'Specifications to be confirmed.'), locationLabel: `Destination: ${payload.destination}`, daysLabel: payload.deadline ? `Open · ${payload.deadline}` : 'Open · 7 days left' };
  rfqs.unshift(rfq);
  res.status(201).json({ item: rfq });
});

app.post('/api/businesses/:id/verification', (req, res) => {
  const business = businesses.find((item) => item.id === req.params.id);
  if (!business) return res.status(404).json({ error: 'Business not found.' });
  business.verificationStatus = 'pending';
  if (!verificationQueue.some((item) => item.businessId === business.id)) {
    verificationQueue.unshift({ id: `v${Date.now()}`, businessId: business.id, requestedAt: 'Just now', reason: 'Verification information submitted' });
  }
  res.json({ item: business, message: 'Verification submitted for review.' });
});

app.get('/api/opportunities', (_req, res) => {
  res.json({ items: opportunities });
});

app.get('/api/opportunities/:id', (req, res) => {
  const opportunity = opportunities.find((item) => item.id === req.params.id);
  if (!opportunity) return res.status(404).json({ error: 'Opportunity not found.' });
  const buyer = businesses.find((business) => business.id === opportunity.buyerId);
  const supplier = businesses.find((business) => business.id === opportunity.supplierId);
  res.json({ item: { ...opportunity, buyer, supplier } });
});

app.post('/api/opportunities/:id/status', (req, res) => {
  const opportunity = opportunities.find((item) => item.id === req.params.id);
  const allowedStatuses = ['new', 'sourcing', 'matched', 'verified', 'introduced', 'rfq', 'negotiation', 'qualified', 'closed'];
  if (!opportunity) return res.status(404).json({ error: 'Opportunity not found.' });
  if (!allowedStatuses.includes(req.body?.status)) return res.status(400).json({ error: 'Invalid opportunity status.' });
  opportunity.status = req.body.status;
  opportunity.updatedAt = 'Just now';
  opportunity.nextAction = req.body.nextAction || 'Review next action';
  res.json({ item: opportunity });
});

app.post('/api/opportunities/:id/messages', (req, res) => {
  const opportunity = opportunities.find((item) => item.id === req.params.id);
  const text = String(req.body?.text || '').trim();
  if (!opportunity) return res.status(404).json({ error: 'Opportunity not found.' });
  if (!text) return res.status(400).json({ error: 'Message text is required.' });
  const message = { id: `m${Date.now()}`, from: 'Borderless sourcing team', text, time: 'Just now' };
  opportunity.messages.push(message);
  opportunity.updatedAt = 'Just now';
  res.status(201).json({ item: message, opportunity });
});

app.get('/api/dashboard', (_req, res) => {
  const verifiedBusinesses = businesses.filter((business) => business.verificationStatus === 'verified').length;
  res.json({
    stats: { verifiedBusinesses, activeBuyers: 1, activeSuppliers: 2, qualifiedOpportunities: 1, openRfqs: rfqs.length, responseRate: '68%' },
    opportunities: opportunities.slice(0, 3),
    latestProducts: marketplaceProducts.slice(0, 3),
    latestRfqs: rfqs.slice(0, 3),
  });
});

app.get('/api/simulation/scenarios', (_req, res) => {
  res.json({ items: simulationScenarios });
});

app.post('/api/simulation/start', (req, res) => {
  res.status(201).json({ item: createSimulation(req.body?.scenarioId, req.body?.role) });
});

app.get('/api/simulation/:id', (req, res) => {
  const run = simulationRuns.get(req.params.id);
  if (!run) return res.status(404).json({ error: 'Simulation not found.' });
  res.json({ item: run, stages: simulationStages });
});

app.post('/api/simulation/:id/action', (req, res) => {
  const run = simulationRuns.get(req.params.id);
  if (!run) return res.status(404).json({ error: 'Simulation not found.' });
  if (run.status === 'complete') return res.status(400).json({ error: 'Simulation is already complete.' });
  const stage = simulationStages[run.stageIndex];
  const action = String(req.body?.action || 'advance');
  const scenario = run.scenario;
  const actions = {
    discover: { title: 'Requirement captured', detail: `${run.role === 'buyer' ? 'Buyer demand' : 'Exporter supply'} is structured and visible to the network.`, trust: 4, progress: 10 },
    verify: { title: 'Businesses verified', detail: `${scenario.buyer} and ${scenario.exporter} passed the simulated trust review.`, trust: 20, progress: 12 },
    match: { title: 'Counterparty matched', detail: `A relevant ${scenario.role === 'buyer' ? 'exporter' : 'buyer'} was found for ${scenario.product}.`, trust: 5, progress: 12 },
    transact: { title: 'Terms agreed', detail: `RFQ, quote, quantity, and delivery terms were aligned for ${scenario.quantity}.`, trust: 4, progress: 14 },
    finance: { title: 'Finance pathway identified', detail: 'A partner finance option is attached to the verified transaction for simulation.', trust: 2, progress: 10 },
    prepare: { title: 'Documents prepared', detail: 'Commercial invoice, origin evidence, and inspection requirements were added.', trust: 2, progress: 12 },
    move: { title: 'Movement coordinated', detail: `A simulated route is ready from ${scenario.origin} to ${scenario.destination}.`, trust: 1, progress: 12 },
    settle: { title: 'Settlement recorded', detail: 'Goods received and payment settled in the simulated transaction.', trust: 3, progress: 10 },
    learn: { title: 'Trade history updated', detail: 'Performance was captured so the next transaction can start with more confidence.', trust: 3, progress: 8 },
  };
  const result = actions[stage];
  run.events.push({ stage, title: result.title, detail: result.detail, actor: run.role === 'buyer' ? scenario.buyer : scenario.exporter, time: 'Just now' });
  run.trust = Math.min(100, run.trust + result.trust);
  run.progress = Math.min(100, run.progress + result.progress);
  if (stage === 'transact') run.quote = { amount: scenario.id === 'avocado' ? 'USD 18,750' : scenario.id === 'sesame' ? 'USD 29,600' : 'USD 24,000', status: 'accepted' };
  if (stage === 'prepare') run.documents.push('Commercial invoice', 'Certificate of origin', 'Inspection requirement');
  if (stage === 'move') run.milestones.push({ label: 'Origin pickup', status: 'complete' }, { label: 'In transit', status: 'active' }, { label: 'Destination delivery', status: 'next' });
  run.stageIndex += 1;
  if (run.stageIndex >= simulationStages.length) run.status = 'complete';
  res.json({ item: run, action });
});

app.post('/api/simulation/:id/message', (req, res) => {
  const run = simulationRuns.get(req.params.id);
  const text = String(req.body?.text || '').trim();
  if (!run) return res.status(404).json({ error: 'Simulation not found.' });
  if (!text) return res.status(400).json({ error: 'Message is required.' });
  const message = { text, actor: run.role === 'buyer' ? run.scenario.buyer : run.scenario.exporter, time: 'Just now' };
  run.messages.push(message);
  run.events.push({ stage: simulationStages[run.stageIndex], title: 'Message sent', detail: text, actor: message.actor, time: 'Just now' });
  res.status(201).json({ item: message, simulation: run });
});

app.get('/api/admin/overview', (_req, res) => {
  if (!requireLocalAdmin(_req, res)) return;
  res.json({
    stats: { businesses: businesses.length, verified: businesses.filter((item) => item.verificationStatus === 'verified').length, pending: verificationQueue.length, opportunities: opportunities.length, rfqs: rfqs.length },
    verificationQueue: verificationQueue.map((entry) => ({ ...entry, business: businesses.find((business) => business.id === entry.businessId) })),
    researchQueue: researchRequests.filter((request) => ['researching', 'review'].includes(request.status)).map((request) => ({ ...request, requester: users.find((user) => user.id === request.userId) ? { name: users.find((user) => user.id === request.userId).name, email: users.find((user) => user.id === request.userId).email } : null })),
    introductionQueue: researchIntroductions.filter((item) => item.status === 'pending' || item.status === 'reviewing').map((item) => ({
      ...item,
      company: businesses.find((business) => business.id === item.businessId),
      requester: users.find((user) => user.id === item.userId) ? { name: users.find((user) => user.id === item.userId).name, email: users.find((user) => user.id === item.userId).email } : null,
    })),
    recentOpportunities: opportunities,
  });
});

app.post('/api/admin/verifications/:id', (req, res) => {
  if (!requireLocalAdmin(req, res)) return;
  const entryIndex = verificationQueue.findIndex((entry) => entry.id === req.params.id);
  if (entryIndex === -1) return res.status(404).json({ error: 'Verification request not found.' });
  const entry = verificationQueue[entryIndex];
  const business = businesses.find((item) => item.id === entry.businessId);
  const decision = req.body?.decision;
  if (!business || !['verified', 'rejected'].includes(decision)) return res.status(400).json({ error: 'Invalid verification decision.' });
  business.verificationStatus = decision;
  verificationQueue.splice(entryIndex, 1);
  res.json({ item: business });
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Borderless server listening on http://localhost:${PORT}`);
});
