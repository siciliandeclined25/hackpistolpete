#!/usr/bin/env node

/**
 * Quiz Context MCP Server
 * Provides quiz state and context to AI assistants via Model Context Protocol
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import express from 'express';
import cors from 'cors';

// Quiz state storage
let quizState = {
  currentQuestion: null,
  currentQuestionIndex: 0,
  totalQuestions: 0,
  userAnswers: [],
  questionHistory: [],
  focusData: null,
  isActive: false,
};

// Analytics data storage
let quizAnalytics = {
  questionTimes: [], // Array of {question, topic, timeSpent, correct}
  topicPerformance: {} // {topic: {totalTime, count, correctCount}}
};

// Create Express app for HTTP API
const app = express();

// CORS configuration - allow all origins for development
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'MCP Server is running' });
});

// HTTP endpoint to update quiz context from frontend
app.post('/api/quiz/context', (req, res) => {
  const { question, questionIndex, totalQuestions } = req.body;
  
  quizState.currentQuestion = question;
  quizState.currentQuestionIndex = questionIndex;
  quizState.totalQuestions = totalQuestions;
  quizState.isActive = true;
  
  if (!quizState.questionHistory.some(q => q.text === question.text)) {
    quizState.questionHistory.push(question);
  }
  
  console.log(`✅ Updated context: Question ${questionIndex + 1}/${totalQuestions}`);
  res.json({ success: true, message: 'Context updated' });
});

// HTTP endpoint to GET current quiz context
app.get('/api/quiz/context', (req, res) => {
  if (!quizState.isActive || !quizState.currentQuestion) {
    res.json({
      success: false,
      message: 'No active quiz',
      data: null
    });
  } else {
    res.json({
      success: true,
      data: {
        question: quizState.currentQuestion,
        questionIndex: quizState.currentQuestionIndex,
        totalQuestions: quizState.totalQuestions,
        isActive: quizState.isActive
      }
    });
  }
});

// HTTP endpoint to record answers
app.post('/api/quiz/answer', (req, res) => {
  const { questionIndex, selectedAnswer, isCorrect } = req.body;
  
  quizState.userAnswers.push({
    questionIndex,
    selectedAnswer,
    isCorrect,
    timestamp: new Date().toISOString(),
  });
  
  console.log(`📝 Recorded answer for question ${questionIndex + 1}: ${isCorrect ? '✓' : '✗'}`);
  res.json({ success: true, message: 'Answer recorded' });
});

// HTTP endpoint to update focus data
app.post('/api/quiz/focus', (req, res) => {
  quizState.focusData = req.body;
  console.log(`👁️ Updated focus data`);
  res.json({ success: true, message: 'Focus data updated' });
});

// HTTP endpoint to receive analytics data
app.post('/api/quiz/analytics', (req, res) => {
  const { questionTimes, topicPerformance } = req.body;
  
  if (questionTimes) {
    quizAnalytics.questionTimes = questionTimes;
  }
  
  if (topicPerformance) {
    quizAnalytics.topicPerformance = topicPerformance;
  }
  
  console.log(`📊 Updated analytics: ${quizAnalytics.questionTimes.length} questions tracked`);
  res.json({ success: true, message: 'Analytics updated' });
});

// HTTP endpoint to get analytics
app.get('/api/quiz/analytics', (req, res) => {
  res.json({
    success: true,
    data: quizAnalytics
  });
});

// HTTP endpoint to reset quiz
app.post('/api/quiz/reset', (req, res) => {
  quizState = {
    currentQuestion: null,
    currentQuestionIndex: 0,
    totalQuestions: 0,
    userAnswers: [],
    questionHistory: [],
    focusData: null,
    isActive: false,
  };
  console.log('🔄 Quiz state reset');
  res.json({ success: true, message: 'Quiz reset' });
});

// Start HTTP server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🌐 HTTP API listening on port ${PORT}`);
  console.log(`📡 Ready to receive quiz context updates`);
});

// Create MCP server
const server = new Server(
  {
    name: 'quiz-context-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      resources: {},
      tools: {},
    },
  }
);

// List available resources
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: 'quiz://current',
        mimeType: 'application/json',
        name: 'Current Quiz State',
        description: 'The current active quiz question and user progress',
      },
      {
        uri: 'quiz://history',
        mimeType: 'application/json',
        name: 'Question History',
        description: 'All questions attempted in this session',
      },
      {
        uri: 'quiz://performance',
        mimeType: 'application/json',
        name: 'Performance Summary',
        description: 'User performance statistics and focus metrics',
      },
    ],
  };
});

// Read resource content
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;

  if (uri === 'quiz://current') {
    if (!quizState.isActive || !quizState.currentQuestion) {
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({
              status: 'inactive',
              message: 'No quiz currently active',
            }, null, 2),
          },
        ],
      };
    }

    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify({
            status: 'active',
            currentQuestion: quizState.currentQuestion,
            questionNumber: quizState.currentQuestionIndex + 1,
            totalQuestions: quizState.totalQuestions,
            progress: `${quizState.currentQuestionIndex + 1}/${quizState.totalQuestions}`,
          }, null, 2),
        },
      ],
    };
  }

  if (uri === 'quiz://history') {
    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify({
            totalAttempted: quizState.questionHistory.length,
            questions: quizState.questionHistory,
          }, null, 2),
        },
      ],
    };
  }

  if (uri === 'quiz://performance') {
    const totalAnswered = quizState.userAnswers.length;
    const correctAnswers = quizState.userAnswers.filter(a => a.isCorrect).length;
    const accuracy = totalAnswered > 0 ? (correctAnswers / totalAnswered * 100).toFixed(1) : 0;

    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify({
            totalAnswered,
            correctAnswers,
            incorrectAnswers: totalAnswered - correctAnswers,
            accuracy: `${accuracy}%`,
            focusData: quizState.focusData,
            recentAnswers: quizState.userAnswers.slice(-5),
          }, null, 2),
        },
      ],
    };
  }

  throw new Error(`Unknown resource: ${uri}`);
});

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'get_current_question',
        description: 'Get the current quiz question the student is working on',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_question_details',
        description: 'Get detailed information about a specific question including all options',
        inputSchema: {
          type: 'object',
          properties: {
            questionIndex: {
              type: 'number',
              description: 'Index of the question (0-based)',
            },
          },
          required: ['questionIndex'],
        },
      },
      {
        name: 'get_performance_summary',
        description: 'Get the student\'s overall performance statistics',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_difficult_questions',
        description: 'Identify questions the student found challenging (based on time spent or incorrect answers)',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_quiz_analytics',
        description: 'Get comprehensive quiz performance analytics including time tracking, topic-based performance, accuracy by topic, and areas needing improvement',
        inputSchema: {
          type: 'object',
          properties: {
            sortBy: {
              type: 'string',
              enum: ['time', 'accuracy', 'count'],
              description: 'How to sort topics: by time spent, accuracy, or question count',
              default: 'time'
            }
          },
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'get_current_question') {
    if (!quizState.isActive || !quizState.currentQuestion) {
      return {
        content: [
          {
            type: 'text',
            text: 'No quiz is currently active.',
          },
        ],
      };
    }

    const q = quizState.currentQuestion;
    return {
      content: [
        {
          type: 'text',
          text: `Current Question (${quizState.currentQuestionIndex + 1}/${quizState.totalQuestions}):\n\n${q.text}\n\nOptions:\nA. ${q.options[0]}\nB. ${q.options[1]}\nC. ${q.options[2]}\nD. ${q.options[3]}\n\nTopic: ${q.topic || 'General'}`,
        },
      ],
    };
  }

  if (name === 'get_question_details') {
    const idx = args.questionIndex;
    if (idx < 0 || idx >= quizState.questionHistory.length) {
      return {
        content: [
          {
            type: 'text',
            text: `Question index ${idx} is out of range. Valid range: 0-${quizState.questionHistory.length - 1}`,
          },
        ],
      };
    }

    const q = quizState.questionHistory[idx];
    const answer = quizState.userAnswers.find(a => a.questionIndex === idx);
    
    let answerInfo = 'Not answered yet';
    if (answer) {
      answerInfo = `Student answered: ${answer.selectedAnswer} (${answer.isCorrect ? 'Correct ✓' : 'Incorrect ✗'})`;
    }

    return {
      content: [
        {
          type: 'text',
          text: `Question ${idx + 1}:\n\n${q.text}\n\nOptions:\nA. ${q.options[0]}\nB. ${q.options[1]}\nC. ${q.options[2]}\nD. ${q.options[3]}\n\nCorrect Answer: ${q.correct_answer}\nTopic: ${q.topic || 'General'}\n\n${answerInfo}`,
        },
      ],
    };
  }

  if (name === 'get_performance_summary') {
    const totalAnswered = quizState.userAnswers.length;
    const correctAnswers = quizState.userAnswers.filter(a => a.isCorrect).length;
    const accuracy = totalAnswered > 0 ? (correctAnswers / totalAnswered * 100).toFixed(1) : 0;

    return {
      content: [
        {
          type: 'text',
          text: `Performance Summary:\n\nTotal Questions Answered: ${totalAnswered}\nCorrect: ${correctAnswers}\nIncorrect: ${totalAnswered - correctAnswers}\nAccuracy: ${accuracy}%\n\nCurrent Progress: Question ${quizState.currentQuestionIndex + 1} of ${quizState.totalQuestions}`,
        },
      ],
    };
  }

  if (name === 'get_difficult_questions') {
    const incorrectAnswers = quizState.userAnswers.filter(a => !a.isCorrect);
    
    if (incorrectAnswers.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: 'Great job! No incorrect answers so far.',
          },
        ],
      };
    }

    const difficultQuestions = incorrectAnswers.map(a => {
      const q = quizState.questionHistory[a.questionIndex];
      return `Question ${a.questionIndex + 1}: ${q.text} (Topic: ${q.topic || 'General'})`;
    });

    return {
      content: [
        {
          type: 'text',
          text: `Challenging Questions (${incorrectAnswers.length} incorrect):\n\n${difficultQuestions.join('\n\n')}`,
        },
      ],
    };
  }

  if (name === 'get_quiz_analytics') {
    const sortBy = args?.sortBy || 'time';
    
    if (quizAnalytics.questionTimes.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: 'No analytics data available yet. The student needs to answer some questions first.',
          },
        ],
      };
    }

    // Calculate overall statistics
    let totalTime = 0;
    let correctCount = 0;
    
    quizAnalytics.questionTimes.forEach(q => {
      totalTime += q.timeSpent;
      if (q.correct) correctCount++;
    });

    const avgTime = (totalTime / quizAnalytics.questionTimes.length).toFixed(1);
    const accuracy = ((correctCount / quizAnalytics.questionTimes.length) * 100).toFixed(1);

    // Build topic breakdown
    const topicBreakdown = [];
    for (const [topic, data] of Object.entries(quizAnalytics.topicPerformance)) {
      const avgTopicTime = (data.totalTime / data.count).toFixed(1);
      const topicAccuracy = ((data.correctCount / data.count) * 100).toFixed(1);
      
      topicBreakdown.push({
        topic: topic,
        questionsAttempted: data.count,
        averageTime: parseFloat(avgTopicTime),
        accuracy: parseFloat(topicAccuracy),
        totalTime: parseFloat(data.totalTime.toFixed(1)),
        correctCount: data.correctCount
      });
    }

    // Sort based on preference
    if (sortBy === 'time') {
      topicBreakdown.sort((a, b) => b.averageTime - a.averageTime);
    } else if (sortBy === 'accuracy') {
      topicBreakdown.sort((a, b) => a.accuracy - b.accuracy);
    } else if (sortBy === 'count') {
      topicBreakdown.sort((a, b) => b.questionsAttempted - a.questionsAttempted);
    }

    // Find areas needing improvement
    const weakAreas = topicBreakdown.filter(t => t.accuracy < 70 || t.averageTime > parseFloat(avgTime) * 1.2);
    const strongAreas = topicBreakdown.filter(t => t.accuracy >= 80 && t.averageTime <= parseFloat(avgTime));

    // Build formatted response
    let analyticsText = `📊 COMPREHENSIVE QUIZ ANALYTICS\n\n`;
    analyticsText += `═══════════════════════════════════════\n\n`;
    analyticsText += `📈 OVERALL PERFORMANCE:\n`;
    analyticsText += `• Total Questions: ${quizAnalytics.questionTimes.length}\n`;
    analyticsText += `• Total Time: ${totalTime.toFixed(1)}s\n`;
    analyticsText += `• Average Time/Question: ${avgTime}s\n`;
    analyticsText += `• Overall Accuracy: ${accuracy}%\n`;
    analyticsText += `• Correct: ${correctCount}/${quizAnalytics.questionTimes.length}\n\n`;
    
    analyticsText += `═══════════════════════════════════════\n\n`;
    analyticsText += `📚 TOPIC BREAKDOWN (sorted by ${sortBy}):\n\n`;
    
    topicBreakdown.forEach((topic, index) => {
      analyticsText += `${index + 1}. ${topic.topic}\n`;
      analyticsText += `   • Questions: ${topic.questionsAttempted}\n`;
      analyticsText += `   • Avg Time: ${topic.averageTime}s\n`;
      analyticsText += `   • Accuracy: ${topic.accuracy}% (${topic.correctCount}/${topic.questionsAttempted})\n`;
      analyticsText += `   • Total Time: ${topic.totalTime}s\n\n`;
    });

    analyticsText += `═══════════════════════════════════════\n\n`;
    
    if (weakAreas.length > 0) {
      analyticsText += `⚠️ AREAS NEEDING IMPROVEMENT:\n`;
      weakAreas.forEach(topic => {
        analyticsText += `• ${topic.topic}: `;
        if (topic.accuracy < 70) {
          analyticsText += `Low accuracy (${topic.accuracy}%) `;
        }
        if (topic.averageTime > parseFloat(avgTime) * 1.2) {
          analyticsText += `Slow response time (${topic.averageTime}s vs ${avgTime}s avg)`;
        }
        analyticsText += `\n`;
      });
      analyticsText += `\n`;
    }

    if (strongAreas.length > 0) {
      analyticsText += `✅ STRONG AREAS:\n`;
      strongAreas.forEach(topic => {
        analyticsText += `• ${topic.topic}: High accuracy (${topic.accuracy}%), Fast (${topic.averageTime}s)\n`;
      });
      analyticsText += `\n`;
    }

    analyticsText += `═══════════════════════════════════════\n\n`;
    analyticsText += `💡 RECOMMENDATIONS:\n`;
    
    if (weakAreas.length > 0) {
      const slowestTopic = topicBreakdown[0];
      const leastAccurate = [...topicBreakdown].sort((a, b) => a.accuracy - b.accuracy)[0];
      
      analyticsText += `• Focus on "${leastAccurate.topic}" to improve accuracy (currently ${leastAccurate.accuracy}%)\n`;
      if (slowestTopic.topic !== leastAccurate.topic) {
        analyticsText += `• Practice "${slowestTopic.topic}" for better time management (avg ${slowestTopic.averageTime}s)\n`;
      }
      analyticsText += `• Review incorrect answers and identify common mistakes\n`;
    } else {
      analyticsText += `• Great job! Keep up the consistent performance\n`;
      analyticsText += `• Challenge yourself with more advanced topics\n`;
    }

    return {
      content: [
        {
          type: 'text',
          text: analyticsText,
        },
      ],
    };
  }

  throw new Error(`Unknown tool: ${name}`);
});

// Start MCP server on stdio
async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.log('🚀 MCP Server running on stdio');
  console.log('📋 Available resources: quiz://current, quiz://history, quiz://performance');
  console.log('🛠️  Available tools: get_current_question, get_question_details, get_performance_summary, get_difficult_questions, get_quiz_analytics');
}

runServer().catch(console.error);
