// Global variables
let questions = [];
let currentQuestionIndex = 0;
let ragQuestions = [];
let currentFile = null;

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
    
    // Auto-start eye tracking when quiz begins
    if (window.eyeTracker && !window.eyeTracker.isTracking) {
        window.eyeTracker.start();
        console.log('Eye tracking auto-started with quiz');
    }
    
    displayQuestion();
}

// Close quiz modal
function closeQuizModal() {
    const modal = document.getElementById('quiz-modal');
    modal.classList.remove('active');
    
    // Auto-stop eye tracking when quiz closes
    if (window.eyeTracker && window.eyeTracker.isTracking) {
        window.eyeTracker.stop();
        console.log('Eye tracking auto-stopped with quiz close');
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
        return;
    }
    
    const question = questions[currentQuestionIndex];
    
    // Start tracking this question
    if (window.eyeTracker && window.eyeTracker.isTracking) {
        window.eyeTracker.startQuestionTracking(question);
    }
    
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
            closeRAGModal();
        }
    });
    
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
    if (!currentFile) return;
    
    // Show processing status
    document.getElementById('file-info').style.display = 'none';
    document.getElementById('processing-status').style.display = 'block';
    
    try {
        // Read file content
        const text = await readFileContent(currentFile);
        
        // Generate questions based on content
        const numQuestions = parseInt(document.getElementById('question-slider').value);
        ragQuestions = await generateQuestions(text, numQuestions);
        
        // Display generated questions
        displayGeneratedQuestions();
        
        // Update RAG question count
        updateRAGQuestionCount();
        
    } catch (error) {
        console.error('Error generating questions:', error);
        alert('Failed to generate questions. Please try again.');
        resetRAGModal();
    }
}

function readFileContent(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            const content = e.target.result;
            
            if (file.name.endsWith('.txt') || file.name.endsWith('.md')) {
                resolve(content);
            } else if (file.name.endsWith('.pdf')) {
                // For PDF, we'll extract text (simplified - in production use PDF.js library)
                resolve(content);
            } else if (file.name.endsWith('.docx')) {
                // For DOCX (simplified - in production use mammoth.js library)
                resolve(content);
            } else {
                resolve(content);
            }
        };
        
        reader.onerror = reject;
        reader.readAsText(file);
    });
}

// Gemini API Configuration
// Add your API key here or create a config.js file
const GEMINI_API_KEY = 'AIzaSyC5Iz17hM7F36tOlZxhPYjxcXl77rhR7ds'; // Replace with your actual API key

async function generateQuestions(text, numQuestions) {
    // Check if API key is set
    if (!GEMINI_API_KEY || GEMINI_API_KEY === 'AIzaSyC5Iz17hM7F36tOlZxhPYjxcXl77rhR7ds') {
        console.warn('Gemini API key not set. Using fallback algorithm.');
        return generateQuestionsFallback(text, numQuestions);
    }

    try {
        // Truncate text if too long (Gemini has token limits)
        const maxChars = 8000;
        const truncatedText = text.length > maxChars ? text.substring(0, maxChars) : text;

        const prompt = `You are an expert educator. Generate ${numQuestions} multiple-choice questions based on the following text.

For each question:
1. Create a clear, specific question that tests understanding
2. Provide exactly 4 answer options
3. Mark which option is correct
4. Make questions diverse (what, why, how, when, etc.)
5. Ensure questions cover different parts of the text

Text to analyze:
${truncatedText}

IMPORTANT: Return ONLY a valid JSON array with NO additional text or markdown. Use this exact format:
[
  {
    "text": "Question text here?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct_answer": "The correct option text",
    "topic": "Main topic"
  }
]`;

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
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
                        temperature: 0.7,
                        maxOutputTokens: 2048,
                    }
                })
            }
        );

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Gemini API Error:', errorData);
            throw new Error(`API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
        }

        const data = await response.json();
        
        // Extract text from Gemini response
        const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!generatedText) {
            throw new Error('No response from Gemini API');
        }

        // Parse JSON from response (remove markdown code blocks if present)
        let jsonText = generatedText.trim();
        jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
        
        const questions = JSON.parse(jsonText);
        
        // Validate and format questions
        return questions.map((q, i) => ({
            id: `rag_gemini_${i + 1}`,
            text: q.text,
            options: q.options.slice(0, 4), // Ensure exactly 4 options
            correct_answer: q.correct_answer,
            topic: q.topic || 'AI Generated',
            source: 'Gemini AI'
        }));

    } catch (error) {
        console.error('Error with Gemini API:', error);
        alert('Gemini API failed. Using fallback algorithm. Check your API key in script.js');
        // Fallback to simple algorithm
        return generateQuestionsFallback(text, numQuestions);
    }
}

// Fallback function (original simple algorithm)
function generateQuestionsFallback(text, numQuestions) {
    return new Promise((resolve) => {
        // Simulate processing time
        setTimeout(() => {
            const questions = [];
            
            // Extract key concepts and sentences from text
            const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
            const words = text.toLowerCase().match(/\b[a-z]{4,}\b/g) || [];
            
            // Get unique important words (excluding common words)
            const commonWords = ['that', 'this', 'with', 'from', 'have', 'been', 'will', 'what', 'when', 'where', 'which', 'their', 'about', 'would', 'there', 'could', 'these', 'other'];
            const importantWords = [...new Set(words)]
                .filter(word => !commonWords.includes(word))
                .slice(0, 50);
            
            // Generate questions
            for (let i = 0; i < Math.min(numQuestions, sentences.length); i++) {
                const sentence = sentences[Math.floor(Math.random() * sentences.length)];
                const keyWord = importantWords[Math.floor(Math.random() * importantWords.length)] || 'concept';
                
                // Create different types of questions
                const questionTypes = [
                    {
                        text: `What is the main concept discussed regarding ${keyWord}?`,
                        options: generateOptions(keyWord, importantWords),
                        correct: keyWord
                    },
                    {
                        text: `According to the text, which statement about ${keyWord} is correct?`,
                        options: generateStatementOptions(sentence, keyWord),
                        correct: sentence.trim()
                    },
                    {
                        text: `What does the text explain about ${keyWord}?`,
                        options: generateOptions(keyWord, importantWords),
                        correct: keyWord
                    }
                ];
                
                const selectedType = questionTypes[i % questionTypes.length];
                
                questions.push({
                    id: `rag_${i + 1}`,
                    text: selectedType.text,
                    options: selectedType.options.slice(0, 4),
                    correct_answer: selectedType.correct,
                    topic: 'Document Analysis',
                    source: 'RAG Generated'
                });
            }
            
            resolve(questions);
        }, 2000);
    });
}

function generateOptions(correctAnswer, wordPool) {
    const options = [correctAnswer];
    
    while (options.length < 4 && wordPool.length > 0) {
        const randomWord = wordPool[Math.floor(Math.random() * wordPool.length)];
        if (!options.includes(randomWord)) {
            options.push(randomWord);
        }
    }
    
    // Add generic options if needed
    while (options.length < 4) {
        options.push(`Option ${options.length + 1}`);
    }
    
    // Shuffle options
    return options.sort(() => Math.random() - 0.5);
}

function generateStatementOptions(baseSentence, keyWord) {
    const options = [
        baseSentence.trim(),
        `${keyWord} is not relevant to this topic`,
        `The text does not mention ${keyWord}`,
        `${keyWord} has no significance in this context`
    ];
    
    return options.sort(() => Math.random() - 0.5);
}

function displayGeneratedQuestions() {
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
