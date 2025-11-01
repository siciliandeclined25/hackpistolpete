// Global variables
let questions = [];
let currentQuestionIndex = 0;

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
    
    // Show user message
    showMessage(text, 'user');
    
    // Clear input
    input.value = '';
    input.style.height = 'auto';
    
    // Simple AI response (you can expand this)
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
    
    const modal = document.getElementById('quiz-modal');
    modal.classList.add('active');
    currentQuestionIndex = 0;
    displayQuestion();
}

// Close quiz modal
function closeQuizModal() {
    const modal = document.getElementById('quiz-modal');
    modal.classList.remove('active');
}

// Display current question
function displayQuestion() {
    const quizContent = document.getElementById('quiz-content');
    quizContent.innerHTML = '';
    
    if (currentQuestionIndex >= questions.length) {
        // Quiz completed
        quizContent.innerHTML = `
            <div style="text-align: center; padding: 2rem;">
                <div style="font-size: 3rem; margin-bottom: 1rem;">🎉</div>
                <h2 style="margin-bottom: 1rem;">Quiz Completed!</h2>
                <p style="color: var(--text-secondary); margin-bottom: 2rem;">
                    You've completed all ${questions.length} questions.
                </p>
                <button class="card-button" onclick="restartQuiz()" style="max-width: 200px; margin: 0 auto;">
                    Restart Quiz
                </button>
            </div>
        `;
        return;
    }
    
    const question = questions[currentQuestionIndex];
    
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
}

// Next question
function nextQuestion() {
    currentQuestionIndex++;
    displayQuestion();
}

// Previous question
function previousQuestion() {
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
    // Load questions
    loadQuestions();
    
    // Send button
    const sendBtn = document.getElementById('send-btn');
    sendBtn.addEventListener('click', handleUserInput);
    
    // Input field
    const input = document.getElementById('user-input');
    input.addEventListener('input', (e) => autoResizeTextarea(e.target));
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleUserInput();
        }
    });
    
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
    
    // Suggestion chips
    document.addEventListener('click', handleSuggestionClick);
    
    // Escape key to close modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeQuizModal();
        }
    });
});
