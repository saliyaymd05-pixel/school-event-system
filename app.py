import os
import io
import re
import csv
import uuid
import datetime
from functools import wraps
from flask import (
    Flask, request, jsonify, session, send_from_directory, Response
)
from flask_sqlalchemy import SQLAlchemy
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__, static_folder='static', static_url_path='')

# Configuration
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'default-dev-secret-key-12345')
app.config['MAX_CONTENT_LENGTH'] = 5 * 1024 * 1024  # 5MB upload limit

# Database Configuration
db_url = os.environ.get('DATABASE_URL')
if db_url:
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)
    app.config['SQLALCHEMY_DATABASE_URI'] = db_url
else:
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///eventschool.db'

app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# Rate Limiter Configuration
limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["1000 per hour"],
    storage_uri="memory://"
)

# Database Models
class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(256), nullable=False)
    role = db.Column(db.String(20), nullable=False, default='student') # admin, head, student
    contact_number = db.Column(db.String(30), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'email': self.email,
            'role': self.role,
            'contact_number': self.contact_number,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class Event(db.Model):
    __tablename__ = 'events'
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(150), nullable=False)
    category = db.Column(db.String(50), nullable=False) # Academic, Cultural, Sports, Workshops, Parent-Teacher Meets, Celebrations
    status = db.Column(db.String(30), nullable=False, default='Open for Registration') # Open for Registration, Planning, In Progress, Completed, Cancelled
    event_date = db.Column(db.String(20), nullable=False)
    event_time = db.Column(db.String(20), nullable=False)
    venue = db.Column(db.String(150), nullable=False)
    participant_limit = db.Column(db.Integer, nullable=False, default=50)
    registration_deadline = db.Column(db.String(30), nullable=False)
    head_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    image_data = db.Column(db.Text, nullable=True) # Data URL or Image URL
    description = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

    head = db.relationship('User', foreign_keys=[head_id])
    registrations = db.relationship('Registration', backref='event', cascade="all, delete-orphan", lazy=True)
    resources = db.relationship('Resource', backref='event', cascade="all, delete-orphan", lazy=True)
    volunteers = db.relationship('Volunteer', backref='event', cascade="all, delete-orphan", lazy=True)
    budget_items = db.relationship('BudgetItem', backref='event', cascade="all, delete-orphan", lazy=True)

    def to_dict(self):
        active_regs = Registration.query.filter(
            Registration.event_id == self.id,
            Registration.status.in_(['Pending', 'Approved'])
        ).count()
        return {
            'id': self.id,
            'title': self.title,
            'category': self.category,
            'status': self.status,
            'event_date': self.event_date,
            'event_time': self.event_time,
            'venue': self.venue,
            'participant_limit': self.participant_limit,
            'registered_count': active_regs,
            'seats_left': max(0, self.participant_limit - active_regs),
            'registration_deadline': self.registration_deadline,
            'head_id': self.head_id,
            'head_name': self.head.name if self.head else 'Unassigned',
            'image_data': self.image_data,
            'description': self.description,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class Registration(db.Model):
    __tablename__ = 'registrations'
    id = db.Column(db.Integer, primary_key=True)
    event_id = db.Column(db.Integer, db.ForeignKey('events.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    participant_name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), nullable=False)
    participant_type = db.Column(db.String(30), nullable=False, default='Student') # Student, Teacher, Parent, Guest
    contact_number = db.Column(db.String(30), nullable=True)
    status = db.Column(db.String(20), nullable=False, default='Pending') # Pending, Approved, Rejected
    attendance = db.Column(db.String(20), nullable=False, default='Absent') # Absent, Present
    ticket_code = db.Column(db.String(36), unique=True, nullable=False, default=lambda: str(uuid.uuid4()))
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint('event_id', 'email', name='unique_event_email'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'event_id': self.event_id,
            'event_title': self.event.title if self.event else '',
            'user_id': self.user_id,
            'participant_name': self.participant_name,
            'email': self.email,
            'participant_type': self.participant_type,
            'contact_number': self.contact_number,
            'status': self.status,
            'attendance': self.attendance,
            'ticket_code': self.ticket_code,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class Notification(db.Model):
    __tablename__ = 'notifications'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    title = db.Column(db.String(150), nullable=False)
    message = db.Column(db.Text, nullable=False)
    is_read = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'title': self.title,
            'message': self.message,
            'is_read': self.is_read,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class Resource(db.Model):
    __tablename__ = 'resources'
    id = db.Column(db.Integer, primary_key=True)
    event_id = db.Column(db.Integer, db.ForeignKey('events.id'), nullable=False)
    item_name = db.Column(db.String(100), nullable=False)
    quantity = db.Column(db.Integer, nullable=False, default=1)
    status = db.Column(db.String(30), nullable=False, default='Requested') # Requested, Approved, Secured
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'event_id': self.event_id,
            'item_name': self.item_name,
            'quantity': self.quantity,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class Volunteer(db.Model):
    __tablename__ = 'volunteers'
    id = db.Column(db.Integer, primary_key=True)
    event_id = db.Column(db.Integer, db.ForeignKey('events.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), nullable=False)
    role_assigned = db.Column(db.String(100), nullable=False)
    status = db.Column(db.String(30), nullable=False, default='Assigned')
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'event_id': self.event_id,
            'name': self.name,
            'email': self.email,
            'role_assigned': self.role_assigned,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class BudgetItem(db.Model):
    __tablename__ = 'budget_items'
    id = db.Column(db.Integer, primary_key=True)
    event_id = db.Column(db.Integer, db.ForeignKey('events.id'), nullable=False)
    category = db.Column(db.String(50), nullable=False) # Equipment, Venue, Refreshments, Decor, Other
    description = db.Column(db.String(200), nullable=False)
    amount = db.Column(db.Float, nullable=False, default=0.0)
    item_type = db.Column(db.String(20), nullable=False, default='Expense') # Expense, Income
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'event_id': self.event_id,
            'category': self.category,
            'description': self.description,
            'amount': self.amount,
            'item_type': self.item_type,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class Photo(db.Model):
    __tablename__ = 'photos'
    id = db.Column(db.Integer, primary_key=True)
    event_id = db.Column(db.Integer, db.ForeignKey('events.id'), nullable=True)
    title = db.Column(db.String(100), nullable=False)
    image_data = db.Column(db.Text, nullable=False)
    uploader_name = db.Column(db.String(100), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'event_id': self.event_id,
            'title': self.title,
            'image_data': self.image_data,
            'uploader_name': self.uploader_name,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class ContactMessage(db.Model):
    __tablename__ = 'contact_messages'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), nullable=False)
    subject = db.Column(db.String(150), nullable=False)
    message = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'email': self.email,
            'subject': self.subject,
            'message': self.message,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

# Helper Decorators & Functions
def current_user():
    user_id = session.get('user_id')
    if not user_id:
        return None
    return User.query.get(user_id)

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user():
            return jsonify({'error': 'Authentication required'}), 401
        return f(*args, **kwargs)
    return decorated_function

def role_required(roles):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            user = current_user()
            if not user or user.role not in roles:
                return jsonify({'error': 'Permission denied'}), 403
            return f(*args, **kwargs)
        return decorated_function
    return decorator

def notify_user(user_id, title, message):
    try:
        notif = Notification(user_id=user_id, title=title, message=message)
        db.session.add(notif)
        db.session.commit()
    except Exception as e:
        db.session.rollback()

def notify_email(email, title, message):
    user = User.query.filter_by(email=email).first()
    if user:
        notify_user(user.id, title, message)

def sanitize_csv_field(val):
    if val is None:
        return ""
    str_val = str(val)
    if str_val.startswith(('=', '+', '-', '@', '\t', '\r')):
        return "'" + str_val
    return str_val

def validate_image_header(data_str):
    if not data_str:
        return True
    if not data_str.startswith("data:image/"):
        if data_str.startswith("http://") or data_str.startswith("https://"):
            return True
        return False
    
    # Base64 header validation
    try:
        header, encoded = data_str.split(',', 1)
        mime = header.split(';')[0].split(':')[1].lower()
        if mime in ['image/jpeg', 'image/png', 'image/gif', 'image/webp']:
            return True
    except Exception:
        pass
    return False

# Initialize Admin & Database
@app.before_request
def setup_initial_data():
    if not hasattr(app, 'has_run_init'):
        app.has_run_init = True
        db.create_all()
        admin_email = os.environ.get('ADMIN_EMAIL', 'admin@eventschool.edu')
        admin_pass = os.environ.get('ADMIN_PASSWORD', 'AdminPass123!')
        
        admin = User.query.filter_by(email=admin_email).first()
        if not admin:
            admin = User(
                name='School Administrator',
                email=admin_email,
                role='admin',
                contact_number='123-456-7890'
            )
            admin.set_password(admin_pass)
            db.session.add(admin)
            db.session.commit()

# Serve Frontend
@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'index.html')

# API Endpoints
# 1. Auth API
@app.route('/api/auth/register', methods=['POST'])
@limiter.limit("10 per minute")
def register():
    data = request.get_json() or {}
    name = data.get('name', '').strip()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')
    contact_number = data.get('contact_number', '').strip()

    if not name or not email or not password:
        return jsonify({'error': 'Name, email, and password are required'}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({'error': 'Email is already registered'}), 400

    user = User(name=name, email=email, role='student', contact_number=contact_number)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()

    session['user_id'] = user.id
    return jsonify({'message': 'Registration successful', 'user': user.to_dict()}), 201

@app.route('/api/auth/login', methods=['POST'])
@limiter.limit("10 per minute")
def login():
    data = request.get_json() or {}
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        return jsonify({'error': 'Invalid credentials'}), 401

    session['user_id'] = user.id
    return jsonify({'message': 'Logged in successfully', 'user': user.to_dict()})

@app.route('/api/auth/logout', methods=['POST'])
def logout():
    session.pop('user_id', None)
    return jsonify({'message': 'Logged out successfully'})

@app.route('/api/auth/me', methods=['GET'])
def me():
    user = current_user()
    if not user:
        return jsonify({'user': None})
    return jsonify({'user': user.to_dict()})

# 2. Users Management (Admin)
@app.route('/api/users', methods=['GET', 'POST'])
@login_required
@role_required(['admin'])
def manage_users():
    if request.method == 'GET':
        role_filter = request.args.get('role')
        query = User.query
        if role_filter:
            query = query.filter_by(role=role_filter)
        users = query.all()
        return jsonify([u.to_dict() for u in users])

    if request.method == 'POST':
        data = request.get_json() or {}
        name = data.get('name', '').strip()
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')
        role = data.get('role', 'head')
        contact_number = data.get('contact_number', '').strip()

        if not name or not email or not password:
            return jsonify({'error': 'Name, email, and password are required'}), 400

        if User.query.filter_by(email=email).first():
            return jsonify({'error': 'User with this email already exists'}), 400

        user = User(name=name, email=email, role=role, contact_number=contact_number)
        user.set_password(password)
        db.session.add(user)
        db.session.commit()
        return jsonify(user.to_dict()), 201

# 3. Events API
@app.route('/api/events', methods=['GET', 'POST'])
def manage_events():
    if request.method == 'GET':
        category = request.args.get('category')
        status = request.args.get('status')
        search = request.args.get('search')
        
        query = Event.query
        if category and category != 'All':
            query = query.filter_by(category=category)
        if status and status != 'All':
            query = query.filter_by(status=status)
        if search:
            query = query.filter(
                (Event.title.ilike(f'%{search}%')) | 
                (Event.description.ilike(f'%{search}%')) |
                (Event.venue.ilike(f'%{search}%'))
            )

        # Filter events for heads if requested in dashboard view
        user = current_user()
        if request.args.get('mine') == 'true' and user and user.role == 'head':
            query = query.filter_by(head_id=user.id)

        events = query.order_by(Event.created_at.desc()).all()
        return jsonify([e.to_dict() for e in events])

    # POST - Admin only creates event
    user = current_user()
    if not user or user.role != 'admin':
        return jsonify({'error': 'Permission denied'}), 403

    data = request.get_json() or {}
    title = data.get('title', '').strip()
    category = data.get('category', '').strip()
    status = data.get('status', 'Open for Registration').strip()
    event_date = data.get('event_date', '').strip()
    event_time = data.get('event_time', '').strip()
    venue = data.get('venue', '').strip()
    participant_limit = int(data.get('participant_limit', 50))
    registration_deadline = data.get('registration_deadline', '').strip()
    head_id = data.get('head_id')
    image_data = data.get('image_data', '')
    description = data.get('description', '').strip()

    if not title or not category or not event_date or not venue or not description:
        return jsonify({'error': 'Missing required fields'}), 400

    if image_data and not validate_image_header(image_data):
        return jsonify({'error': 'Invalid image format. Allowed formats: JPG, PNG, GIF, WEBP'}), 400

    head_user = User.query.get(head_id) if head_id else None

    event = Event(
        title=title,
        category=category,
        status=status,
        event_date=event_date,
        event_time=event_time,
        venue=venue,
        participant_limit=participant_limit,
        registration_deadline=registration_deadline,
        head_id=head_user.id if head_user else None,
        image_data=image_data,
        description=description
    )
    db.session.add(event)
    db.session.commit()

    if head_user:
        notify_user(head_user.id, "Assigned as Event Head", f"You have been assigned as head for event '{title}'.")

    return jsonify(event.to_dict()), 201

@app.route('/api/events/<int:event_id>', methods=['GET', 'PUT', 'DELETE'])
def event_detail(event_id):
    event = Event.query.get_or_404(event_id)
    user = current_user()

    if request.method == 'GET':
        return jsonify(event.to_dict())

    if request.method == 'DELETE':
        if not user or user.role != 'admin':
            return jsonify({'error': 'Permission denied'}), 403
        db.session.delete(event)
        db.session.commit()
        return jsonify({'message': 'Event deleted successfully'})

    if request.method == 'PUT':
        if not user or user.role not in ['admin', 'head']:
            return jsonify({'error': 'Permission denied'}), 403
        if user.role == 'head' and event.head_id != user.id:
            return jsonify({'error': 'You can only update events assigned to you'}), 403

        data = request.get_json() or {}
        image_data = data.get('image_data')
        if image_data and not validate_image_header(image_data):
            return jsonify({'error': 'Invalid image format'}), 400

        old_head_id = event.head_id
        event.title = data.get('title', event.title).strip()
        event.category = data.get('category', event.category).strip()
        event.status = data.get('status', event.status).strip()
        event.event_date = data.get('event_date', event.event_date).strip()
        event.event_time = data.get('event_time', event.event_time).strip()
        event.venue = data.get('venue', event.venue).strip()
        event.participant_limit = int(data.get('participant_limit', event.participant_limit))
        event.registration_deadline = data.get('registration_deadline', event.registration_deadline).strip()
        if user.role == 'admin' and 'head_id' in data:
            event.head_id = data.get('head_id')
        if image_data is not None:
            event.image_data = image_data
        event.description = data.get('description', event.description).strip()

        db.session.commit()

        if user.role == 'admin' and event.head_id and event.head_id != old_head_id:
            notify_user(event.head_id, "Assigned as Event Head", f"You have been assigned as head for event '{event.title}'.")

        return jsonify(event.to_dict())

# 4. Event Registration & My Registrations
@app.route('/api/events/<int:event_id>/register', methods=['POST'])
@login_required
def register_for_event(event_id):
    user = current_user()
    
    # Row lock implementation to prevent race conditions & overbooking
    try:
        # Lock event row
        event = db.session.query(Event).with_for_update().get(event_id)
        if not event:
            return jsonify({'error': 'Event not found'}), 404

        if event.status != 'Open for Registration':
            return jsonify({'error': f'Registration is closed for this event (Status: {event.status})'}), 400

        # Check deadline
        if event.registration_deadline:
            try:
                deadline_dt = datetime.datetime.strptime(event.registration_deadline, '%Y-%m-%d')
                if datetime.datetime.now() > deadline_dt + datetime.timedelta(days=1):
                    return jsonify({'error': 'Registration deadline has passed'}), 400
            except ValueError:
                pass

        # Check existing
        existing = Registration.query.filter_by(event_id=event_id, email=user.email).first()
        if existing:
            return jsonify({'error': 'You are already registered for this event'}), 400

        # Count existing Pending + Approved seats
        active_regs = Registration.query.filter(
            Registration.event_id == event_id,
            Registration.status.in_(['Pending', 'Approved'])
        ).count()

        if active_regs >= event.participant_limit:
            return jsonify({'error': 'Event is full! No seats left'}), 400

        reg = Registration(
            event_id=event_id,
            user_id=user.id,
            participant_name=user.name,
            email=user.email,
            participant_type='Student',
            contact_number=user.contact_number,
            status='Pending'
        )
        db.session.add(reg)
        db.session.commit()

        # Notify user & Head
        notify_user(user.id, "Registration Submitted", f"Your registration for '{event.title}' is currently Pending.")
        if event.head_id:
            notify_user(event.head_id, "New Registration", f"{user.name} registered for '{event.title}'.")

        return jsonify({'message': 'Registration successful', 'registration': reg.to_dict()}), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Registration failed: {str(e)}'}), 500

@app.route('/api/my-registrations', methods=['GET'])
@login_required
def my_registrations():
    user = current_user()
    regs = Registration.query.filter_by(email=user.email).order_by(Registration.created_at.desc()).all()
    return jsonify([r.to_dict() for r in regs])

# 5. Participant Management & Ticket Verification
@app.route('/api/registrations', methods=['GET', 'POST'])
@login_required
@role_required(['admin', 'head'])
def list_or_add_registrations():
    user = current_user()

    if request.method == 'GET':
        event_id = request.args.get('event_id')
        status = request.args.get('status')
        search = request.args.get('search')

        query = Registration.query.join(Event)
        if user.role == 'head':
            query = query.filter(Event.head_id == user.id)

        if event_id:
            query = query.filter(Registration.event_id == event_id)
        if status and status != 'All':
            query = query.filter(Registration.status == status)
        if search:
            query = query.filter(
                (Registration.participant_name.ilike(f'%{search}%')) |
                (Registration.email.ilike(f'%{search}%'))
            )

        regs = query.order_by(Registration.created_at.desc()).all()
        return jsonify([r.to_dict() for r in regs])

    # POST - Head or Admin adds auto-approved guest/parent/teacher participant
    if request.method == 'POST':
        data = request.get_json() or {}
        event_id = data.get('event_id')
        name = data.get('participant_name', '').strip()
        email = data.get('email', '').strip().lower()
        participant_type = data.get('participant_type', 'Guest')
        contact = data.get('contact_number', '').strip()

        if not event_id or not name or not email:
            return jsonify({'error': 'Event, Name, and Email are required'}), 400

        event = Event.query.get(event_id)
        if not event:
            return jsonify({'error': 'Event not found'}), 404

        if user.role == 'head' and event.head_id != user.id:
            return jsonify({'error': 'Permission denied for this event'}), 403

        if Registration.query.filter_by(event_id=event_id, email=email).first():
            return jsonify({'error': 'Participant with this email is already registered'}), 400

        reg = Registration(
            event_id=event_id,
            participant_name=name,
            email=email,
            participant_type=participant_type,
            contact_number=contact,
            status='Approved'  # Auto-approved
        )
        db.session.add(reg)
        db.session.commit()

        notify_email(email, "Event Ticket Approved", f"You have been added to '{event.title}'. Your ticket code is {reg.ticket_code}.")
        return jsonify(reg.to_dict()), 201

@app.route('/api/registrations/<int:reg_id>', methods=['PATCH', 'DELETE'])
@login_required
def update_or_delete_registration(reg_id):
    reg = Registration.query.get_or_404(reg_id)
    user = current_user()
    event = reg.event

    # Cancel by Student
    if request.method == 'DELETE' and user.role == 'student':
        if reg.email != user.email:
            return jsonify({'error': 'Permission denied'}), 403
        if reg.attendance == 'Present':
            return jsonify({'error': 'Cannot cancel registration after check-in'}), 400
        if event.status == 'In Progress':
            return jsonify({'error': 'Cannot cancel registration while event is In Progress'}), 400

        db.session.delete(reg)
        db.session.commit()

        notify_user(user.id, "Registration Cancelled", f"Your registration for '{event.title}' was cancelled.")
        if event.head_id:
            notify_user(event.head_id, "Registration Cancelled", f"{user.name} cancelled their registration for '{event.title}'.")
        return jsonify({'message': 'Registration cancelled successfully'})

    # Head or Admin Operations
    if user.role not in ['admin', 'head']:
        return jsonify({'error': 'Permission denied'}), 403
    if user.role == 'head' and event.head_id != user.id:
        return jsonify({'error': 'Permission denied for this event'}), 403

    if request.method == 'DELETE':
        p_name = reg.participant_name
        p_email = reg.email
        db.session.delete(reg)
        db.session.commit()

        notify_email(p_email, "Registration Removed", f"Your registration for '{event.title}' was removed by the event head.")
        return jsonify({'message': f'Participant {p_name} removed successfully'})

    if request.method == 'PATCH':
        data = request.get_json() or {}
        new_status = data.get('status')
        new_attendance = data.get('attendance')

        if new_status and new_status != reg.status:
            reg.status = new_status
            notify_email(reg.email, f"Registration Status: {new_status}", f"Your registration status for '{event.title}' is now {new_status}.")

        if new_attendance:
            reg.attendance = new_attendance

        db.session.commit()
        return jsonify(reg.to_dict())

@app.route('/api/tickets/verify', methods=['POST'])
@login_required
@role_required(['admin', 'head'])
def verify_ticket():
    data = request.get_json() or {}
    ticket_code = data.get('ticket_code', '').strip()
    user = current_user()

    if not ticket_code:
        return jsonify({'error': 'Ticket code is required'}), 400

    reg = Registration.query.filter_by(ticket_code=ticket_code).first()
    if not reg:
        return jsonify({'error': 'Invalid ticket code'}), 444

    event = reg.event
    if user.role == 'head' and event.head_id != user.id:
        return jsonify({'error': 'You are not authorized to check-in participants for this event'}), 403

    if reg.status != 'Approved':
        return jsonify({'error': f'Cannot check-in. Registration status is {reg.status}'}), 400

    reg.attendance = 'Present'
    db.session.commit()

    return jsonify({
        'message': f'Check-in successful for {reg.participant_name} ({reg.participant_type})!',
        'registration': reg.to_dict()
    })

# 6. Notifications API
@app.route('/api/notifications', methods=['GET', 'PATCH'])
@login_required
def manage_notifications():
    user = current_user()
    if request.method == 'GET':
        notifs = Notification.query.filter_by(user_id=user.id).order_by(Notification.created_at.desc()).all()
        unread_count = Notification.query.filter_by(user_id=user.id, is_read=False).count()
        return jsonify({
            'notifications': [n.to_dict() for n in notifs],
            'unread_count': unread_count
        })

    if request.method == 'PATCH':
        Notification.query.filter_by(user_id=user.id, is_read=False).update({Notification.is_read: True})
        db.session.commit()
        return jsonify({'message': 'All notifications marked as read'})

# 7. Resources, Volunteers, Budget APIs
@app.route('/api/resources', methods=['GET', 'POST', 'DELETE'])
@login_required
@role_required(['admin', 'head'])
def manage_resources():
    user = current_user()
    if request.method == 'GET':
        event_id = request.args.get('event_id')
        query = Resource.query.join(Event)
        if user.role == 'head':
            query = query.filter(Event.head_id == user.id)
        if event_id:
            query = query.filter(Resource.event_id == event_id)
        return jsonify([r.to_dict() for r in query.all()])

    if request.method == 'POST':
        data = request.get_json() or {}
        event_id = data.get('event_id')
        item_name = data.get('item_name', '').strip()
        quantity = int(data.get('quantity', 1))
        status = data.get('status', 'Requested')

        if not event_id or not item_name:
            return jsonify({'error': 'Event and item name are required'}), 400

        res = Resource(event_id=event_id, item_name=item_name, quantity=quantity, status=status)
        db.session.add(res)
        db.session.commit()
        return jsonify(res.to_dict()), 201

    if request.method == 'DELETE':
        res_id = request.args.get('id')
        res = Resource.query.get_or_404(res_id)
        db.session.delete(res)
        db.session.commit()
        return jsonify({'message': 'Resource deleted'})

@app.route('/api/volunteers', methods=['GET', 'POST', 'DELETE'])
@login_required
@role_required(['admin', 'head'])
def manage_volunteers():
    user = current_user()
    if request.method == 'GET':
        event_id = request.args.get('event_id')
        query = Volunteer.query.join(Event)
        if user.role == 'head':
            query = query.filter(Event.head_id == user.id)
        if event_id:
            query = query.filter(Volunteer.event_id == event_id)
        return jsonify([v.to_dict() for v in query.all()])

    if request.method == 'POST':
        data = request.get_json() or {}
        event_id = data.get('event_id')
        name = data.get('name', '').strip()
        email = data.get('email', '').strip().lower()
        role_assigned = data.get('role_assigned', '').strip()

        if not event_id or not name or not role_assigned:
            return jsonify({'error': 'Event, Name, and Role are required'}), 400

        vol = Volunteer(event_id=event_id, name=name, email=email, role_assigned=role_assigned)
        db.session.add(vol)
        db.session.commit()
        return jsonify(vol.to_dict()), 201

    if request.method == 'DELETE':
        vol_id = request.args.get('id')
        vol = Volunteer.query.get_or_404(vol_id)
        db.session.delete(vol)
        db.session.commit()
        return jsonify({'message': 'Volunteer deleted'})

@app.route('/api/budget', methods=['GET', 'POST', 'DELETE'])
@login_required
@role_required(['admin', 'head'])
def manage_budget():
    user = current_user()
    if request.method == 'GET':
        event_id = request.args.get('event_id')
        query = BudgetItem.query.join(Event)
        if user.role == 'head':
            query = query.filter(Event.head_id == user.id)
        if event_id:
            query = query.filter(BudgetItem.event_id == event_id)
        return jsonify([b.to_dict() for b in query.all()])

    if request.method == 'POST':
        data = request.get_json() or {}
        event_id = data.get('event_id')
        category = data.get('category', 'Other')
        description = data.get('description', '').strip()
        amount = float(data.get('amount', 0.0))
        item_type = data.get('item_type', 'Expense')

        if not event_id or not description:
            return jsonify({'error': 'Event and description are required'}), 400

        item = BudgetItem(event_id=event_id, category=category, description=description, amount=amount, item_type=item_type)
        db.session.add(item)
        db.session.commit()
        return jsonify(item.to_dict()), 201

    if request.method == 'DELETE':
        b_id = request.args.get('id')
        item = BudgetItem.query.get_or_404(b_id)
        db.session.delete(item)
        db.session.commit()
        return jsonify({'message': 'Budget item deleted'})

# 8. Photos Gallery API
@app.route('/api/photos', methods=['GET', 'POST', 'DELETE'])
def manage_photos():
    if request.method == 'GET':
        photos = Photo.query.order_by(Photo.created_at.desc()).all()
        return jsonify([p.to_dict() for p in photos])

    user = current_user()
    if not user or user.role not in ['admin', 'head']:
        return jsonify({'error': 'Permission denied'}), 403

    if request.method == 'POST':
        data = request.get_json() or {}
        title = data.get('title', '').strip()
        image_data = data.get('image_data', '')
        event_id = data.get('event_id')

        if not title or not image_data:
            return jsonify({'error': 'Title and Image are required'}), 400

        if not validate_image_header(image_data):
            return jsonify({'error': 'Invalid photo image format'}), 400

        photo = Photo(
            title=title,
            image_data=image_data,
            event_id=event_id if event_id else None,
            uploader_name=user.name
        )
        db.session.add(photo)
        db.session.commit()
        return jsonify(photo.to_dict()), 201

    if request.method == 'DELETE':
        p_id = request.args.get('id')
        photo = Photo.query.get_or_404(p_id)
        db.session.delete(photo)
        db.session.commit()
        return jsonify({'message': 'Photo deleted'})

# 9. Contact API
@app.route('/api/contact', methods=['GET', 'POST'])
@limiter.limit("5 per minute")
def manage_contact():
    if request.method == 'POST':
        data = request.get_json() or {}
        name = data.get('name', '').strip()
        email = data.get('email', '').strip()
        subject = data.get('subject', '').strip()
        message = data.get('message', '').strip()

        if not name or not email or not message:
            return jsonify({'error': 'Name, email, and message are required'}), 400

        msg = ContactMessage(name=name, email=email, subject=subject, message=message)
        db.session.add(msg)
        db.session.commit()
        return jsonify({'message': 'Message sent successfully!'}), 201

    # GET - Admin only
    user = current_user()
    if not user or user.role != 'admin':
        return jsonify({'error': 'Permission denied'}), 403

    messages = ContactMessage.query.order_by(ContactMessage.created_at.desc()).all()
    return jsonify([m.to_dict() for m in messages])

# 10. Dashboard Stats & CSV Export
@app.route('/api/stats', methods=['GET'])
@login_required
@role_required(['admin', 'head'])
def get_stats():
    user = current_user()
    
    events_query = Event.query
    if user.role == 'head':
        events_query = events_query.filter_by(head_id=user.id)
    events = events_query.all()
    event_ids = [e.id for e in events]

    total_events = len(events)
    total_regs = Registration.query.filter(Registration.event_id.in_(event_ids)).count() if event_ids else 0
    pending_regs = Registration.query.filter(Registration.event_id.in_(event_ids), Registration.status == 'Pending').count() if event_ids else 0
    present_regs = Registration.query.filter(Registration.event_id.in_(event_ids), Registration.attendance == 'Present').count() if event_ids else 0

    budget_items = BudgetItem.query.filter(BudgetItem.event_id.in_(event_ids)).all() if event_ids else []
    total_expenses = sum(b.amount for b in budget_items if b.item_type == 'Expense')
    total_income = sum(b.amount for b in budget_items if b.item_type == 'Income')

    return jsonify({
        'total_events': total_events,
        'total_registrations': total_regs,
        'pending_registrations': pending_regs,
        'marked_present': present_regs,
        'total_expenses': total_expenses,
        'total_income': total_income,
        'net_budget': total_income - total_expenses
    })

@app.route('/api/reports/<report_type>', methods=['GET'])
@login_required
@role_required(['admin', 'head'])
def export_csv_report(report_type):
    user = current_user()
    event_id = request.args.get('event_id')

    output = io.StringIO()
    writer = csv.writer(output)

    if report_type == 'participants' or report_type == 'registrations':
        writer.writerow(['ID', 'Event Title', 'Participant Name', 'Email', 'Type', 'Contact', 'Status', 'Attendance', 'Ticket Code', 'Date'])
        query = Registration.query.join(Event)
        if user.role == 'head':
            query = query.filter(Event.head_id == user.id)
        if event_id:
            query = query.filter(Registration.event_id == event_id)

        for r in query.all():
            writer.writerow([
                sanitize_csv_field(r.id),
                sanitize_csv_field(r.event.title if r.event else ''),
                sanitize_csv_field(r.participant_name),
                sanitize_csv_field(r.email),
                sanitize_csv_field(r.participant_type),
                sanitize_csv_field(r.contact_number),
                sanitize_csv_field(r.status),
                sanitize_csv_field(r.attendance),
                sanitize_csv_field(r.ticket_code),
                sanitize_csv_field(r.created_at)
            ])

    elif report_type == 'events':
        writer.writerow(['ID', 'Title', 'Category', 'Status', 'Date', 'Time', 'Venue', 'Capacity', 'Head Name', 'Description'])
        query = Event.query
        if user.role == 'head':
            query = query.filter_by(head_id=user.id)

        for e in query.all():
            writer.writerow([
                sanitize_csv_field(e.id),
                sanitize_csv_field(e.title),
                sanitize_csv_field(e.category),
                sanitize_csv_field(e.status),
                sanitize_csv_field(e.event_date),
                sanitize_csv_field(e.event_time),
                sanitize_csv_field(e.venue),
                sanitize_csv_field(e.participant_limit),
                sanitize_csv_field(e.head.name if e.head else 'Unassigned'),
                sanitize_csv_field(e.description)
            ])

    elif report_type == 'budget':
        writer.writerow(['ID', 'Event Title', 'Category', 'Description', 'Type', 'Amount', 'Date'])
        query = BudgetItem.query.join(Event)
        if user.role == 'head':
            query = query.filter(Event.head_id == user.id)
        if event_id:
            query = query.filter(BudgetItem.event_id == event_id)

        for b in query.all():
            writer.writerow([
                sanitize_csv_field(b.id),
                sanitize_csv_field(b.event.title if b.event else ''),
                sanitize_csv_field(b.category),
                sanitize_csv_field(b.description),
                sanitize_csv_field(b.item_type),
                sanitize_csv_field(b.amount),
                sanitize_csv_field(b.created_at)
            ])

    else:
        return jsonify({'error': 'Invalid report type'}), 400

    output.seek(0)
    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": f"attachment;filename=eventschool_{report_type}_report.csv"}
    )

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)