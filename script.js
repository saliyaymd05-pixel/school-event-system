let events = [];
let registrations = [];

document.addEventListener('DOMContentLoaded', () => {
  fetchEvents();
  fetchRegistrations();
});

// 1. Fetch Events from SQLite via Flask API
async function fetchEvents() {
  try {
    const response = await fetch('/api/events');
    events = await response.json();
    renderEvents(events);
  } catch (error) {
    console.error("Error loading events:", error);
  }
}

// 2. Fetch Registrations from SQLite via Flask API
async function fetchRegistrations() {
  try {
    const response = await fetch('/api/registrations');
    registrations = await response.json();
    renderDashboard();
  } catch (error) {
    console.error("Error loading registrations:", error);
  }
}

// Render Event Cards Grid
function renderEvents(items) {
  const grid = document.getElementById('eventsGrid');
  if (!grid) return;
  grid.innerHTML = '';

  if (items.length === 0) {
    grid.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding: 40px; color: var(--text-muted);"><p>No school events found.</p></div>`;
    return;
  }

  items.forEach(item => {
    const card = document.createElement('div');
    card.className = 'event-card';
    card.innerHTML = `
      <div class="card-image-wrap">
        <img src="${item.image}" alt="${item.title}">
        <span class="status-tag">${item.status}</span>
      </div>
      <div class="card-content">
        <span class="card-category">${item.category}</span>
        <h3 class="card-title">${item.title}</h3>
        <div class="card-details">
          <span><i class="fa-solid fa-calendar-day"></i> ${item.date} (${item.time})</span>
          <span><i class="fa-solid fa-location-dot"></i> ${item.venue}</span>
        </div>
        <div class="card-actions">
          <button class="btn btn-primary btn-sm flex-1" onclick="openRegisterModal(${item.id})">Register</button>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });
}

// Real-time Event Filter
function filterEvents() {
  const search = document.getElementById('searchInput').value.toLowerCase();
  const category = document.getElementById('categoryFilter').value;
  const status = document.getElementById('statusFilter').value;

  const filtered = events.filter(e => {
    const matchesSearch = e.title.toLowerCase().includes(search) || e.venue.toLowerCase().includes(search);
    const matchesCat = (category === 'All') || (e.category === category);
    const matchesStatus = (status === 'All') || (e.status === status);
    return matchesSearch && matchesCat && matchesStatus;
  });

  renderEvents(filtered);
}

function resetFilters() {
  document.getElementById('searchInput').value = '';
  document.getElementById('categoryFilter').value = 'All';
  document.getElementById('statusFilter').value = 'All';
  renderEvents(events);
}

// Modals
function openModal(id) { document.getElementById(id).style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }

function openRegisterModal(id) {
  const evt = events.find(e => e.id === id);
  if (!evt) return;
  document.getElementById('regEventId').value = evt.id;
  document.getElementById('regEventTitle').value = evt.title;
  openModal('registerModal');
}

// 3. Save New Event to Database via API
async function handleCreateEvent(e) {
  e.preventDefault();
  const newEvt = {
    title: document.getElementById('evtTitle').value,
    category: document.getElementById('evtCategory').value,
    status: document.getElementById('evtStatus').value,
    date: document.getElementById('evtDate').value,
    time: document.getElementById('evtTime').value,
    venue: document.getElementById('evtVenue').value,
    max_participants: parseInt(document.getElementById('evtMax').value),
    image: document.getElementById('evtImage').value,
    description: document.getElementById('evtDesc').value
  };

  const response = await fetch('/api/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newEvt)
  });

  if (response.ok) {
    fetchEvents();
    closeModal('createEventModal');
    showToast("Event saved successfully in SQLite database!");
    e.target.reset();
  }
}

// 4. Save Registration to Database via API
async function handleRegistrationSubmit(e) {
  e.preventDefault();
  const newReg = {
    event_id: parseInt(document.getElementById('regEventId').value),
    event_title: document.getElementById('regEventTitle').value,
    participant_name: document.getElementById('regName').value,
    email: document.getElementById('regEmail').value,
    participant_type: document.getElementById('regType').value,
    phone: document.getElementById('regPhone').value
  };

  const response = await fetch('/api/registrations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newReg)
  });

  if (response.ok) {
    fetchRegistrations();
    closeModal('registerModal');
    showToast("Registration saved successfully!");
    e.target.reset();
  }
}

// Render Dashboard Data
function renderDashboard() {
  const regBody = document.getElementById('registrationsTableBody');
  if (regBody) {
    regBody.innerHTML = registrations.map(r => `
      <tr>
        <td><strong>${r.participant_name}</strong></td>
        <td>${r.event_title}</td>
        <td>${r.participant_type}</td>
        <td>${r.email}</td>
        <td>${r.phone}</td>
        <td><span class="badge" style="background:#e3f9e5; color:#1b5e20; padding:4px 8px; border-radius:4px;">${r.check_in_status}</span></td>
      </tr>
    `).join('');
  }
}

function switchDashTab(panelId) {
  document.querySelectorAll('.dash-tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.dash-panel').forEach(p => p.classList.remove('active'));
  event.currentTarget.classList.add('active');
  document.getElementById(panelId).classList.add('active');
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.innerText = msg;
  toast.style.display = 'block';
  setTimeout(() => { toast.style.display = 'none'; }, 3000);
}