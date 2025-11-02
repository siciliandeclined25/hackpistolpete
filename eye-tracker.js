// ===== EYE TRACKING WITH MEDIAPIPE =====
// This system tracks user's eyes and determines focus level

class EyeTracker {
    constructor() {
        this.isTracking = false;
        this.faceMesh = null;
        this.camera = null;
        this.videoElement = null;
        this.canvasElement = null;
        this.canvasCtx = null;
        
        // Focus tracking data
        this.focusData = {
            totalTime: 0,
            focusedTime: 0,
            unfocusedTime: 0,
            lookAwayCount: 0,
            averageFocusScore: 100,
            currentQuestionDifficulty: 'normal',
            questionFocusMap: {}, // Maps question IDs to focus scores
            sessionStartTime: null
        };
        
        // Eye tracking parameters (IMPROVED - More strict detection)
        this.eyeThresholds = {
            gazeDeviation: 0.08, // Reduced from 0.15 - Stricter center detection
            gazeVerticalDeviation: 0.10, // Separate vertical threshold
            blinkThreshold: 0.02, // Eye aspect ratio for blink detection
            lookAwayDuration: 1000, // Reduced from 2000ms - Faster detection
            minFocusForEasy: 80, // Focus score threshold for "easy" question
            minFocusForNormal: 60, // Focus score threshold for "normal" question
            headTurnThreshold: 0.15, // Head rotation tolerance
            consecutiveFramesRequired: 3, // Frames to confirm look away
        };
        
        // Improved tracking state
        this.consecutiveLookAwayFrames = 0;
        this.consecutiveFocusedFrames = 0;
        
        // Tracking state
        this.currentState = {
            isFocused: true,
            isBlinking: false,
            lookAwayStartTime: null,
            gazeDirection: 'center',
            headPose: 'forward',
            eyeAspectRatio: 0,
            lastUpdateTime: Date.now()
        };
        
        // Question tracking
        this.currentQuestion = null;
        this.questionStartTime = null;
        this.questionFocusHistory = [];
        
        this.setupUI();
    }
    
    setupUI() {
        // Create eye tracking overlay (HIDDEN during quiz)
        const overlay = document.createElement('div');
        overlay.id = 'eye-tracking-overlay';
        overlay.className = 'eye-tracking-overlay hidden';
        overlay.innerHTML = `
            <div class="eye-tracking-container">
                <div class="camera-feed" style="display: none;">
                    <video id="eye-tracking-video" autoplay playsinline></video>
                    <canvas id="eye-tracking-canvas"></canvas>
                </div>
                <div class="tracking-stats" style="display: none;">
                    <div class="stat-item">
                        <span class="stat-label">Focus Score</span>
                        <span class="stat-value" id="focus-score">100%</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Status</span>
                        <span class="stat-value" id="focus-status">Focused</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Gaze</span>
                        <span class="stat-value" id="gaze-direction">Center</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Look Away Count</span>
                        <span class="stat-value" id="look-away-count">0</span>
                    </div>
                </div>
                <div class="focus-indicator" style="display: none;">
                    <div class="focus-bar">
                        <div class="focus-bar-fill" id="focus-bar-fill"></div>
                    </div>
                    <p class="focus-message" id="focus-message">Tracking active... 👀</p>
                </div>
                <div class="tracking-active-indicator">
                    <div class="pulse-dot"></div>
                    <span>Focus Tracking Active</span>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        
        this.videoElement = document.getElementById('eye-tracking-video');
        this.canvasElement = document.getElementById('eye-tracking-canvas');
        this.canvasCtx = this.canvasElement.getContext('2d');
    }
    
    async start() {
        if (this.isTracking) return;
        
        try {
            // Initialize MediaPipe Face Mesh
            this.faceMesh = new FaceMesh({
                locateFile: (file) => {
                    return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
                }
            });
            
            this.faceMesh.setOptions({
                maxNumFaces: 1,
                refineLandmarks: true,
                minDetectionConfidence: 0.5,
                minTrackingConfidence: 0.5
            });
            
            this.faceMesh.onResults((results) => this.onResults(results));
            
            // Initialize camera
            this.camera = new Camera(this.videoElement, {
                onFrame: async () => {
                    await this.faceMesh.send({ image: this.videoElement });
                },
                width: 640,
                height: 480
            });
            
            await this.camera.start();
            
            this.isTracking = true;
            this.focusData.sessionStartTime = Date.now();
            
            // Show minimal indicator only (overlay stays hidden during quiz)
            const indicator = document.querySelector('.tracking-active-indicator');
            if (indicator) {
                indicator.classList.remove('hidden');
            }
            
            // Update button (if exists - may be hidden during auto-start)
            const btn = document.getElementById('eye-tracking-btn');
            if (btn) {
                btn.querySelector('span').textContent = 'Stop Eye Tracking';
                btn.classList.add('active');
            }
            
            // Start focus monitoring
            this.startFocusMonitoring();
            
            console.log('Eye tracking started successfully');
            
        } catch (error) {
            console.error('Error starting eye tracking:', error);
            alert('Failed to start eye tracking. Please allow camera access.');
        }
    }
    
    stop() {
        if (!this.isTracking) return;
        
        if (this.camera) {
            this.camera.stop();
        }
        
        this.isTracking = false;
        
        // Hide indicator
        const indicator = document.querySelector('.tracking-active-indicator');
        if (indicator) {
            indicator.classList.add('hidden');
        }
        
        // Update button (if exists)
        const btn = document.getElementById('eye-tracking-btn');
        if (btn) {
            btn.querySelector('span').textContent = 'Start Eye Tracking';
            btn.classList.remove('active');
        }
        
        console.log('Eye tracking stopped');
        console.log('Session stats:', this.focusData);
    }
    
    onResults(results) {
        // Clear canvas
        this.canvasCtx.save();
        this.canvasCtx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);
        
        if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
            const landmarks = results.multiFaceLandmarks[0];
            
            // Draw face mesh (optional, for debugging)
            this.drawFaceMesh(landmarks);
            
            // Analyze eye tracking
            this.analyzeEyes(landmarks);
            this.analyzeHeadPose(landmarks);
            this.updateFocusState();
        } else {
            // No face detected - user not in frame
            this.handleNoFaceDetected();
        }
        
        this.canvasCtx.restore();
        
        // Update UI
        this.updateUI();
    }
    
    drawFaceMesh(landmarks) {
        // Draw eye regions for visualization
        const leftEyeIndices = [33, 160, 158, 133, 153, 144];
        const rightEyeIndices = [362, 385, 387, 263, 373, 380];
        
        this.canvasCtx.fillStyle = 'rgba(139, 92, 246, 0.3)';
        this.canvasCtx.strokeStyle = 'rgba(139, 92, 246, 0.8)';
        this.canvasCtx.lineWidth = 2;
        
        // Draw left eye
        this.drawEyeRegion(landmarks, leftEyeIndices);
        
        // Draw right eye
        this.drawEyeRegion(landmarks, rightEyeIndices);
    }
    
    drawEyeRegion(landmarks, indices) {
        this.canvasCtx.beginPath();
        indices.forEach((idx, i) => {
            const point = landmarks[idx];
            const x = point.x * this.canvasElement.width;
            const y = point.y * this.canvasElement.height;
            
            if (i === 0) {
                this.canvasCtx.moveTo(x, y);
            } else {
                this.canvasCtx.lineTo(x, y);
            }
        });
        this.canvasCtx.closePath();
        this.canvasCtx.fill();
        this.canvasCtx.stroke();
    }
    
    analyzeEyes(landmarks) {
        // Calculate eye aspect ratio for blink detection
        const leftEAR = this.calculateEyeAspectRatio(landmarks, 'left');
        const rightEAR = this.calculateEyeAspectRatio(landmarks, 'right');
        const avgEAR = (leftEAR + rightEAR) / 2;
        
        this.currentState.eyeAspectRatio = avgEAR;
        this.currentState.isBlinking = avgEAR < this.eyeThresholds.blinkThreshold;
        
        // Calculate gaze direction
        const gazeVector = this.calculateGazeDirection(landmarks);
        this.currentState.gazeDirection = gazeVector.direction;
        
        // Check head pose (returns false if head turned away)
        const headFacingForward = this.analyzeHeadPose(landmarks);
        
        // IMPROVED: Combined check - gaze + head pose
        const isLookingAtScreen = this.isGazeFocused(gazeVector) && headFacingForward && !this.currentState.isBlinking;
        
        // IMPROVED: Use consecutive frames to prevent false positives
        if (!isLookingAtScreen) {
            this.consecutiveLookAwayFrames++;
            this.consecutiveFocusedFrames = 0;
            
            // Only mark as looked away after consecutive frames
            if (this.consecutiveLookAwayFrames >= this.eyeThresholds.consecutiveFramesRequired) {
                if (!this.currentState.lookAwayStartTime) {
                    this.currentState.lookAwayStartTime = Date.now();
                }
            }
        } else {
            this.consecutiveFocusedFrames++;
            this.consecutiveLookAwayFrames = 0;
            
            // Return to focused after consecutive focused frames
            if (this.consecutiveFocusedFrames >= this.eyeThresholds.consecutiveFramesRequired) {
                this.currentState.lookAwayStartTime = null;
            }
        }
    }
    
    calculateEyeAspectRatio(landmarks, eye) {
        // Eye Aspect Ratio (EAR) formula
        const indices = eye === 'left' 
            ? { v1: 159, v2: 145, h1: 33, h2: 133 }
            : { v1: 386, v2: 374, h1: 362, h2: 263 };
        
        const vertical1 = this.getDistance(landmarks[indices.v1], landmarks[indices.v2]);
        const horizontal = this.getDistance(landmarks[indices.h1], landmarks[indices.h2]);
        
        return vertical1 / (horizontal + 0.001); // Avoid division by zero
    }
    
    calculateGazeDirection(landmarks) {
        // IMPROVED: Use iris landmarks with better normalization
        const leftIris = landmarks[468]; // Left iris center
        const rightIris = landmarks[473]; // Right iris center
        const noseTip = landmarks[1];
        const leftEyeOuter = landmarks[33];
        const rightEyeOuter = landmarks[263];
        
        // Normalize by eye width for better accuracy
        const eyeWidth = this.getDistance(leftEyeOuter, rightEyeOuter);
        
        // Calculate deviation from center (normalized)
        const leftDeviation = (leftIris.x - noseTip.x) / eyeWidth;
        const rightDeviation = (rightIris.x - noseTip.x) / eyeWidth;
        const avgDeviation = (leftDeviation + rightDeviation) / 2;
        
        // Vertical gaze (normalized)
        const verticalGaze = ((leftIris.y + rightIris.y) / 2 - noseTip.y) / eyeWidth;
        
        // STRICTER: Determine direction with separate thresholds
        let direction = 'center';
        const absHorizontal = Math.abs(avgDeviation);
        const absVertical = Math.abs(verticalGaze);
        
        if (absHorizontal > this.eyeThresholds.gazeDeviation) {
            direction = avgDeviation > 0 ? 'right' : 'left';
        } else if (absVertical > this.eyeThresholds.gazeVerticalDeviation) {
            direction = verticalGaze > 0 ? 'down' : 'up';
        }
        
        return {
            direction,
            horizontal: avgDeviation,
            vertical: verticalGaze,
            magnitude: Math.sqrt(avgDeviation * avgDeviation + verticalGaze * verticalGaze),
            isStrict: absHorizontal > this.eyeThresholds.gazeDeviation || absVertical > this.eyeThresholds.gazeVerticalDeviation
        };
    }
    
    isGazeFocused(gazeVector) {
        // IMPROVED: Stricter focus detection with separate axis checks
        const horizontalOK = Math.abs(gazeVector.horizontal) < this.eyeThresholds.gazeDeviation;
        const verticalOK = Math.abs(gazeVector.vertical) < this.eyeThresholds.gazeVerticalDeviation;
        return horizontalOK && verticalOK;
    }
    
    analyzeHeadPose(landmarks) {
        // IMPROVED: More accurate head pose with 3D consideration
        const noseTip = landmarks[1];
        const leftFace = landmarks[234];
        const rightFace = landmarks[454];
        const chin = landmarks[152];
        const forehead = landmarks[10];
        
        const faceWidth = this.getDistance(leftFace, rightFace);
        const faceHeight = this.getDistance(forehead, chin);
        
        // Horizontal rotation
        const noseOffset = (noseTip.x - (leftFace.x + rightFace.x) / 2) / faceWidth;
        
        // Vertical tilt
        const verticalTilt = (noseTip.y - (forehead.y + chin.y) / 2) / faceHeight;
        
        // Check if head is turned away (stricter)
        if (Math.abs(noseOffset) > this.eyeThresholds.headTurnThreshold) {
            this.currentState.headPose = noseOffset > 0 ? 'turned-right' : 'turned-left';
            // Head turned significantly = not focused
            return false;
        } else if (Math.abs(verticalTilt) > 0.15) {
            this.currentState.headPose = verticalTilt > 0 ? 'tilted-down' : 'tilted-up';
            return false;
        } else {
            this.currentState.headPose = 'forward';
            return true;
        }
    }
    
    getDistance(point1, point2) {
        const dx = point1.x - point2.x;
        const dy = point1.y - point2.y;
        const dz = (point1.z || 0) - (point2.z || 0);
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
    
    updateFocusState() {
        const now = Date.now();
        const timeDelta = now - this.currentState.lastUpdateTime;
        this.currentState.lastUpdateTime = now;
        
        // Check if user looked away for too long
        if (this.currentState.lookAwayStartTime) {
            const lookAwayDuration = now - this.currentState.lookAwayStartTime;
            
            if (lookAwayDuration > this.eyeThresholds.lookAwayDuration) {
                if (this.currentState.isFocused) {
                    this.currentState.isFocused = false;
                    this.focusData.lookAwayCount++;
                    this.onLookAway();
                }
                this.focusData.unfocusedTime += timeDelta;
            }
        } else {
            if (!this.currentState.isFocused) {
                this.currentState.isFocused = true;
                this.onReturnFocus();
            }
            this.focusData.focusedTime += timeDelta;
        }
        
        this.focusData.totalTime += timeDelta;
        
        // Calculate focus score
        if (this.focusData.totalTime > 0) {
            this.focusData.averageFocusScore = Math.round(
                (this.focusData.focusedTime / this.focusData.totalTime) * 100
            );
        }
        
        // Track question-specific focus
        if (this.currentQuestion) {
            this.questionFocusHistory.push({
                timestamp: now,
                isFocused: this.currentState.isFocused,
                gazeDirection: this.currentState.gazeDirection
            });
        }
    }
    
    handleNoFaceDetected() {
        // Treat as unfocused
        if (this.currentState.isFocused) {
            this.currentState.lookAwayStartTime = Date.now();
        }
    }
    
    startFocusMonitoring() {
        // Monitor focus periodically
        setInterval(() => {
            if (!this.isTracking) return;
            
            // Update stats card
            this.updateStatsCard();
            
            // Check for question difficulty assessment
            if (this.currentQuestion) {
                this.assessQuestionDifficulty();
            }
        }, 1000);
    }
    
    onLookAway() {
        console.log('User looked away!');
        this.showFocusNotification('👀 Please stay focused on the screen', 'warning');
        
        // If answering a question, mark it as potentially difficult
        if (this.currentQuestion) {
            console.log(`User looked away during question: ${this.currentQuestion.id}`);
        }
    }
    
    onReturnFocus() {
        console.log('User returned focus');
        this.showFocusNotification('✅ Great! You\'re back on track', 'success');
    }
    
    showFocusNotification(message, type) {
        const messageEl = document.getElementById('focus-message');
        if (messageEl) {
            messageEl.textContent = message;
            messageEl.className = `focus-message ${type}`;
        }
    }
    
    // Called when user starts a question
    startQuestionTracking(question) {
        this.currentQuestion = question;
        this.questionStartTime = Date.now();
        this.questionFocusHistory = [];
        
        console.log('Started tracking question:', question.id);
    }
    
    // Called when user finishes a question
    endQuestionTracking() {
        if (!this.currentQuestion) return;
        
        const questionDuration = Date.now() - this.questionStartTime;
        const focusedDuration = this.questionFocusHistory.filter(h => h.isFocused).length;
        const questionFocusScore = (focusedDuration / this.questionFocusHistory.length) * 100;
        
        // Store question focus data
        this.focusData.questionFocusMap[this.currentQuestion.id] = {
            focusScore: questionFocusScore,
            duration: questionDuration,
            lookAwayCount: this.questionFocusHistory.filter((h, i, arr) => 
                i > 0 && !h.isFocused && arr[i-1].isFocused
            ).length,
            difficulty: this.assessQuestionDifficulty()
        };
        
        console.log(`Question ${this.currentQuestion.id} focus score: ${questionFocusScore}%`);
        
        this.currentQuestion = null;
        this.questionStartTime = null;
    }
    
    assessQuestionDifficulty() {
        if (!this.currentQuestion || this.questionFocusHistory.length < 5) {
            return 'normal';
        }
        
        const recentHistory = this.questionFocusHistory.slice(-10);
        const recentFocusRate = recentHistory.filter(h => h.isFocused).length / recentHistory.length;
        const focusPercentage = recentFocusRate * 100;
        
        let difficulty;
        if (focusPercentage >= this.eyeThresholds.minFocusForEasy) {
            difficulty = 'easy';
        } else if (focusPercentage >= this.eyeThresholds.minFocusForNormal) {
            difficulty = 'normal';
        } else {
            difficulty = 'hard';
        }
        
        this.focusData.currentQuestionDifficulty = difficulty;
        return difficulty;
    }
    
    getDifficultyInsights() {
        // Analyze all questions to provide insights
        const insights = {
            easyQuestions: [],
            normalQuestions: [],
            hardQuestions: [],
            averageFocusByDifficulty: {}
        };
        
        Object.entries(this.focusData.questionFocusMap).forEach(([id, data]) => {
            if (data.difficulty === 'easy') {
                insights.easyQuestions.push(id);
            } else if (data.difficulty === 'normal') {
                insights.normalQuestions.push(id);
            } else {
                insights.hardQuestions.push(id);
            }
        });
        
        return insights;
    }
    
    updateUI() {
        // Update focus score
        const scoreEl = document.getElementById('focus-score');
        if (scoreEl) {
            scoreEl.textContent = `${this.focusData.averageFocusScore}%`;
            scoreEl.className = 'stat-value ' + this.getFocusScoreClass(this.focusData.averageFocusScore);
        }
        
        // Update status
        const statusEl = document.getElementById('focus-status');
        if (statusEl) {
            statusEl.textContent = this.currentState.isFocused ? 'Focused ✓' : 'Distracted ✗';
            statusEl.className = 'stat-value ' + (this.currentState.isFocused ? 'success' : 'warning');
        }
        
        // Update gaze direction
        const gazeEl = document.getElementById('gaze-direction');
        if (gazeEl) {
            gazeEl.textContent = this.currentState.gazeDirection.charAt(0).toUpperCase() + 
                                this.currentState.gazeDirection.slice(1);
        }
        
        // Update look away count
        const countEl = document.getElementById('look-away-count');
        if (countEl) {
            countEl.textContent = this.focusData.lookAwayCount;
        }
        
        // Update focus bar
        const barEl = document.getElementById('focus-bar-fill');
        if (barEl) {
            barEl.style.width = `${this.focusData.averageFocusScore}%`;
            barEl.className = 'focus-bar-fill ' + this.getFocusScoreClass(this.focusData.averageFocusScore);
        }
    }
    
    getFocusScoreClass(score) {
        if (score >= 80) return 'success';
        if (score >= 60) return 'warning';
        return 'error';
    }
    
    updateStatsCard() {
        // Update the stats flashcard with focus data
        const statsCard = document.getElementById('stats-card');
        if (statsCard && this.isTracking) {
            const statValue = statsCard.querySelector('.stat-value');
            if (statValue) {
                statValue.textContent = `${this.focusData.averageFocusScore}%`;
            }
            const statLabel = statsCard.querySelector('.stat-label');
            if (statLabel) {
                statLabel.textContent = 'Focus Score';
            }
        }
        
        // Update focus card
        const focusCard = document.getElementById('focus-card');
        if (focusCard && this.isTracking) {
            const statValue = focusCard.querySelector('.stat-value');
            if (statValue) {
                const focusTime = Math.round(this.focusData.focusedTime / 1000);
                statValue.textContent = `${focusTime}s`;
            }
            const statLabel = focusCard.querySelector('.stat-label');
            if (statLabel) {
                statLabel.textContent = 'Focused Time';
            }
        }
    }
    
    getSessionSummary() {
        const totalMinutes = Math.round(this.focusData.totalTime / 60000);
        const focusedMinutes = Math.round(this.focusData.focusedTime / 60000);
        
        return {
            totalTime: totalMinutes,
            focusedTime: focusedMinutes,
            focusScore: this.focusData.averageFocusScore,
            lookAwayCount: this.focusData.lookAwayCount,
            insights: this.getDifficultyInsights()
        };
    }
}

// Global instance
let eyeTracker = null;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    eyeTracker = new EyeTracker();
    
    // Setup button handler
    const eyeTrackingBtn = document.getElementById('eye-tracking-btn');
    if (eyeTrackingBtn) {
        eyeTrackingBtn.addEventListener('click', () => {
            if (eyeTracker.isTracking) {
                eyeTracker.stop();
            } else {
                eyeTracker.start();
            }
        });
    }
});

// Export for use in other scripts
window.eyeTracker = eyeTracker;
