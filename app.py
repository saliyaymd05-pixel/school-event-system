from flask import Flask, jsonify, request
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS

app = Flask(__name__, static_folder='static', static_url_path='')
CORS(app)

# Configure SQLite Database
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///school_events.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# ----------------- Database Models -----------------
class Event(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(150), nullable=False)
    description = db.Column(db.Text, nullable=False)
    category = db.Column(db.String(50), nullable=False)
    date = db.Column(db.String(50), nullable=False)
    time = db.Column(db.String(50), nullable=False)
    venue = db.Column(db.String(100), nullable=False)
    status = db.Column(db.String(50), nullable=False)
    max_participants = db.Column(db.Integer, nullable=False)
    image = db.Column(db.String(300), nullable=False)

    def to_dict(self):
        return {
            "id": self.id, "title": self.title, "description": self.description,
            "category": self.category, "date": self.date, "time": self.time,
            "venue": self.venue, "status": self.status, "max_participants": self.max_participants, "image": self.image
        }

class Registration(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    event_id = db.Column(db.Integer, nullable=False)
    event_title = db.Column(db.String(150), nullable=False)
    participant_name = db.Column(db.String(100), nullable=False)
    participant_type = db.Column(db.String(50), nullable=False)
    email = db.Column(db.String(100), nullable=False)
    phone = db.Column(db.String(20), nullable=False)
    check_in_status = db.Column(db.String(50), default="Not Checked In")

    def to_dict(self):
        return {
            "id": self.id, "event_id": self.event_id, "event_title": self.event_title,
            "participant_name": self.participant_name, "participant_type": self.participant_type,
            "email": self.email, "phone": self.phone, "check_in_status": self.check_in_status
        }

# ----------------- API Endpoints -----------------
@app.route('/')
def home():
    return app.send_static_file('index.html')

@app.route('/api/events', methods=['GET'])
def get_events():
    events = Event.query.all()
    return jsonify([e.to_dict() for e in events])

@app.route('/api/events', methods=['POST'])
def create_event():
    data = request.json
    new_event = Event(
        title=data.get('title'), description=data.get('description'), category=data.get('category'),
        date=data.get('date'), time=data.get('time'), venue=data.get('venue'),
        status=data.get('status'), max_participants=data.get('max_participants'), image=data.get('image')
    )
    db.session.add(new_event)
    db.session.commit()
    return jsonify({"message": "Event saved successfully!", "event": new_event.to_dict()}), 201

@app.route('/api/registrations', methods=['GET'])
def get_registrations():
    regs = Registration.query.all()
    return jsonify([r.to_dict() for r in regs])

@app.route('/api/registrations', methods=['POST'])
def create_registration():
    data = request.json
    new_reg = Registration(
        event_id=data.get('event_id'), event_title=data.get('event_title'),
        participant_name=data.get('participant_name'), participant_type=data.get('participant_type'),
        email=data.get('email'), phone=data.get('phone')
    )
    db.session.add(new_reg)
    db.session.commit()
    return jsonify({"message": "Registration saved successfully!", "registration": new_reg.to_dict()}), 201

# Initialize Database & Seed Default Events
if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        if Event.query.count() == 0:
            default_events = [
                Event(title="Annual Science Fair 2026", description="Students showcase innovative science projects.", category="Academic", date="2026-11-15", time="9:00 AM - 4:00 PM", venue="School Auditorium", status="Open for Registration", max_participants=200, image="https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=800&q=80"),
                Event(title="Annual Sports Day", description="Inter-house track and field athletics competitions.", category="Sports", date="2026-12-10", time="8:00 AM - 5:00 PM", venue="School Ground", status="Planning", max_participants=500, image="https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=800&q=80"),
                Event(title="Annual Cultural Day", description="Student music performances, dance, and theatrical plays.", category="Cultural", date="2026-12-20", time="10:00 AM - 6:00 PM", venue="School Open Air Stage", status="Open for Registration", max_participants=600, image="https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=800&q=80"),
                Event(title="Robotics & Coding Workshop", description="Hands-on STEM and coding workshop for students.", category="Workshops", date="2026-11-25", time="10:00 AM - 2:00 PM", venue="Computer Lab 1", status="In Progress", max_participants=60, image="https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=800&q=80"),
                Event(title="Parent-Teacher Progress Meet", description="Discussion on quarterly student academic performance.", category="Parent-Teacher Meets", date="2026-11-05", time="1:00 PM - 5:00 PM", venue="School Classrooms", status="Open for Registration", max_participants=300, image="https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&w=800&q=80")
            ]
            db.session.add_all(default_events)
            db.session.commit()
    app.run(debug=True, port=5000)