# Text Detection Camera Web App

A real-time camera-based text detection application that monitors video feed for specific target phrases and triggers an alarm when detected.

## Features

- 📹 **Real-time Camera Access**: Uses native browser APIs to access device camera
- 🔍 **Text Recognition**: Powered by Tesseract.js for OCR (Optical Character Recognition)
- 🚨 **Alarm System**: Visual and audio alerts when target phrases are detected
- ⚙️ **Configurable Settings**: Adjustable confidence threshold and detection interval
- 📱 **Responsive Design**: Works on desktop and mobile devices
- 🎨 **Modern UI**: Clean, professional interface with real-time status updates

## Target Phrases

The application is configured to detect these specific phrases:
- "secret"
- "brainrot god"

## How It Works

1. **Camera Access**: Requests permission to access the device camera
2. **Video Processing**: Captures frames from the video stream at regular intervals
3. **Text Recognition**: Uses Tesseract.js to extract text from each frame
4. **Pattern Matching**: Checks if any target phrases are present in the detected text
5. **Alarm Trigger**: Plays an audio alarm and shows a visual alert when matches are found

## Browser Compatibility

- Chrome 66+
- Firefox 60+
- Safari 11+
- Edge 79+

**Note**: Requires HTTPS for camera access in production environments.

## Getting Started

### Prerequisites

- A modern web browser with camera support
- Camera permission granted to the website

### Installation

1. Clone or download this repository
2. Open `index.html` in your web browser
3. Click "Start Camera" to begin

### Local Development

For local development, you can use any static file server:

```bash
# Using Python 3
python -m http.server 8000

# Using Node.js (if you have http-server installed)
npx http-server

# Using PHP
php -S localhost:8000
```

Then navigate to `http://localhost:8000` in your browser.

## Usage

1. **Start Camera**: Click the "Start Camera" button to begin video capture
2. **Monitor Detection**: Watch the detection log for real-time text recognition results
3. **Adjust Settings**: 
   - **Confidence Threshold**: Adjust the sensitivity of text detection (0.1-1.0)
   - **Detection Interval**: Set how frequently to analyze frames (100-2000ms)
4. **Alarm Response**: When target phrases are detected:
   - An audio alarm will play
   - A visual alert overlay will appear
   - The detected text area will be highlighted on the video
   - The alarm will auto-dismiss after 10 seconds

## Technical Details

### Technologies Used

- **HTML5**: Structure and video elements
- **CSS3**: Styling and animations
- **JavaScript (ES6+)**: Core functionality
- **Tesseract.js 6.0.1**: OCR engine for text recognition
- **Web Audio API**: Audio alarm generation
- **MediaDevices API**: Camera access

### Architecture

The application is built as a single-page client-side application with:

- **TextDetectionCamera Class**: Main application controller
- **Real-time Processing**: Continuous frame analysis
- **Event-driven UI**: Responsive user interface
- **Error Handling**: Graceful degradation for various scenarios

### Performance Considerations

- Detection interval can be adjusted to balance accuracy vs performance
- Canvas-based frame capture for efficient processing
- Automatic cleanup of detection intervals and media streams
- Limited log entries to prevent memory issues

## Security & Privacy

- **Client-side Only**: No data is sent to external servers
- **Local Processing**: All text recognition happens in the browser
- **Camera Permission**: Requires explicit user consent
- **No Data Storage**: No images or text are stored locally

## Troubleshooting

### Camera Not Working
- Ensure camera permissions are granted
- Check if another application is using the camera
- Try refreshing the page and granting permissions again

### Text Detection Issues
- Ensure good lighting conditions
- Position text clearly in the camera view
- Adjust confidence threshold if needed
- Check that text is in English

### Performance Issues
- Increase detection interval for better performance
- Close other browser tabs/applications
- Ensure sufficient system resources

## License

This project is open source and available under the MIT License.

## Contributing

Feel free to submit issues, feature requests, or pull requests to improve the application. 