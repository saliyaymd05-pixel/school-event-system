import os
from flask import Flask, render_template, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

app = Flask(__name__, static_folder='static', template_folder='static')
app.secret_key = os.environ.get("SECRET_KEY", "eventschool-secret-key-2026")

# Database Configuration (SQLite)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///eventschool.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# ---------------- DATABASE MODELS ----------------
class Event(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(150), nullable=False)
    category = db.Column(db.String(50), nullable=False)
    status = db.Column(db.String(50), default="Open for Registration")
    date = db.Column(db.String(50), nullable=False)
    time = db.Column(db.String(50), nullable=False)
    venue = db.Column(db.String(100), nullable=False)
    image = db.Column(db.String(500), nullable=False)
    description = db.Column(db.Text, nullable=False)

class Registration(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    event_id = db.Column(db.Integer, db.ForeignKey('event.id'), nullable=False)
    event_title = db.Column(db.String(150), nullable=False)
    student_name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), nullable=False)
    phone = db.Column(db.String(20), nullable=False)
    participant_type = db.Column(db.String(50), default="Student")
    status = db.Column(db.String(50), default="Approved")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

# Create Database Tables Automatically
with app.app_context():
    db.create_all()

# ---------------- ROUTES & API ENDPOINTS ----------------

@app.route('/')
def home():
    return app.send_static_file('index.html')

# 1. Fetch All Events
@app.route('/api/events', methods=['GET'])
def get_events():
    events = Event.query.all()
    events_data = [{
        'id': e.id,
        'title': e.title,
        'category': e.category,
        'status': e.status,
        'date': e.date,
        'time': e.time,
        'venue': e.venue,
        'image': e.image,
        'description': e.description
    } for e in events]
    return jsonify(events_data), 200

# 2. Store New Event in Database
@app.route('/api/events', methods=['POST'])
def create_event():
    data = request.json
    new_event = Event(
        title=data['title'],
        category=data['category'],
        status=data.get('status', 'Open for Registration'),
        date=data['date'],
        time=data['time'],
        venue=data['venue'],
        image=data['image'],
        description=data['description']
    )
    db.session.add(new_event)
    db.session.commit()
    return jsonify({"message": "Event stored successfully!", "id": new_event.id}), 201

# 3. Store Student Registration in Database
@app.route('/api/register', methods=['POST'])
def register_student():
    data = request.json
    new_reg = Registration(
        event_id=data['event_id'],
        event_title=data['event_title'],
        student_name=data['student_name'],
        email=data['email'],
        phone=data['phone'],
        participant_type=data.get('participant_type', 'Student')
    )
    db.session.add(new_reg)
    db.session.commit()
    return jsonify({"message": "Registration saved successfully!"}), 201

# 4. Fetch All Registrations for Event Head Dashboard
@app.route('/api/registrations', methods=['GET'])
def get_registrations():
    registrations = Registration.query.all()
    reg_data = [{
        'id': r.id,
        'event_id': r.event_id,
        'event_title': r.event_title,
        'student_name': r.student_name,
        'email': r.email,
        'phone': r.phone,
        'participant_type': r.participant_type,
        'status': r.status
    } for r in registrations]
    return jsonify(reg_data), 200

# 5. Event Head Action: Delete Registration from Database
@app.route('/api/registrations/<int:reg_id>', methods=['DELETE'])
def delete_registration(reg_id):
    reg = Registration.query.get_or_404(reg_id)
    db.session.delete(reg)
    db.session.commit()
    return jsonify({"message": "Student registration deleted successfully!"}), 200

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
