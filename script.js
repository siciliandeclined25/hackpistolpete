// Global variables
let questions = [];
let currentQuestionIndex = 0;
let ragQuestions = [];
    let currentFile = null;

// Time tracking for analytics
let questionStartTime = null;
let quizAnalytics = {
    questionTimes: [], // Array of {question, topic, timeSpent, correct}
    topicPerformance: {} // {topic: {totalTime, count, correctCount}}
};

// MCP Server Configuration (DISABLED - Not needed)
const MCP_SERVER_URL = 'http://localhost:3000';

// Helper function to send context to MCP server
async function sendContextToMCP(endpoint, data) {
    try {
        const response = await fetch(`${MCP_SERVER_URL}/api/${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });
        
        if (!response.ok) {
            console.warn(`⚠️ MCP server not responding (${endpoint})`);
            return false;
        }
        
        const result = await response.json();
        console.log(`✅ Sent to MCP: ${endpoint}`, result);
        return true;
    } catch (error) {
        console.log(`ℹ️ MCP server not available (${endpoint})`);
        return false;
    }
}

// Get formatted analytics for BrahmaGupta
function getQuizAnalytics() {
    const analytics = {
        totalQuestions: quizAnalytics.questionTimes.length,
        totalTime: 0,
        averageTime: 0,
        accuracy: 0,
        topicBreakdown: []
    };
    
    if (quizAnalytics.questionTimes.length === 0) {
        return "No quiz data available yet. Start answering questions to see performance analytics.";
    }
    
    // Calculate totals
    let correctCount = 0;
    quizAnalytics.questionTimes.forEach(q => {
        analytics.totalTime += q.timeSpent;
        if (q.correct) correctCount++;
    });
    
    analytics.averageTime = (analytics.totalTime / analytics.totalQuestions).toFixed(1);
    analytics.accuracy = ((correctCount / analytics.totalQuestions) * 100).toFixed(1);
    
    // Build topic breakdown
    for (const [topic, data] of Object.entries(quizAnalytics.topicPerformance)) {
        const avgTime = (data.totalTime / data.count).toFixed(1);
        const accuracy = ((data.correctCount / data.count) * 100).toFixed(1);
        analytics.topicBreakdown.push({
            topic: topic,
            questionsAttempted: data.count,
            averageTime: avgTime,
            accuracy: accuracy,
            totalTime: data.totalTime.toFixed(1)
        });
    }
    
    // Sort by average time (slowest first)
    analytics.topicBreakdown.sort((a, b) => parseFloat(b.averageTime) - parseFloat(a.averageTime));
    
    // Format as readable text for AI
    let analyticsText = `📊 Quiz Performance Analytics:\n\n`;
    analyticsText += `Overall: ${analytics.totalQuestions} questions answered\n`;
    analyticsText += `Total Time: ${analytics.totalTime.toFixed(1)}s\n`;
    analyticsText += `Average Time per Question: ${analytics.averageTime}s\n`;
    analyticsText += `Overall Accuracy: ${analytics.accuracy}%\n\n`;
    analyticsText += `Topic Breakdown (sorted by time spent):\n`;
    
    analytics.topicBreakdown.forEach((topic, index) => {
        analyticsText += `${index + 1}. ${topic.topic}:\n`;
        analyticsText += `   - Questions: ${topic.questionsAttempted}\n`;
        analyticsText += `   - Avg Time: ${topic.averageTime}s\n`;
        analyticsText += `   - Accuracy: ${topic.accuracy}%\n`;
        analyticsText += `   - Total Time: ${topic.totalTime}s\n`;
    });
    
    return analyticsText;
}

// Test function - run in console to check analytics
window.testAnalytics = function() {
    console.log('Testing analytics...');
    const saved = localStorage.getItem('quizAnalytics');
    if (saved) {
        console.log('📊 Saved analytics found:');
        console.log(JSON.parse(saved));
        console.log('\nFormatted output:');
        console.log(getQuizAnalytics());
    } else {
        console.log('❌ No analytics data in localStorage');
    }
};

// Load questions from JSON
async function loadQuestions() {
    try {
        const response = await fetch('questions.json');
        questions = await response.json();
        updateQuestionCount();
    } catch (error) {
        console.error('Error loading questions:', error);
        showMessage('Failed to load questions. Please check questions.json file.', 'error');
    }
}

// Update question count in flashcard
function updateQuestionCount() {
    const countElement = document.getElementById('question-count');
    if (countElement) {
        countElement.textContent = questions.length;
    }
}

// Show message in chat
function showMessage(text, type = 'ai') {
    const messagesContainer = document.getElementById('messages');
    const welcomeMessage = messagesContainer.querySelector('.welcome-message');
    
    if (welcomeMessage) {
        welcomeMessage.remove();
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message message-${type}`;
    
    const bubbleDiv = document.createElement('div');
    bubbleDiv.className = 'message-bubble';
    bubbleDiv.textContent = text;
    
    messageDiv.appendChild(bubbleDiv);
    messagesContainer.appendChild(messageDiv);
    
    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Handle user input
function handleUserInput() {
    const input = document.getElementById('user-input');
    const text = input.value.trim();
    
    if (!text) return;
    
    // Clear input immediately
    input.value = '';
    input.style.height = 'auto';
    
    // If Gemini Voice Assistant is available, use it
    if (window.geminiAssistant) {
        window.geminiAssistant.handleUserMessage(text);
    } else {
        // Fallback: Show user message
        showMessage(text, 'user');
        
        // Simple AI response
        setTimeout(() => {
            let response = "I'm here to help! ";
            
            if (text.toLowerCase().includes('quiz') || text.toLowerCase().includes('question')) {
                response = `I have ${questions.length} calculus questions ready for you! Click on the "Questions" card above or type "start quiz" to begin.`;
            } else if (text.toLowerCase().includes('start')) {
                openQuizModal();
                response = "Opening the quiz for you now!";
            } else if (text.toLowerCase().includes('help')) {
                response = "I can help you with calculus practice questions, track your focus, and monitor your study performance. What would you like to do?";
            } else {
                response = "I understand you're asking about that. Try starting a calculus quiz by clicking the 'Questions' card above!";
            }
            
            showMessage(response, 'ai');
        }, 500);
    }
}

// Auto-resize textarea
function autoResizeTextarea(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
}

// Open quiz modal
function openQuizModal() {
    if (questions.length === 0) {
        showMessage('No questions available. Please check the questions.json file.', 'ai');
        return;
    }
    
    // Clear previous quiz analytics
    quizAnalytics = {
        questionTimes: [],
        topicPerformance: {}
    };
    localStorage.setItem('quizAnalytics', JSON.stringify(quizAnalytics));
    // Also clear last quiz analytics so we start completely fresh
    localStorage.removeItem('lastQuizAnalytics');
    console.log('🔄 Analytics cleared for new quiz (including lastQuizAnalytics)');
    
    const modal = document.getElementById('quiz-modal');
    modal.classList.add('active');
    currentQuestionIndex = 0;
    
    // Auto-start eye tracking when quiz begins
    if (window.eyeTracker) {
        window.eyeTracker.start();
        console.log('Eye tracking auto-started with quiz');
        
        // Update camera button state
        const cameraBtn = document.getElementById('camera-toggle-btn');
        if (cameraBtn) {
            cameraBtn.classList.remove('camera-off');
            const statusText = document.getElementById('camera-status');
            if (statusText) statusText.textContent = 'Camera On';
        }
    }
    
    // Auto-initialize Gemini voice assistant when quiz starts
    if (window.geminiAssistant) {
        window.geminiAssistant.initialize().then(success => {
            if (success) {
                console.log('✅ Gemini AI assistant ready - click "AI Help" button to talk!');
            }
        });
    }
    
    displayQuestion();
}

// Close quiz modal
function closeQuizModal() {
    const modal = document.getElementById('quiz-modal');
    modal.classList.remove('active');
    
    // Clear the AI Tutor's question context when quiz closes
    if (window.geminiAssistant) {
        window.geminiAssistant.updateQuizContext(null);
        console.log('🧹 Cleared AI Tutor question context');
    }
    
    // Auto-stop eye tracking when quiz closes
    if (window.eyeTracker && window.eyeTracker.isTracking) {
        window.eyeTracker.stop();
        console.log('Eye tracking auto-stopped with quiz close');
    }
}

// Toggle camera (eye tracking) on/off
function toggleCamera() {
    const btn = document.getElementById('camera-toggle-btn');
    const statusText = document.getElementById('camera-status');
    const cameraOnIcon = btn.querySelector('.camera-on-icon');
    const cameraOffIcon = btn.querySelector('.camera-off-icon');
    
    if (window.eyeTracker && window.eyeTracker.isTracking) {
        // Stop eye tracking
        window.eyeTracker.stop();
        btn.classList.add('camera-off');
        statusText.textContent = 'Camera Off';
        console.log('📷 Eye tracking disabled by user');
    } else {
        // Start eye tracking
        if (window.eyeTracker) {
            window.eyeTracker.start();
            btn.classList.remove('camera-off');
            statusText.textContent = 'Camera On';
            console.log('📷 Eye tracking enabled by user');
        }
    }
}

// Show analytics in a formatted alert/display
function showAnalytics() {
    const analyticsText = getQuizAnalytics();
    
    // Create a nice modal-style alert with the analytics
    const message = analyticsText.replace(/\n/g, '<br>');
    
    // You can also send this to the AI assistant
    if (window.voiceAgent) {
        window.voiceAgent.addAIMessage(`📊 Here's your performance summary:\n\n${analyticsText}`);
        
        // Open voice assistant panel if not already visible
        const panel = document.querySelector('.voice-assistant-panel');
        if (panel && !panel.classList.contains('visible')) {
            const toggleBtn = document.querySelector('.voice-assistant-toggle');
            if (toggleBtn) toggleBtn.click();
        }
    } else {
        // Fallback to alert if voice agent not available
        alert(analyticsText);
    }
}

// Display current question
function displayQuestion() {
    const quizContent = document.getElementById('quiz-content');
    quizContent.innerHTML = '';
    
    if (currentQuestionIndex >= questions.length) {
        // End tracking for previous question and stop eye tracking
        let summary = null;
        if (window.eyeTracker && window.eyeTracker.isTracking) {
            window.eyeTracker.endQuestionTracking();
            summary = window.eyeTracker.getSessionSummary();
            // Stop tracking when quiz completes
            window.eyeTracker.stop();
            console.log('Eye tracking stopped - quiz completed');
        }
        
        // Disconnect voice agent when quiz ends
        if (window.voiceAgent && window.voiceAgent.isConnected) {
            console.log('Quiz completed - voice agent still available');
            // Don't disconnect, let user ask questions about their performance
        }
        
        let summaryHTML = '';
        if (summary) {
            summaryHTML = `
                <div style="background: var(--bg-tertiary); padding: 1.5rem; border-radius: var(--radius-md); margin-top: 1rem;">
                    <h3 style="margin-bottom: 1rem;">Focus Insights</h3>
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; margin-bottom: 1rem;">
                        <div>
                            <p style="color: var(--text-secondary); font-size: 0.875rem;">Focus Score</p>
                            <p style="font-size: 1.5rem; font-weight: 600; color: var(--accent-primary);">${summary.focusScore}%</p>
                        </div>
                        <div>
                            <p style="color: var(--text-secondary); font-size: 0.875rem;">Look Away Count</p>
                            <p style="font-size: 1.5rem; font-weight: 600;">${summary.lookAwayCount}</p>
                        </div>
                    </div>
                    <p style="color: var(--text-secondary); font-size: 0.875rem;">
                        ${summary.insights.hardQuestions.length > 0 
                            ? `🎯 ${summary.insights.hardQuestions.length} questions seemed challenging based on your focus.` 
                            : '✨ Great focus throughout the quiz!'}
                    </p>
                </div>
            `;
        }
        
        quizContent.innerHTML = `
            <div style="text-align: center; padding: 2rem;">
                <div style="font-size: 3rem; margin-bottom: 1rem;">🎉</div>
                <h2 style="margin-bottom: 1rem;">Quiz Completed!</h2>
                <p style="color: var(--text-secondary); margin-bottom: 2rem;">
                    You've completed all ${questions.length} questions.
                </p>
                ${summaryHTML}
                <button class="card-button" onclick="restartQuiz()" style="max-width: 200px; margin: 2rem auto 0;">
                    Restart Quiz
                </button>
            </div>
        `;
        
        // IMPORTANT: Save analytics to lastQuizAnalytics BEFORE clearing
        // This ensures BrahmaGupta can access the completed quiz data
        localStorage.setItem('lastQuizAnalytics', JSON.stringify(quizAnalytics));
        console.log('💾 Saved completed quiz analytics to lastQuizAnalytics:', quizAnalytics);
        
        // Clear current quiz analytics to prevent accumulation across quiz sessions
        localStorage.removeItem('quizAnalytics');
        console.log('🗑️ Cleared quizAnalytics from localStorage to prevent accumulation');
        
        return;
    }
    
    const question = questions[currentQuestionIndex];
    
    // Start time tracking for this question
    questionStartTime = Date.now();
    
    // Start tracking this question
    if (window.eyeTracker && window.eyeTracker.isTracking) {
        window.eyeTracker.startQuestionTracking(question);
    }
    
    // Update voice assistant with current question context (ACTIVE INJECTION)
    if (window.geminiAssistant) {
        window.geminiAssistant.updateQuizContext({
            question: question.text,  // JSON uses "text" not "question"
            questionIndex: currentQuestionIndex + 1,
            totalQuestions: questions.length,
            options: question.options,
            topic: question.topic || '',
            correctAnswer: question.correct_answer  // JSON uses "correct_answer"
        });
    }
    
    // Send context to MCP server
    sendContextToMCP('quiz/context', {
        question: question.text,  // JSON uses "text" not "question"
        questionIndex: currentQuestionIndex + 1,
        totalQuestions: questions.length,
        options: question.options
    });
    
    const questionDiv = document.createElement('div');
    questionDiv.className = 'quiz-question';
    questionDiv.innerHTML = `
        <div class="question-number">Question ${currentQuestionIndex + 1} of ${questions.length}</div>
        <div class="question-text">${question.text}</div>
        <div class="quiz-options">
            ${question.options.map((option, index) => `
                <button class="option-button" onclick="selectOption(${index}, '${option.replace(/'/g, "\\'")}')">
                    ${String.fromCharCode(65 + index)}. ${option}
                </button>
            `).join('')}
        </div>
    `;
    
    quizContent.appendChild(questionDiv);
    
    // Add navigation buttons
    const navDiv = document.createElement('div');
    navDiv.style.cssText = 'display: flex; gap: 1rem; margin-top: 2rem; justify-content: space-between;';
    
    if (currentQuestionIndex > 0) {
        navDiv.innerHTML += `
            <button class="option-button" onclick="previousQuestion()" style="max-width: 150px;">
                ← Previous
            </button>
        `;
    } else {
        navDiv.innerHTML += '<div></div>';
    }
    
    navDiv.innerHTML += `
        <button class="card-button" onclick="nextQuestion()" style="max-width: 150px;">
            ${currentQuestionIndex < questions.length - 1 ? 'Next →' : 'Finish'}
        </button>
    `;
    
    quizContent.appendChild(navDiv);
}

// Select option
function selectOption(index, optionText) {
    // Remove previous selection
    const buttons = document.querySelectorAll('.option-button');
    buttons.forEach(btn => btn.classList.remove('selected'));
    
    // Add selection to clicked button
    buttons[index].classList.add('selected');
    
    // Store answer (you can expand this to track all answers)
    questions[currentQuestionIndex].userAnswer = optionText;
    
    // Calculate time spent on this question
    const timeSpent = questionStartTime ? (Date.now() - questionStartTime) / 1000 : 0; // in seconds
    const question = questions[currentQuestionIndex];
    const isCorrect = optionText === question.correct_answer;
    
    // Store analytics
    quizAnalytics.questionTimes.push({
        question: question.text,
        topic: question.topic || 'General',
        timeSpent: timeSpent,
        correct: isCorrect
    });
    
    // Update topic performance
    const topic = question.topic || 'General';
    if (!quizAnalytics.topicPerformance[topic]) {
        quizAnalytics.topicPerformance[topic] = {
            totalTime: 0,
            count: 0,
            correctCount: 0
        };
    }
    quizAnalytics.topicPerformance[topic].totalTime += timeSpent;
    quizAnalytics.topicPerformance[topic].count += 1;
    if (isCorrect) {
        quizAnalytics.topicPerformance[topic].correctCount += 1;
    }
    
    // Save analytics to localStorage
    localStorage.setItem('quizAnalytics', JSON.stringify(quizAnalytics));
    console.log('📊 Analytics saved:', quizAnalytics);
    
    // Send analytics to MCP server
    sendContextToMCP('quiz/analytics', {
        questionTimes: quizAnalytics.questionTimes,
        topicPerformance: quizAnalytics.topicPerformance
    });
    
    // Record answer with voice agent
    if (window.voiceAgent && window.voiceAgent.isConnected) {
        window.voiceAgent.recordAnswer(optionText, isCorrect);
        
        // Send answer to MCP server
        sendContextToMCP('quiz/answer', {
            questionIndex: currentQuestionIndex,
            selectedAnswer: optionText,
            isCorrect: isCorrect,
        });
    }
}

// Next question
function nextQuestion() {
    // End tracking for current question before moving to next
    if (window.eyeTracker && window.eyeTracker.isTracking) {
        window.eyeTracker.endQuestionTracking();
    }
    
    currentQuestionIndex++;
    displayQuestion();
}

// Previous question
function previousQuestion() {
    // End tracking for current question
    if (window.eyeTracker && window.eyeTracker.isTracking) {
        window.eyeTracker.endQuestionTracking();
    }
    
    currentQuestionIndex--;
    displayQuestion();
}

// Restart quiz
function restartQuiz() {
    currentQuestionIndex = 0;
    questions.forEach(q => delete q.userAnswer);
    displayQuestion();
}

// Suggestion chip click handler
function handleSuggestionClick(e) {
    if (e.target.classList.contains('suggestion-chip')) {
        const input = document.getElementById('user-input');
        input.value = e.target.textContent;
        input.focus();
        handleUserInput();
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Load saved analytics from localStorage
    const savedAnalytics = localStorage.getItem('quizAnalytics');
    if (savedAnalytics) {
        try {
            quizAnalytics = JSON.parse(savedAnalytics);
            console.log('📊 Loaded saved analytics:', quizAnalytics);
        } catch (e) {
            console.error('Failed to load analytics:', e);
        }
    }
    
    // Load questions
    loadQuestions();
    
    // Send button - only if it exists (removed in new design)
    const sendBtn = document.getElementById('send-btn');
    if (sendBtn) {
        sendBtn.addEventListener('click', handleUserInput);
    }
    
    // Input field - only if it exists (removed in new design)
    const input = document.getElementById('user-input');
    if (input) {
        input.addEventListener('input', (e) => autoResizeTextarea(e.target));
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleUserInput();
            }
        });
    }
    
    // Questions card click
    const questionsCard = document.getElementById('questions-card');
    questionsCard.addEventListener('click', openQuizModal);
    
    // Start quiz button
    const startQuizBtn = document.getElementById('start-quiz-btn');
    startQuizBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openQuizModal();
    });
    
    // Close modal
    const closeModalBtn = document.getElementById('close-modal');
    closeModalBtn.addEventListener('click', closeQuizModal);
    
    // Close modal on backdrop click
    const modal = document.getElementById('quiz-modal');
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeQuizModal();
        }
    });
    
    // Camera Toggle Button Event Listener
    const cameraToggleBtn = document.getElementById('camera-toggle-btn');
    if (cameraToggleBtn) {
        cameraToggleBtn.addEventListener('click', toggleCamera);
    }
    
    // Suggestion chips
    document.addEventListener('click', handleSuggestionClick);
    
    // Escape key to close modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeQuizModal();
            closeRAGModal();
            closeAPIKeyModal();
        }
    });
    
    // API Key Modal Event Listeners
    const apiKeyBtn = document.getElementById('api-key-btn');
    const closeAPIKeyBtn = document.getElementById('close-api-key-modal');
    const saveAPIKeyBtn = document.getElementById('save-api-key-btn');
    const clearAPIKeyBtn = document.getElementById('clear-api-key-btn');
    const toggleVisibilityBtn = document.getElementById('toggle-key-visibility');
    const toggleElevenLabsBtn = document.getElementById('toggle-elevenlabs-visibility');
    const apiKeyModal = document.getElementById('api-key-modal');
    
    apiKeyBtn.addEventListener('click', openAPIKeyModal);
    closeAPIKeyBtn.addEventListener('click', closeAPIKeyModal);
    saveAPIKeyBtn.addEventListener('click', saveAPIKey);
    clearAPIKeyBtn.addEventListener('click', clearAPIKey);
    toggleVisibilityBtn.addEventListener('click', toggleAPIKeyVisibility);
    
    // ElevenLabs visibility toggle
    if (toggleElevenLabsBtn) {
        toggleElevenLabsBtn.addEventListener('click', () => {
            const input = document.getElementById('elevenlabs-key-input');
            input.type = input.type === 'password' ? 'text' : 'password';
        });
    }
    
    // Close on backdrop click
    apiKeyModal.addEventListener('click', (e) => {
        if (e.target === apiKeyModal) {
            closeAPIKeyModal();
        }
    });
    
    // Check API key status on load
    checkAPIKeyStatus();
    
    // Voice Agent Button Event Listener
    const voiceAgentBtn = document.getElementById('voice-agent-btn');
    if (voiceAgentBtn) {
        voiceAgentBtn.addEventListener('click', () => {
            if (window.geminiAssistant) {
                // Show the assistant panel
                window.geminiAssistant.show();
                
                // Update button state
                const statusSpan = document.getElementById('voice-agent-status');
                if (statusSpan) {
                    statusSpan.textContent = window.geminiAssistant.isAgentConnected() ? 
                        'AI Active' : 'AI Help';
                }
                
                // Add visual feedback
                voiceAgentBtn.classList.add('active');
            }
        });
    }
    
    // RAG Modal Event Listeners
    setupRAGEventListeners();
});

// ===== RAG FUNCTIONALITY =====

function setupRAGEventListeners() {
    // Upload document button
    const uploadDocBtn = document.getElementById('upload-doc-btn');
    const ragCard = document.getElementById('rag-card');
    
    uploadDocBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openRAGModal();
    });
    
    ragCard.addEventListener('click', openRAGModal);
    
    // Close RAG modal
    const closeRAGModalBtn = document.getElementById('close-rag-modal');
    closeRAGModalBtn.addEventListener('click', closeRAGModal);
    
    // File upload area
    const fileUploadArea = document.getElementById('file-upload-area');
    const fileInput = document.getElementById('file-input');
    
    fileUploadArea.addEventListener('click', () => fileInput.click());
    
    fileInput.addEventListener('change', handleFileUpload);
    
    // Drag and drop
    fileUploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        fileUploadArea.style.borderColor = 'var(--accent-primary)';
    });
    
    fileUploadArea.addEventListener('dragleave', () => {
        fileUploadArea.style.borderColor = 'var(--border-color)';
    });
    
    fileUploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        fileUploadArea.style.borderColor = 'var(--border-color)';
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFileSelection(files[0]);
        }
    });
    
    // Remove file button
    const removeFileBtn = document.getElementById('remove-file');
    removeFileBtn.addEventListener('click', removeFile);
    
    // Question slider
    const questionSlider = document.getElementById('question-slider');
    const questionNum = document.getElementById('question-num');
    
    questionSlider.addEventListener('input', (e) => {
        questionNum.textContent = e.target.value;
    });
    
    // Generate questions button
    const generateBtn = document.getElementById('generate-questions-btn');
    generateBtn.addEventListener('click', generateQuestionsFromFile);
    
    // Start RAG quiz button
    const startRAGQuizBtn = document.getElementById('start-rag-quiz-btn');
    startRAGQuizBtn.addEventListener('click', startRAGQuiz);
    
    // Save questions button
    const saveQuestionsBtn = document.getElementById('save-questions-btn');
    saveQuestionsBtn.addEventListener('click', saveRAGQuestions);
    
    // Close modal on backdrop click
    const ragModal = document.getElementById('rag-modal');
    ragModal.addEventListener('click', (e) => {
        if (e.target === ragModal) {
            closeRAGModal();
        }
    });
}

function openRAGModal() {
    const modal = document.getElementById('rag-modal');
    modal.classList.add('active');
    resetRAGModal();
}

function closeRAGModal() {
    const modal = document.getElementById('rag-modal');
    modal.classList.remove('active');
}

function resetRAGModal() {
    document.getElementById('file-upload-area').style.display = 'block';
    document.getElementById('file-info').style.display = 'none';
    document.getElementById('processing-status').style.display = 'none';
    document.getElementById('generated-questions').style.display = 'none';
    currentFile = null;
}

function handleFileUpload(e) {
    const file = e.target.files[0];
    if (file) {
        handleFileSelection(file);
    }
}

function handleFileSelection(file) {
    const validTypes = ['.pdf', '.txt', '.docx', '.md'];
    const fileExt = '.' + file.name.split('.').pop().toLowerCase();
    
    if (!validTypes.includes(fileExt)) {
        alert('Unsupported file type. Please upload PDF, TXT, DOCX, or MD files.');
        return;
    }
    
    currentFile = file;
    
    // Display file info
    document.getElementById('file-name').textContent = file.name;
    document.getElementById('file-size').textContent = formatFileSize(file.size);
    
    document.getElementById('file-upload-area').style.display = 'none';
    document.getElementById('file-info').style.display = 'block';
}

function removeFile() {
    currentFile = null;
    document.getElementById('file-upload-area').style.display = 'block';
    document.getElementById('file-info').style.display = 'none';
    document.getElementById('file-input').value = '';
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

async function generateQuestionsFromFile() {
    if (!currentFile) {
        alert('Please upload a file first');
        return;
    }
    
    console.log('🚀 Starting RAG question generation...');
    console.log('📁 File:', currentFile.name);
    
    // Show processing status
    document.getElementById('file-info').style.display = 'none';
    document.getElementById('processing-status').style.display = 'block';
    
    try {
        console.log('📖 Reading file content...');
        
        // Read file content
        const text = await readFileContent(currentFile);
        
        console.log('✅ File content read successfully');
        console.log('📊 Content length:', text.length, 'characters');
        console.log('📄 First 100 chars:', text.substring(0, 100));
        
        // Validate content
        if (!text || text.trim().length < 50) {
            throw new Error('File content is too short or empty. Please ensure the file contains readable text.');
        }
        
        // Generate questions based on content
        const numQuestions = parseInt(document.getElementById('question-slider').value);
        console.log('🎯 Generating', numQuestions, 'questions...');
        
        ragQuestions = await generateQuestions(text, numQuestions);
        
        console.log('✅ Questions generated:', ragQuestions.length);
        
        if (ragQuestions.length === 0) {
            throw new Error('No questions were generated. Please try a different file or check the content.');
        }
        
        // Display generated questions
        displayGeneratedQuestions();
        
        // Update RAG question count
        updateRAGQuestionCount();
        
        console.log('🎉 RAG generation completed successfully!');
        
    } catch (error) {
        console.error('❌ Error generating questions:', error);
        console.error('❌ Error stack:', error.stack);
        
        alert(`Failed to generate questions:\n\n${error.message}\n\nPlease check:\n- File is readable text (TXT/MD work best)\n- File contains enough content\n- Internet connection (for Gemini API)\n- Console for detailed errors (F12)`);
        
        resetRAGModal();
    }
}

function readFileContent(file) {
    console.log('📖 Reading file:', file.name, '- Type:', file.type, '- Size:', file.size);
    
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        const fileName = file.name.toLowerCase();
        
        reader.onload = (e) => {
            console.log('✅ File loaded successfully');
            const content = e.target.result;
            
            // Handle different file types
            if (fileName.endsWith('.txt') || fileName.endsWith('.md')) {
                console.log('📝 Processing as plain text');
                console.log('📄 Content preview:', content.substring(0, 200));
                resolve(content);
                
            } else if (fileName.endsWith('.pdf')) {
                console.log('📕 PDF detected - extracting text (limited support)');
                // For proper PDF support, would need PDF.js library
                // For now, try to extract any readable text
                const textContent = content.replace(/[^\x20-\x7E\n]/g, ' ').trim();
                
                if (textContent.length < 100) {
                    console.warn('⚠️ PDF text extraction limited - please convert to TXT for better results');
                    alert('PDF support is limited. For best results, please convert your PDF to a TXT file.');
                }
                
                console.log('📄 Extracted text preview:', textContent.substring(0, 200));
                resolve(textContent);
                
            } else if (fileName.endsWith('.docx')) {
                console.log('📘 DOCX detected - extracting text (limited support)');
                // For proper DOCX support, would need mammoth.js library
                // For now, try to extract any readable text
                const textContent = content.replace(/[^\x20-\x7E\n]/g, ' ').trim();
                
                if (textContent.length < 100) {
                    console.warn('⚠️ DOCX text extraction limited - please convert to TXT for better results');
                    alert('DOCX support is limited. For best results, please convert your document to a TXT file.');
                }
                
                console.log('📄 Extracted text preview:', textContent.substring(0, 200));
                resolve(textContent);
                
            } else {
                console.log('📄 Processing as generic text');
                resolve(content);
            }
        };
        
        reader.onerror = (error) => {
            console.error('❌ File reading error:', error);
            reject(error);
        };
        
        // Read as text for all file types (improved from before)
        reader.readAsText(file, 'UTF-8');
    });
}

// Gemini API Configuration
// For hackathons/public repos: Users provide their own API key via UI
// Key is stored in browser's localStorage (not in code/repo)
let GEMINI_API_KEY = localStorage.getItem('gemini_api_key') || '';

// Check API key status on load
function checkAPIKeyStatus() {
    const apiKeyBtn = document.getElementById('api-key-btn');
    const apiKeyStatus = document.getElementById('api-key-status');
    
    if (GEMINI_API_KEY && GEMINI_API_KEY.trim() !== '') {
        apiKeyBtn.classList.add('configured');
        apiKeyStatus.textContent = '✅ API Ready';
        console.log('✅ API key loaded from localStorage');
    } else {
        apiKeyBtn.classList.remove('configured');
        apiKeyStatus.textContent = '🔑 Setup API';
        console.log('⚠️ No API key found. Click "Setup API" to configure.');
    }
}

// Save API key to localStorage
function saveAPIKey() {
    const geminiInput = document.getElementById('api-key-input');
    const elevenlabsInput = document.getElementById('elevenlabs-key-input');
    const messageEl = document.getElementById('api-key-message');
    const geminiKey = geminiInput.value.trim();
    const elevenlabsKey = elevenlabsInput.value.trim();
    
    let messages = [];
    
    // Save Gemini API key
    if (geminiKey) {
        if (!geminiKey.startsWith('AIzaSy')) {
            showAPIKeyMessage('Invalid Gemini API key format. Should start with "AIzaSy..."', 'warning');
            return;
        }
        localStorage.setItem('gemini_api_key', geminiKey);
        GEMINI_API_KEY = geminiKey;
        messages.push('Gemini API key saved');
    }
    
    // Save ElevenLabs API key
    if (elevenlabsKey) {
        localStorage.setItem('elevenlabs_api_key', elevenlabsKey);
        messages.push('ElevenLabs API key saved');
        
        // Update the voice assistant's key
        if (window.geminiAssistant) {
            window.geminiAssistant.elevenLabsApiKey = elevenlabsKey;
        }
    }
    
    if (messages.length === 0) {
        showAPIKeyMessage('Please enter at least one API key', 'error');
        return;
    }
    
    showAPIKeyMessage('✅ ' + messages.join(' & ') + ' successfully!', 'success');
    checkAPIKeyStatus();
    
    // Close modal after short delay
    setTimeout(() => {
        closeAPIKeyModal();
    }, 1500);
}

// Clear saved API key
function clearAPIKey() {
    if (confirm('Are you sure you want to clear all saved API keys?')) {
        localStorage.removeItem('gemini_api_key');
        localStorage.removeItem('elevenlabs_api_key');
        GEMINI_API_KEY = '';
        document.getElementById('api-key-input').value = '';
        document.getElementById('elevenlabs-key-input').value = '';
        
        // Update the voice assistant
        if (window.geminiAssistant) {
            window.geminiAssistant.elevenLabsApiKey = null;
        }
        
        showAPIKeyMessage('All API keys cleared. You\'ll need to enter them again to use features.', 'warning');
        checkAPIKeyStatus();
    }
}

// Show API key message
function showAPIKeyMessage(message, type = 'success') {
    const messageEl = document.getElementById('api-key-message');
    messageEl.textContent = message;
    messageEl.className = `api-key-status-message ${type}`;
}

// Toggle API key visibility
function toggleAPIKeyVisibility() {
    const input = document.getElementById('api-key-input');
    input.type = input.type === 'password' ? 'text' : 'password';
}

// Open/close API key modal
function openAPIKeyModal() {
    document.getElementById('api-key-modal').classList.add('active');
    // Load current keys if they exist
    if (GEMINI_API_KEY) {
        document.getElementById('api-key-input').value = GEMINI_API_KEY;
    }
    const elevenlabsKey = localStorage.getItem('elevenlabs_api_key');
    if (elevenlabsKey) {
        document.getElementById('elevenlabs-key-input').value = elevenlabsKey;
    }
}

function closeAPIKeyModal() {
    document.getElementById('api-key-modal').classList.remove('active');
    document.getElementById('api-key-message').className = 'api-key-status-message';
}

// Debug function to list available models (call in console: testGeminiModels())
async function testGeminiModels() {
    console.log('🧪 Testing Gemini API models...');
    
    if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_API_KEY_HERE' || GEMINI_API_KEY.trim() === '') {
        console.error('❌ API key not configured');
        return;
    }
    
    console.log('✅ Using API key:', GEMINI_API_KEY.substring(0, 15) + '...');
    
    // Test different model endpoints
    const modelsToTest = [
        'gemini-1.5-flash',
        'gemini-1.5-flash-latest',
        'gemini-1.5-pro',
        'gemini-pro',
        'gemini-pro-latest'
    ];
    
    console.log('Testing', modelsToTest.length, 'models...\n');
    
    for (const model of modelsToTest) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    contents: [{parts: [{text: 'Say "Hello"'}]}]
                })
            });
            
            if (response.ok) {
                console.log(`✅ ${model} - WORKS`);
            } else {
                console.log(`❌ ${model} - ${response.status} ${response.statusText}`);
            }
        } catch (error) {
            console.log(`❌ ${model} - Error:`, error.message);
        }
    }
    
    console.log('\n🔍 To use this, run: testGeminiModels() in the console');
}

// Make function available globally for testing
window.testGeminiModels = testGeminiModels;

async function generateQuestions(text, numQuestions) {
    console.log('🔍 RAG Debug - Starting question generation...');
    console.log('📄 Text length:', text.length, 'characters');
    console.log('❓ Requested questions:', numQuestions);
    
    // Validate text content
    if (!text || text.trim().length < 50) {
        console.error('❌ Text too short or empty:', text.substring(0, 100));
        alert('The document content is too short. Please upload a document with more text.');
        throw new Error('Insufficient text content');
    }
    
    // Check if API key is set (FIXED: proper validation)
    if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_API_KEY_HERE' || GEMINI_API_KEY.trim() === '') {
        console.warn('⚠️ Gemini API key not configured. Using fallback algorithm.');
        return generateQuestionsFallback(text, numQuestions);
    }
    
    console.log('✅ Using Gemini API with key:', GEMINI_API_KEY.substring(0, 10) + '...');
    console.log('✅ Using Gemini API with key:', GEMINI_API_KEY.substring(0, 10) + '...');

    try {
        // Clean and prepare text (remove excessive whitespace, special chars)
        let cleanedText = text
            .replace(/\r\n/g, '\n')
            .replace(/\n{3,}/g, '\n\n')
            .replace(/[^\x20-\x7E\n]/g, '')
            .trim();
        
        console.log('🧹 Cleaned text length:', cleanedText.length);
        
        // Smart truncation: Keep the most relevant content
        const maxChars = 6000;
        if (cleanedText.length > maxChars) {
            // Try to keep complete paragraphs
            const truncated = cleanedText.substring(0, maxChars);
            const lastPeriod = truncated.lastIndexOf('.');
            cleanedText = lastPeriod > maxChars * 0.8 
                ? truncated.substring(0, lastPeriod + 1)
                : truncated;
            console.log('✂️ Text truncated to:', cleanedText.length, 'characters');
        }
        
        // Show preview of content being analyzed
        console.log('📖 Text preview:', cleanedText.substring(0, 200) + '...');

        const prompt = `You are an expert educator creating a quiz. Analyze the following document and generate EXACTLY ${numQuestions} high-quality multiple-choice questions.

CRITICAL JSON FORMATTING RULES:
- Return ONLY a valid JSON array
- NO text before or after the array
- NO markdown code blocks
- NO trailing commas anywhere
- Use double quotes ONLY (never single quotes)
- Ensure all brackets and braces are properly closed
- Each question must be complete (no truncation)

CONTENT REQUIREMENTS:
1. Questions MUST be directly based on the actual content of the text below
2. Each question should test comprehension, not just memorization
3. Questions should cover different sections/topics from the document
4. All 4 answer options must be plausible but only one correct
5. Avoid questions that are too obvious or too obscure
6. Use varied question types (What, Why, How, When, According to the text...)

DOCUMENT CONTENT:
${cleanedText}

Return EXACTLY this JSON structure with ${numQuestions} complete question objects:
[{"text":"Question here?","options":["Option A","Option B","Option C","Option D"],"correct_answer":"Option A","topic":"Topic name"}]

IMPORTANT: Respond with ONLY the JSON array. No explanations, no markdown, no extra text.`;

        console.log('📤 Sending request to Gemini API...');
        console.log('📝 Prompt length:', prompt.length, 'characters');

        // Use gemini-pro-latest (confirmed working with your API key)
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-latest:generateContent?key=${GEMINI_API_KEY}`;
        
        console.log('🌐 API endpoint:', apiUrl.replace(GEMINI_API_KEY, 'API_KEY_HIDDEN'));

        const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: prompt
                        }]
                    }],
                    generationConfig: {
                        temperature: 0.4,
                        maxOutputTokens: 3000,
                        topP: 0.8,
                        topK: 40
                    }
                })
            });

        console.log('📥 Response status:', response.status, response.statusText);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('❌ Gemini API Error Response:', JSON.stringify(errorData, null, 2));
            console.error('❌ Status Code:', response.status);
            console.error('❌ Status Text:', response.statusText);
            
            // Provide specific error messages
            let errorMessage = errorData.error?.message || 'Unknown error';
            
            if (response.status === 404) {
                errorMessage = 'Model not found. This should not happen with gemini-pro-latest.';
                console.log('🔄 Trying alternative (though gemini-pro-latest should work)...');
                
                // This shouldn't be needed since gemini-pro-latest works, but just in case
                try {
                    const altResponse = await fetch(
                        `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-latest:generateContent?key=${GEMINI_API_KEY}`,
                        {
                            method: 'POST',
                            headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify({
                                contents: [{parts: [{text: prompt}]}],
                                generationConfig: {temperature: 0.4, maxOutputTokens: 3000}
                            })
                        }
                    );
                    
                    if (altResponse.ok) {
                        console.log('✅ Alternative model (gemini-pro-latest) worked!');
                        const altData = await altResponse.json();
                        const generatedText = altData.candidates?.[0]?.content?.parts?.[0]?.text;
                        if (generatedText) {
                            console.log('✅ Got response from gemini-pro model');
                            return await processGeminiResponse(generatedText);
                        }
                    } else {
                        console.error('❌ Alternative model also failed:', altResponse.status);
                    }
                } catch (altError) {
                    console.error('❌ Alternative model error:', altError);
                }
            }
            
            if (response.status === 403) {
                // Check if it's specifically a leaked key error
                if (errorData.error?.message?.includes('leaked')) {
                    errorMessage = '🚨 API KEY COMPROMISED! Your key was reported as leaked and has been disabled.\n\n' +
                                   'Steps to fix:\n' +
                                   '1. Go to: https://aistudio.google.com/app/apikey\n' +
                                   '2. Delete the compromised key\n' +
                                   '3. Create a NEW API key\n' +
                                   '4. Update GEMINI_API_KEY in script.js\n' +
                                   '5. NEVER share your API key publicly!';
                } else {
                    errorMessage = 'Invalid API key or API access denied. Please check your Gemini API key.';
                }
            } else if (response.status === 429) {
                errorMessage = 'API quota exceeded. Please wait or upgrade your plan.';
            }
            
            throw new Error(`API error: ${response.status} - ${errorMessage}`);
        }

        const data = await response.json();
        console.log('✅ Received response from Gemini');
        console.log('📊 Response data structure:', Object.keys(data));
        
        // Extract text from Gemini response
        const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!generatedText) {
            console.error('❌ No text in response:', JSON.stringify(data, null, 2));
            throw new Error('No response from Gemini API');
        }
        
        return await processGeminiResponse(generatedText);

    } catch (error) {
        console.error('❌ Error with Gemini API:', error);
        console.error('❌ Error details:', error.message);
        console.error('❌ Stack trace:', error.stack);
        
        alert(`Gemini API Error: ${error.message}\n\nFalling back to basic algorithm. Check console for details.`);
        
        // Fallback to simple algorithm
        return generateQuestionsFallback(text, numQuestions);
    }
}

// Helper function to process Gemini response
async function processGeminiResponse(generatedText) {
    console.log('📄 Generated response length:', generatedText.length);
    console.log('📄 Full raw response:', generatedText);  // Log complete response
    console.log('📄 Response preview:', generatedText.substring(0, 300));

    // Parse JSON from response (handle markdown code blocks)
    let jsonText = generatedText.trim();
    
    // Remove markdown code blocks
    jsonText = jsonText.replace(/```json\s*/g, '').replace(/```\s*/g, '');
    
    // Remove any text before the JSON array
    jsonText = jsonText.replace(/^[^[]*/, '');
    
    // Remove any text after the JSON array
    const closingBracketIndex = jsonText.lastIndexOf(']');
    if (closingBracketIndex !== -1) {
        jsonText = jsonText.substring(0, closingBracketIndex + 1);
    }
    
    // Find JSON array in the text
    const jsonMatch = jsonText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
        console.error('❌ No JSON array found in response:', jsonText.substring(0, 500));
        throw new Error('Invalid response format from Gemini - no JSON array found');
    }
    
    jsonText = jsonMatch[0];
    console.log('🔍 Extracted JSON length:', jsonText.length);
    console.log('🔍 Full extracted JSON:', jsonText);  // Log complete extracted JSON
    
    // Clean up common JSON issues more aggressively
    jsonText = jsonText
        .replace(/,\s*}/g, '}')        // Remove trailing commas in objects
        .replace(/,\s*]/g, ']')        // Remove trailing commas in arrays
        .replace(/,\s*,/g, ',')        // Remove duplicate commas
        .replace(/\r?\n/g, ' ')        // Remove all newlines (Windows + Unix)
        .replace(/\t/g, ' ')           // Remove tabs
        .replace(/\s+/g, ' ')          // Normalize whitespace
        .replace(/"\s*:\s*/g, '":')    // Normalize key-value spacing
        .replace(/,\s*/g, ',')         // Normalize comma spacing
        .trim();
    
    console.log('🧹 Cleaned JSON:', jsonText);  // Log cleaned JSON
    
    let questions;
    try {
        questions = JSON.parse(jsonText);
        console.log('✅ Parsed', questions.length, 'questions successfully');
    } catch (parseError) {
        console.error('❌ JSON Parse Error:', parseError.message);
        console.error('❌ Error at position:', parseError.message.match(/position (\d+)/)?.[1] || 'unknown');
        console.error('❌ Problematic JSON (first 500 chars):', jsonText.substring(0, 500));
        console.error('❌ Problematic JSON (last 200 chars):', jsonText.substring(jsonText.length - 200));
        
        // Try to fix and parse again with even more aggressive cleaning
        try {
            console.log('🔧 Attempting aggressive repair...');
            
            // More aggressive cleaning
            let fixedJson = jsonText
                // Fix unquoted property names
                .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2":')
                // Convert single quotes to double quotes for strings
                .replace(/:\s*'([^']*)'/g, ':"$1"')
                // Remove any trailing commas before } or ]
                .replace(/,(\s*[}\]])/g, '$1')
                // Fix potential issues with escaped quotes
                .replace(/\\'/g, "'")
                // Remove any non-printable characters
                .replace(/[^\x20-\x7E\s]/g, '')
                // Ensure proper array/object closure
                .trim();
            
            // If the JSON doesn't end with ], try to close it properly
            if (!fixedJson.endsWith(']')) {
                console.log('⚠️ JSON does not end with ], attempting to close...');
                // Count opening and closing brackets
                const openBraces = (fixedJson.match(/{/g) || []).length;
                const closeBraces = (fixedJson.match(/}/g) || []).length;
                const openBrackets = (fixedJson.match(/\[/g) || []).length;
                const closeBrackets = (fixedJson.match(/\]/g) || []).length;
                
                // Add missing closing braces
                for (let i = 0; i < openBraces - closeBraces; i++) {
                    fixedJson += '}';
                }
                // Add missing closing brackets
                for (let i = 0; i < openBrackets - closeBrackets; i++) {
                    fixedJson += ']';
                }
                console.log('🔧 Added missing brackets, new JSON:', fixedJson);
            }
            
            console.log('🔧 Final fixed JSON:', fixedJson);
            questions = JSON.parse(fixedJson);
            console.log('✅ Parsed after aggressive cleanup:', questions.length, 'questions');
        } catch (retryError) {
            console.error('❌ Still failed after aggressive cleanup:', retryError.message);
            console.error('❌ Final attempted JSON:', jsonText);
            throw new Error(`Failed to parse Gemini response: ${parseError.message}`);
        }
    }
    
    // Validate questions
    const validatedQuestions = questions.filter((q, i) => {
            const isValid = q.text && 
                           Array.isArray(q.options) && 
                           q.options.length >= 4 &&
                           q.correct_answer &&
                           q.options.includes(q.correct_answer);
            
            if (!isValid) {
                console.warn(`⚠️ Question ${i + 1} failed validation:`, q);
            }
            return isValid;
        });
        
        console.log('✅ Validated questions:', validatedQuestions.length, '/', questions.length);
        
        if (validatedQuestions.length === 0) {
            throw new Error('No valid questions generated');
        }
        
        // Format questions
        const formattedQuestions = validatedQuestions.map((q, i) => {
            console.log(`✅ Question ${i + 1}:`, q.text);
            console.log(`   Topic: ${q.topic}`);
            console.log(`   Correct: ${q.correct_answer}`);
            
            return {
                id: `rag_gemini_${Date.now()}_${i}`,
                text: q.text,
                options: q.options.slice(0, 4),
                correct_answer: q.correct_answer,
                topic: q.topic || 'AI Generated',
                source: 'Gemini AI'
            };
        });
        
        console.log('🎉 Successfully generated', formattedQuestions.length, 'questions from document');
        return formattedQuestions;
}

// Improved Fallback function (when Gemini API is not available)
function generateQuestionsFallback(text, numQuestions) {
    console.log('⚠️ Using fallback algorithm (AI not available)');
    console.log('📄 Text length:', text.length);
    
    return new Promise((resolve) => {
        setTimeout(() => {
            const questions = [];
            
            // Clean text first
            const cleanText = text.replace(/\s+/g, ' ').trim();
            
            // Extract meaningful sentences (at least 10 words)
            const sentences = cleanText.match(/[^.!?]+[.!?]+/g) || [];
            const meaningfulSentences = sentences.filter(s => s.split(' ').length >= 10);
            
            console.log('📝 Found', meaningfulSentences.length, 'meaningful sentences');
            
            if (meaningfulSentences.length === 0) {
                console.error('❌ No meaningful sentences found in text');
                resolve([{
                    id: 'rag_error_1',
                    text: 'Unable to generate questions from this document. The text may be too short or unreadable.',
                    options: ['Please try again', 'Upload a different file', 'Check the file content', 'Contact support'],
                    correct_answer: 'Upload a different file',
                    topic: 'Error',
                    source: 'Fallback'
                }]);
                return;
            }
            
            // Extract paragraphs for context
            const paragraphs = cleanText.split(/\n\n+/).filter(p => p.length > 50);
            
            // Extract key terms (nouns, verbs) - better than random words
            const words = cleanText.toLowerCase().match(/\b[a-z]{5,}\b/g) || [];
            const commonWords = ['that', 'this', 'with', 'from', 'have', 'been', 'will', 'what', 'when', 'where', 'which', 'their', 'about', 'would', 'there', 'could', 'these', 'other', 'should', 'might', 'thing', 'things', 'being', 'often', 'after', 'before', 'without'];
            
            // Get word frequency
            const wordFreq = {};
            words.forEach(word => {
                if (!commonWords.includes(word)) {
                    wordFreq[word] = (wordFreq[word] || 0) + 1;
                }
            });
            
            // Get top keywords (mentioned multiple times)
            const keywords = Object.entries(wordFreq)
                .filter(([word, freq]) => freq >= 2)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 20)
                .map(([word]) => word);
            
            console.log('🔑 Top keywords:', keywords.slice(0, 10));
            
            // Generate questions based on actual content
            const questionsToGenerate = Math.min(numQuestions, meaningfulSentences.length, 10);
            
            for (let i = 0; i < questionsToGenerate; i++) {
                // Pick a random meaningful sentence
                const sentenceIndex = Math.floor(Math.random() * meaningfulSentences.length);
                const sentence = meaningfulSentences[sentenceIndex].trim();
                const sentenceWords = sentence.toLowerCase().split(' ');
                
                // Find a keyword in this sentence
                const sentenceKeyword = keywords.find(kw => sentenceWords.includes(kw)) || keywords[i % keywords.length];
                
                // Create question based on the actual sentence
                const questionText = `According to the text, which statement is most accurate regarding ${sentenceKeyword}?`;
                
                // Use the actual sentence as correct answer, generate plausible distractors
                const correctAnswer = sentence.replace(/[.!?]+$/, '');
                const wrongAnswers = [
                    `${sentenceKeyword.charAt(0).toUpperCase() + sentenceKeyword.slice(1)} is not mentioned in the document`,
                    `The text contradicts the concept of ${sentenceKeyword}`,
                    `${sentenceKeyword.charAt(0).toUpperCase() + sentenceKeyword.slice(1)} is only briefly referenced without detail`
                ];
                
                // Try to get alternative sentences with the same keyword for better distractors
                const altSentences = meaningfulSentences.filter((s, idx) => 
                    idx !== sentenceIndex && 
                    s.toLowerCase().includes(sentenceKeyword)
                );
                
                if (altSentences.length > 0) {
                    wrongAnswers[0] = altSentences[0].replace(/[.!?]+$/, '');
                }
                
                const options = [correctAnswer, ...wrongAnswers].slice(0, 4);
                
                // Shuffle options
                const shuffledOptions = options.sort(() => Math.random() - 0.5);
                
                questions.push({
                    id: `rag_fallback_${i + 1}`,
                    text: questionText,
                    options: shuffledOptions,
                    correct_answer: correctAnswer,
                    topic: `Document Analysis - ${sentenceKeyword}`,
                    source: 'Fallback Algorithm'
                });
                
                console.log(`✅ Fallback Q${i + 1}:`, questionText);
            }
            
            console.log('✅ Generated', questions.length, 'questions using fallback');
            resolve(questions);
        }, 1500);
    });
}

// Display generated questions with better formatting
function displayGeneratedQuestions() {
    console.log('🎨 Displaying', ragQuestions.length, 'generated questions');
    
    document.getElementById('processing-status').style.display = 'none';
    document.getElementById('generated-questions').style.display = 'block';
    
    const questionsList = document.getElementById('questions-list');
    questionsList.innerHTML = '';
    
    ragQuestions.forEach((question, index) => {
        const questionDiv = document.createElement('div');
        questionDiv.className = 'question-preview';
        
        questionDiv.innerHTML = `
            <h4>Question ${index + 1}</h4>
            <p>${question.text}</p>
            <div class="options">
                ${question.options.map((option, i) => `
                    <div class="option ${option === question.correct_answer ? 'correct' : ''}">
                        ${String.fromCharCode(65 + i)}. ${option}
                    </div>
                `).join('')}
            </div>
        `;
        
        questionsList.appendChild(questionDiv);
    });
}

function updateRAGQuestionCount() {
    const countElement = document.getElementById('rag-question-count');
    if (countElement) {
        countElement.textContent = ragQuestions.length;
    }
}

function startRAGQuiz() {
    if (ragQuestions.length === 0) return;
    
    // Replace current questions with RAG questions
    questions = [...ragQuestions];
    currentQuestionIndex = 0;
    
    // Close RAG modal and open quiz modal
    closeRAGModal();
    openQuizModal();
}

function saveRAGQuestions() {
    if (ragQuestions.length === 0) return;
    
    // Create a downloadable JSON file
    const dataStr = JSON.stringify(ragQuestions, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = 'rag_questions.json';
    link.click();
    
    URL.revokeObjectURL(url);
    
    // Show confirmation message
    alert('Questions saved successfully! You can now use this file as your questions.json');
}

// Initialize Gemini Voice Assistant
if (typeof GeminiVoiceAssistant !== 'undefined') {
    window.geminiAssistant = new GeminiVoiceAssistant();
    window.geminiAssistant.initialize().then(() => {
        console.log('✅ Gemini Voice Assistant initialized successfully');
    }).catch(err => {
        console.error('❌ Failed to initialize Gemini Voice Assistant:', err);
    });
} else {
    console.warn('⚠️ GeminiVoiceAssistant class not found');
}

// ===== COMMUNITY QUIZ FUNCTIONALITY =====

function openCommunityQuizModal() {
    const modal = document.getElementById('community-quiz-modal');
    modal.classList.add('active');
}

function closeCommunityQuizModal() {
    const modal = document.getElementById('community-quiz-modal');
    modal.classList.remove('active');
}

// Make functions globally accessible
window.openCommunityQuizModal = openCommunityQuizModal;
window.closeCommunityQuizModal = closeCommunityQuizModal;
window.toggleCamera = toggleCamera;

// Dataset imports - simulated datasets (in production, these would fetch from a server)
const communityDatasets = {
    calculus1: [
        {
            text: "What is the limit of (x² - 4)/(x - 2) as x approaches 2?",
            options: ["4", "2", "0", "Undefined"],
            correct_answer: "4",
            topic: "Limits"
        },
        {
            text: "What is the derivative of f(x) = 3x² + 2x - 1?",
            options: ["6x + 2", "3x + 2", "6x - 1", "3x² + 2"],
            correct_answer: "6x + 2",
            topic: "Derivatives"
        },
        {
            text: "What is ∫(2x + 3)dx?",
            options: ["x² + 3x + C", "2x² + 3x + C", "x² + 3 + C", "2x + 3x + C"],
            correct_answer: "x² + 3x + C",
            topic: "Integration"
        }
    ],
    calculus2: [
        {
            text: "What is the Taylor series expansion of e^x around x = 0?",
            options: ["∑(x^n/n!)", "∑(x^n)", "∑(n*x^n)", "∑(x^n/2^n)"],
            correct_answer: "∑(x^n/n!)",
            topic: "Series"
        },
        {
            text: "Evaluate ∫x*e^x dx using integration by parts",
            options: ["e^x(x-1) + C", "x*e^x + C", "e^x(x+1) + C", "x*e^x - e^x + C"],
            correct_answer: "e^x(x-1) + C",
            topic: "Integration Techniques"
        }
    ],
    linearalgebra: [
        {
            text: "What is the determinant of [[2,3],[1,4]]?",
            options: ["5", "8", "11", "2"],
            correct_answer: "5",
            topic: "Determinants"
        },
        {
            text: "If A is a 3×2 matrix and B is a 2×4 matrix, what is the size of AB?",
            options: ["3×4", "2×2", "3×2", "Cannot multiply"],
            correct_answer: "3×4",
            topic: "Matrix Operations"
        }
    ],
    physics: [
        {
            text: "What is Newton's second law of motion?",
            options: ["F = ma", "E = mc²", "p = mv", "W = Fd"],
            correct_answer: "F = ma",
            topic: "Mechanics"
        },
        {
            text: "What is the unit of electrical resistance?",
            options: ["Ohm", "Volt", "Ampere", "Watt"],
            correct_answer: "Ohm",
            topic: "Electricity"
        }
    ],
    chemistry: [
        {
            text: "What is the atomic number of Carbon?",
            options: ["6", "12", "8", "14"],
            correct_answer: "6",
            topic: "Atomic Structure"
        },
        {
            text: "What type of bond forms when electrons are shared between atoms?",
            options: ["Covalent", "Ionic", "Metallic", "Hydrogen"],
            correct_answer: "Covalent",
            topic: "Chemical Bonding"
        }
    ],
    statistics: [
        {
            text: "What is the mean of the dataset: 2, 4, 6, 8, 10?",
            options: ["6", "5", "7", "8"],
            correct_answer: "6",
            topic: "Descriptive Statistics"
        },
        {
            text: "In a normal distribution, approximately what percentage of data falls within one standard deviation of the mean?",
            options: ["68%", "95%", "99%", "50%"],
            correct_answer: "68%",
            topic: "Probability Distributions"
        }
    ]
};

async function importDataset(datasetName) {
    console.log('📥 Importing dataset:', datasetName);
    
    if (!communityDatasets[datasetName]) {
        alert('Dataset not found!');
        return;
    }
    
    const dataset = communityDatasets[datasetName];
    
    // Show confirmation
    const confirmed = confirm(`Import ${dataset.length} questions from ${datasetName.toUpperCase()} dataset?\n\nThis will replace your current quiz questions.`);
    
    if (!confirmed) return;
    
    // Import the dataset
    questions = dataset.map((q, index) => ({
        id: `community_${datasetName}_${index}`,
        text: q.text,
        options: q.options,
        correct_answer: q.correct_answer,
        topic: q.topic,
        source: `Community - ${datasetName}`
    }));
    
    // Update question count
    updateQuestionCount();
    
    // Close modal
    closeCommunityQuizModal();
    
    // Show success message
    alert(`✅ Successfully imported ${dataset.length} questions from ${datasetName.toUpperCase()}!\n\nClick "Start Practice" to begin the quiz.`);
    
    console.log('✅ Dataset imported:', questions);
}

// Make globally accessible
window.importDataset = importDataset;

// Initialize Community Quiz modal event listeners
document.addEventListener('DOMContentLoaded', () => {
    const closeBtn = document.getElementById('close-community-modal');
    const modal = document.getElementById('community-quiz-modal');
    
    if (closeBtn) {
        closeBtn.addEventListener('click', closeCommunityQuizModal);
    }
    
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeCommunityQuizModal();
            }
        });
    }
    
    // Escape key to close
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeCommunityQuizModal();
        }
    });
});
