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
        this.savePreprocessedCheckbox = document.getElementById('savePreprocessed');
        this.debugModeCheckbox = document.getElementById('debugMode');
        this.showZoneIndicatorCheckbox = document.getElementById('showZoneIndicator');
        this.testDetectionBtn = document.getElementById('testDetection');
        this.whitelistInput = document.getElementById('whitelist');
        this.zoneXInput = document.getElementById('zoneX');
        this.zoneYInput = document.getElementById('zoneY');
        this.zoneWidthInput = document.getElementById('zoneWidth');
        this.zoneHeightInput = document.getElementById('zoneHeight');
        
        this.stream = null;
        this.detectionInterval = null;
        this.worker = null;
        this.isRunning = false;
        
        // Target phrases to detect
        this.targetPhrases = ['secret', 'god', 'rare', 'epic'];
        
        // Character whitelist optimized for target phrases
        this.characterWhitelist = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 ';
        
        // Zone cropping configuration for rarity text detection
        this.rarityZone = {
            x: 500,      // X position of rarity text zone
            y: 125,     // Y position of rarity text zone  
            width: 550, // Width of rarity text zone
            height: 400  // Height of rarity text zone
        };
        
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
        
        this.showZoneIndicatorCheckbox.addEventListener('change', (e) => {
            const indicator = document.getElementById('rarity-zone-indicator');
            if (indicator) {
                indicator.style.display = e.target.checked ? 'block' : 'none';
            }
            this.logMessage(`Zone indicator ${e.target.checked ? 'shown' : 'hidden'}`, 'info');
        });
        
        this.whitelistInput.addEventListener('input', (e) => {
            this.characterWhitelist = e.target.value;
            this.logMessage(`Character whitelist updated: "${e.target.value}"`, 'info');
        });
        
        // Zone control event listeners
        this.zoneXInput.addEventListener('change', () => this.updateRarityZoneFromInputs());
        this.zoneYInput.addEventListener('change', () => this.updateRarityZoneFromInputs());
        this.zoneWidthInput.addEventListener('change', () => this.updateRarityZoneFromInputs());
        this.zoneHeightInput.addEventListener('change', () => this.updateRarityZoneFromInputs());
        
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
        
        // Hide rarity zone indicator
        const indicator = document.getElementById('rarity-zone-indicator');
        if (indicator) {
            indicator.style.display = 'none';
        }
        
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
            
            // Crop to rarity zone for targeted detection
            const croppedCanvas = this.cropRarityZone(this.canvas);
            
            // Preprocess the cropped image for better OCR accuracy
            const processedCanvas = this.preprocessImageForOCR(croppedCanvas);
            
            // Save snapshot if enabled
            if (this.saveSnapshotsCheckbox.checked) {
                this.saveSnapshot();
            }
            
            // Save preprocessed snapshot if enabled
            if (this.savePreprocessedCheckbox.checked) {
                this.saveSnapshot(processedCanvas, 'Preprocessed');
            }
            
            // Perform OCR using new Tesseract.js 6.0.1 worker API with aggressive single-word configuration
            const { data: { text } } = await this.worker.recognize(processedCanvas, {
                tessedit_char_whitelist: this.characterWhitelist,
                preserve_interword_spaces: 0, // No spaces for single words
                tessedit_pageseg_mode: 7, // Treat as single text line
                tessedit_ocr_engine_mode: 3, // Default engine
                textord_heavy_nr: 1, // Heavy noise removal
                textord_min_linesize: 1.5, // Lower minimum line size for single words
                tessedit_do_invert: 0, // Don't invert colors
                classify_bln_numeric_mode: 0, // Disable numeric mode for letters only
                textord_old_baselines: 0, // Use new baseline detection
                textord_min_xheight: 8, // Minimum character height
                textord_heavy_nr: 1, // Heavy noise removal
                textord_min_linesize: 1.5 // Lower minimum line size
            });
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
    
    saveSnapshot(canvas = this.canvas, label = '') {
        try {
            // Don't save if video is not active
            if (!this.isRunning || !this.video.srcObject) {
                return;
            }
            
            // Create a data URL from the provided canvas
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            
            // Create snapshot item
            const snapshotItem = document.createElement('div');
            snapshotItem.className = 'snapshot-item';
            
            const timestamp = new Date().toLocaleTimeString();
            const frameInfo = `${canvas.width}x${canvas.height}`;
            const snapshotLabel = label ? ` (${label})` : '';
            
            snapshotItem.innerHTML = `
                <img src="${dataUrl}" alt="Snapshot at ${timestamp}">
                <div class="snapshot-info">${timestamp}${snapshotLabel} | ${frameInfo}</div>
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
    
    cropRarityZone(canvas) {
        const croppedCanvas = document.createElement('canvas');
        const ctx = croppedCanvas.getContext('2d');
        
        // Set canvas size to match target zone
        croppedCanvas.width = this.rarityZone.width;
        croppedCanvas.height = this.rarityZone.height;
        
        // Draw only the rarity area
        ctx.drawImage(
            canvas, 
            this.rarityZone.x, this.rarityZone.y, this.rarityZone.width, this.rarityZone.height,
            0, 0, this.rarityZone.width, this.rarityZone.height
        );
        
        // Show visual indicator of the rarity zone on the video
        this.showRarityZoneIndicator();
        
        if (this.debugMode) {
            console.log(`Cropped rarity zone: ${this.rarityZone.x},${this.rarityZone.y} ${this.rarityZone.width}x${this.rarityZone.height}`);
        }
        
        return croppedCanvas;
    }
    
    showRarityZoneIndicator() {
        // Only show if checkbox is checked
        if (!this.showZoneIndicatorCheckbox.checked) {
            return;
        }
        
        // Create or update the rarity zone indicator
        let indicator = document.getElementById('rarity-zone-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'rarity-zone-indicator';
            indicator.style.cssText = `
                position: absolute;
                border: 2px solid #ff6b6b;
                background: rgba(255, 107, 107, 0.1);
                pointer-events: none;
                z-index: 10;
                transition: all 0.3s ease;
            `;
            this.video.parentElement.appendChild(indicator);
        }
        
        // Calculate position relative to video
        const videoRect = this.video.getBoundingClientRect();
        const scaleX = videoRect.width / this.canvas.width;
        const scaleY = videoRect.height / this.canvas.height;
        
        indicator.style.left = `${this.rarityZone.x * scaleX}px`;
        indicator.style.top = `${this.rarityZone.y * scaleY}px`;
        indicator.style.width = `${this.rarityZone.width * scaleX}px`;
        indicator.style.height = `${this.rarityZone.height * scaleY}px`;
        indicator.style.display = 'block';
    }
    
    preprocessImageForOCR(sourceCanvas) {
        // Create a new canvas for preprocessing
        const processedCanvas = document.createElement('canvas');
        const ctx = processedCanvas.getContext('2d');
        
        processedCanvas.width = sourceCanvas.width;
        processedCanvas.height = sourceCanvas.height;
        
        // Step 1: Convert to grayscale
        ctx.filter = "grayscale(100%)";
        ctx.drawImage(sourceCanvas, 0, 0);
        
        // Step 2: Increase contrast and brightness for better text separation
        ctx.filter = "contrast(200%) brightness(110%)";
        ctx.drawImage(processedCanvas, 0, 0);
        
        // Step 3: Apply manual contrast enhancement and adaptive thresholding
        const imageData = ctx.getImageData(0, 0, processedCanvas.width, processedCanvas.height);
        const data = imageData.data;
        
        // Calculate local mean for adaptive thresholding
        const windowSize = 15;
        const localMeans = this.calculateLocalMeans(data, processedCanvas.width, processedCanvas.height, windowSize);
        
        // Apply adaptive thresholding and contrast enhancement
        for (let i = 0; i < data.length; i += 4) {
            const gray = data[i]; // All channels are the same after grayscale
            const pixelIndex = i / 4;
            const localMean = localMeans[pixelIndex] || 128;
            
            // Adaptive thresholding based on local mean
            const threshold = localMean * 0.8; // Slightly below local mean
            const enhanced = gray > threshold ? 255 : 0;
            
            data[i] = enhanced;     // Red
            data[i + 1] = enhanced; // Green
            data[i + 2] = enhanced; // Blue
            // Alpha remains unchanged
        }
        
        // Step 4: Apply morphological operations to clean up text
        ctx.putImageData(imageData, 0, 0);
        
        // Step 5: Apply slight blur to reduce noise, then sharpen
        ctx.filter = "blur(0.5px)";
        ctx.drawImage(processedCanvas, 0, 0);
        
        // Step 6: Final sharpening and contrast boost
        ctx.filter = "contrast(150%) saturate(0%)";
        ctx.drawImage(processedCanvas, 0, 0);
        
        // Reset filter
        ctx.filter = "none";
        
        return processedCanvas;
    }
    
    calculateLocalMeans(data, width, height, windowSize) {
        const means = [];
        const halfWindow = Math.floor(windowSize / 2);
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let sum = 0;
                let count = 0;
                
                // Calculate mean in local window
                for (let wy = Math.max(0, y - halfWindow); wy < Math.min(height, y + halfWindow + 1); wy++) {
                    for (let wx = Math.max(0, x - halfWindow); wx < Math.min(width, x + halfWindow + 1); wx++) {
                        const index = (wy * width + wx) * 4;
                        sum += data[index];
                        count++;
                    }
                }
                
                const pixelIndex = y * width + x;
                means[pixelIndex] = count > 0 ? sum / count : 128;
            }
        }
        
        return means;
    }
    
    updateRarityZoneFromInputs() {
        this.rarityZone.x = parseInt(this.zoneXInput.value) || 90;
        this.rarityZone.y = parseInt(this.zoneYInput.value) || 130;
        this.rarityZone.width = parseInt(this.zoneWidthInput.value) || 200;
        this.rarityZone.height = parseInt(this.zoneHeightInput.value) || 50;
        
        this.logMessage(`Rarity zone updated: ${this.rarityZone.x},${this.rarityZone.y} ${this.rarityZone.width}x${this.rarityZone.height}`, 'info');
    }
    
    testDetectionStatus() {
        const status = {
            isRunning: this.isRunning,
            hasWorker: !!this.worker,
            workerType: this.worker ? 'Tesseract.js 6.0.1 Worker' : 'None',
            hasVideoStream: !!this.video.srcObject,
            videoReadyState: this.video.readyState,
            canvasDimensions: `${this.canvas.width}x${this.canvas.height}`,
            hasDetectionInterval: !!this.detectionInterval,
            rarityZone: this.rarityZone
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

// Global function for whitelist presets
function setWhitelist(whitelist) {
    const input = document.getElementById('whitelist');
    input.value = whitelist;
    input.dispatchEvent(new Event('input'));
}

// Global function for updating rarity zone
function updateRarityZone() {
    if (window.textDetectionCamera) {
        window.textDetectionCamera.updateRarityZoneFromInputs();
    }
}

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.textDetectionCamera = new TextDetectionCamera();
}); 