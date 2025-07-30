# Gmail Email Checker

A modern, full-stack Gmail email validation tool with real-time progress tracking and beautiful UI.

## Features

- **Gmail-Only Filtering**: Only processes emails from Gmail domains (@gmail.com)
- **Catch-All Detection**: Detects if the domain uses catch-all email handling
- **Multithreaded Processing**: Uses multiple threads for efficient email checking
- **Real-Time Progress**: Live progress updates via WebSockets
- **Categorized Results**: Displays results in three categories (Valid, Bounced, Error)
- **Excel Downloads**: Download results as .xlsx files for each category
- **Dark Mode**: Toggle between light and dark themes
- **Modern UI**: Beautiful, responsive interface with animations

## Tech Stack

### Frontend
- React 18 with TypeScript
- Tailwind CSS for styling
- Socket.IO client for real-time updates
- Lucide React for icons
- Vite for development

### Backend
- Python Flask
- Flask-SocketIO for WebSocket communication
- Threading for concurrent email checking
- pandas & openpyxl for Excel export
- dnspython for DNS lookups

## Setup Instructions

### Backend Setup

1. **Install Python dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Run the Flask server:**
   ```bash
   python app.py
   ```
   The backend will run on `http://localhost:5000`

### Frontend Setup

1. **Install Node.js dependencies:**
   ```bash
   npm install
   ```

2. **Start the development server:**
   ```bash
   npm run dev
   ```
   The frontend will run on `http://localhost:5173`

## Usage

1. **Upload Email List**: Drag and drop or select a .txt file with one email per line
2. **Start Processing**: Click "Start Checking" to begin validation
3. **Monitor Progress**: Watch real-time progress and statistics
4. **View Results**: Results are categorized into Valid, Bounced, and Error tabs
5. **Download Results**: Export results as Excel files for each category

## Email Validation Process

1. **Domain Check**: Verifies the email is from Gmail (@gmail.com)
2. **Format Validation**: Checks basic email format
3. **MX Record Lookup**: Finds mail server for the domain
4. **SMTP Verification**: Connects to mail server to verify email existence
5. **Catch-All Detection**: Tests for catch-all email handling
6. **Retry Logic**: Implements exponential backoff for failed connections

## API Endpoints

- `POST /api/upload` - Upload email file for processing
- `GET /api/download/<category>` - Download results (valid/bounced/error)
- `GET /api/status` - Get current processing status
- `GET /api/results/<category>` - Get results for specific category

## WebSocket Events

- `progress` - Real-time progress updates
- `result` - Individual email validation results
- `processing_complete` - Notification when processing finishes

## File Structure

```
├── app.py                 # Flask backend server
├── requirements.txt       # Python dependencies
├── src/
│   ├── App.tsx           # Main React component
│   ├── hooks/
│   │   └── useSocket.ts  # Socket.IO hook
│   └── ...
├── downloads/            # Generated Excel files
└── README.md
```

## Configuration

### Backend Configuration
- `MAX_RETRIES`: Number of retry attempts (default: 3)
- `TIMEOUT`: SMTP connection timeout (default: 10 seconds)
- `ThreadPoolExecutor`: Max workers for concurrent processing (default: 5)

### Frontend Configuration
- Socket.IO server URL: `http://localhost:5000`
- File upload endpoint: `/api/upload`
- Download endpoint: `/api/download/<category>`

## Error Handling

The application handles various error scenarios:
- Invalid email formats
- DNS lookup failures
- SMTP connection timeouts
- Server disconnections
- File upload errors

## Security Considerations

- Only processes Gmail addresses for security
- Implements rate limiting through threading controls
- Uses proper SMTP etiquette with delays
- Validates file uploads and email formats

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is for educational purposes. Please use responsibly and in accordance with email service provider terms of service.