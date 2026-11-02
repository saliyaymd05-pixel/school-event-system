# EventSchool - Full-Stack School Event Management Platform

A modern, responsive full-stack web application designed for schools to plan, organize, manage, and coordinate campus events, activities, and parent-teacher meetings with persistent database storage.

## Features

- **Event Discovery & Real-Time Filtering**: Search through school events instantly by title or venue, and filter by categories (Academic, Sports, Cultural, Workshops, Parent-Teacher Meets) and status.
- **Dynamic Event Creation**: Full form modal allowing administrators to create and save new school events directly to a persistent database.
- **Participant Registrations**: Register students, teachers, parents, and guest speakers with instant database tracking.
- **Management Dashboard**: Clean interface to view all live participant records and event data.
- **Persistent Database Backend**: Built with Python Flask and SQLAlchemy, ensuring all created events and user registrations are permanently saved using SQLite.

---

## Technology Stack

- **Backend**: Python, Flask, Flask-SQLAlchemy, Flask-CORS
- **Database**: SQLite
- **Frontend**: HTML5, CSS3, Vanilla JavaScript, Font Awesome, Google Fonts (Plus Jakarta Sans)
- **Deployment & Production**: Gunicorn, Render

---

## Project Structure

```text
school-event-system/
│
├── app.py              # Flask backend server, database models, and API endpoints
├── requirements.txt    # Python dependencies and production servers
└── static/
    ├── index.html      # Main frontend HTML file
    ├── style.css       # Custom layout styles, grid, and responsive design
    └── script.js       # Frontend logic and API fetch integration# school-event-system
