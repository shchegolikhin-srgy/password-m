from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
import psycopg2
from psycopg2.extras import RealDictCursor
import bcrypt
import uuid
from datetime import datetime, timedelta
import os

app = Flask(__name__)
CORS(app)
app.config['JWT_SECRET_KEY'] = 'your-secret-key-change-this-in-production'
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=24)
jwt = JWTManager(app)
def get_db_connection():
    conn = psycopg2.connect(
        host="postgres",
        port=5432,
        user="postgres",
        password="mysecretpassword",
        dbname="password_manager"
    )
    return conn
@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.get_json()
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')
    if not username or not email or not password:
        return jsonify({'error': 'Username, email, and password are required'}), 400 
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT COUNT(*) FROM users WHERE username = %s OR email = %s", (username, email))
        count = cursor.fetchone()[0]
        if count > 0:
            return jsonify({'error': 'Username or email already exists'}), 409
        hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        user_id = str(uuid.uuid4())
        cursor.execute(
            "INSERT INTO users (id, username, email, password_hash, is_active) VALUES (%s, %s, %s, %s, %s)",
            (user_id, username, email, hashed_password, True)
        )
        conn.commit()
        access_token = create_access_token(identity=user_id)
        return jsonify({
            'token': access_token,
            'user': {
                'id': user_id,
                'username': username,
                'email': email,
                'is_active': True
            },
            'message': 'Registration successful'
        }), 201 
    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        cursor.close()
        conn.close()
@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    if not username or not password:
        return jsonify({'error': 'Username and password are required'}), 400
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cursor.execute(
            "SELECT id, username, email, password_hash, is_active FROM users WHERE username = %s",
            (username,)
        )
        user = cursor.fetchone()
        if not user:
            return jsonify({'error': 'Invalid credentials'}), 401  
        if not user['is_active']:
            return jsonify({'error': 'Account is deactivated'}), 401
        if not bcrypt.checkpw(password.encode('utf-8'), user['password_hash'].encode('utf-8')):
            return jsonify({'error': 'Invalid credentials'}), 401
        access_token = create_access_token(identity=str(user['id']))
        
        return jsonify({
            'access_token': access_token,
            'user': {
                'id': str(user['id']),
                'username': user['username'],
                'email': user['email'],
                'is_active': user['is_active']
            },
            'message': 'Login successful'
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        cursor.close()
        conn.close()
@app.route('/api/passwords', methods=['GET'])
@jwt_required()
def get_passwords():
    current_user_id = get_jwt_identity()
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cursor.execute(
            "SELECT id, service, username, password FROM passwords WHERE user_id = %s ORDER BY created_at DESC",
            (current_user_id,)
        )
        passwords = cursor.fetchall()
        return jsonify([dict(row) for row in passwords]), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        cursor.close()
        conn.close()
@app.route('/api/passwords', methods=['POST'])
@jwt_required()
def create_password():
    current_user_id = get_jwt_identity()
    data = request.get_json()
    service = data.get('service')
    username = data.get('username')
    password = data.get('password')
    
    if not service or not username or not password:
        return jsonify({'error': 'Service, username, and password are required'}), 400
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT INTO passwords (user_id, service, username, password) VALUES (%s, %s, %s, %s) RETURNING id",
            (current_user_id, service, username, password)
        )
        password_id = cursor.fetchone()[0]
        conn.commit()
        
        return jsonify({
            'id': password_id,
            'service': service,
            'username': username,
            'password': password
        }), 201

    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        cursor.close()
        conn.close()
@app.route('/api/passwords/<int:password_id>', methods=['DELETE'])
@jwt_required()
def delete_password(password_id):
    current_user_id = get_jwt_identity()
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "DELETE FROM passwords WHERE id = %s AND user_id = %s",
            (password_id, current_user_id)
        )
        conn.commit()
        if cursor.rowcount == 0:
            return jsonify({'error': 'Password entry not found or not owned by user'}), 404
        return '', 204
    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        cursor.close()
        conn.close()
@app.route('/')
def index():
    return send_from_directory('static', 'index.html')
@app.route('/css/<path:filename>')
def css(filename):
    return send_from_directory('static/css', filename)
@app.route('/js/<path:filename>')
def js(filename):
    return send_from_directory('static/js', filename)
if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=8080)