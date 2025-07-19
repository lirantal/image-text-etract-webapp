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
        
        // Snapshot elements
        this.snapshotsContainer = document.getElementById('snapshots');
        this.clearSnapshotsBtn = document.getElementById('clearSnapshots');
        this.saveSnapshotsCheckbox = document.getElementById('saveSnapshots');
        this.saveTextSnapshotsCheckbox = document.getElementById('saveTextSnapshots');
        this.debugModeCheckbox = document.getElementById('debugMode');
        this.testDetectionBtn = document.getElementById('testDetection');
        
        this.stream = null;
        this.detectionInterval = null;
        this.worker = null;
        this.isRunning = false;
        
        // Target phrases to detect
        this.targetPhrases = ['secret', 'god', 'rare', 'epic'];
        
        // Settings
        this.confidenceThreshold = 0.4;
        this.detectionIntervalMs = 450;
        
        // Debug flag
        this.debugMode = false;
        
        this.initializeEventListeners();
        this.initializeTesseract();
    }
    
    initializeEventListeners() {
        this.startBtn.addEventListener('click', () => this.startCamera());
        this.stopBtn.addEventListener('click', () => this.stopCamera().catch(error => {
            this.logMessage(`Error stopping camera: ${error.message}`, 'error');
        }));
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
        
        this.clearSnapshotsBtn.addEventListener('click', () => this.clearSnapshots());
        
        this.debugModeCheckbox.addEventListener('change', (e) => {
            this.debugMode = e.target.checked;
            this.logMessage(`Debug mode ${this.debugMode ? 'enabled' : 'disabled'}`, 'info');
        });
        
        this.testDetectionBtn.addEventListener('click', () => this.testDetectionStatus());
    }
    
    async initializeTesseract() {
        try {
            this.logMessage('Initializing Tesseract.js...', 'info');
            
            // Use the new Tesseract.js 6.0.1 createWorker API
            const { createWorker } = Tesseract;
            this.worker = await createWorker('eng', 1);
            
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
    
    async stopCamera() {
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
        
        // Terminate the Tesseract worker to free up resources
        if (this.worker) {
            try {
                await this.worker.terminate();
                this.worker = null;
                this.logMessage('Tesseract worker terminated', 'info');
            } catch (error) {
                this.logMessage(`Error terminating worker: ${error.message}`, 'error');
            }
        }
        
        // Debug: Log that detection should be stopped
        if (this.debugMode) {
            this.logMessage('Detection interval cleared, isRunning set to false', 'info');
        }
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
        
        // Additional check to ensure video is actually playing
        if (!this.video.srcObject || this.video.readyState < 2) {
            return;
        }
        
        // Check if canvas has valid dimensions
        if (this.canvas.width === 0 || this.canvas.height === 0) {
            return;
        }
        
        // Debug: Log when detection is actually running
        if (this.debugMode) {
            this.logMessage(`Detection cycle running - Video readyState: ${this.video.readyState}`, 'info');
        }
        
        try {
            // Capture current frame - add error handling for drawImage
            try {
                this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
            } catch (drawError) {
                if (this.debugMode) {
                    this.logMessage(`Failed to draw video frame: ${drawError.message}`, 'error');
                }
                return;
            }
            
            // Save snapshot if enabled
            if (this.saveSnapshotsCheckbox.checked) {
                this.saveSnapshot();
            }
            
            // Perform OCR using new Tesseract.js 6.0.1 worker API
            const { data: { text } } = await this.worker.recognize(this.canvas);
            const detectedText = text.toLowerCase().trim();
            
            // Debug: Log the result structure to understand the new API
            if (this.debugMode) {
                this.logMessage(`OCR Result: "${text}"`, 'info');
            }
            
            if (detectedText) {
                this.logMessage(`Detected: "${detectedText}"`, 'info');
                
                // Save text snapshot if enabled and no regular snapshot was saved
                if (this.saveTextSnapshotsCheckbox.checked && !this.saveSnapshotsCheckbox.checked) {
                    this.saveSnapshot();
                }
                
                // Check for target phrases
                const foundPhrases = this.targetPhrases.filter(phrase => 
                    detectedText.includes(phrase.toLowerCase())
                );
                
                if (foundPhrases.length > 0) {
                    this.triggerAlarm(foundPhrases[0]);
                    // No need to show the detection box because we are already triggering the alarm
                    // this.showDetectionBox(result.data.words);
                }
                
                // Update the latest snapshot with detected text
                this.updateLatestSnapshotText(detectedText, foundPhrases.length > 0);
            } else {
                // Log when no text is detected for debugging
                if (this.debugMode) {
                    this.logMessage('No text detected in this frame', 'info');
                }
            }
            
        } catch (error) {
            this.logMessage(`Detection error: ${error.message}`, 'error');
        }
    }
    
    saveSnapshot() {
        try {
            // Don't save if video is not active
            if (!this.isRunning || !this.video.srcObject) {
                return;
            }
            
            // Create a data URL from the canvas
            const dataUrl = this.canvas.toDataURL('image/jpeg', 0.8);
            
            // Create snapshot item
            const snapshotItem = document.createElement('div');
            snapshotItem.className = 'snapshot-item';
            
            const timestamp = new Date().toLocaleTimeString();
            const frameInfo = `${this.canvas.width}x${this.canvas.height}`;
            
            snapshotItem.innerHTML = `
                <img src="${dataUrl}" alt="Snapshot at ${timestamp}">
                <div class="snapshot-info">${timestamp} | ${frameInfo}</div>
                <div class="snapshot-text" style="display: none;">No text detected</div>
            `;
            
            // Add to container (at the beginning to show newest first)
            this.snapshotsContainer.insertBefore(snapshotItem, this.snapshotsContainer.firstChild);
            
            // Keep only last 20 snapshots to prevent memory issues
            while (this.snapshotsContainer.children.length > 20) {
                this.snapshotsContainer.removeChild(this.snapshotsContainer.lastChild);
            }
            
            // Store reference to latest snapshot for text updates
            this.latestSnapshot = snapshotItem;
            
        } catch (error) {
            this.logMessage(`Failed to save snapshot: ${error.message}`, 'error');
        }
    }
    
    updateLatestSnapshotText(detectedText, hasTargetPhrase = false) {
        if (this.latestSnapshot) {
            const textElement = this.latestSnapshot.querySelector('.snapshot-text');
            if (textElement) {
                textElement.textContent = detectedText;
                textElement.style.display = 'block';
                
                // Highlight if target phrase was found
                if (hasTargetPhrase) {
                    this.latestSnapshot.style.borderColor = '#dc3545';
                    this.latestSnapshot.style.backgroundColor = '#fff5f5';
                    textElement.style.backgroundColor = '#dc3545';
                    textElement.style.color = 'white';
                }
            }
        }
    }
    
    clearSnapshots() {
        this.snapshotsContainer.innerHTML = '';
        this.latestSnapshot = null;
        this.logMessage('Snapshots cleared', 'info');
    }
    
    testDetectionStatus() {
        const status = {
            isRunning: this.isRunning,
            hasWorker: !!this.worker,
            workerType: this.worker ? 'Tesseract.js 6.0.1 Worker' : 'None',
            hasVideoStream: !!this.video.srcObject,
            videoReadyState: this.video.readyState,
            canvasDimensions: `${this.canvas.width}x${this.canvas.height}`,
            hasDetectionInterval: !!this.detectionInterval
        };
        
        this.logMessage(`Detection Status: ${JSON.stringify(status, null, 2)}`, 'info');
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