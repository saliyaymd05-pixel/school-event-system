// EventSchool Global State
let currentUser = null;
let allEvents = [];
let currentDashTab = 'overview';

// Helper for HTML escaping (Prevent XSS)
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Convert Uploaded Image to Base64
function convertImageToBase64(fileInput, targetInputId) {
  const file = fileInput.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) {
    alert("File size exceeds 2 MB limit");
    fileInput.value = "";
    return;
  }
  const reader = new FileReader();
  reader.onload = function(e) {
    document.getElementById(targetInputId).value = e.target.result;
  };
  reader.readAsDataURL(file);
}

// App Initialization
document.addEventListener("DOMContentLoaded", () => {
  checkAuth();
  fetchEvents();
  fetchPhotos();
});

function openModal(id) {
  document.getElementById(id).classList.add('active');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('active');
}

function toggleMobileMenu() {
  document.getElementById('navLinks').classList.toggle('mobile-open');
}

// Auth API Calls
async function checkAuth() {
  try {
    const res = await fetch('/api/auth/me');
    const data = await res.json();
    currentUser = data.user;
    updateAuthUI();
    if (currentUser) {
      fetchNotifications();
    }
  } catch (err) {
    console.error(err);
  }
}

function updateAuthUI() {
  const topbar = document.getElementById('topbarAuth');
  const myRegsSec = document.getElementById('myRegistrationsSection');
  const dashSec = document.getElementById('dashboardSection');
  const addPhotoBtn = document.getElementById('addPhotoBtn');

  if (currentUser) {
    topbar.innerHTML = `
      <span>Welcome, <strong>${escapeHtml(currentUser.name)}</strong> (${escapeHtml(currentUser.role)})</span>
      <a onclick="handleLogout()">Log out</a>
    `;

    if (currentUser.role === 'student') {
      myRegsSec.style.display = 'block';
      dashSec.style.display = 'none';
      addPhotoBtn.style.display = 'none';
      fetchMyRegistrations();
    } else {
      myRegsSec.style.display = 'none';
      dashSec.style.display = 'block';
      addPhotoBtn.style.display = 'inline-block';
      document.getElementById('dashRoleTitle').innerText = currentUser.role === 'admin' ? 'Administrator Dashboard' : 'Event Head Dashboard';
      if (currentUser.role === 'admin') {
        document.getElementById('msgTabBtn').style.display = 'flex';
      }
      loadDashboardTab(currentDashTab);
    }
  } else {
    topbar.innerHTML = `
      <a onclick="openModal('loginModal')">Log in</a>
      <a onclick="openModal('signupModal')">Sign up</a>
    `;
    myRegsSec.style.display = 'none';
    dashSec.style.display = 'none';
    addPhotoBtn.style.display = 'none';
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;

  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();

  if (res.ok) {
    currentUser = data.user;
    closeModal('loginModal');
    updateAuthUI();
    fetchEvents();
  } else {
    alert(data.error || 'Login failed');
  }
}

async function handleSignup(e) {
  e.preventDefault();
  const name = document.getElementById('signName').value;
  const email = document.getElementById('signEmail').value;
  const contact_number = document.getElementById('signContact').value;
  const password = document.getElementById('signPassword').value;

  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, contact_number, password })
  });
  const data = await res.json();

  if (res.ok) {
    currentUser = data.user;
    closeModal('signupModal');
    updateAuthUI();
    fetchEvents();
  } else {
    alert(data.error || 'Signup failed');
  }
}

async function handleLogout() {
  await fetch('/api/auth/logout', { method: 'POST' });
  currentUser = null;
  updateAuthUI();
  fetchEvents();
}

// Fetch and Display Events
async function fetchEvents() {
  const search = document.getElementById('searchInput').value;
  const category = document.getElementById('categoryFilter').value;
  const status = document.getElementById('statusFilter').value;

  const url = `/api/events?search=${encodeURIComponent(search)}&category=${encodeURIComponent(category)}&status=${encodeURIComponent(status)}`;
  const res = await fetch(url);
  allEvents = await res.json();

  renderEventsGrid(allEvents);
  renderScheduleTimeline(allEvents);
}

function renderEventsGrid(events) {
  const grid = document.getElementById('eventsGrid');
  grid.innerHTML = '';

  if (events.length === 0) {
    grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #666;">No events found matching criteria.</p>';
    return;
  }

  events.forEach(ev => {
    const seatsLeft = ev.seats_left;
    const isFull = seatsLeft <= 0;
    const isClosed = ev.status !== 'Open for Registration';

    let regBtnAttr = '';
    let btnText = 'Register';

    if (isClosed) {
      regBtnAttr = `disabled title="Registration is ${ev.status}"`;
      btnText = ev.status;
    } else if (isFull) {
      regBtnAttr = `disabled title="Event is full"`;
      btnText = 'Full';
    }

    const defaultImg = 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=500';
    const cardImg = ev.image_data || defaultImg;

    const card = document.createElement('div');
    card.className = 'event-card';
    card.innerHTML = `
      <div class="card-img-container">
        <img src="${escapeHtml(cardImg)}" class="card-img" alt="Event">
        <span class="card-category">${escapeHtml(ev.category)}</span>
      </div>
      <div class="card-body">
        <h3 class="card-title">${escapeHtml(ev.title)}</h3>
        <div class="card-meta">
          <span>📅 ${escapeHtml(ev.event_date)} | ⏰ ${escapeHtml(ev.event_time)}</span>
          <span>📍 ${escapeHtml(ev.venue)}</span>
          <span>👤 Head: ${escapeHtml(ev.head_name)}</span>
        </div>
        <div class="seat-progress">
          <div class="seat-label">
            <span>${seatsLeft} of ${ev.participant_limit} seats left</span>
            <span>${Math.round((ev.registered_count / ev.participant_limit) * 100)}%</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${(ev.registered_count / ev.participant_limit) * 100}%"></div>
          </div>
        </div>
        <p style="font-size:0.75rem; color:#64748b; margin-bottom:10px;">Deadline: ${escapeHtml(ev.registration_deadline)}</p>
        <div class="card-actions">
          <button class="btn btn-outline btn-sm" onclick="showEventDetails(${ev.id})">Details</button>
          <button class="btn btn-primary btn-sm" ${regBtnAttr} onclick="handleRegisterEvent(${ev.id})">${btnText}</button>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });
}

function renderScheduleTimeline(events) {
  const timeline = document.getElementById('timelineList');
  timeline.innerHTML = '';
  events.slice(0, 5).forEach(ev => {
    const item = document.createElement('div');
    item.className = 'timeline-item';
    item.innerHTML = `
      <h4>${escapeHtml(ev.title)} (${escapeHtml(ev.category)})</h4>
      <p style="font-size:0.85rem; color:#64748b;">📅 ${escapeHtml(ev.event_date)} at ${escapeHtml(ev.venue)}</p>
    `;
    timeline.appendChild(item);
  });
}

function showEventDetails(eventId) {
  const ev = allEvents.find(e => e.id === eventId);
  if (!ev) return;

  const defaultImg = 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=500';
  const modalBody = document.getElementById('eventModalBody');
  modalBody.innerHTML = `
    <img src="${escapeHtml(ev.image_data || defaultImg)}" style="width:100%; height:200px; object-fit:cover; border-radius:8px; margin-bottom:15px;">
    <h2>${escapeHtml(ev.title)}</h2>
    <p><strong>Category:</strong> ${escapeHtml(ev.category)} | <strong>Status:</strong> ${escapeHtml(ev.status)}</p>
    <p><strong>Date & Time:</strong> ${escapeHtml(ev.event_date)} @ ${escapeHtml(ev.event_time)}</p>
    <p><strong>Venue:</strong> ${escapeHtml(ev.venue)}</p>
    <p><strong>Event Head:</strong> ${escapeHtml(ev.head_name)}</p>
    <p style="margin-top:10px;">${escapeHtml(ev.description)}</p>
  `;
  openModal('eventDetailModal');
}

async function handleRegisterEvent(eventId) {
  if (!currentUser) {
    alert("Please login first to register!");
    openModal('loginModal');
    return;
  }
  const res = await fetch(`/api/events/${eventId}/register`, { method: 'POST' });
  const data = await res.json();
  if (res.ok) {
    alert("Registration submitted! Status is Pending.");
    fetchEvents();
    if (currentUser.role === 'student') fetchMyRegistrations();
  } else {
    alert(data.error || "Registration failed");
  }
}

function resetFilters() {
  document.getElementById('searchInput').value = '';
  document.getElementById('categoryFilter').value = 'All';
  document.getElementById('statusFilter').value = 'All';
  fetchEvents();
}

function filterByCategory(cat) {
  document.getElementById('categoryFilter').value = cat;
  fetchEvents();
  window.location.href = '#events';
}

// Student Registrations & Ticket Display
async function fetchMyRegistrations() {
  const res = await fetch('/api/my-registrations');
  const regs = await res.json();
  const tbody = document.getElementById('myRegsTableBody');
  tbody.innerHTML = '';

  regs.forEach(r => {
    let badgeClass = 'badge-pending';
    if (r.status === 'Approved') badgeClass = 'badge-approved';
    if (r.status === 'Rejected') badgeClass = 'badge-rejected';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(r.event_title)}</td>
      <td>${escapeHtml(r.participant_type)}</td>
      <td><span class="badge ${badgeClass}">${escapeHtml(r.status)}</span></td>
      <td><code>${escapeHtml(r.ticket_code)}</code></td>
      <td>
        ${r.status === 'Approved' ? `<button class="btn btn-outline btn-sm" onclick="showTicket('${r.ticket_code}')">Ticket</button>` : ''}
        <button class="btn btn-secondary btn-sm" onclick="cancelRegistration(${r.id})">Cancel</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function showTicket(ticketCode) {
  document.getElementById('ticketCodeDisplay').innerText = ticketCode;
  document.getElementById('qrImage').src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(ticketCode)}`;
  openModal('ticketModal');
}

async function cancelRegistration(regId) {
  if (!confirm("Are you sure you want to cancel this registration?")) return;
  const res = await fetch(`/api/registrations/${regId}`, { method: 'DELETE' });
  if (res.ok) {
    fetchMyRegistrations();
    fetchEvents();
  } else {
    const data = await res.json();
    alert(data.error || "Cancellation failed");
  }
}

// Notifications API
async function fetchNotifications() {
  const res = await fetch('/api/notifications');
  const data = await res.json();
  document.getElementById('notifCount').innerText = data.unread_count;

  const list = document.getElementById('notifList');
  list.innerHTML = '';
  if (data.notifications.length === 0) {
    list.innerHTML = '<p style="font-size:0.8rem; color:#666;">No unread notifications</p>';
    return;
  }
  data.notifications.forEach(n => {
    const item = document.createElement('div');
    item.className = 'notif-item';
    item.innerHTML = `<strong>${escapeHtml(n.title)}</strong><br>${escapeHtml(n.message)}`;
    list.appendChild(item);
  });
}

async function toggleNotifications() {
  const dropdown = document.getElementById('notifDropdown');
  dropdown.classList.toggle('active');
  if (dropdown.classList.contains('active')) {
    await fetch('/api/notifications', { method: 'PATCH' });
    document.getElementById('notifCount').innerText = '0';
  }
}

// Admin / Head Dashboard Logic
function switchDashTab(tab) {
  currentDashTab = tab;
  document.querySelectorAll('.sidebar-tab').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');
  loadDashboardTab(tab);
}

async function loadDashboardTab(tab) {
  const content = document.getElementById('dashContent');

  if (tab === 'overview') {
    const res = await fetch('/api/stats');
    const s = await res.json();
    content.innerHTML = `
      <h3>Overview Statistics</h3>
      <div class="stats-grid" style="margin-top:20px;">
        <div class="stat-card"><h4>Total Events</h4><div class="value">${s.total_events}</div></div>
        <div class="stat-card"><h4>Total Registrations</h4><div class="value">${s.total_registrations}</div></div>
        <div class="stat-card"><h4>Pending Registrations</h4><div class="value">${s.pending_registrations}</div></div>
        <div class="stat-card"><h4>Marked Present</h4><div class="value">${s.marked_present}</div></div>
        <div class="stat-card"><h4>Total Expenses</h4><div class="value">$${s.total_expenses.toFixed(2)}</div></div>
      </div>
    `;
  } else if (tab === 'events') {
    let addBtn = currentUser.role === 'admin' ? `<button class="btn btn-primary btn-sm" onclick="openCreateEventModal()">+ Create Event</button>` : '';
    content.innerHTML = `
      <div style="display:flex; justify-size:space-between; align-items:center; margin-bottom:15px;">
        <h3>Event Management</h3>
        ${addBtn}
      </div>
      <div class="table-responsive">
        <table>
          <thead>
            <tr><th>Title</th><th>Category</th><th>Status</th><th>Date</th><th>Head</th><th>Actions</th></tr>
          </thead>
          <tbody id="dashEventsTable"></tbody>
        </table>
      </div>
    `;
    loadDashEventsTable();
  } else if (tab === 'participants') {
    content.innerHTML = `
      <h3>Participant & Attendance Management</h3>
      <div style="background:#f8fafc; padding:15px; border-radius:8px; margin:15px 0; display:flex; gap:10px; flex-wrap:wrap;">
        <input type="text" id="checkinTicketCode" placeholder="Enter Ticket Code" style="padding:8px; flex:1; min-width:200px;">
        <button class="btn btn-primary btn-sm" onclick="verifyCheckin()">Verify and Check-in</button>
        <button class="btn btn-outline btn-sm" onclick="openModal('addPartModal')">+ Add Participant</button>
      </div>
      <div class="table-responsive">
        <table>
          <thead>
            <tr><th>Participant</th><th>Event</th><th>Type</th><th>Contact</th><th>Status</th><th>Attendance</th><th>Actions</th></tr>
          </thead>
          <tbody id="dashPartTable"></tbody>
        </table>
      </div>
    `;
    loadDashParticipantsTable();
    populateEventDropdowns();
  } else if (tab === 'resources') {
    content.innerHTML = `
      <h3>Resource Management</h3>
      <form onsubmit="handleAddResource(event)" style="display:flex; gap:10px; margin:15px 0; flex-wrap:wrap;">
        <select id="resEventSelect" required style="padding:8px;"></select>
        <input type="text" id="resItemName" placeholder="Item Name" required style="padding:8px;">
        <input type="number" id="resQuantity" value="1" min="1" style="padding:8px; width:80px;">
        <button type="submit" class="btn btn-primary btn-sm">Add Resource</button>
      </form>
      <div class="table-responsive">
        <table>
          <thead><tr><th>Event</th><th>Item Name</th><th>Quantity</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody id="dashResTable"></tbody>
        </table>
      </div>
    `;
    populateEventDropdowns();
    loadDashResourcesTable();
  } else if (tab === 'volunteers') {
    content.innerHTML = `
      <h3>Volunteer Coordination</h3>
      <form onsubmit="handleAddVolunteer(event)" style="display:flex; gap:10px; margin:15px 0; flex-wrap:wrap;">
        <select id="volEventSelect" required style="padding:8px;"></select>
        <input type="text" id="volName" placeholder="Volunteer Name" required style="padding:8px;">
        <input type="email" id="volEmail" placeholder="Email" required style="padding:8px;">
        <input type="text" id="volRole" placeholder="Role Assigned" required style="padding:8px;">
        <button type="submit" class="btn btn-primary btn-sm">Assign Volunteer</button>
      </form>
      <div class="table-responsive">
        <table>
          <thead><tr><th>Event</th><th>Name</th><th>Email</th><th>Role</th><th>Actions</th></tr></thead>
          <tbody id="dashVolTable"></tbody>
        </table>
      </div>
    `;
    populateEventDropdowns();
    loadDashVolunteersTable();
  } else if (tab === 'budget') {
    content.innerHTML = `
      <h3>Budget Tracking</h3>
      <form onsubmit="handleAddBudgetItem(event)" style="display:flex; gap:10px; margin:15px 0; flex-wrap:wrap;">
        <select id="budEventSelect" required style="padding:8px;"></select>
        <input type="text" id="budDesc" placeholder="Description" required style="padding:8px;">
        <input type="number" step="0.01" id="budAmount" placeholder="Amount" required style="padding:8px; width:100px;">
        <select id="budType" style="padding:8px;"><option value="Expense">Expense</option><option value="Income">Income</option></select>
        <button type="submit" class="btn btn-primary btn-sm">Add Item</button>
      </form>
      <div class="table-responsive">
        <table>
          <thead><tr><th>Event</th><th>Description</th><th>Type</th><th>Amount</th><th>Actions</th></tr></thead>
          <tbody id="dashBudTable"></tbody>
        </table>
      </div>
    `;
    populateEventDropdowns();
    loadDashBudgetTable();
  } else if (tab === 'reports') {
    content.innerHTML = `
      <h3>Export Reports (CSV)</h3>
      <div style="display:flex; gap:15px; margin-top:20px;">
        <a href="/api/reports/participants" class="btn btn-primary btn-sm">Download Participants CSV</a>
        <a href="/api/reports/events" class="btn btn-outline btn-sm">Download Events CSV</a>
        <a href="/api/reports/budget" class="btn btn-secondary btn-sm">Download Budget CSV</a>
      </div>
    `;
  } else if (tab === 'messages') {
    const res = await fetch('/api/contact');
    const msgs = await res.json();
    content.innerHTML = `
      <h3>Contact Form Messages</h3>
      <div class="table-responsive" style="margin-top:15px;">
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>Subject</th><th>Message</th></tr></thead>
          <tbody>
            ${msgs.map(m => `<tr><td>${escapeHtml(m.name)}</td><td>${escapeHtml(m.email)}</td><td>${escapeHtml(m.subject)}</td><td>${escapeHtml(m.message)}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>
    `;
  }
}

// Load Tables Logic
async function loadDashEventsTable() {
  const url = currentUser.role === 'head' ? '/api/events?mine=true' : '/api/events';
  const res = await fetch(url);
  const events = await res.json();
  const tbody = document.getElementById('dashEventsTable');
  tbody.innerHTML = '';

  events.forEach(ev => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(ev.title)}</td>
      <td>${escapeHtml(ev.category)}</td>
      <td>${escapeHtml(ev.status)}</td>
      <td>${escapeHtml(ev.event_date)}</td>
      <td>${escapeHtml(ev.head_name)}</td>
      <td>
        ${currentUser.role === 'admin' ? `<button class="btn btn-secondary btn-sm" onclick="deleteEvent(${ev.id})">Delete</button>` : ''}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function loadDashParticipantsTable() {
  const res = await fetch('/api/registrations');
  const regs = await res.json();
  const tbody = document.getElementById('dashPartTable');
  tbody.innerHTML = '';

  regs.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(r.participant_name)}</td>
      <td>${escapeHtml(r.event_title)}</td>
      <td>${escapeHtml(r.participant_type)}</td>
      <td>${escapeHtml(r.email)}</td>
      <td>${escapeHtml(r.status)}</td>
      <td>${escapeHtml(r.attendance)}</td>
      <td>
        <button class="btn btn-primary btn-sm" onclick="updatePartStatus(${r.id}, 'Approved')">Approve</button>
        <button class="btn btn-outline btn-sm" onclick="updatePartStatus(${r.id}, 'Rejected')">Reject</button>
        <button class="btn btn-secondary btn-sm" onclick="removeParticipant(${r.id})">Remove</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function verifyCheckin() {
  const code = document.getElementById('checkinTicketCode').value.trim();
  const res = await fetch('/api/tickets/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ticket_code: code })
  });
  const data = await res.json();
  if (res.ok) {
    alert(data.message);
    loadDashParticipantsTable();
  } else {
    alert(data.error || "Check-in failed");
  }
}

async function updatePartStatus(regId, status) {
  const res = await fetch(`/api/registrations/${regId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  });
  if (res.ok) loadDashParticipantsTable();
}

async function removeParticipant(regId) {
  if (!confirm("Are you sure you want to remove this participant?")) return;
  const res = await fetch(`/api/registrations/${regId}`, { method: 'DELETE' });
  if (res.ok) loadDashParticipantsTable();
}

async function deleteEvent(eventId) {
  if (!confirm("Are you sure you want to delete this event?")) return;
  const res = await fetch(`/api/events/${eventId}`, { method: 'DELETE' });
  if (res.ok) {
    loadDashEventsTable();
    fetchEvents();
  }
}

// Populate Dropdowns & Manage Modals
async function populateEventDropdowns() {
  const url = currentUser.role === 'head' ? '/api/events?mine=true' : '/api/events';
  const res = await fetch(url);
  const events = await res.json();

  ['addPartEvent', 'resEventSelect', 'volEventSelect', 'budEventSelect'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.innerHTML = events.map(e => `<option value="${e.id}">${escapeHtml(e.title)}</option>`).join('');
    }
  });
}

function openCreateEventModal() {
  fetchHeadsForDropdown();
  openModal('createEventModal');
}

async function fetchHeadsForDropdown() {
  const res = await fetch('/api/users?role=head');
  const heads = await res.json();
  const select = document.getElementById('evHead');
  select.innerHTML = '<option value="">-- Select Event Head --</option>' + heads.map(h => `<option value="${h.id}">${escapeHtml(h.name)}</option>`).join('');
}

async function handleSaveEvent(e) {
  e.preventDefault();
  const payload = {
    title: document.getElementById('evTitle').value,
    category: document.getElementById('evCategory').value,
    status: document.getElementById('evStatus').value,
    event_date: document.getElementById('evDate').value,
    event_time: document.getElementById('evTime').value,
    venue: document.getElementById('evVenue').value,
    participant_limit: document.getElementById('evLimit').value,
    registration_deadline: document.getElementById('evDeadline').value,
    head_id: document.getElementById('evHead').value || null,
    image_data: document.getElementById('evImageUrl').value,
    description: document.getElementById('evDescription').value
  };

  const res = await fetch('/api/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (res.ok) {
    closeModal('createEventModal');
    fetchEvents();
    if (currentDashTab === 'events') loadDashEventsTable();
  } else {
    const data = await res.json();
    alert(data.error || "Failed to save event");
  }
}

async function handleAddParticipant(e) {
  e.preventDefault();
  const payload = {
    event_id: document.getElementById('addPartEvent').value,
    participant_name: document.getElementById('addPartName').value,
    email: document.getElementById('addPartEmail').value,
    participant_type: document.getElementById('addPartType').value,
    contact_number: document.getElementById('addPartContact').value
  };

  const res = await fetch('/api/registrations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (res.ok) {
    closeModal('addPartModal');
    loadDashParticipantsTable();
  } else {
    const data = await res.json();
    alert(data.error || "Failed to add participant");
  }
}

// Additional Management Forms
async function handleAddResource(e) {
  e.preventDefault();
  const payload = {
    event_id: document.getElementById('resEventSelect').value,
    item_name: document.getElementById('resItemName').value,
    quantity: document.getElementById('resQuantity').value
  };
  await fetch('/api/resources', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  loadDashResourcesTable();
}

async function loadDashResourcesTable() {
  const res = await fetch('/api/resources');
  const items = await res.json();
  const tbody = document.getElementById('dashResTable');
  tbody.innerHTML = items.map(i => `<tr><td>${i.event_id}</td><td>${escapeHtml(i.item_name)}</td><td>${i.quantity}</td><td>${i.status}</td><td><button class="btn btn-secondary btn-sm" onclick="deleteResource(${i.id})">Delete</button></td></tr>`).join('');
}

async function deleteResource(id) {
  await fetch(`/api/resources?id=${id}`, { method: 'DELETE' });
  loadDashResourcesTable();
}

async function handleAddVolunteer(e) {
  e.preventDefault();
  const payload = {
    event_id: document.getElementById('volEventSelect').value,
    name: document.getElementById('volName').value,
    email: document.getElementById('volEmail').value,
    role_assigned: document.getElementById('volRole').value
  };
  await fetch('/api/volunteers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  loadDashVolunteersTable();
}

async function loadDashVolunteersTable() {
  const res = await fetch('/api/volunteers');
  const items = await res.json();
  const tbody = document.getElementById('dashVolTable');
  tbody.innerHTML = items.map(i => `<tr><td>${i.event_id}</td><td>${escapeHtml(i.name)}</td><td>${escapeHtml(i.email)}</td><td>${escapeHtml(i.role_assigned)}</td><td><button class="btn btn-secondary btn-sm" onclick="deleteVolunteer(${i.id})">Delete</button></td></tr>`).join('');
}

async function deleteVolunteer(id) {
  await fetch(`/api/volunteers?id=${id}`, { method: 'DELETE' });
  loadDashVolunteersTable();
}

async function handleAddBudgetItem(e) {
  e.preventDefault();
  const payload = {
    event_id: document.getElementById('budEventSelect').value,
    description: document.getElementById('budDesc').value,
    amount: document.getElementById('budAmount').value,
    item_type: document.getElementById('budType').value
  };
  await fetch('/api/budget', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  loadDashBudgetTable();
}

async function loadDashBudgetTable() {
  const res = await fetch('/api/budget');
  const items = await res.json();
  const tbody = document.getElementById('dashBudTable');
  tbody.innerHTML = items.map(i => `<tr><td>${i.event_id}</td><td>${escapeHtml(i.description)}</td><td>${i.item_type}</td><td>$${i.amount.toFixed(2)}</td><td><button class="btn btn-secondary btn-sm" onclick="deleteBudgetItem(${i.id})">Delete</button></td></tr>`).join('');
}

async function deleteBudgetItem(id) {
  await fetch(`/api/budget?id=${id}`, { method: 'DELETE' });
  loadDashBudgetTable();
}

// Photos Gallery Logic
async function fetchPhotos() {
  const res = await fetch('/api/photos');
  const photos = await res.json();
  const grid = document.getElementById('galleryGrid');
  grid.innerHTML = '';

  if (photos.length === 0) {
    grid.innerHTML = '<p style="grid-column:1/-1; color:#666;">No gallery photos available yet.</p>';
    return;
  }

  photos.forEach(p => {
    const div = document.createElement('div');
    div.className = 'gallery-item';
    div.innerHTML = `<img src="${escapeHtml(p.image_data)}" alt="${escapeHtml(p.title)}" onclick="openLightbox('${escapeHtml(p.image_data)}')">`;
    grid.appendChild(div);
  });
}

function openLightbox(url) {
  document.getElementById('lightboxImg').src = url;
  openModal('lightboxModal');
}

async function handleAddPhoto(e) {
  e.preventDefault();
  const payload = {
    title: document.getElementById('photoTitle').value,
    image_data: document.getElementById('photoUrl').value
  };
  const res = await fetch('/api/photos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (res.ok) {
    closeModal('addPhotoModal');
    fetchPhotos();
  } else {
    alert("Failed to upload photo");
  }
}

// Contact Form
async function handleContactSubmit(e) {
  e.preventDefault();
  const payload = {
    name: document.getElementById('cName').value,
    email: document.getElementById('cEmail').value,
    subject: document.getElementById('cSubject').value,
    message: document.getElementById('cMessage').value
  };
  const res = await fetch('/api/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (res.ok) {
    alert("Thank you! Your message has been sent.");
    document.getElementById('contactForm').reset();
  } else {
    alert("Failed to send message.");
  }
}