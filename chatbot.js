/**
 * chatbot.js — Conversational Interior Design Assistant
 * 
 * Maintains conversation context and user preferences throughout the session.
 * Generates personalized interior designs based on natural language input.
 * Memory persists until final image generation.
 */

(function(global) {
    'use strict';

    // ── Conversation State ────────────────────────────────────────────────────
    const conversation = {
        messages: [],           // Full chat history
        preferences: {
            roomType: null,     // 'living' | 'bedroom' | 'kitchen'
            style: null,        // 'modern' | 'minimal' | 'traditional' | 'luxury'
            budget: 50000,
            colors: [],         // User-specified colors
            furniture: [],      // Requested furniture items
            placement: {},      // Custom placement instructions
            avoid: [],          // Things to avoid
            priorities: []      // What matters most to user
        },
        imageUploaded: false,
        readyToGenerate: false
    };

    // ── NLP Pattern Matching ──────────────────────────────────────────────────
    const patterns = {
        roomType: {
            living: /living\s*room|lounge|sitting\s*room|family\s*room/i,
            bedroom: /bedroom|bed\s*room|sleeping\s*room|master\s*bedroom/i,
            kitchen: /kitchen|cooking\s*area|dining\s*kitchen/i
        },
        style: {
            modern: /modern|contemporary|sleek|minimalist\s*modern|clean\s*lines/i,
            minimal: /minimal|minimalist|simple|zen|scandinavian|nordic/i,
            traditional: /traditional|classic|vintage|rustic|warm|cozy/i,
            luxury: /luxury|luxurious|premium|high[\s-]end|elegant|opulent/i
        },
        budget: /budget|spend|afford|price|cost.*?(\d+(?:,\d{3})*(?:\.\d{2})?)/i,
        colors: /color|colour|shade|tone|hue|palette/i,
        furniture: /furniture|sofa|couch|bed|table|chair|lamp|shelf|cabinet/i,
        placement: /place|put|position|locate|corner|wall|center|left|right/i,
        avoid: /don't|dont|avoid|no|not|without|exclude/i,
        priority: /important|priority|must\s*have|need|want|prefer|love/i,
        ready: /ready|generate|create|show|make|design|done|finish/i
    };

    // ── Response Templates ────────────────────────────────────────────────────
    const responses = {
        greeting: [
            "Hi! I'm your interior design assistant. I'll help you create a personalized room design. Have you uploaded a photo of your room?",
            "Hello! Let's design your dream space together. Do you have a room photo ready to upload?",
            "Welcome! I'm here to help you redesign your space. First, please upload a photo of your room."
        ],
        needImage: [
            "I'll need a photo of your room first. Please upload an image using the upload area above.",
            "Let's start with your room photo. Click the upload button above to get started.",
            "Before we begin, please upload a photo of the room you'd like to redesign."
        ],
        askRoomType: [
            "Great! What type of room is this? (living room, bedroom, or kitchen)",
            "Perfect! Is this a living room, bedroom, or kitchen?",
            "Got it! Which room are we working with - living room, bedroom, or kitchen?"
        ],
        askStyle: [
            "What style do you prefer? I can do modern, minimal, traditional, or luxury designs.",
            "Which design style speaks to you? Choose from modern, minimal, traditional, or luxury.",
            "Let's pick a style! Would you like modern, minimal, traditional, or luxury?"
        ],
        askBudget: [
            "What's your budget for this project? (e.g., ₹50,000 or ₹2 lakhs)",
            "How much are you looking to spend on furniture and decor?",
            "What budget range are you comfortable with?"
        ],
        askPreferences: [
            "Any specific colors or furniture pieces you'd like to include?",
            "Tell me about your preferences - colors, furniture, or anything you want to avoid.",
            "What matters most to you in this design? Colors, specific furniture, or layout?"
        ],
        confirmGenerate: [
            "Perfect! I have everything I need. Ready to generate your personalized design?",
            "Great! I've noted all your preferences. Shall I create your custom interior design now?",
            "Excellent! I'm ready to design your space. Should I generate the image?"
        ],
        generating: [
            "Creating your personalized design now...",
            "Generating your custom interior based on your preferences...",
            "Designing your dream space..."
        ]
    };

    // ── Core Functions ────────────────────────────────────────────────────────

    function addMessage(text, isUser = false) {
        const msg = {
            text,
            isUser,
            timestamp: Date.now()
        };
        conversation.messages.push(msg);
        return msg;
    }

    function extractPreferences(userInput) {
        const input = userInput.toLowerCase();

        // Room type
        for (const [type, pattern] of Object.entries(patterns.roomType)) {
            if (pattern.test(input)) {
                conversation.preferences.roomType = type;
            }
        }

        // Style
        for (const [style, pattern] of Object.entries(patterns.style)) {
            if (pattern.test(input)) {
                conversation.preferences.style = style;
            }
        }

        // Budget
        const budgetMatch = input.match(/(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:rupees|rs|₹|inr|thousand|k|lakh|lac)?/i);
        if (budgetMatch) {
            let amount = parseFloat(budgetMatch[1].replace(/,/g, ''));
            if (/lakh|lac/i.test(input)) amount *= 100000;
            else if (/thousand|k/i.test(input)) amount *= 1000;
            conversation.preferences.budget = Math.round(amount);
        }

        // Colors
        const colorWords = ['red', 'blue', 'green', 'yellow', 'white', 'black', 'grey', 'gray', 
                           'brown', 'beige', 'cream', 'navy', 'teal', 'purple', 'pink', 'orange'];
        colorWords.forEach(color => {
            if (new RegExp(`\\b${color}\\b`, 'i').test(input)) {
                if (!conversation.preferences.colors.includes(color)) {
                    conversation.preferences.colors.push(color);
                }
            }
        });

        // Furniture items
        const furnitureWords = ['sofa', 'couch', 'bed', 'table', 'chair', 'lamp', 'shelf', 
                               'cabinet', 'desk', 'dresser', 'nightstand', 'bookshelf'];
        furnitureWords.forEach(item => {
            if (new RegExp(`\\b${item}\\b`, 'i').test(input)) {
                if (!conversation.preferences.furniture.includes(item)) {
                    conversation.preferences.furniture.push(item);
                }
            }
        });

        // Placement instructions
        if (patterns.placement.test(input)) {
            const placementMatch = input.match(/(place|put|position)\s+(\w+)\s+(in|on|at|near)\s+(\w+)/i);
            if (placementMatch) {
                const item = placementMatch[2];
                const location = placementMatch[4];
                conversation.preferences.placement[item] = location;
            }
        }

        // Things to avoid
        if (patterns.avoid.test(input)) {
            const avoidMatch = input.match(/(?:don't|dont|avoid|no|not|without)\s+(\w+)/gi);
            if (avoidMatch) {
                avoidMatch.forEach(match => {
                    const word = match.replace(/^(?:don't|dont|avoid|no|not|without)\s+/i, '');
                    if (!conversation.preferences.avoid.includes(word)) {
                        conversation.preferences.avoid.push(word);
                    }
                });
            }
        }

        // Priorities
        if (patterns.priority.test(input)) {
            const priorityMatch = input.match(/(?:important|priority|must\s*have|need|want|prefer)\s+(\w+)/gi);
            if (priorityMatch) {
                priorityMatch.forEach(match => {
                    const word = match.replace(/^(?:important|priority|must\s*have|need|want|prefer)\s+/i, '');
                    if (!conversation.preferences.priorities.includes(word)) {
                        conversation.preferences.priorities.push(word);
                    }
                });
            }
        }

        // Check if ready to generate
        if (patterns.ready.test(input)) {
            conversation.readyToGenerate = true;
        }
    }

    function generateResponse(userInput) {
        extractPreferences(userInput);

        const prefs = conversation.preferences;
        const input = userInput.toLowerCase();

        // Check if user wants to generate
        if (conversation.readyToGenerate && conversation.imageUploaded && prefs.roomType && prefs.style) {
            return {
                text: random(responses.generating),
                action: 'generate'
            };
        }

        // Need image first
        if (!conversation.imageUploaded) {
            return {
                text: random(responses.needImage),
                action: 'needImage'
            };
        }

        // Ask for room type
        if (!prefs.roomType) {
            return {
                text: random(responses.askRoomType),
                action: 'askRoomType'
            };
        }

        // Ask for style
        if (!prefs.style) {
            return {
                text: random(responses.askStyle),
                action: 'askStyle'
            };
        }

        // Ask for budget if not specified
        if (prefs.budget === 50000 && !input.includes('budget') && conversation.messages.length < 6) {
            return {
                text: random(responses.askBudget),
                action: 'askBudget'
            };
        }

        // Ask for additional preferences
        if (prefs.colors.length === 0 && prefs.furniture.length === 0 && conversation.messages.length < 8) {
            return {
                text: random(responses.askPreferences),
                action: 'askPreferences'
            };
        }

        // Confirm and offer to generate
        return {
            text: buildSummary() + " " + random(responses.confirmGenerate),
            action: 'confirmGenerate'
        };
    }

    function buildSummary() {
        const prefs = conversation.preferences;
        const parts = [];

        if (prefs.roomType) {
            const roomLabels = { living: 'living room', bedroom: 'bedroom', kitchen: 'kitchen' };
            parts.push(`${roomLabels[prefs.roomType]}`);
        }

        if (prefs.style) {
            parts.push(`${prefs.style} style`);
        }

        if (prefs.budget && prefs.budget !== 50000) {
            parts.push(`₹${prefs.budget.toLocaleString('en-IN')} budget`);
        }

        if (prefs.colors.length > 0) {
            parts.push(`${prefs.colors.join(', ')} colors`);
        }

        if (prefs.furniture.length > 0) {
            parts.push(`with ${prefs.furniture.join(', ')}`);
        }

        return parts.length > 0 ? `I've noted: ${parts.join(', ')}.` : '';
    }

    function random(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    // ── Public API ────────────────────────────────────────────────────────────

    function init() {
        const greeting = random(responses.greeting);
        addMessage(greeting, false);
        return greeting;
    }

    function sendMessage(userInput) {
        addMessage(userInput, true);
        const response = generateResponse(userInput);
        addMessage(response.text, false);
        return response;
    }

    function setImageUploaded(uploaded) {
        conversation.imageUploaded = uploaded;
    }

    function getPreferences() {
        return { ...conversation.preferences };
    }

    function getMessages() {
        return [...conversation.messages];
    }

    function reset() {
        conversation.messages = [];
        conversation.preferences = {
            roomType: null,
            style: null,
            budget: 50000,
            colors: [],
            furniture: [],
            placement: {},
            avoid: [],
            priorities: []
        };
        conversation.imageUploaded = false;
        conversation.readyToGenerate = false;
    }

    // Expose API
    global.DesignChatbot = {
        init,
        sendMessage,
        setImageUploaded,
        getPreferences,
        getMessages,
        reset
    };

})(window);
