from flask import Flask, request, jsonify, send_from_directory, url_for, make_response
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask_cors import CORS
import os
import time
from dotenv import load_dotenv
from openai import AzureOpenAI
from werkzeug.utils import secure_filename
import traceback
from flask_pymongo import PyMongo  
from datetime import datetime, timedelta
import json
from tenacity import retry, stop_after_attempt, wait_fixed
from app import create_app
import requests
import jwt

app = create_app()
CORS(app, resources={r"/*": {"origins": "*"}})
socketio = SocketIO(app, cors_allowed_origins="*")

load_dotenv()

app.config['UPLOAD_FOLDER'] = os.path.join(os.getcwd(), 'uploads')
if not os.path.exists(app.config['UPLOAD_FOLDER']):
    os.makedirs(app.config['UPLOAD_FOLDER'])

app.config["MONGO_URI"] = os.getenv("MONGO_URI")

client = AzureOpenAI(
    azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
    api_key=os.getenv("AZURE_OPENAI_API_KEY"),
    api_version="2024-05-01-preview"
)

mongo = PyMongo(app)

agent_collection = mongo.db.agents

threads = {}

@retry(stop=stop_after_attempt(3), wait=wait_fixed(2))
def execute_run(thread_id, run_id):
    run = client.beta.threads.runs.retrieve(
        thread_id=thread_id,
        run_id=run_id
    )
    
    while run.status in ['queued', 'in_progress', 'requires_action']:
        if run.status == 'requires_action':
            tool_calls = run.required_action.submit_tool_outputs.tool_calls
            tool_outputs = []
            for tool_call in tool_calls:
                if tool_call.function.name == "connect_to_an_agent":
                    # Implement the logic to connect to an agent
                    threads[thread_id]['agent_required'] = True
                    agent_message = {
                        'role': 'system',
                        'content': 'Connecting you to an agent...',
                        'isAgentConnectedMessage': True
                    }
                    threads[thread_id]['messages'].append(agent_message)
                    socketio.emit('new_message', {'thread_id': thread_id, 'message': agent_message}, room=thread_id)
                    socketio.emit('agent_required', {'thread_id': thread_id})
                    tool_outputs.append({
                        "tool_call_id": tool_call.id,
                        "output": json.dumps({"success": True, "message": "Connected to agent"})
                    })
                
            if tool_outputs:
                run = client.beta.threads.runs.submit_tool_outputs(
                    thread_id=thread_id,
                    run_id=run.id,
                    tool_outputs=tool_outputs
                )
            else:
                break
        
        time.sleep(1)
        run = client.beta.threads.runs.retrieve(
            thread_id=thread_id,
            run_id=run.id
        )

    if run.status == 'failed':
        raise Exception(f"Run failed with status: {run.status}")
    
    return run

@app.route('/new_thread', methods=['POST'])
def new_thread():
    try:
        thread = client.beta.threads.create()
        threads[thread.id] = {
            'messages': [],
            'agent_required': False,
            'status': 'in_progress',  # Changed from 'open' to 'in_progress'
            'created_at': datetime.now().isoformat(),
            'last_activity': datetime.now().isoformat()
        }
        return jsonify({'thread_id': thread.id})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/agent/add', methods=['POST'])
def add_agent():
    name = request.json.get('name')
    email = request.json.get('email')

    if not name or not email:
        return jsonify({'error': 'Missing name or email'}), 400

    agent = agent_collection.find_one({'email': email})
    if agent:
        return jsonify({'error': 'Agent already exists'}), 400

    # Insert the new agent into MongoDB
    agent_collection.insert_one({
        'name': name,
        'email': email,
    })
    return jsonify({'success': True})

@app.route('/api/auth/google', methods=['POST'])
def google_login():
    token = request.json.get('token')

    if not token:
        return jsonify({'error': 'Missing token'}), 400
    
    google_response = requests.get(f'https://oauth2.googleapis.com/tokeninfo?id_token={token}')

    if google_response.status_code != 200:
        return jsonify({'error': 'Invalid token'}), 400
    

    google_data = google_response.json()

    email = google_data.get('email')
    name = google_data.get('name')

    if not email or not name:
        return jsonify({"error": "Invalid token"}), 400
    
    agent = agent_collection.find_one({'email': email})

    if not agent:
        return jsonify({'error': 'Agent not found'}), 404
    
    payload = {
        "user_id": str(agent['_id']),
        "email": email,
        "name": name,
        "exp": datetime.utcnow() + timedelta(days=1)
    }

    jwt_token = jwt.encode(payload, os.getenv('JWT_SECRET'), algorithm='HS256')

    response = make_response(jsonify({'success': True, "token": jwt_token, "user": {
        "name": agent['name'],
        "email": agent['email']
    }}))
    
    response.set_cookie('access_token', jwt_token, httponly=True, samesite="None", secure=True)

    return response


@app.route('/ask', methods=['POST'])
def ask_question():
    try:
        thread_id = request.form.get('thread_id')
        question = request.form.get('question')
        file = request.files.get('file')
        
        if not thread_id or not question:
            return jsonify({'error': 'Missing thread_id or question'}), 400
        
        if thread_id not in threads:
            return jsonify({'error': 'Invalid thread ID'}), 400

        file_url = None
        if file:
            filename = secure_filename(file.filename)
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            file.save(file_path)
            file_url = url_for('uploaded_file', filename=filename, _external=True)

        user_message = {'role': 'user', 'content': question, 'file': file_url}
        threads[thread_id]['messages'].append(user_message)
        threads[thread_id]['last_activity'] = datetime.now().isoformat()
        
        socketio.emit('new_message', {'thread_id': thread_id, 'message': user_message}, room=thread_id)

        if threads[thread_id].get('agent_required'):
            return jsonify({'success': True, 'agent_connected': True})

        client.beta.threads.messages.create(
            thread_id=thread_id,
            role="user",
            content=question
        )

        run = client.beta.threads.runs.create(
            thread_id=thread_id,
            assistant_id=os.getenv("AZURE_OPENAI_ASSISTANT_ID")
        )

        try:
            run = execute_run(thread_id, run.id)
        except Exception as e:
            app.logger.error(f"Run failed after retries: {str(e)}")
            return jsonify({'error': str(e)}), 500

        if run.status == 'completed':
            messages = client.beta.threads.messages.list(thread_id=thread_id)
        
            for message in messages.data:
                if message.role == 'assistant':
                    response = message.content[0].text.value
                    new_message = {'role': 'assistant', 'content': response}
                    print(new_message)
                    threads[thread_id]['messages'].append(new_message)
                    socketio.emit('new_message', {'thread_id': thread_id, 'message': new_message}, room=thread_id)
                    
                    return jsonify({'response': response, 'file': file_url, 'agent_connected': threads[thread_id].get('agent_required', False)})
            
            app.logger.error(f"No assistant message found in the response")
            return jsonify({'error': 'No response from assistant'}), 500
        else:
            app.logger.error(f"Run failed with status: {run.status}")
            app.logger.error(f"Run details: {run}")
            return jsonify({'error': f"Run failed with status: {run.status}"}), 500

    except Exception as e:
        app.logger.error(f"Error in ask_question: {str(e)}")
        app.logger.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@app.route('/get_chats', methods=['GET'])
def get_chats():
    chat_list = [
        {
            'thread_id': thread_id,
            'status': thread['status'],
            'created_at': thread['created_at'],
            'last_activity': thread['last_activity'],
            'last_message': thread['messages'][-1]['content'] if thread['messages'] else '',
            'agent_required': thread['agent_required'],
            'was_reopened': thread.get('was_reopened', False),
            'resolved_at': thread.get('resolved_at')
        }
        for thread_id, thread in threads.items()
    ]
    chat_list.sort(key=lambda x: x['last_activity'], reverse=True)
    return jsonify({'chats': chat_list})

@app.route('/get_agent_chats', methods=['GET'])
def get_agent_chats():
    agent_chat_list = [
        {
            'thread_id': thread_id,
            'status': thread['status'],
            'created_at': thread['created_at'],
            'last_activity': thread['last_activity'],
            'messages': thread['messages'],
            'agent_required': thread['agent_required'],
            'was_reopened': thread.get('was_reopened', False)
        }
        for thread_id, thread in threads.items()
        if thread['agent_required']
    ]
    agent_chat_list.sort(key=lambda x: x['last_activity'], reverse=True)
    return jsonify({'chats': agent_chat_list})

@app.route('/connect_agent', methods=['POST'])
def connect_agent():
    data = request.get_json()
    thread_id = data.get('thread_id')
    agent_name = data.get('agent_name', 'Agent')
    
    if thread_id not in threads:
        return jsonify({'error': 'Invalid thread ID'}), 400
    
    threads[thread_id]['agent_required'] = True
    
    agent_connected_message = {
        'role': 'system',
        'content': f'You\'ve been connected to {agent_name}. They will respond shortly.',
        'isAgentConnectedMessage': True
    }
    threads[thread_id]['messages'].append(agent_connected_message)
    
    socketio.emit('agent_connected', {'thread_id': thread_id, 'agent_name': agent_name}, room=thread_id)
    socketio.emit('agent_required', {'thread_id': thread_id})
    return jsonify({'success': True})

@app.route('/get_chat_messages/<thread_id>', methods=['GET'])
def get_chat_messages(thread_id):
    if thread_id not in threads:
        return jsonify({'error': 'Invalid thread ID'}), 400
    
    return jsonify({'messages': threads[thread_id]['messages'], 'status': threads[thread_id]['status']})

@app.route('/resolve_chat', methods=['POST'])
def resolve_chat():
    data = request.get_json()
    thread_id = data.get('thread_id')
    
    if thread_id not in threads:
        return jsonify({'error': 'Invalid thread ID'}), 400
    
    threads[thread_id]['status'] = 'resolved'
    threads[thread_id]['resolved_at'] = datetime.now().isoformat()
    # Keep the was_reopened flag if it was reopened before
    threads[thread_id]['was_reopened'] = threads[thread_id].get('was_reopened', False)
    socketio.emit('chat_resolved', {'thread_id': thread_id}, room=thread_id)
    return jsonify({'success': True})

@app.route('/reopen_chat', methods=['POST'])
def reopen_chat():
    data = request.get_json()
    thread_id = data.get('thread_id')
    
    if thread_id not in threads:
        return jsonify({'error': 'Invalid thread ID'}), 400
    
    threads[thread_id]['status'] = 'in_progress'
    threads[thread_id]['was_reopened'] = True
    threads[thread_id]['agent_required'] = True  # Add this line
    threads[thread_id]['last_activity'] = datetime.now().isoformat()
    socketio.emit('chat_reopened', {'thread_id': thread_id}, room=thread_id)
    return jsonify({'success': True})

@app.route('/send_agent_message', methods=['POST'])
def send_agent_message():
    thread_id = request.form.get('thread_id')
    message = request.form.get('message')
    file = request.files.get('file')
    
    if thread_id not in threads:
        return jsonify({'error': 'Invalid thread ID'}), 400
    
    file_url = None
    if file:
        filename = secure_filename(file.filename)
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(file_path)
        file_url = url_for('uploaded_file', filename=filename, _external=True)
    
    new_message = {'role': 'agent', 'content': message, 'file': file_url}
    threads[thread_id]['messages'].append(new_message)
    threads[thread_id]['last_activity'] = datetime.now().isoformat()
    
    socketio.emit('new_message', {'thread_id': thread_id, 'message': new_message}, room=thread_id)
    
    return jsonify({'success': True})

@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@socketio.on('join')
def on_join(data):
    room = data['thread_id']
    join_room(room)
    # Send the latest messages to the client when they join a room
    if room in threads:
        emit('chat_history', {'messages': threads[room]['messages']})
    
@socketio.on('leave')
def on_leave(data):
    room = data['thread_id']
    leave_room(room)

if __name__ == '__main__':
    socketio.run(app, debug=True)