import re
import socket
import eventlet
eventlet.monkey_patch()

from concurrent.futures import ThreadPoolExecutor
from openpyxl import Workbook
from flask_cors import CORS
from flask_socketio import SocketIO, emit
from flask import Flask, render_template, request, send_file, jsonify
from email.utils import parseaddr
import pandas as pd
import threading
import os
import smtplib
import dns.resolver
import time


app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key-here'
CORS(app, origins="*")  # Allow React dev server
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

# Global variables to store results
results = []
valid_emails = []
bounced_emails = []
error_emails = []
processing_stats = {
    'total': 0,
    'current': 0,
    'valid_count': 0,
    'bounced_count': 0,
    'error_count': 0,
    'current_email': '',
    'is_processing': False
}

MAX_RETRIES = 3
INITIAL_WAIT_TIME = 2
BACKOFF_BASE = 1.5
TIMEOUT = 10

# Gmail-only validation
ALLOWED_DOMAINS = ['gmail.com']


def clean_email(email):
    # Remove BOM if present
    if email.startswith('\ufeff'):
        email = email[1:]
    # Strip whitespace just in case
    return email.strip()


def is_valid_email(email):
    email = clean_email(email)
    pattern = r"(^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*$)"
    return re.match(pattern, email) is not None


def get_mx_host(domain):
    """Get MX record for domain"""
    try:
        answers = dns.resolver.resolve(domain, 'MX')
        mx_records = sorted(answers, key=lambda x: x.preference)
        return str(mx_records[0].exchange).rstrip('.')
    except Exception as e:
        print(f"MX lookup failed for {domain}: {e}")
        return None


def check_catch_all(domain, mx_host):
    """Check if domain has catch-all email handling"""
    try:
        # Test with a random email that shouldn't exist
        test_email = f"nonexistent{int(time.time())}@{domain}"
        server = smtplib.SMTP(mx_host, 25, timeout=TIMEOUT)
        server.helo('test.com')
        server.mail('test@test.com')
        code, message = server.rcpt(test_email)
        server.quit()

        # If random email is accepted, it's likely catch-all
        return code in [250, 251]
    except:
        return False


def check_email_smtp(email):
    """Check email via SMTP connection"""
    domain = email.split('@')[-1].lower()

    # Only process Gmail emails
    if domain not in ALLOWED_DOMAINS:
        return 'error', f"❌ Not a Gmail address (domain: {domain})"

    # Basic format validation
    if not is_valid_email(email):
        return 'error', "❌ Invalid email format"

    # Get MX record
    mx_host = get_mx_host(domain)
    if not mx_host:
        return 'error', "⚠️ No MX record found"

    # Skip catch-all to avoid inconsistency
    is_catch_all = False

    # Attempt SMTP verification with retries
    for attempt in range(MAX_RETRIES):
        try:
            server = smtplib.SMTP(mx_host, 25, timeout=TIMEOUT)
            server.helo('emailchecker.com')
            server.mail('noreply@emailchecker.com')
            code, message = server.rcpt(email)
            server.quit()

            if code == 250:
                status_msg = "✅ Valid Gmail address"
                if is_catch_all:
                    status_msg += " (Catch-all detected)"
                return 'valid', status_msg
            elif code == 251:
                return 'valid', "✅ Valid (forwarded)"
            elif code in [550, 551, 553]:
                return 'bounced', f"❌ Email bounced (Code: {code})"
            elif code in [450, 451, 452]:
                return 'error', f"⚠️ Temporary failure (Code: {code})"
            else:
                return 'bounced', f"❌ Rejected (Code: {code})"

        except smtplib.SMTPConnectError:
            error_msg = "⚠️ Connection failed"
        except (smtplib.SMTPServerDisconnected, socket.timeout, TimeoutError) as e:
            error_msg = "⚠️ Connection timeout"
        except smtplib.SMTPServerDisconnected:
            error_msg = "⚠️ Server disconnected"
        except Exception as e:
            error_msg = f"⚠️ Error: {str(e)[:50]}"

        # Retry with exponential backoff
        if attempt < MAX_RETRIES - 1:
            wait_time = INITIAL_WAIT_TIME * (BACKOFF_BASE ** attempt)
            time.sleep(wait_time)
        else:
            return 'error', error_msg


def check_single_email(email, index, total):
    """Check a single email and emit results"""
    global processing_stats

    # Update current processing info
    processing_stats['current'] = index + 1
    processing_stats['current_email'] = email

    # Emit progress update
    with threading.Lock():
        socketio.emit('progress', {
            'current': processing_stats['current'],
            'total': processing_stats['total'],
            'currentEmail': email,
            'percentage': round((processing_stats['current'] / processing_stats['total']) * 100, 1)
        })

    # Check the email
    status, message = check_email_smtp(email)

    # Store result
    result = {
        'email': email,
        'status': status,
        'message': message,
        'timestamp': time.time()
    }

    # Add to appropriate list
    if status == 'valid':
        valid_emails.append(result)
        processing_stats['valid_count'] += 1
    elif status == 'bounced':
        bounced_emails.append(result)
        processing_stats['bounced_count'] += 1
    else:
        error_emails.append(result)
        processing_stats['error_count'] += 1

    # Emit result to frontend
    with threading.Lock():
        socketio.emit('result', result)

    # Small delay to prevent overwhelming the server
    time.sleep(0.1)


def process_emails_threaded(emails):
    """Process emails using thread pool"""
    global processing_stats

    processing_stats['is_processing'] = True
    processing_stats['total'] = len(emails)
    processing_stats['current'] = 0
    processing_stats['valid_count'] = 0
    processing_stats['bounced_count'] = 0
    processing_stats['error_count'] = 0

    # This ensures that the memory is cleared even if multiple threads are used — preventing cross-run pollution.
    with threading.Lock():
        valid_emails[:] = []
        bounced_emails[:] = []
        error_emails[:] = []

    # Use ThreadPoolExecutor for concurrent processing
    # Reduced workers to be respectful
    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = []
        for index, email in enumerate(emails):
            future = executor.submit(
                check_single_email, email, index, len(emails))
            futures.append(future)

        # Wait for all threads to complete
        for future in futures:
            future.result()

    processing_stats['is_processing'] = False
    processing_stats['current_email'] = 'Completed!'

    # Emit completion
    socketio.emit('processing_complete', {
        'total_processed': len(emails),
        'valid_count': processing_stats['valid_count'],
        'bounced_count': processing_stats['bounced_count'],
        'error_count': processing_stats['error_count']
    })
    
    print("✅ Final counts:")
    print("Total processed:", len(emails))
    print("Valid:", processing_stats['valid_count'])
    print("Bounced:", processing_stats['bounced_count'])
    print("Error:", processing_stats['error_count'])
    print("Sum:", processing_stats['valid_count'] + processing_stats['bounced_count'] + processing_stats['error_count'])


@app.route('/')
def index():
    """Serve the main page"""
    return jsonify({"message": "Gmail Email Checker API is running"})


@app.route('/api/upload', methods=['POST'])
def upload_emails():
    """Handle email file upload"""
    try:
        if 'email_file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400

        file = request.files['email_file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400

        # Read and process emails
        content = file.read().decode('utf-8')

        emails = re.split(r'[\r\n]+', content)
        
        if not emails:
            return jsonify({'error': 'No emails found in file'}), 400

        emails = [clean_email(email) for email in emails if email]

        # Remove duplicates while preserving order
        unique_emails = list(dict.fromkeys(emails))
        
        # Save number of duplicates removed
        duplicates_removed = len(emails) - len(unique_emails)

        # Start processing in background
        socketio.start_background_task(
            target=process_emails_threaded, emails=unique_emails)

        return jsonify({
            'message': 'Processing started',
            'total_emails': len(unique_emails),
            'unique_emails': len(unique_emails),
            'original_uploaded': len(emails),
            'duplicates_removed': duplicates_removed
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/download/<category>')
def download_results(category):
    """Download results as plain .txt file containing only emails"""
    try:
        if category == 'valid':
            data = valid_emails
            filename = 'valid_gmail_emails.txt'
        elif category == 'bounced':
            data = bounced_emails
            filename = 'bounced_gmail_emails.txt'
        elif category == 'error':
            data = error_emails
            filename = 'error_gmail_emails.txt'
        else:
            return jsonify({'error': 'Invalid category'}), 400

        if not data:
            return jsonify({'error': f'No {category} emails to download'}), 400

        # Extract emails only
        email_lines = [item['email'] for item in data]
        content = '\n'.join(email_lines)

        # Write to .txt file
        filepath = os.path.join('downloads', filename)
        os.makedirs('downloads', exist_ok=True)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)

        return send_file(filepath, as_attachment=True, download_name=filename)

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/status')
def get_status():
    """Get current processing status"""
    return jsonify(processing_stats)

@app.route('/api/results/<category>')
def get_results(category):
    """Get results for a specific category"""
    if category == 'valid':
        data = valid_emails
    elif category == 'bounced':
        data = bounced_emails
    elif category == 'error':
        data = error_emails
    else:
        return jsonify({'error': 'Invalid category'}), 400
    
    return jsonify(data)

@socketio.on('connect')
def handle_connect():
    """Handle client connection"""
    print('Client connected')
    emit('connected', {'message': 'Connected to Gmail Email Checker'})

@socketio.on('disconnect')
def handle_disconnect():
    """Handle client disconnection"""
    print('Client disconnected')

if __name__ == '__main__':
    # Create downloads directory
    os.makedirs('downloads', exist_ok=True)
    
    import eventlet
    import eventlet.wsgi
    eventlet.monkey_patch()
    
    print("Starting Gmail Email Checker Server...")
    print("Frontend should be running on http://localhost:5173")
    print("Backend API running on http://localhost:5000")
    
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)
