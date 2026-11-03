let events = [];
let registrations = [];
let currentEventHead = null;

document.addEventListener('DOMContentLoaded', () => {
  fetchEvents();
  fetchRegistrations();
});

async function fetchEvents() {
  try {
    const res = await fetch('/api/events');
    events = await res.json();
    renderEvents(events);
  } catch (err) {
    console.error("Error loading events:", err);
  }
}

async function fetchRegistrations() {
  try {
    const res = await fetch('/api/registrations');
    registrations = await res.json();
    renderDashboard();
  } catch (err) {
    console.error("Error loading registrations:", err);
  }
}

function renderEvents(items) {
  const grid = document.getElementById('eventsGrid');
  if (!grid) return;
  grid.innerHTML = '';

  if (items.length === 0) {
    grid.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding: 40px; color: var(--text-muted);"><p>No events found.</p></div>`;
    return;
  }

  items.forEach(item => {
    const card = document.createElement('div');
    card.className = 'event-card';
    card.innerHTML = `
      <div class="card-image-wrap">
        <img src="${item.image}" alt="${item.title}" onerror="this.src='https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=800&q=80'">
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

function filterEvents() {
  const search = document.getElementById('searchInput').value.toLowerCase();
  const category = document.getElementById('categoryFilter').value;
  const filtered = events.filter(e => {
    const matchesSearch = e.title.toLowerCase().includes(search) || e.venue.toLowerCase().includes(search);
    const matchesCat = (category === 'All') || (e.category === category);
    return matchesSearch && matchesCat;
  });
  renderEvents(filtered);
}

function filterByCategory(cat) {
  document.getElementById('categoryFilter').value = cat;
  filterEvents();
  document.getElementById('events').scrollIntoView({ behavior: 'smooth' });
}

function resetFilters() {
  document.getElementById('searchInput').value = '';
  document.getElementById('categoryFilter').value = 'All';
  renderEvents(events);
}

function openModal(id) { document.getElementById(id).style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }
function toggleMobileMenu() { document.getElementById('navMenu').classList.toggle('show'); }

function openRegisterModal(id) {
  const evt = events.find(e => e.id === id);
  if (!evt) return;
  document.getElementById('regEventId').value = evt.id;
  document.getElementById('regEventTitle').value = evt.title;
  openModal('registerModal');
}

async function handleHeadLogin(e) {
  e.preventDefault();
  const username = document.getElementById('loginUsername').value;
  const password = document.getElementById('loginPassword').value;

  try {
    const res = await fetch('/api/auth/head-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();

    if (res.ok && data.success) {
      currentEventHead = data.head;
      closeModal('headLoginModal');
      showToast(`Welcome Event Head: ${currentEventHead.username}!`);
      updateEventHeadUI();
    } else {
      showToast(data.message || "Invalid credentials");
    }
  } catch (err) {
    showToast("Login connection error.");
  }
}

function updateEventHeadUI() {
  const assignedEvent = events.find(e => e.id === currentEventHead.assigned_event_id);
  const eventName = assignedEvent ? assignedEvent.title : `Event ID #${currentEventHead.assigned_event_id}`;
  
  document.getElementById('headWelcomeBanner').innerHTML = `
    <i class="fa-solid fa-user-shield"></i> Logged in as Event Head: <strong>${currentEventHead.username}</strong> | 
    Managing Assigned Event: <strong>${eventName}</strong>
    <button class="btn btn-sm btn-outline" style="margin-left:15px;" onclick="headLogout()">Logout</button>
  `;
  document.getElementById('topAuthArea').innerHTML = `<span class="badge badge-accent">Head: ${currentEventHead.username}</span>`;
  document.getElementById('actionHeaderCol').style.display = 'table-cell';
  renderDashboard();
}

function headLogout() {
  currentEventHead = null;
  location.reload();
}

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

  const res = await fetch('/api/registrations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newReg)
  });

  if (res.ok) {
    fetchRegistrations();
    closeModal('registerModal');
    showToast("Registration successful!");
    e.target.reset();
  }
}

async function handleCreateEvent(e) {
  e.preventDefault();
  const newEvt = {
    title: document.getElementById('evtTitle').value,
    category: document.getElementById('evtCategory').value,
    status: document.getElementById('evtStatus').value,
    date: document.getElementById('evtDate').value,
    time: document.getElementById('evtTime').value,
    venue: document.getElementById('evtVenue').value,
    image: document.getElementById('evtImage').value,
    description: document.getElementById('evtDesc').value
  };

  const res = await fetch('/api/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newEvt)
  });

  if (res.ok) {
    fetchEvents();
    closeModal('createEventModal');
    showToast("Event created successfully!");
    e.target.reset();
  }
}

async function updateStudentStatus(regId, status) {
  if (!currentEventHead) return showToast("Unauthorized action.");
  const res = await fetch(`/api/registrations/${regId}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  });
  if (res.ok) {
    fetchRegistrations();
    showToast(`Student marked as ${status}`);
  }
}

async function deleteStudentRegistration(regId) {
  if (!currentEventHead) return showToast("Unauthorized action.");
  if (!confirm("Are you sure you want to delete/remove this student?")) return;

  const res = await fetch(`/api/registrations/${regId}`, { method: 'DELETE' });
  if (res.ok) {
    fetchRegistrations();
    showToast("Student registration deleted.");
  }
}

function renderDashboard() {
  const tbody = document.getElementById('registrationsTableBody');
  if (!tbody) return;

  let displayList = registrations;
  if (currentEventHead) {
    displayList = registrations.filter(r => r.event_id === currentEventHead.assigned_event_id);
    document.getElementById('tableTitleHeading').innerText = `Registered Students for Assigned Event (#${currentEventHead.assigned_event_id})`;
  } else {
    document.getElementById('tableTitleHeading').innerText = "All Student Registrations (Login as Event Head to Manage)";
  }

  if (displayList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:30px; color:var(--text-muted);">No registrations found for this view.</td></tr>`;
    return;
  }

  tbody.innerHTML = displayList.map(r => `
    <tr>
      <td><strong>${r.participant_name}</strong></td>
      <td>${r.event_title}</td>
      <td>${r.participant_type}</td>
      <td>${r.email}</td>
      <td>${r.phone}</td>
      <td><span class="badge ${r.status === 'Approved' ? 'badge-accent' : r.status === 'Disqualified' ? 'badge-orange' : ''}">${r.status}</span></td>
      ${currentEventHead ? `
        <td>
          <button class="btn btn-sm btn-outline" style="color:#1b5e20; border-color:#1b5e20;" onclick="updateStudentStatus(${r.id}, 'Approved')">Approve</button>
          <button class="btn btn-sm btn-outline" style="color:#d97706; border-color:#d97706;" onclick="updateStudentStatus(${r.id}, 'Disqualified')">Disqualify</button>
          <button class="btn btn-sm btn-outline" style="color:#b91c1c; border-color:#b91c1c;" onclick="deleteStudentRegistration(${r.id})"><i class="fa-solid fa-trash"></i> Delete</button>
        </td>
      ` : '<td style="color:#94A3B8; font-size:0.8rem;">Restricted to Event Head</td>'}
    </tr>
  `).join('');
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.innerText = msg;
  toast.style.display = 'block';
  setTimeout(() => { toast.style.display = 'none'; }, 3000);
}
