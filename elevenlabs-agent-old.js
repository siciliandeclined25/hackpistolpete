// ElevenLabs Conversational AI Agent Integration
// Agent ID: agent_6801k911brdnebbvajra2cxtvf6g
// Direct Link: https://elevenlabs.io/app/talk-to?agent_id=agent_6801k911brdnebbvajra2cxtvf6g

class ElevenLabsVoiceAgent {
    constructor(agentId) {
        this.agentId = agentId;
        this.agentUrl = `https://elevenlabs.io/app/talk-to?agent_id=${agentId}`;
        this.agentWindow = null;
        this.isConnected = false;
        this.currentQuestion = null;
        this.questionHistory = [];
        this.userAnswers = [];
        this.contextPanel = null;
    }

    /**
     * Initialize the ElevenLabs agent
     */
    async initialize() {
        try {
            console.log('🎙️ Initializing ElevenLabs voice agent...');
            console.log('📍 Agent URL:', this.agentUrl);
            
            // Create context panel to show what the agent knows
            if (!this.contextPanel) {
                this.createContextPanel();
            }

            console.log('✅ Voice agent ready to launch');
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize voice agent:', error);
            this.updateUI('error');
            return false;
        }
    }

    /**
     * Create a context panel to show current quiz state
     */
    createContextPanel() {
        this.contextPanel = document.createElement('div');
        this.contextPanel.id = 'agent-context-panel';
        this.contextPanel.className = 'agent-context-panel';
        this.contextPanel.style.display = 'none';
        
        this.contextPanel.innerHTML = `
            <div class="context-panel-header">
                <span>🎙️ AI Assistant Context</span>
                <button class="context-panel-close" onclick="window.voiceAgent.hideContextPanel()">×</button>
            </div>
            <div class="context-panel-body" id="agent-context-body">
                <p>Click "AI Help Active" to talk to your assistant!</p>
            </div>
        `;
        
        document.body.appendChild(this.contextPanel);
    }

    /**
     * Show context panel
     */
    showContextPanel() {
        if (this.contextPanel) {
            this.contextPanel.style.display = 'block';
        }
    }

    /**
     * Hide context panel
     */
    hideContextPanel() {
        if (this.contextPanel) {
            this.contextPanel.style.display = 'none';
        }
    }

    /**
     * Update context panel content
     */
    updateContextPanel() {
        const contextBody = document.getElementById('agent-context-body');
        if (!contextBody) return;

        if (this.currentQuestion) {
            const performance = this.getPerformanceSummary();
            contextBody.innerHTML = `
                <div class="context-section">
                    <strong>📝 Current Question:</strong>
                    <p>${this.currentQuestion.text}</p>
                </div>
                <div class="context-section">
                    <strong>📊 Your Progress:</strong>
                    <p>${performance.totalAnswered} answered, ${performance.correctAnswers} correct (${performance.accuracy}%)</p>
                </div>
                <div class="context-section">
                    <strong>💡 The AI knows:</strong>
                    <ul>
                        <li>Current question and all options</li>
                        <li>Your answer history</li>
                        <li>Which questions you found challenging</li>
                    </ul>
                </div>
            `;
        } else {
            contextBody.innerHTML = `
                <p>Start a quiz to get AI assistance!</p>
            `;
        }
    }

    /**
     * Connect to the voice agent (open in new window)
     */
    async connect() {
        if (!this.contextPanel) {
            await this.initialize();
        }

        try {
            console.log('🔌 Opening voice agent in new window...');
            
            // Open agent in new window
            const windowFeatures = 'width=500,height=700,menubar=no,toolbar=no,location=no,status=no';
            this.agentWindow = window.open(this.agentUrl, 'ElevenLabsAgent', windowFeatures);
            
            if (this.agentWindow) {
                this.isConnected = true;
                this.updateUI('connected');
                this.showContextPanel();
                this.updateContextPanel();
                
                // Check if window is closed
                const checkClosed = setInterval(() => {
                    if (this.agentWindow && this.agentWindow.closed) {
                        clearInterval(checkClosed);
                        this.isConnected = false;
                        this.updateUI('disconnected');
                        this.hideContextPanel();
                    }
                }, 1000);
                
                console.log('✅ Voice agent opened successfully');
            } else {
                console.error('❌ Failed to open window (popup blocked?)');
                alert('Please allow popups for this site to use the voice assistant!');
                this.updateUI('error');
            }
            
            return true;
        } catch (error) {
            console.error('Failed to open agent window:', error);
            this.updateUI('error');
            return false;
        }
    }

    /**
     * Disconnect from the voice agent (close window)
     */
    async disconnect() {
        try {
            if (this.agentWindow && !this.agentWindow.closed) {
                this.agentWindow.close();
                console.log('👋 Voice agent window closed');
            }
            this.isConnected = false;
            this.updateUI('disconnected');
            this.hideContextPanel();
        } catch (error) {
            console.error('Error closing agent window:', error);
        }
    }

    /**
     * Update the agent with the current quiz context
     * @param {Object} question - Current question object
     * @param {number} questionIndex - Current question number
     * @param {number} totalQuestions - Total number of questions
     */
    updateQuizContext(question, questionIndex, totalQuestions) {
        this.currentQuestion = question;
        
        console.log('📋 Updated quiz context for question', questionIndex + 1);
        
        // Store context for reference
        this.lastContext = {
            question: question.text,
            options: question.options,
            topic: question.topic,
            questionNumber: questionIndex + 1,
            totalQuestions: totalQuestions
        };
        
        // Update context panel if visible
        this.updateContextPanel();
    }

    /**
     * Send context information to the agent
     */
    sendContextToAgent(context) {
        // Store context for when user asks for help
        this.lastContext = context;
        console.log('💾 Context stored for agent reference');
    }

    /**
     * Record user's answer for the current question
     */
    recordAnswer(selectedOption, isCorrect) {
        if (!this.currentQuestion) return;

        const answerRecord = {
            question: this.currentQuestion.text,
            userAnswer: selectedOption,
            correctAnswer: this.currentQuestion.correct_answer,
            isCorrect: isCorrect,
            timestamp: new Date().toISOString()
        };

        this.userAnswers.push(answerRecord);
        this.questionHistory.push(this.currentQuestion);

        console.log('📝 Recorded answer:', answerRecord);
    }

    /**
     * Get student performance summary
     */
    getPerformanceSummary() {
        const totalAnswered = this.userAnswers.length;
        const correctAnswers = this.userAnswers.filter(a => a.isCorrect).length;
        const accuracy = totalAnswered > 0 ? (correctAnswers / totalAnswered * 100).toFixed(1) : 0;

        return {
            totalAnswered,
            correctAnswers,
            accuracy,
            recentQuestions: this.questionHistory.slice(-3) // Last 3 questions
        };
    }

    /**
     * Update the UI based on connection state
     */
    updateUI(state) {
        const voiceBtn = document.getElementById('voice-agent-btn');
        const voiceStatus = document.getElementById('voice-agent-status');
        
        if (!voiceBtn || !voiceStatus) return;

        switch (state) {
            case 'connecting':
                voiceBtn.classList.add('connecting');
                voiceBtn.classList.remove('connected', 'error');
                voiceStatus.textContent = 'Connecting...';
                break;
            case 'connected':
                voiceBtn.classList.add('connected');
                voiceBtn.classList.remove('connecting', 'error');
                voiceStatus.textContent = 'AI Help Active';
                break;
            case 'disconnected':
                voiceBtn.classList.remove('connected', 'connecting', 'error');
                voiceStatus.textContent = 'AI Help';
                break;
            case 'error':
                voiceBtn.classList.add('error');
                voiceBtn.classList.remove('connected', 'connecting');
                voiceStatus.textContent = 'Error';
                break;
        }
    }

    /**
     * Toggle voice agent on/off
     */
    async toggle() {
        if (this.agentWindow && !this.agentWindow.closed) {
            await this.disconnect();
        } else {
            await this.connect();
        }
    }

    /**
     * Clean up when quiz ends
     */
    cleanup() {
        console.log('🧹 Cleaning up voice agent...');
        this.currentQuestion = null;
        this.questionHistory = [];
        this.userAnswers = [];
        this.updateContextPanel();
    }

    /**
     * Reset for new quiz session
     */
    reset() {
        this.cleanup();
        console.log('🔄 Voice agent reset for new session');
    }

    /**
     * Destroy the agent completely
     */
    destroy() {
        if (this.agentWindow && !this.agentWindow.closed) {
            this.agentWindow.close();
        }
        if (this.contextPanel) {
            this.contextPanel.remove();
            this.contextPanel = null;
        }
        this.agentWindow = null;
        this.isConnected = false;
    }
}

// Create global instance
window.voiceAgent = new ElevenLabsVoiceAgent('agent_6801k911brdnebbvajra2cxtvf6g');

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('🚀 Voice agent ready for initialization');
    });
} else {
    console.log('🚀 Voice agent ready for initialization');
}
