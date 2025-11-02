/**
 * Gemini Voice Assistant with Automatic Context Injection
 * Knows your current question automatically + voice input/output
 */
class GeminiVoiceAssistant {
    constructor() {
        this.apiKey = null;
        this.elevenLabsApiKey = null;
        this.voiceId = 'wtQQHWfMy9WeIYuth5ga';
        this.currentContext = null;
        this.isListening = false;
        this.isSpeaking = false;
        this.recognition = null;
        this.chatPanel = null;
        this.textInput = null;
        this.messages = [];
        this.conversationHistory = [];
        this.currentAudio = null;
        this.lastQuizAnalytics = null; // Store last quiz analytics
        this.isProcessingToggle = false; // Prevent double-clicks
    }

    async initialize() {
        this.apiKey = localStorage.getItem('gemini_api_key');
        this.elevenLabsApiKey = localStorage.getItem('elevenlabs_api_key');
        
        // Load last quiz analytics from localStorage
        const savedLastQuizAnalytics = localStorage.getItem('lastQuizAnalytics');
        if (savedLastQuizAnalytics) {
            this.lastQuizAnalytics = JSON.parse(savedLastQuizAnalytics);
            console.log('📊 Loaded last quiz analytics from localStorage:', this.lastQuizAnalytics);
        }

        if (!this.apiKey) {
            console.warn('No Gemini API key found in localStorage');
            this.checkForApiKey();
        } else {
            console.log('Gemini API key loaded');
        }

        if (!this.elevenLabsApiKey) {
            console.warn('No ElevenLabs API key found - voice output will be disabled');
        } else {
            console.log('ElevenLabs API key loaded');
        }

        if ('speechSynthesis' in window) {
            window.speechSynthesis.onvoiceschanged = () => {
                const voices = window.speechSynthesis.getVoices();
                console.log(`Loaded ${voices.length} voices`);
            };
            window.speechSynthesis.getVoices();
        }

        this.createChatPanel();
        this.initializeSpeechRecognition();
        console.log('Gemini Voice Assistant ready');
        return true;
    }

    checkForApiKey() {
        const interval = setInterval(() => {
            this.apiKey = localStorage.getItem('gemini_api_key');
            if (this.apiKey) {
                console.log('API key found!');
                clearInterval(interval);
            }
        }, 1000);
        setTimeout(() => clearInterval(interval), 10000);
    }

    initializeSpeechRecognition() {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.recognition = new SpeechRecognition();
            this.recognition.continuous = false; // Listen for single utterance
            this.recognition.interimResults = true; // Show interim results
            this.recognition.lang = 'en-US';
            this.recognition.maxAlternatives = 1;

            this.recognition.onstart = () => {
                console.log('🎤 Recognition started - SPEAK NOW!');
                this.updateStatus('🎤 Listening... SPEAK NOW!', 'success');
            };

            this.recognition.onresult = (event) => {
                // Get the most recent result
                const lastResultIndex = event.results.length - 1;
                const result = event.results[lastResultIndex];
                
                if (result.isFinal) {
                    const transcript = result[0].transcript.trim();
                    console.log('✅ ✅ ✅ HEARD (FINAL):', transcript);
                    console.log('📝 Transcript length:', transcript.length, 'characters');
                    
                    if (transcript.length > 0) {
                        // Show what we heard in a visible alert
                        this.addSystemMessage(`🎤 I heard you say: "${transcript}"`);
                        
                        // Don't stop listening - just process the message
                        // The recognition will auto-restart for the next question
                        this.handleUserMessage(transcript);
                        
                        // Optional: If you want to stop after one question, uncomment:
                        // this.stopListening();
                    } else {
                        console.log('⚠️ Empty transcript received');
                    }
                } else {
                    // Show interim results
                    const transcript = result[0].transcript;
                    console.log('⏳ Hearing (interim):', transcript);
                    this.updateStatus(`Hearing: "${transcript}"...`, 'success');
                }
            };

            this.recognition.onerror = (event) => {
                console.error('❌ Speech recognition error:', event.error);
                
                if (event.error === 'no-speech') {
                    this.updateStatus('⚠️ NO SPEECH DETECTED! Check your microphone!', 'warning');
                    console.log('⚠️⚠️⚠️ NO SPEECH DETECTED!');
                    console.log('Troubleshooting:');
                    console.log('1. Is your microphone unmuted?');
                    console.log('2. Is microphone volume high enough?');
                    console.log('3. Is the correct microphone selected in browser settings?');
                    console.log('4. Try speaking MUCH LOUDER or closer to the mic');
                    
                    // Don't auto-restart on no-speech - user needs to fix mic
                    // Just keep the mic open and waiting
                    console.log('Keeping microphone open - try speaking now...');
                } else if (event.error === 'not-allowed') {
                    this.updateStatus('❌ Microphone permission denied', 'error');
                    alert('🎤 Please allow microphone access!\n\n1. Click the 🔒 lock icon in your browser address bar\n2. Allow microphone access\n3. Refresh the page');
                    this.isListening = false;
                    this.updateMicButton();
                } else if (event.error === 'audio-capture') {
                    this.updateStatus('❌ No microphone found', 'error');
                    alert('🎤 No microphone detected!\n\nPlease connect a microphone and try again.');
                    this.isListening = false;
                    this.updateMicButton();
                } else if (event.error === 'network') {
                    this.updateStatus('❌ Network error. Check your connection.', 'error');
                    this.isListening = false;
                    this.updateMicButton();
                } else {
                    this.updateStatus('❌ Microphone error: ' + event.error, 'error');
                    this.isListening = false;
                    this.updateMicButton();
                }
            };

            this.recognition.onend = () => {
                console.log('🔇 Recognition ended');
                console.log('  isListening state:', this.isListening);
                console.log('  Will restart?', this.isListening);
                
                // IMPORTANT: The recognition ended, but we want to keep listening
                // So we restart it automatically
                if (this.isListening) {
                    console.log('⚡ Restarting in 100ms...');
                    setTimeout(() => {
                        if (this.isListening) {
                            try {
                                console.log('🔄 Attempting restart...');
                                this.recognition.start();
                                this.updateStatus('🎤 Listening... SPEAK NOW!', 'success');
                                console.log('✅ Restarted successfully');
                            } catch (e) {
                                console.error('❌ Failed to restart:', e);
                                // Only set to false if we really failed
                                this.isListening = false;
                                this.updateMicButton();
                                this.updateStatus('❌ Microphone stopped. Click to restart.', 'error');
                            }
                        } else {
                            console.log('⏹️ Not restarting - user stopped listening');
                        }
                    }, 100);
                } else {
                    console.log('⏹️ Stopping - user clicked stop');
                    this.updateMicButton();
                    this.updateStatus('Ready to help!', 'info');
                }
            };

            console.log('✅ Speech recognition initialized');
        } else {
            console.warn('⚠️ Speech recognition not supported');
            alert('Voice input is not supported in your browser.\n\nPlease use:\n• Chrome\n• Edge\n• Safari (iOS)');
        }
    }

    createChatPanel() {
        const existingPanel = document.getElementById('gemini-voice-panel');
        if (existingPanel) {
            console.log('Removing existing chat panel');
            existingPanel.remove();
        }

        this.chatPanel = document.createElement('div');
        this.chatPanel.id = 'gemini-voice-panel';
        this.chatPanel.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            width: 420px;
            height: 620px;
            background: rgba(255, 255, 255, 0.15);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.25);
            border-radius: 24px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4), 0 0 1px rgba(255, 255, 255, 0.5) inset;
            color: white;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            z-index: 10000;
            display: none;
            flex-direction: column;
            overflow: hidden;
        `;

        this.chatPanel.innerHTML = `
            <div style="
                padding: 24px;
                background: linear-gradient(135deg, rgba(0, 0, 0, 0.6) 0%, rgba(20, 20, 30, 0.7) 100%);
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                backdrop-filter: blur(20px);
            ">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div style="
                            width: 40px;
                            height: 40px;
                            background: linear-gradient(135deg, #000000, #1a1a2e);
                            border: 2px solid rgba(255, 255, 255, 0.2);
                            border-radius: 12px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            font-size: 20px;
                            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
                        ">🤖</div>
                        <div>
                            <h3 style="margin: 0; font-size: 18px; font-weight: 600;">BrahmaGupta</h3>
                            <p style="margin: 0; font-size: 12px; opacity: 0.7;">Powered by Gemini</p>
                        </div>
                    </div>
                    <button onclick="window.geminiAssistant.hide()" style="
                        background: rgba(255, 255, 255, 0.1);
                        border: 1px solid rgba(255, 255, 255, 0.15);
                        color: white;
                        cursor: pointer;
                        padding: 8px 12px;
                        border-radius: 10px;
                        font-size: 20px;
                        transition: all 0.2s;
                        backdrop-filter: blur(10px);
                    " onmouseover="this.style.background='rgba(255,255,255,0.2)'" 
                       onmouseout="this.style.background='rgba(255,255,255,0.1)'">×</button>
                </div>
                <div id="voice-status" style="
                    margin-top: 12px;
                    font-size: 13px;
                    padding: 10px 14px;
                    background: rgba(0, 0, 0, 0.3);
                    backdrop-filter: blur(5px);
                    border-radius: 10px;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    color: rgba(255, 255, 255, 0.9);
                ">Ready to help!</div>
            </div>
            
            <div id="chat-messages" style="
                flex: 1;
                overflow-y: auto;
                padding: 20px;
                display: flex;
                flex-direction: column;
                gap: 12px;
                background: rgba(0, 0, 0, 0.2);
            ">
                <div style="
                    background: linear-gradient(135deg, rgba(30, 30, 40, 0.8), rgba(20, 20, 30, 0.8));
                    backdrop-filter: blur(15px);
                    border: 1px solid rgba(255, 255, 255, 0.15);
                    padding: 14px 16px;
                    border-radius: 14px;
                    font-size: 14px;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
                ">
                    <strong>Hi there!</strong> I can see your current question. Ask me anything to get started!
                </div>
                
                <!-- Quick Action: Analytics Flashcard -->
                <div id="analytics-flashcard" style="
                    background: linear-gradient(135deg, rgba(0, 0, 0, 0.6), rgba(16, 185, 129, 0.2));
                    backdrop-filter: blur(15px);
                    border: 1px solid rgba(16, 185, 129, 0.4);
                    padding: 16px;
                    border-radius: 14px;
                    cursor: pointer;
                    transition: all 0.3s;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4), 0 0 20px rgba(16, 185, 129, 0.1);
                " onclick="window.geminiAssistant.requestAnalytics()"
                   onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 16px rgba(16, 185, 129, 0.3)'"
                   onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(0, 0, 0, 0.1)'">
                    <div style="font-size: 24px;">📊</div>
                    <div style="flex: 1;">
                        <div style="font-weight: 600; margin-bottom: 4px;">View Quiz Analytics</div>
                        <div style="font-size: 12px; opacity: 0.8;">See your latest quiz performance breakdown</div>
                    </div>
                    <div style="font-size: 20px; opacity: 0.6;">→</div>
                </div>
            </div>
            
            <div style="
                padding: 20px;
                background: linear-gradient(135deg, rgba(0, 0, 0, 0.5), rgba(20, 20, 30, 0.6));
                backdrop-filter: blur(15px);
                border-top: 1px solid rgba(255, 255, 255, 0.1);
            ">
                <div style="display: flex; gap: 10px; margin-bottom: 12px;">
                    <button id="mic-button" onclick="window.geminiAssistant.toggleVoice()" style="
                        flex: 1;
                        padding: 14px 18px;
                        background: linear-gradient(135deg, rgba(16, 185, 129, 0.8), rgba(5, 150, 105, 0.9));
                        border: 1px solid rgba(16, 185, 129, 0.5);
                        color: white;
                        border-radius: 12px;
                        cursor: pointer;
                        font-size: 14px;
                        font-weight: 600;
                        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4), 0 0 20px rgba(16, 185, 129, 0.2);
                        transition: all 0.3s;
                    " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 24px rgba(0,0,0,0.5), 0 0 30px rgba(16,185,129,0.3)'" 
                       onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 20px rgba(0,0,0,0.4), 0 0 20px rgba(16,185,129,0.2)'">
                        Speak Your Question
                    </button>
                    <button onclick="window.geminiAssistant.stopSpeaking()" style="
                        padding: 14px 18px;
                        background: linear-gradient(135deg, rgba(239, 68, 68, 0.8), rgba(220, 38, 38, 0.9));
                        border: 1px solid rgba(239, 68, 68, 0.5);
                        color: white;
                        border-radius: 12px;
                        cursor: pointer;
                        font-size: 14px;
                        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
                        transition: all 0.3s;
                    " onmouseover="this.style.transform='translateY(-2px)'" 
                       onmouseout="this.style.transform='translateY(0)'">Stop</button>
                    <button onclick="window.geminiAssistant.showVoiceSettings()" style="
                        padding: 14px 18px;
                        background: linear-gradient(135deg, rgba(245, 158, 11, 0.8), rgba(217, 119, 6, 0.9));
                        border: 1px solid rgba(245, 158, 11, 0.5);
                        color: white;
                        border-radius: 12px;
                        cursor: pointer;
                        font-size: 14px;
                        box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
                        transition: all 0.3s;
                    " title="ElevenLabs Voice Settings"
                       onmouseover="this.style.transform='translateY(-2px)'" 
                       onmouseout="this.style.transform='translateY(0)'">Settings</button>
                </div>
                <div style="display: flex; gap: 10px;">
                    <input type="text" id="gemini-text-input" placeholder="Or type your question..." style="
                        flex: 1;
                        padding: 14px 16px;
                        background: rgba(0, 0, 0, 0.4);
                        backdrop-filter: blur(10px);
                        border: 1px solid rgba(255, 255, 255, 0.2);
                        border-radius: 12px;
                        font-size: 14px;
                        color: white;
                        outline: none;
                        transition: all 0.3s;
                    " onfocus="this.style.background='rgba(0,0,0,0.5)'; this.style.borderColor='rgba(255,255,255,0.3)'; this.style.boxShadow='0 0 20px rgba(255,255,255,0.1)'"
                       onblur="this.style.background='rgba(0,0,0,0.4)'; this.style.borderColor='rgba(255,255,255,0.2)'; this.style.boxShadow='none'">
                    <button onclick="window.geminiAssistant.sendTextMessage()" style="
                        padding: 14px 24px;
                        background: linear-gradient(135deg, rgba(0, 0, 0, 0.7), rgba(30, 30, 40, 0.8));
                        border: 1px solid rgba(255, 255, 255, 0.3);
                        color: white;
                        border-radius: 12px;
                        cursor: pointer;
                        font-weight: 600;
                        font-size: 14px;
                        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5), 0 0 20px rgba(255, 255, 255, 0.1);
                        transition: all 0.3s;
                    " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 24px rgba(0,0,0,0.6), 0 0 30px rgba(255,255,255,0.2)'"
                       onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 20px rgba(0,0,0,0.5), 0 0 20px rgba(255,255,255,0.1)'">Send</button>
                </div>
            </div>
        `;

        document.body.appendChild(this.chatPanel);
        
        this.textInput = document.getElementById('gemini-text-input');
        
        if (this.textInput) {
            this.textInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.sendTextMessage();
                }
            });
        }
    }

    show() {
        if (this.chatPanel) {
            this.chatPanel.style.display = 'flex';
            this.conversationHistory = [];
            if (this.currentContext) {
                this.addSystemMessage(`Current Question: ${this.currentContext.questionIndex}/${this.currentContext.totalQuestions}\n\n"${this.currentContext.question}"`);
            }
        }
    }

    hide() {
        if (this.chatPanel) {
            this.chatPanel.style.display = 'none';
        }
        this.stopListening();
        this.stopSpeaking();
        
        // SAVE current context as last quiz analytics before clearing
        if (this.currentContext && this.currentContext.analytics) {
            this.lastQuizAnalytics = {
                ...this.currentContext.analytics,
                savedAt: new Date().toISOString()
            };
            // Persist to localStorage with separate key
            localStorage.setItem('lastQuizAnalytics', JSON.stringify(this.lastQuizAnalytics));
            console.log('💾 Saved last quiz analytics to localStorage:', this.lastQuizAnalytics);
        }
        
        // CLEAR conversation memory to start fresh next time
        this.conversationHistory = [];
        this.currentContext = null;
        console.log('🧹 Conversation memory cleared for next session');
    }

    updateQuizContext(data) {
        this.currentContext = data;
        console.log('Context updated:', data);
    }

    toggleVoice() {
        console.log('🔀 toggleVoice() called, current isListening:', this.isListening);
        console.log('  isProcessingToggle:', this.isProcessingToggle);
        
        // Prevent double-clicks
        if (this.isProcessingToggle) {
            console.log('⏸️ ⚠️ IGNORING CLICK - Still processing! Wait for button to update!');
            alert('⏸️ Please wait! The microphone is still starting...');
            return;
        }
        
        this.isProcessingToggle = true;
        console.log('🔒 Locked toggle processing');
        
        if (this.isListening) {
            console.log('  → Calling stopListening()');
            this.stopListening();
        } else {
            console.log('  → Calling startListening()');
            this.startListening();
        }
        
        // Reset after 1000ms (1 second) to allow the next toggle
        setTimeout(() => {
            this.isProcessingToggle = false;
            console.log('✅ Toggle processing unlocked - can click again now');
        }, 1000);
    }

    startListening() {
        if (!this.recognition) {
            alert('🎤 Voice input not supported!\n\nPlease use:\n• Chrome\n• Edge\n• Safari (iOS)');
            return;
        }

        if (!this.apiKey) {
            this.apiKey = localStorage.getItem('gemini_api_key');
            if (!this.apiKey) {
                alert('🔑 Please setup your Gemini API key first!\n\nSteps:\n1. Click the gear icon (⚙️ Setup API)\n2. Enter your Gemini API key\n3. Click Save');
                return;
            }
        }

        // If already listening, ignore
        if (this.isListening) {
            console.log('⚠️ Already listening, ignoring start request');
            return;
        }

        // Check microphone permissions first
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            navigator.mediaDevices.getUserMedia({ audio: true })
                .then(stream => {
                    console.log('✅ Microphone access granted');
                    // Stop the test stream
                    stream.getTracks().forEach(track => track.stop());
                    
                    // Now start actual recognition
                    try {
                        this.isListening = true;
                        this.updateMicButton(); // Update button IMMEDIATELY
                        this.recognition.start();
                        this.updateStatus('🎤 Listening... speak now!', 'success');
                        console.log('🎤 Started listening - SAY SOMETHING NOW!');
                    } catch (error) {
                        console.error('Failed to start recognition:', error);
                        
                        if (error.message && error.message.includes('already started')) {
                            console.log('Recognition already running - this is OK, continuing...');
                            // Don't try to restart, it's already running
                        } else {
                            this.isListening = false;
                            this.updateMicButton();
                            alert('Failed to start microphone.\n\nPlease refresh the page and try again.');
                        }
                    }
                })
                .catch(error => {
                    console.error('❌ Microphone permission denied:', error);
                    alert('🎤 Microphone Access Required!\n\n' +
                          'Please:\n' +
                          '1. Click the 🔒 or ⓘ icon in the address bar\n' +
                          '2. Find "Microphone" permissions\n' +
                          '3. Change to "Allow"\n' +
                          '4. Refresh the page\n\n' +
                          'Or try:\n' +
                          '• Settings → Privacy → Microphone\n' +
                          '• Allow this site to use microphone');
                });
        } else {
            // Fallback for browsers without getUserMedia
            try {
                if (this.isListening) {
                    console.log('⚠️ Already listening (fallback), ignoring');
                    return;
                }
                this.isListening = true;
                this.updateMicButton();
                this.recognition.start();
                this.updateStatus('🎤 Listening... speak now!', 'success');
                console.log('🎤 Started listening (fallback)');
            } catch (error) {
                console.error('Failed to start recognition:', error);
                if (!error.message.includes('already started')) {
                    this.isListening = false;
                    this.updateMicButton();
                    alert('Failed to start microphone.\n\nPlease refresh the page and try again.');
                }
            }
        }
    }

    stopListening() {
        const stack = new Error().stack;
        console.log('🛑 stopListening() called from:', stack);
        console.log('🛑 stopListening() called, current state:', this.isListening);
        if (this.recognition && this.isListening) {
            this.recognition.stop();
            this.isListening = false;
            console.log('🛑 Set isListening = false');
            this.updateMicButton();
            this.updateStatus('Ready to help!', 'info');
        }
    }

    updateMicButton() {
        const btn = document.getElementById('mic-button');
        if (btn) {
            if (this.isListening) {
                btn.innerHTML = `
                    <span style="display: flex; align-items: center; gap: 8px;">
                        <span style="animation: pulse 1s infinite; font-size: 20px;">🎤</span>
                        <span>LISTENING... Click to Stop</span>
                    </span>
                `;
                btn.style.background = 'linear-gradient(135deg, rgba(255, 152, 0, 0.9), rgba(245, 124, 0, 0.9))';
                btn.style.animation = 'pulse 1.5s infinite';
                btn.style.border = '2px solid #ff9800';
                btn.style.boxShadow = '0 0 20px rgba(255, 152, 0, 0.5)';
            } else {
                btn.innerHTML = 'Speak Your Question';
                btn.style.background = 'linear-gradient(135deg, rgba(16, 185, 129, 0.8), rgba(5, 150, 105, 0.9))';
                btn.style.animation = 'none';
                btn.style.border = '1px solid rgba(16, 185, 129, 0.5)';
                btn.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.4), 0 0 20px rgba(16, 185, 129, 0.2)';
            }
        }
    }

    // Triggered by the analytics flashcard button
    requestAnalytics() {
        console.log('📊 Analytics flashcard clicked');
        
        // Hide the flashcard after clicking
        const flashcard = document.getElementById('analytics-flashcard');
        if (flashcard) {
            flashcard.style.display = 'none';
        }
        
        // Trigger analytics display directly
        this.handleUserMessage('what was my latest quiz analysis');
    }

    sendTextMessage() {
        console.log('sendTextMessage called');
        
        let input = this.textInput;
        
        if (!input) {
            console.warn('Stored reference lost, searching DOM...');
            input = document.getElementById('gemini-text-input');
            this.textInput = input;
        }

        if (!input) {
            console.error('Input element not found in DOM!');
            alert('Error: Text input not found. Please close and reopen the chat.');
            return;
        }

        const message = input.value.trim();
        if (!message) {
            alert('Please type a message before clicking Send!');
            return;
        }

        console.log('Sending message:', message);
        this.handleUserMessage(message);
        input.value = '';
    }

    async handleUserMessage(message) {
        console.log('handleUserMessage called with:', message);

        if (!this.apiKey) {
            this.apiKey = localStorage.getItem('gemini_api_key');
            console.log('Checking for API key...', this.apiKey ? 'Found!' : 'Not found');
        }

        // Check for analytics request
        const analyticsKeywords = [
            'how did i do', 'my performance', 'how am i doing', 'quiz results', 
            'analytics', 'how i did', 'my progress', 'areas to work on', 
            'weak areas', 'strengths', 'weaknesses', 'recent quiz', 'my results',
            'give me my analytics', 'show me my analytics', 'tell me my results',
            'can u tell me', 'can you tell me', 'analysis of', 'my analysis',
            'latest quiz', 'last quiz', 'quiz analysis', 'analyze my', 'give me analysis'
        ];
        const isAskingForAnalytics = analyticsKeywords.some(keyword => 
            message.toLowerCase().includes(keyword)
        );

        console.log('Checking for analytics request:', isAskingForAnalytics);
        console.log('User message:', message.toLowerCase());

        if (isAskingForAnalytics) {
            console.log('Analytics request detected!');
            this.addUserMessage(message);

            try {
                // PRIORITY 1: Use in-memory last quiz analytics if available
                let analytics = null;
                
                if (this.lastQuizAnalytics) {
                    console.log('✅ Using in-memory last quiz analytics:', this.lastQuizAnalytics);
                    analytics = this.lastQuizAnalytics;
                } else {
                    // PRIORITY 2: Check localStorage for lastQuizAnalytics (completed quiz)
                    const savedLastAnalytics = localStorage.getItem('lastQuizAnalytics');
                    console.log('Saved last analytics from localStorage:', savedLastAnalytics);
                    
                    if (savedLastAnalytics) {
                        analytics = JSON.parse(savedLastAnalytics);
                        console.log('✅ Using localStorage last quiz analytics');
                    } else {
                        // PRIORITY 3: Try to get from currentContext (active quiz)
                        if (this.currentContext && this.currentContext.analytics) {
                            console.log('✅ Using current context analytics');
                            analytics = this.currentContext.analytics;
                        } else {
                            // PRIORITY 4: Fall back to in-progress quizAnalytics
                            const savedAnalytics = localStorage.getItem('quizAnalytics');
                            console.log('Saved in-progress analytics from localStorage:', savedAnalytics);
                            
                            if (savedAnalytics) {
                                analytics = JSON.parse(savedAnalytics);
                                console.log('✅ Using in-progress quiz analytics');
                            }
                        }
                    }
                }

                if (!analytics || !analytics.questionTimes || analytics.questionTimes.length === 0) {
                    this.addAIMessage('No quiz data available yet.\n\nPlease complete a quiz first, then ask me about your performance!');
                    return;
                }

                // Calculate statistics
                let totalTime = 0;
                let correctCount = 0;

                analytics.questionTimes.forEach(q => {
                    totalTime += q.timeSpent;
                    if (q.correct) correctCount++;
                });

                const avgTime = (totalTime / analytics.questionTimes.length).toFixed(1);
                const accuracy = ((correctCount / analytics.questionTimes.length) * 100).toFixed(1);

                // Topic breakdown
                const topicBreakdown = [];
                for (const [topic, data] of Object.entries(analytics.topicPerformance)) {
                    const avgTopicTime = (data.totalTime / data.count).toFixed(1);
                    const topicAccuracy = ((data.correctCount / data.count) * 100).toFixed(1);
                    topicBreakdown.push({
                        topic: topic,
                        count: data.count,
                        avgTime: parseFloat(avgTopicTime),
                        accuracy: parseFloat(topicAccuracy),
                        totalTime: parseFloat(data.totalTime.toFixed(1)),
                        correct: data.correctCount
                    });
                }

                topicBreakdown.sort((a, b) => b.avgTime - a.avgTime);

                const weakAreas = topicBreakdown.filter(t => 
                    t.accuracy < 70 || t.avgTime > parseFloat(avgTime) * 1.2
                );
                const strongAreas = topicBreakdown.filter(t => 
                    t.accuracy >= 80 && t.avgTime <= parseFloat(avgTime)
                );

                // Build formatted message
                let analyticsMessage = `QUIZ PERFORMANCE ANALYSIS\n\n`;
                analyticsMessage += `========================================\n\n`;
                analyticsMessage += `OVERALL PERFORMANCE\n\n`;
                analyticsMessage += `Total Questions: ${analytics.questionTimes.length}\n`;
                analyticsMessage += `Total Time: ${totalTime.toFixed(1)}s\n`;
                analyticsMessage += `Average Time: ${avgTime}s per question\n`;
                analyticsMessage += `Accuracy: ${accuracy}% (${correctCount}/${analytics.questionTimes.length} correct)\n\n`;
                analyticsMessage += `========================================\n\n`;
                analyticsMessage += `TOPIC BREAKDOWN\n`;
                analyticsMessage += `(Sorted by time spent)\n\n`;

                topicBreakdown.forEach((topic, index) => {
                    analyticsMessage += `${index + 1}. ${topic.topic}\n`;
                    analyticsMessage += `   Questions: ${topic.count}\n`;
                    analyticsMessage += `   Avg Time: ${topic.avgTime}s\n`;
                    analyticsMessage += `   Accuracy: ${topic.accuracy}% (${topic.correct}/${topic.count})\n`;
                    analyticsMessage += `   Total Time: ${topic.totalTime}s\n\n`;
                });

                if (weakAreas.length > 0 || strongAreas.length > 0) {
                    analyticsMessage += `========================================\n\n`;
                }

                if (weakAreas.length > 0) {
                    analyticsMessage += `AREAS NEEDING IMPROVEMENT\n\n`;
                    weakAreas.forEach(topic => {
                        analyticsMessage += `- ${topic.topic}\n`;
                        if (topic.accuracy < 70) {
                            analyticsMessage += `  Low accuracy: ${topic.accuracy}%\n`;
                        }
                        if (topic.avgTime > parseFloat(avgTime) * 1.2) {
                            analyticsMessage += `  Slow response: ${topic.avgTime}s vs ${avgTime}s avg\n`;
                        }
                        analyticsMessage += `\n`;
                    });
                }

                if (strongAreas.length > 0) {
                    analyticsMessage += `STRONG AREAS\n\n`;
                    strongAreas.forEach(topic => {
                        analyticsMessage += `- ${topic.topic}\n`;
                        analyticsMessage += `  High accuracy: ${topic.accuracy}%\n`;
                        analyticsMessage += `  Fast response: ${topic.avgTime}s\n\n`;
                    });
                }

                if (weakAreas.length > 0) {
                    analyticsMessage += `========================================\n\n`;
                    analyticsMessage += `RECOMMENDATIONS\n\n`;
                    const leastAccurate = [...topicBreakdown].sort((a, b) => a.accuracy - b.accuracy)[0];
                    const slowest = topicBreakdown[0];
                    
                    analyticsMessage += `- Focus on "${leastAccurate.topic}"\n`;
                    analyticsMessage += `  to improve accuracy\n`;
                    analyticsMessage += `  (currently ${leastAccurate.accuracy}%)\n\n`;
                    
                    if (slowest.topic !== leastAccurate.topic) {
                        analyticsMessage += `- Practice "${slowest.topic}"\n`;
                        analyticsMessage += `  for better time management\n`;
                        analyticsMessage += `  (avg ${slowest.avgTime}s)\n\n`;
                    }
                    
                    analyticsMessage += `- Review incorrect answers and\n`;
                    analyticsMessage += `  identify common mistakes\n`;
                } else {
                    analyticsMessage += `========================================\n\n`;
                    analyticsMessage += `RECOMMENDATIONS\n\n`;
                    analyticsMessage += `- Great job! Keep up the\n`;
                    analyticsMessage += `  consistent performance\n\n`;
                    analyticsMessage += `- Challenge yourself with\n`;
                    analyticsMessage += `  more advanced topics\n`;
                }

                this.addAIMessage(analyticsMessage);
                return;

            } catch (e) {
                console.error('Error getting analytics:', e);
                this.addAIMessage('Unable to retrieve quiz analytics. Please try again.');
                return;
            }
        }

        // Continue with normal Gemini flow
        if (!this.apiKey) {
            console.error('No API key - stopping here');
            this.addAIMessage('No API key found. Please setup your Gemini API key first.\n\nClick the "Setup API" button at the top of the page.');
            this.updateStatus('API key required', 'error');
            return;
        }

        console.log('API key verified, proceeding...');
        this.addUserMessage(message);
        this.conversationHistory.push({
            role: 'user',
            text: message
        });

        // Check for practice questions request
        const practiceKeywords = [
            'give me questions', 'practice questions', 'more questions',
            'questions on', 'questions about', 'practice problems',
            'generate questions', 'quiz me on', 'test me on'
        ];
        const isAskingForPractice = practiceKeywords.some(keyword =>
            message.toLowerCase().includes(keyword)
        );

        // Build prompt
        let fullPrompt = '';
        fullPrompt += `You are a friendly Socratic math tutor having a conversation with a student.\n\n`;

        if (this.currentContext && this.currentContext.question) {
            fullPrompt += `CURRENT QUIZ PROBLEM: "${this.currentContext.question}"\n`;
            fullPrompt += `TOPIC: ${this.currentContext.topic || 'Mathematics'}\n`;
            fullPrompt += `Help the student with THIS specific problem they're working on.\n\n`;
        } else {
            fullPrompt += `The student is NOT currently taking a quiz. Help them with general questions or generate practice problems.\n\n`;
        }

        if (isAskingForPractice) {
            // Detect specific topics from the message
            const topicLower = message.toLowerCase();
            let specificTopic = '';
            let examples = '';
            
            if (topicLower.includes('integral') || topicLower.includes('integration')) {
                specificTopic = 'INTEGRALS/INTEGRATION';
                examples = `ONLY create INTEGRATION problems. Examples:
- "Evaluate ∫(2x + 3)dx"
- "Find ∫(x² - 4x + 1)dx"
- "Calculate ∫sin(x)dx"
- "Evaluate ∫(1/x)dx"
DO NOT create derivative problems. ONLY integrals.`;
            } else if (topicLower.includes('derivative') || topicLower.includes('differentiation')) {
                specificTopic = 'DERIVATIVES/DIFFERENTIATION';
                examples = `ONLY create DERIVATIVE problems. Examples:
- "What is d/dx(3x² + 2x - 5)?"
- "Find f'(x) if f(x) = x³ - 2x"
- "Differentiate sin(2x)"
DO NOT create integral problems. ONLY derivatives.`;
            } else if (topicLower.includes('limit')) {
                specificTopic = 'LIMITS';
                examples = `ONLY create LIMIT problems. Examples:
- "Find lim(x→2) (x²-4)/(x-2)"
- "Evaluate lim(x→∞) (1/x)"
- "Calculate lim(x→0) (sin(x)/x)"`;
            } else {
                specificTopic = 'CALCULUS';
                examples = `Examples:
- For Limits: "Find lim(x→2) (x²-4)/(x-2)"
- For Derivatives: "What is d/dx(3x² + 2x - 5)?"
- For Integrals: "Evaluate ∫(2x + 3)dx"`;
            }
            
            fullPrompt += `The student is asking for practice questions on ${specificTopic}. Generate 3-4 complete problems STRICTLY on this topic.\n\n`;
            fullPrompt += `⚠️ CRITICAL: ${examples}\n\n`;
            fullPrompt += `FORMAT EXACTLY LIKE THIS:\n\n`;
            fullPrompt += `Here are practice questions on ${specificTopic}:\n\n`;
            fullPrompt += `Question 1: [Write a clear, specific calculus problem]\n`;
            fullPrompt += `A) [Specific numerical/algebraic answer]\n`;
            fullPrompt += `B) [Specific numerical/algebraic answer]\n`;
            fullPrompt += `C) [Specific numerical/algebraic answer]\n`;
            fullPrompt += `D) [Specific numerical/algebraic answer]\n`;
            fullPrompt += `Correct Answer: [Letter]\n`;
            fullPrompt += `Explanation: [Brief explanation of solution method]\n\n`;
            fullPrompt += `Question 2: [Next problem]...\n\n`;
            fullPrompt += `Make questions progressively harder. Use actual calculus problems with specific numbers and functions.\n`;
        }

        fullPrompt += `YOUR ROLE AS TUTOR:
- DO NOT give the final answer or reveal which choice is correct for current quiz questions
- Guide them to understand HOW to solve it
- Suggest the mathematical method or rule to use
- Ask guiding questions to make them think
- Keep responses brief (2-3 sentences max) for quiz help
- Be encouraging and remember what you've already told them
- Don't repeat the same hints - build on previous conversation
- If asked about performance, analyze the data and give specific advice
- If student asks for practice questions on a topic, generate 3-5 practice problems with multiple choice options
- For practice questions, you CAN provide the correct answer at the end

`;

        if (this.conversationHistory.length > 1) {
            fullPrompt += `CONVERSATION SO FAR:\n`;
            const recentHistory = this.conversationHistory.slice(-6);
            recentHistory.forEach(msg => {
                if (msg.role === 'user') {
                    fullPrompt += `Student: "${msg.text}"\n`;
                } else {
                    fullPrompt += `You (Tutor): "${msg.text}"\n`;
                }
            });
            fullPrompt += '\n';
        }

        fullPrompt += `Now respond to the student's latest message. Remember what you've already explained and don't repeat yourself:\n`;
        fullPrompt += `Your response:`;

        this.updateStatus('Thinking...', 'info');
        console.log('Sending to Gemini API...');

        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-latest:generateContent?key=${this.apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: fullPrompt
                        }]
                    }]
                })
            });

            console.log('Response status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('API Error:', errorText);
                throw new Error(`API returned ${response.status}: ${errorText}`);
            }

            const data = await response.json();
            console.log('Response data:', data);

            if (data.candidates && data.candidates[0].content) {
                const aiResponse = data.candidates[0].content.parts[0].text;
                console.log('AI Response:', aiResponse.substring(0, 100) + '...');

                this.conversationHistory.push({
                    role: 'assistant',
                    text: aiResponse
                });

                if (this.conversationHistory.length > 12) {
                    this.conversationHistory = this.conversationHistory.slice(-12);
                }

                this.addAIMessage(aiResponse);
                this.speakResponse(aiResponse);

            } else if (data.error) {
                console.error('API Error:', data.error);
                throw new Error(data.error.message || 'API Error');
            } else {
                console.error('Invalid response format:', data);
                throw new Error('Invalid response format');
            }

        } catch (error) {
            console.error('Gemini API error:', error);
            this.addSystemMessage('Sorry, I encountered an error: ' + error.message);
            this.updateStatus('Error - try again', 'error');
        }
    }

    addUserMessage(text) {
        console.log('Adding user message:', text);
        const container = document.getElementById('chat-messages');
        if (!container) {
            console.error('Messages container not found!');
            return;
        }

        const msg = document.createElement('div');
        msg.style.cssText = `
            background: linear-gradient(135deg, rgba(20, 20, 30, 0.95), rgba(30, 30, 40, 0.95));
            backdrop-filter: blur(15px);
            color: white;
            padding: 14px 18px;
            border-radius: 16px 16px 4px 16px;
            align-self: flex-end;
            max-width: 75%;
            font-size: 14px;
            line-height: 1.6;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5), 0 0 15px rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.2);
            margin-left: auto;
            white-space: pre-wrap;
        `;
        msg.textContent = text;
        container.appendChild(msg);
        container.scrollTop = container.scrollHeight;
        console.log('User message added');
    }

    addAIMessage(text) {
        console.log('Adding AI message:', text.substring(0, 50) + '...');
        console.log('Full text length:', text.length, 'characters');
        const container = document.getElementById('chat-messages');
        if (!container) {
            console.error('Chat container not found!');
            return;
        }

        const msg = document.createElement('div');
        msg.style.cssText = `
            background: linear-gradient(135deg, rgba(10, 10, 15, 0.95), rgba(20, 20, 25, 0.95));
            backdrop-filter: blur(15px);
            color: rgba(255, 255, 255, 0.95);
            padding: 20px 24px;
            border-radius: 12px;
            align-self: flex-start;
            max-width: 85%;
            font-size: 14px;
            line-height: 1.8;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5), 0 0 20px rgba(100, 100, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.15);
            white-space: pre-wrap;
            font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
        `;
        msg.textContent = text;
        console.log('Text content set, element created');
        container.appendChild(msg);
        console.log('Message appended to container');
        container.scrollTop = container.scrollHeight;

        this.updateStatus('Response ready!', 'success');
        console.log('AI message added');
    }

    addSystemMessage(text) {
        const container = document.getElementById('chat-messages');
        if (!container) return;

        const msg = document.createElement('div');
        msg.style.cssText = `
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            color: rgba(255, 255, 255, 0.9);
            padding: 12px 16px;
            border-radius: 12px;
            align-self: center;
            max-width: 85%;
            font-size: 13px;
            text-align: center;
            line-height: 1.5;
            border: 1px solid rgba(255, 255, 255, 0.15);
        `;
        msg.textContent = text;
        container.appendChild(msg);
        container.scrollTop = container.scrollHeight;
    }

    async speakResponse(text) {
        if (this.elevenLabsApiKey) {
            await this.speakWithElevenLabs(text);
        } else {
            console.log('ElevenLabs API key not set - voice output disabled');
        }
    }

    async speakWithElevenLabs(text) {
        try {
            this.updateStatus('Generating voice...', 'info');
            const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${this.voiceId}`, {
                method: 'POST',
                headers: {
                    'Accept': 'audio/mpeg',
                    'Content-Type': 'application/json',
                    'xi-api-key': this.elevenLabsApiKey
                },
                body: JSON.stringify({
                    text: text,
                    model_id: 'eleven_monolingual_v1',
                    voice_settings: {
                        stability: 0.5,
                        similarity_boost: 0.75
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`ElevenLabs API error: ${response.status}`);
            }

            const audioBlob = await response.blob();
            const audioUrl = URL.createObjectURL(audioBlob);

            this.stopSpeaking();

            this.currentAudio = new Audio(audioUrl);
            this.isSpeaking = true;
            this.updateStatus('Speaking...', 'info');

            this.currentAudio.onended = () => {
                this.isSpeaking = false;
                this.updateStatus('Ready to help!', 'info');
                URL.revokeObjectURL(audioUrl);
            };

            this.currentAudio.onerror = (error) => {
                console.error('Audio playback error:', error);
                this.isSpeaking = false;
                this.updateStatus('Audio error', 'error');
            };

            await this.currentAudio.play();
            console.log('Playing ElevenLabs audio');

        } catch (error) {
            console.error('ElevenLabs TTS error:', error);
            this.updateStatus('Voice synthesis failed', 'error');
            this.isSpeaking = false;
        }
    }

    stopSpeaking() {
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio.currentTime = 0;
            this.currentAudio = null;
        }

        if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
        }

        this.isSpeaking = false;
        this.updateStatus('Ready to help!', 'info');
    }

    showVoiceSettings() {
        const currentKey = localStorage.getItem('elevenlabs_api_key') || '';
        const hasKey = currentKey.length > 0;

        const newKey = prompt(
            `ElevenLabs API Key Setup\n\n` +
            `${hasKey ? 'API key is currently set\n\n' : 'No API key set - voice output disabled\n\n'}` +
            `Get your free API key from:\nhttps://elevenlabs.io/app/settings/api-keys\n\n` +
            `Paste your API key below:`,
            hasKey ? '••••••••' : ''
        );

        if (newKey === null) return;

        if (newKey.trim() === '') {
            localStorage.removeItem('elevenlabs_api_key');
            this.elevenLabsApiKey = null;
            alert('ElevenLabs API key removed. Voice output disabled.');
        } else if (newKey !== '••••••••') {
            localStorage.setItem('elevenlabs_api_key', newKey.trim());
            this.elevenLabsApiKey = newKey.trim();
            alert('ElevenLabs API key saved! Voice output enabled with natural AI voice.');
        }
    }

    updateStatus(message, type = 'info') {
        const statusEl = document.getElementById('voice-status');
        if (statusEl) {
            statusEl.textContent = message;
            const colors = {
                error: '#ffcccc',
                success: '#ccffcc',
                warning: '#ffffcc',
                info: 'white'
            };
            statusEl.style.color = colors[type] || 'white';
        }
        console.log(`[Gemini] ${message}`);
    }

    isAgentConnected() {
        return this.chatPanel && this.chatPanel.style.display === 'flex';
    }
}

// Create global instance
window.geminiAssistant = new GeminiVoiceAssistant();

// Initialize when ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.geminiAssistant.initialize();
    });
} else {
    window.geminiAssistant.initialize();
}

console.log('Gemini Voice Assistant loaded');
