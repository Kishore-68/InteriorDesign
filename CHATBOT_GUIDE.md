# Conversational Design Assistant — User Guide

## Overview

The AI Design Assistant is a conversational chatbot that helps users create personalized interior designs through natural language. It maintains context throughout the entire conversation and generates the final image based on all collected preferences.

## Features

### 1. Natural Language Understanding
The chatbot understands:
- **Room types**: "living room", "bedroom", "kitchen"
- **Design styles**: "modern", "minimal", "traditional", "luxury"
- **Budget**: "₹50,000", "2 lakhs", "50k"
- **Colors**: "blue walls", "white furniture", "warm tones"
- **Furniture**: "sofa", "bed", "table", "lamp", "shelf"
- **Placement**: "put the sofa near the window", "table in the center"
- **Avoidances**: "no dark colors", "avoid clutter"
- **Priorities**: "natural light is important", "need storage"

### 2. Conversation Flow

```
User opens chat
    ↓
Bot: "Hi! Upload a room photo to get started"
    ↓
User uploads image
    ↓
Bot: "What type of room is this?"
    ↓
User: "It's my living room"
    ↓
Bot: "What style do you prefer?"
    ↓
User: "I like modern design with blue accents"
    ↓
Bot: "What's your budget?"
    ↓
User: "Around 1 lakh"
    ↓
Bot: "Any specific furniture or preferences?"
    ↓
User: "I want a large sofa and lots of natural light"
    ↓
Bot: "Perfect! I've noted: living room, modern style, ₹1,00,000 budget, blue colors, with sofa. Ready to generate?"
    ↓
User: "Yes, create it"
    ↓
Bot: "Creating your personalized design now..."
    ↓
[Generates image with all preferences applied]
```

### 3. Memory Persistence

The chatbot maintains conversation context until image generation:
- All preferences are stored in memory
- User can add/modify preferences throughout the conversation
- Context is NOT cleared between messages
- Memory persists across the entire design session
- Only resets after final image is generated

### 4. Preference Extraction

The chatbot automatically extracts:

| Category | Examples | Storage |
|----------|----------|---------|
| Room Type | "bedroom", "living room" | `preferences.roomType` |
| Style | "modern", "minimal" | `preferences.style` |
| Budget | "₹50k", "2 lakhs" | `preferences.budget` |
| Colors | "blue", "white", "warm" | `preferences.colors[]` |
| Furniture | "sofa", "table", "lamp" | `preferences.furniture[]` |
| Placement | "sofa near window" | `preferences.placement{}` |
| Avoid | "no dark colors" | `preferences.avoid[]` |
| Priorities | "natural light important" | `preferences.priorities[]` |

### 5. Smart Defaults

If user doesn't specify certain preferences:
- Budget defaults to ₹50,000
- Bot asks follow-up questions for missing critical info (room type, style)
- Optional preferences (colors, furniture) can be skipped

## Example Conversations

### Minimal Conversation
```
User: "I uploaded my bedroom photo"
Bot: "What style do you prefer?"
User: "Minimal"
Bot: "Ready to generate your minimal bedroom design?"
User: "Yes"
[Generates with defaults: bedroom, minimal, ₹50k budget]
```

### Detailed Conversation
```
User: "This is my living room, I want a modern luxury design"
Bot: "What's your budget?"
User: "I can spend up to 3 lakhs"
Bot: "Any specific preferences?"
User: "I love blue and white colors, need a large L-shaped sofa, and want the TV on the main wall. Natural light is very important to me. Avoid dark furniture."
Bot: "Perfect! I've noted: living room, modern style, ₹3,00,000 budget, blue and white colors, with sofa. Ready to generate?"
User: "Yes, create it"
[Generates with all specified preferences]
```

### Iterative Refinement
```
User: "Living room, modern style"
Bot: "What's your budget?"
User: "50k"
Bot: "Any specific preferences?"
User: "Actually, make it 1 lakh instead"
Bot: "Updated! Any colors or furniture?"
User: "Blue walls and a grey sofa"
Bot: "Got it! Ready to generate?"
User: "Add a coffee table too"
Bot: "Added! Shall I create your design now?"
User: "Yes"
[Generates with final preferences: ₹1L budget, blue, grey sofa, coffee table]
```

## Technical Implementation

### Architecture
```
chatbot.js
    ↓
Conversation State
  • messages[]        — Full chat history
  • preferences{}     — Extracted user preferences
  • imageUploaded     — Upload status
  • readyToGenerate   — Generation trigger
    ↓
NLP Pattern Matching
  • Room type patterns
  • Style patterns
  • Budget extraction
  • Color/furniture detection
  • Placement parsing
    ↓
Response Generation
  • Context-aware replies
  • Follow-up questions
  • Preference confirmation
    ↓
Integration with app.js
  • Apply preferences to state
  • Update UI selections
  • Trigger generation
```

### API

```javascript
// Initialize chatbot
DesignChatbot.init()
// Returns: greeting message

// Send user message
DesignChatbot.sendMessage(text)
// Returns: { text: string, action: string }

// Notify image upload
DesignChatbot.setImageUploaded(true)

// Get current preferences
DesignChatbot.getPreferences()
// Returns: { roomType, style, budget, colors[], furniture[], ... }

// Get full conversation
DesignChatbot.getMessages()
// Returns: [{ text, isUser, timestamp }, ...]

// Reset conversation
DesignChatbot.reset()
```

## UI Components

### Floating Button
- Fixed bottom-right corner
- Gradient purple background
- "AI" badge indicator
- Hover animation

### Chat Panel
- 380px × 520px (responsive)
- Slides up from bottom
- Header with avatar and status
- Scrollable message area
- Input field with send button

### Message Bubbles
- Bot messages: left-aligned, grey background
- User messages: right-aligned, purple background
- Avatar icons (🤖 for bot, 👤 for user)
- Smooth fade-in animation

## Browser Compatibility

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| Chat UI | ✓ | ✓ | ✓ | ✓ |
| NLP | ✓ | ✓ | ✓ | ✓ |
| Memory | ✓ | ✓ | ✓ | ✓ |
| Integration | ✓ | ✓ | ✓ | ✓ |

## Future Enhancements

Potential improvements:
- Voice input support
- Image-based preference detection (analyze uploaded photo)
- Multi-language support
- Furniture product recommendations in chat
- Real-time preview updates as preferences change
- Export conversation history
- Save/load previous designs
