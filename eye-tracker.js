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
        this.hasLoggedDetection = false; // For logging face detection once
        
        // Focus tracking data
        this.focusData = {
            totalTime: 0,
            focusedTime: 0,
            unfocusedTime: 0,
            lookAwayCount: 0,
            averageFocusScore: 0, // FIXED: Start at 0, not 100
            currentQuestionDifficulty: 'normal',
            questionFocusMap: {}, // Maps question IDs to focus scores
            sessionStartTime: null,
            focusFrames: 0, // NEW: Count frames where user is focused
            totalFrames: 0  // NEW: Count total frames processed
        };
        
        // Eye tracking parameters - ADJUSTED for natural screen reading
        this.eyeThresholds = {
            gazeDeviation: 0.25, // INCREASED - Allow looking across screen horizontally
            gazeVerticalDeviation: 0.35, // INCREASED - Allow looking DOWN at screen (natural reading position)
            blinkThreshold: 0.02, // Eye aspect ratio for blink detection
            lookAwayDuration: 2500, // INCREASED - Give more time before marking as distracted (2.5 seconds)
            minFocusForEasy: 80, // Focus score threshold for "easy" question
            minFocusForNormal: 60, // Focus score threshold for "normal" question
            headTurnThreshold: 0.25, // INCREASED - Allow natural head movements while reading
            consecutiveFramesRequired: 5, // INCREASED - Reduce false positives (require 5 frames ~160ms)
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
            lastUpdateTime: 0 // FIXED: Initialize to 0, will be set when tracking starts
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
                    <video id="eye-tracking-video" autoplay playsinline width="640" height="480"></video>
                    <canvas id="eye-tracking-canvas" width="640" height="480"></canvas>
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
            console.log('🎥 Starting eye tracker with TensorFlow.js...');
            
            // Check if TensorFlow.js is loaded
            if (typeof faceLandmarksDetection === 'undefined') {
                throw new Error('TensorFlow.js Face Detection not loaded. Check internet connection.');
            }
            
            console.log('✅ TensorFlow.js loaded');
            console.log('Available models:', faceLandmarksDetection.SupportedModels);
            
            // Load the MediaPipeFaceMesh model
            const model = faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh;
            console.log('Loading model:', model);
            
            this.detector = await faceLandmarksDetection.createDetector(model, {
                runtime: 'tfjs',
                refineLandmarks: true,
                maxFaces: 1
            });
            
            console.log('✅ Face detector initialized:', this.detector);
            
            // Setup video stream
            console.log('Requesting camera access...');
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: 640,
                    height: 480,
                    facingMode: 'user'
                }
            });
            
            this.videoElement.srcObject = stream;
            await this.videoElement.play();
            
            // Wait for video to be ready
            await new Promise(resolve => {
                if (this.videoElement.readyState >= 2) {
                    resolve();
                } else {
                    this.videoElement.onloadeddata = () => resolve();
                }
            });
            
            console.log('✅ Camera started, video element:', this.videoElement);
            console.log('Video dimensions:', this.videoElement.videoWidth, 'x', this.videoElement.videoHeight);
            console.log('Video ready state:', this.videoElement.readyState);
            
            this.isTracking = true;
            this.focusData.sessionStartTime = Date.now();
            this.currentState.lastUpdateTime = Date.now(); // FIXED: Initialize lastUpdateTime when session starts
            
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
            
            // Start detection loop
            this.detectFaces();
            
            // Start focus monitoring
            this.startFocusMonitoring();
            
            console.log('✅ Eye tracking started successfully');
            
        } catch (error) {
            console.error('❌ Error starting eye tracking:', error);
            console.error('Error details:', {
                message: error.message,
                stack: error.stack
            });
            
            let errorMsg = 'Failed to start eye tracking.\n\n';
            
            if (error.name === 'NotAllowedError' || error.message.includes('permission')) {
                errorMsg += 'Camera access denied. Please allow camera access in your browser settings.';
            } else if (typeof faceLandmarksDetection === 'undefined') {
                errorMsg += 'TensorFlow.js libraries failed to load. Check your internet connection.';
            } else {
                errorMsg += 'Error: ' + error.message;
            }
            
            alert(errorMsg);
        }
    }
    
    async detectFaces() {
        if (!this.isTracking) return;
        
        try {
            // Check if detector exists
            if (!this.detector) {
                console.error('❌ Detector not initialized!');
                return;
            }
            
            // Check if video is ready
            if (this.videoElement.readyState < 2 || this.videoElement.videoWidth === 0) {
                console.warn('⏳ Video not ready yet, skipping frame...');
                requestAnimationFrame(() => this.detectFaces());
                return;
            }
            
            const faces = await this.detector.estimateFaces(this.videoElement, {
                flipHorizontal: false
            });
            
            // Log detection results occasionally
            if (Math.random() < 0.05) { // 5% of frames
                console.log('🔍 Detection result:', faces?.length || 0, 'faces found');
            }
            
            // Clear canvas
            this.canvasCtx.save();
            this.canvasCtx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);
            
            if (faces && faces.length > 0) {
                const face = faces[0];
                const landmarks = face.keypoints;
                
                // Only log once to avoid spam
                if (!this.hasLoggedDetection) {
                    console.log('✅ Face detected! Eye tracking active.');
                    console.log('Landmarks count:', landmarks.length);
                    this.hasLoggedDetection = true;
                }
                
                // Convert TensorFlow format to normalized coordinates (0-1 range)
                const videoWidth = this.videoElement.videoWidth;
                const videoHeight = this.videoElement.videoHeight;
                const landmarksArray = landmarks.map(p => ({ 
                    x: p.x / videoWidth, 
                    y: p.y / videoHeight, 
                    z: p.z || 0 
                }));
                
                // Analyze
                this.analyzeEyes(landmarksArray);
                this.analyzeHeadPose(landmarksArray);
                this.updateFocusState();
            } else {
                if (this.hasLoggedDetection) {
                    console.log('⚠️ No face detected');
                    this.hasLoggedDetection = false;
                }
                this.handleNoFaceDetected();
            }
            
            this.canvasCtx.restore();
            this.updateUI();
            
        } catch (error) {
            console.error('❌ Detection error:', error);
        }
        
        // Continue detection loop
        requestAnimationFrame(() => this.detectFaces());
    }
    
    stop() {
        if (!this.isTracking) return;
        
        this.isTracking = false;
        
        // Stop video stream
        if (this.videoElement.srcObject) {
            this.videoElement.srcObject.getTracks().forEach(track => track.stop());
        }
        
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
        // This method is now replaced by detectFaces()
        // Keeping for compatibility but not used
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
        
        // Calculate gaze direction (SCREEN-RELATIVE)
        const gazeVector = this.calculateGazeDirection(landmarks);
        this.currentState.gazeDirection = gazeVector.direction;
        
        // Check head pose (returns false if head turned away)
        const headFacingForward = this.analyzeHeadPose(landmarks);
        
        // SCREEN-AWARE: Check if looking at screen
        const isLookingAtScreen = gazeVector.lookingAtScreen && headFacingForward && !this.currentState.isBlinking;
        
        // Debug logging (occasionally)
        if (Math.random() < 0.02) {
            console.log('👁️ Gaze analysis:', {
                lookingAtScreen: isLookingAtScreen,
                horizontal: gazeVector.horizontal.toFixed(3),
                vertical: gazeVector.vertical.toFixed(3),
                direction: gazeVector.direction
            });
        }
        
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
        // SCREEN-RELATIVE GAZE: Recognize that screen is BELOW camera
        const leftIris = landmarks[468]; // Left iris center
        const rightIris = landmarks[473]; // Right iris center
        const noseTip = landmarks[1];
        const leftEyeOuter = landmarks[33];
        const rightEyeOuter = landmarks[263];
        const leftEyeInner = landmarks[133];
        const rightEyeInner = landmarks[362];
        
        // Normalize by eye width for better accuracy
        const eyeWidth = this.getDistance(leftEyeOuter, rightEyeOuter);
        const eyeCenterY = (leftEyeOuter.y + rightEyeOuter.y) / 2;
        
        // Calculate horizontal deviation from center
        const leftDeviation = (leftIris.x - leftEyeInner.x) / eyeWidth;
        const rightDeviation = (rightIris.x - rightEyeInner.x) / eyeWidth;
        const avgHorizontal = (leftDeviation + rightDeviation) / 2;
        
        // Calculate vertical gaze RELATIVE TO EYES (not nose)
        // Positive = looking DOWN at screen, Negative = looking UP away from screen
        const avgIrisY = (leftIris.y + rightIris.y) / 2;
        const verticalGaze = (avgIrisY - eyeCenterY) / eyeWidth;
        
        // SCREEN-AWARE THRESHOLDS
        // When looking at screen: eyes look DOWN (positive vertical) and CENTERED (low horizontal)
        const lookingAtScreen = 
            Math.abs(avgHorizontal) < this.eyeThresholds.gazeDeviation && // Centered horizontally
            verticalGaze > -0.1 && // Not looking up (away from screen)
            verticalGaze < this.eyeThresholds.gazeVerticalDeviation; // Not looking too far down
        
        // Determine direction
        let direction = 'center';
        const absHorizontal = Math.abs(avgHorizontal);
        
        if (!lookingAtScreen) {
            if (absHorizontal > this.eyeThresholds.gazeDeviation) {
                direction = avgHorizontal > 0 ? 'right' : 'left';
            } else if (verticalGaze < -0.1) {
                direction = 'up'; // Looking away from screen (upward)
            } else if (verticalGaze > this.eyeThresholds.gazeVerticalDeviation) {
                direction = 'down'; // Looking too far down (lap/phone)
            }
        }
        
        return {
            direction,
            horizontal: avgHorizontal,
            vertical: verticalGaze,
            magnitude: Math.sqrt(avgHorizontal * avgHorizontal + verticalGaze * verticalGaze),
            lookingAtScreen: lookingAtScreen,
            isStrict: !lookingAtScreen
        };
    }
    
    isGazeFocused(gazeVector) {
        // SIMPLIFIED: Use the screen-aware detection from calculateGazeDirection
        return gazeVector.lookingAtScreen;
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
        
        // Don't reset lastUpdateTime yet - calculateRealFocusMetrics needs it!
        
        // Check if user looked away for too long
        if (this.currentState.lookAwayStartTime) {
            const lookAwayDuration = now - this.currentState.lookAwayStartTime;
            
            if (lookAwayDuration > this.eyeThresholds.lookAwayDuration) {
                if (this.currentState.isFocused) {
                    this.currentState.isFocused = false;
                    this.focusData.lookAwayCount++;
                    this.onLookAway();
                }
            }
        } else {
            if (!this.currentState.isFocused) {
                this.currentState.isFocused = true;
                this.onReturnFocus();
            }
        }
        
        // Calculate focus score based on actual session time
        this.calculateRealFocusMetrics();
        
        // NOW update lastUpdateTime AFTER calculateRealFocusMetrics
        this.currentState.lastUpdateTime = now;
        
        // Track question-specific focus
        if (this.currentQuestion) {
            this.questionFocusHistory.push({
                timestamp: now,
                isFocused: this.currentState.isFocused,
                gazeDirection: this.currentState.gazeDirection
            });
        }
    }
    
    calculateRealFocusMetrics() {
        // IMPROVED: Use frame-based ratio instead of time accumulation
        if (!this.focusData.sessionStartTime) {
            return {
                totalTime: 0,
                focusedTime: 0,
                unfocusedTime: 0,
                focusScore: 0
            };
        }
        
        const now = Date.now();
        const actualTotalTime = now - this.focusData.sessionStartTime;
        this.focusData.totalTime = actualTotalTime;
        
        // Increment frame counters
        this.focusData.totalFrames++;
        if (this.currentState.isFocused && !this.currentState.lookAwayStartTime) {
            this.focusData.focusFrames++;
        }
        
        // Calculate focus score based on FRAME RATIO (more accurate)
        // This gives us the percentage of frames where user was focused
        if (this.focusData.totalFrames > 30) { // After ~1 second at 30fps
            this.focusData.averageFocusScore = Math.round(
                (this.focusData.focusFrames / this.focusData.totalFrames) * 100
            );
        } else {
            this.focusData.averageFocusScore = 0; // Not enough data yet
        }
        
        // Calculate estimated focused time from frame ratio
        this.focusData.focusedTime = (this.focusData.focusFrames / Math.max(1, this.focusData.totalFrames)) * actualTotalTime;
        this.focusData.unfocusedTime = actualTotalTime - this.focusData.focusedTime;
        
        // Debug logging (only every 30 frames to reduce spam)
        if (this.focusData.totalFrames % 90 === 0) {
            console.log('📊 Focus metrics:', {
                focusScore: this.focusData.averageFocusScore + '%',
                focusFrames: this.focusData.focusFrames,
                totalFrames: this.focusData.totalFrames,
                ratio: (this.focusData.focusFrames / this.focusData.totalFrames).toFixed(2)
            });
        }
        
        // Return metrics
        return {
            totalTime: this.focusData.totalTime,
            focusedTime: this.focusData.focusedTime,
            unfocusedTime: this.focusData.unfocusedTime,
            focusScore: this.focusData.averageFocusScore
        };
    }
    
    handleNoFaceDetected() {
        // NO FACE DETECTED = DEFINITELY UNFOCUSED
        // Mark as looking away immediately
        if (!this.currentState.lookAwayStartTime) {
            this.currentState.lookAwayStartTime = Date.now();
        }
        
        // Force unfocused state
        if (this.currentState.isFocused) {
            this.currentState.isFocused = false;
            this.focusData.lookAwayCount++;
            console.log('⚠️ No face detected - marking as unfocused');
        }
        
        // Set gaze to "away"
        this.currentState.gazeDirection = 'away';
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
        // DON'T call calculateRealFocusMetrics here - it's already called in updateFocusState()
        
        // Update focus score
        const scoreEl = document.getElementById('focus-score');
        if (scoreEl) {
            scoreEl.textContent = `${Math.round(this.focusData.averageFocusScore)}%`;
            scoreEl.className = 'stat-value ' + this.getFocusScoreClass(this.focusData.averageFocusScore);
        }
        
        // Update focused time
        const timeEl = document.getElementById('focused-time');
        if (timeEl) {
            const seconds = Math.round(this.focusData.focusedTime / 1000);
            timeEl.textContent = `${seconds}s`;
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
        // Update the focus score and time on the Focus Tracker card
        const scoreEl = document.getElementById('focus-score');
        const timeEl = document.getElementById('focused-time');
        
        // DON'T call calculateRealFocusMetrics here - use existing data from updateFocusState()
        
        if (scoreEl && this.isTracking) {
            scoreEl.textContent = `${Math.round(this.focusData.averageFocusScore)}%`;
        }
        
        if (timeEl && this.isTracking) {
            const focusTime = Math.round(this.focusData.focusedTime / 1000);
            timeEl.textContent = `${focusTime}s`;
        }
        
        // Log stats update (only occasionally to avoid console spam)
        const focusTimeSec = Math.round(this.focusData.focusedTime / 1000);
        if (focusTimeSec % 5 === 0 && focusTimeSec > 0) {
            console.log('📊 Stats updated:', {
                focusScore: Math.round(this.focusData.averageFocusScore) + '%',
                focusedTime: focusTimeSec + 's'
            });
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

// Initialize immediately - don't wait for DOMContentLoaded
(function initEyeTracker() {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupEyeTracker);
    } else {
        setupEyeTracker();
    }
})();

function setupEyeTracker() {
    console.log('🔧 Initializing Eye Tracker...');
    
    try {
        eyeTracker = new EyeTracker();
        window.eyeTracker = eyeTracker;
        console.log('✅ Eye Tracker initialized successfully');
        
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
            console.log('✅ Eye tracking button handler attached');
        } else {
            console.warn('⚠️ Eye tracking button not found');
        }
        
        // Add diagnostic function to window
        window.testEyeTracking = function() {
            console.log('🔍 Running diagnostics...');
            console.log('MediaPipe FaceMesh loaded:', typeof FaceMesh !== 'undefined');
            console.log('MediaPipe Camera loaded:', typeof Camera !== 'undefined');
            console.log('Eye tracker instance:', eyeTracker !== null);
            console.log('Is tracking:', eyeTracker?.isTracking);
            console.log('Video element:', eyeTracker?.videoElement);
            console.log('Canvas element:', eyeTracker?.canvasElement);
            
            if (typeof FaceMesh === 'undefined') {
                console.error('❌ FaceMesh not loaded! Check internet connection.');
            }
            if (typeof Camera === 'undefined') {
                console.error('❌ Camera not loaded! Check internet connection.');
            }
            
            console.log('✅ Diagnostics complete. Check messages above.');
        };
        
        console.log('💡 Type testEyeTracking() in console to run diagnostics');
        
    } catch (error) {
        console.error('❌ Failed to initialize Eye Tracker:', error);
    }
}
