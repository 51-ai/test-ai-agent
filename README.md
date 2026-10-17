# AI Agent System

A high-performance AI Agent system with autonomous decision-making, dynamic task planning, multi-tool integration, and continuous learning capabilities.

## Features

- **Perception Module**: Multi-modal input processing (text, voice, image)
- **Decision Engine**: Reinforcement learning-based autonomous decision system
- **Execution Module**: Tool calling framework with sync/async execution
- **Memory System**: Hierarchical memory structure (short-term, long-term, skill library)
- **Natural Language Processing**: Intent recognition, entity extraction, emotion analysis
- **Multi-language Support**: Chinese, English, Japanese
- **Tool Integration**: Web search, code execution, document processing, data analysis, cloud services

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      AI Agent System                           │
├─────────────────────────────────────────────────────────────────┤
│  Frontend Layer                                               │
│  ├── Web UI (React + TypeScript)                              │
│  └── RESTful API Interface                                    │
├─────────────────────────────────────────────────────────────────┤
│  Core Modules                                                 │
│  ├── Perception Module    (Input validation, NLP processing)  │
│  ├── Decision Engine      (Task decomposition, planning)      │
│  ├── Execution Engine     (Tool execution, retry logic)       │
│  ├── Memory System        (Short/long term memory)            │
│  └── NLP Module          (Intent recognition, translation)   │
├─────────────────────────────────────────────────────────────────┤
│  External Tools                                               │
│  ├── Web Search          (Real-time information retrieval)    │
│  ├── Code Executor       (Python/JavaScript execution)        │
│  ├── Document Tool       (PDF/Word/Excel processing)          │
│  ├── Data Analysis       (SQL query, visualization)           │
│  └── Cloud Services      (AWS, Azure integration)             │
├─────────────────────────────────────────────────────────────────┤
│  Database Layer                                               │
│  ├── MongoDB             (User data, conversations)           │
│  └── Redis               (Caching, session management)        │
└─────────────────────────────────────────────────────────────────┘
```

## Getting Started

### Prerequisites

- Node.js >= 18.x
- MongoDB >= 6.0
- Redis >= 7.0

### Installation

```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### Running the Application

```bash
# Start MongoDB and Redis (using Docker)
docker-compose up -d mongodb redis

# Start backend server
cd backend
npm run dev

# Start frontend development server
cd ../frontend
npm run dev
```

### Environment Variables

Create `.env` file in backend directory:

```env
PORT=3000
HOST=localhost
NODE_ENV=development

JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d

MONGO_URI=mongodb://localhost:27017/ai-agent
REDIS_URI=redis://localhost:6379

OPENAI_API_KEY=your-openai-api-key
OPENAI_MODEL=gpt-4
```

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register | Register new user |
| POST | /api/auth/login | Login user |
| GET | /api/auth/me | Get current user |

### Conversations

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/conversations | Get all conversations |
| GET | /api/conversations/:id | Get conversation by ID |
| POST | /api/conversations | Create new conversation |
| POST | /api/conversations/:id/messages | Add message to conversation |
| PUT | /api/conversations/:id | Update conversation title |
| DELETE | /api/conversations/:id | Delete conversation |

### Agent

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/agent/chat | Send message to agent |
| GET | /api/agent/memory/stats | Get memory stats |
| POST | /api/agent/memory/consolidate | Consolidate memory |

## Testing

```bash
cd backend
npm test
```

## Project Structure

```
ai-agent-system/
├── backend/                    # Backend application
│   ├── src/
│   │   ├── api/               # REST API routes
│   │   ├── core/              # Core modules
│   │   │   ├── perception/    # Input processing
│   │   │   ├── decision/      # Decision engine
│   │   │   ├── execution/     # Tool execution
│   │   │   ├── memory/        # Memory system
│   │   │   ├── nlp/           # NLP processing
│   │   │   └── tools/         # Tool management
│   │   ├── config/            # Configuration
│   │   ├── middlewares/       # Express middlewares
│   │   ├── models/            # Database models
│   │   ├── services/          # Business logic
│   │   ├── tests/             # Unit tests
│   │   └── utils/             # Utility functions
│   ├── package.json
│   └── tsconfig.json
├── frontend/                   # Frontend application
│   ├── src/
│   │   ├── components/        # React components
│   │   ├── services/          # API services
│   │   └── App.tsx
│   ├── package.json
│   └── vite.config.ts
├── docker-compose.yml          # Docker configuration
└── README.md
```

## License

MIT License

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Contact

For questions or support, please contact the development team.