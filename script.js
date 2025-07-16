class TextDetectionCamera {
    constructor() {
        this.video = document.getElementById('video');
        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.status = document.getElementById('status');
        this.log = document.getElementById('log');
        this.detectionBox = document.getElementById('detection-box');
        this.alarm = document.getElementById('alarm');
        this.alarmText = document.getElementById('alarm-text');
        
        this.startBtn = document.getElementById('startBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.dismissAlarmBtn = document.getElementById('dismissAlarm');
        
        this.confidenceSlider = document.getElementById('confidence');
        this.confidenceValue = document.getElementById('confidenceValue');
        this.intervalInput = document.getElementById('interval');
        
        this.stream = null;
        this.detectionInterval = null;
        this.worker = null;
        this.isRunning = false;
        
        // Target phrases to detect
        this.targetPhrases = ['secret', 'god', 'rare', 'epic'];
        
        // Settings
        this.confidenceThreshold = 0.7;
        this.detectionIntervalMs = 50;
        
        this.initializeEventListeners();
        this.initializeTesseract();
    }
    
    initializeEventListeners() {
        this.startBtn.addEventListener('click', () => this.startCamera());
        this.stopBtn.addEventListener('click', () => this.stopCamera());
        this.dismissAlarmBtn.addEventListener('click', () => this.dismissAlarm());
        
        this.confidenceSlider.addEventListener('input', (e) => {
            this.confidenceThreshold = parseFloat(e.target.value);
            this.confidenceValue.textContent = e.target.value;
        });
        
        this.intervalInput.addEventListener('input', (e) => {
            this.detectionIntervalMs = parseInt(e.target.value);
            if (this.isRunning) {
                this.restartDetection();
            }
        });
    }
    
    async initializeTesseract() {
        try {
            this.logMessage('Initializing Tesseract.js...', 'info');
            this.worker = await Tesseract.createWorker();
            await this.worker.loadLanguage('eng');
            await this.worker.initialize('eng');
            await this.worker.setParameters({
                tessedit_char_whitelist: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ',
            });
            this.logMessage('Tesseract.js initialized successfully!', 'success');
        } catch (error) {
            this.logMessage(`Failed to initialize Tesseract: ${error.message}`, 'error');
        }
    }
    
    async startCamera() {
        try {
            this.logMessage('Requesting camera permission...', 'info');
            
            const constraints = {
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: 'environment'
                }
            };
            
            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.video.srcObject = this.stream;
            
            this.video.addEventListener('loadedmetadata', () => {
                this.canvas.width = this.video.videoWidth;
                this.canvas.height = this.video.videoHeight;
                this.startDetection();
            });
            
            this.startBtn.disabled = true;
            this.stopBtn.disabled = false;
            this.status.textContent = 'Camera active';
            this.logMessage('Camera started successfully!', 'success');
            
        } catch (error) {
            this.logMessage(`Camera access denied: ${error.message}`, 'error');
            this.status.textContent = 'Camera access denied';
        }
    }
    
    stopCamera() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        
        if (this.detectionInterval) {
            clearInterval(this.detectionInterval);
            this.detectionInterval = null;
        }
        
        this.isRunning = false;
        this.video.srcObject = null;
        this.startBtn.disabled = false;
        this.stopBtn.disabled = true;
        this.status.textContent = 'Camera stopped';
        this.detectionBox.style.display = 'none';
        this.logMessage('Camera stopped', 'info');
    }
    
    startDetection() {
        if (!this.worker) {
            this.logMessage('Tesseract not initialized yet', 'error');
            return;
        }
        
        this.isRunning = true;
        this.detectionInterval = setInterval(() => {
            this.detectText();
        }, this.detectionIntervalMs);
        
        this.logMessage('Text detection started', 'success');
    }
    
    restartDetection() {
        if (this.detectionInterval) {
            clearInterval(this.detectionInterval);
        }
        if (this.isRunning) {
            this.detectionInterval = setInterval(() => {
                this.detectText();
            }, this.detectionIntervalMs);
        }
    }
    
    async detectText() {
        if (!this.isRunning || !this.worker) return;
        
        try {
            // Capture current frame
            this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
            
            // Perform OCR
            const result = await this.worker.recognize(this.canvas);
            const detectedText = result.data.text.toLowerCase().trim();
            
            if (detectedText) {
                this.logMessage(`Detected: "${detectedText}"`, 'info');
                
                // Check for target phrases
                const foundPhrases = this.targetPhrases.filter(phrase => 
                    detectedText.includes(phrase.toLowerCase())
                );
                
                if (foundPhrases.length > 0) {
                    this.triggerAlarm(foundPhrases[0]);
                    this.showDetectionBox(result.data.words);
                }
            }
            
        } catch (error) {
            this.logMessage(`Detection error: ${error.message}`, 'error');
        }
    }
    
    showDetectionBox(words) {
        if (!words || words.length === 0) return;
        
        // Find the bounding box of all detected words
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        
        words.forEach(word => {
            const bbox = word.bbox;
            minX = Math.min(minX, bbox.x0);
            minY = Math.min(minY, bbox.y0);
            maxX = Math.max(maxX, bbox.x1);
            maxY = Math.max(maxY, bbox.y1);
        });
        
        // Convert canvas coordinates to video coordinates
        const videoRect = this.video.getBoundingClientRect();
        const scaleX = videoRect.width / this.canvas.width;
        const scaleY = videoRect.height / this.canvas.height;
        
        this.detectionBox.style.left = `${minX * scaleX}px`;
        this.detectionBox.style.top = `${minY * scaleY}px`;
        this.detectionBox.style.width = `${(maxX - minX) * scaleX}px`;
        this.detectionBox.style.height = `${(maxY - minY) * scaleY}px`;
        this.detectionBox.style.display = 'block';
        
        // Hide the box after 3 seconds
        setTimeout(() => {
            this.detectionBox.style.display = 'none';
        }, 3000);
    }
    
    triggerAlarm(detectedPhrase) {
        this.logMessage(`🚨 ALARM: "${detectedPhrase}" detected!`, 'detected');
        this.alarmText.textContent = `Target phrase "${detectedPhrase}" detected!`;
        this.alarm.classList.remove('hidden');
        
        // Play alarm sound
        this.playAlarmSound();
        
        // Auto-dismiss after 10 seconds
        setTimeout(() => {
            this.dismissAlarm();
        }, 10000);
    }
    
    dismissAlarm() {
        this.alarm.classList.add('hidden');
    }
    
    playAlarmSound() {
        // Create a simple alarm sound using Web Audio API
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.2);
        oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.3);
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
    }
    
    logMessage(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry ${type}`;
        logEntry.textContent = `[${timestamp}] ${message}`;
        
        this.log.appendChild(logEntry);
        this.log.scrollTop = this.log.scrollHeight;
        
        // Keep only last 50 entries
        while (this.log.children.length > 50) {
            this.log.removeChild(this.log.firstChild);
        }
    }
}

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new TextDetectionCamera();
}); 