document.addEventListener("DOMContentLoaded", () => {
  loadEvents();
  loadRegistrations();
});

// Toggle Navigation Drawer
function toggleSidebar() {
  const drawer = document.getElementById('sidebarDrawer');
  const overlay = document.getElementById('sidebarOverlay');
  if (drawer && overlay) {
    drawer.classList.toggle('open');
    overlay.classList.toggle('active');
  }
}

// Modal Control
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.style.display = 'flex';
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.style.display = 'none';
}

// ---------------- DATABASE FETCH & DISPLAY FUNCTIONS ----------------

// Fetch Events from Database and Display as Cards
async function loadEvents() {
  try {
    const response = await fetch('/api/events');
    const events = await response.json();
    const grid = document.getElementById('eventsGrid');
    if (!grid) return;

    if (events.length === 0) {
      grid.innerHTML = `<p style="text-align:center; color:#64748b; grid-column:1/-1;">No events found. Click "Create Event" to add one!</p>`;
      return;
    }

    grid.innerHTML = events.map(evt => `
      <div class="category-card" style="padding:0; overflow:hidden;">
        <img src="${evt.image}" alt="${evt.title}" style="width:100%; height:160px; object-fit:cover;">
        <div style="padding:16px;">
          <span class="badge badge-accent" style="margin-bottom:8px;">${evt.category}</span>
          <h3 style="margin-bottom:8px;">${evt.title}</h3>
          <p style="color:#64748b; font-size:0.9rem; margin-bottom:12px;">${evt.description}</p>
          <p style="font-size:0.85rem; color:#475569; margin-bottom:12px;">
            <i class="fa-solid fa-calendar"></i> ${evt.date} | <i class="fa-solid fa-clock"></i> ${evt.time}<br>
            <i class="fa-solid fa-location-dot"></i> ${evt.venue}
          </p>
          <button class="btn btn-primary" style="width:100%; justify-content:center;" onclick="openRegisterModal(${evt.id}, '${evt.title.replace(/'/g, "\\'")}')">
            Register Now
          </button>
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Error loading events:', error);
  }
}

// Open Registration Modal with Pre-filled Event Info
function openRegisterModal(eventId, eventTitle) {
  document.getElementById('regEventId').value = eventId;
  document.getElementById('regEventTitle').value = eventTitle;
  openModal('registerModal');
}

// Save New Event to Database
async function handleCreateEvent(e) {
  e.preventDefault();
  const eventData = {
    title: document.getElementById('evtTitle').value,
    category: document.getElementById('evtCategory').value,
    status: document.getElementById('evtStatus').value,
    date: document.getElementById('evtDate').value,
    time: document.getElementById('evtTime').value,
    venue: document.getElementById('evtVenue').value,
    image: document.getElementById('evtImage').value,
    description: document.getElementById('evtDesc').value
  };

  try {
    const response = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(eventData)
    });
    if (response.ok) {
      alert('Event created and saved to database!');
      closeModal('createEventModal');
      e.target.reset();
      loadEvents();
    }
  } catch (err) {
    alert('Failed to save event.');
  }
}

// Save Student Registration to Database
async function handleRegistrationSubmit(e) {
  e.preventDefault();
  const regData = {
    event_id: document.getElementById('regEventId').value,
    event_title: document.getElementById('regEventTitle').value,
    student_name: document.getElementById('regName').value,
    email: document.getElementById('regEmail').value,
    phone: document.getElementById('regPhone').value,
    participant_type: document.getElementById('regType').value
  };

  try {
    const response = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(regData)
    });
    if (response.ok) {
      alert('Registration successful! Data stored in database.');
      closeModal('registerModal');
      e.target.reset();
      loadRegistrations();
    }
  } catch (err) {
    alert('Failed to register.');
  }
}

// Fetch Registrations into Dashboard Table
async function loadRegistrations() {
  try {
    const response = await fetch('/api/registrations');
    const data = await response.json();
    const tbody = document.getElementById('registrationsTableBody');
    if (!tbody) return;

    if (data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#64748b;">No student registrations yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = data.map(r => `
      <tr>
        <td><strong>${r.student_name}</strong></td>
        <td>${r.event_title}</td>
        <td><span class="badge badge-accent">${r.participant_type}</span></td>
        <td>${r.email}</td>
        <td>${r.phone}</td>
        <td><span style="color:#16a34a; font-weight:700;">${r.status}</span></td>
        <td>
          <button class="btn btn-outline" style="padding:4px 10px; font-size:0.8rem; color:#dc2626; border-color:#dc2626;" onclick="deleteRegistration(${r.id})">
            Delete
          </button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Error loading registrations:', err);
  }
}

// Event Head Delete Registration
async function deleteRegistration(regId) {
  if (!confirm("Are you sure you want to delete this student registration?")) return;
  
  try {
    const response = await fetch(`/api/registrations/${regId}`, { method: 'DELETE' });
    if (response.ok) {
      alert("Registration deleted from database!");
      loadRegistrations();
    }
  } catch (err) {
    alert("Could not delete registration.");
  }
}

// Event Head Login Simulation
function handleHeadLogin(e) {
  e.preventDefault();
  closeModal('headLoginModal');
  document.getElementById('actionHeaderCol').style.display = 'table-cell';
  alert('Logged in as Event Head successfully! Full controls enabled.');
}
