# Instagram Clone

A full-stack Instagram-like social media application built with **Next.js 16**, **Express 5**, **MongoDB**, and **TypeScript**.

## Features

- **Authentication** — JWT-based register & login
- **Posts** — create, browse, and like photo posts
- **Stories** — 24-hour auto-expiring stories (MongoDB TTL index)
- **User profiles** — follow/unfollow, bio, profile picture upload
- **Search** — find users by username
- **Direct messages** — real-time-ready conversations and messages
- **Image upload** — multer-powered file uploads served as static assets

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, Tailwind CSS 4, TypeScript |
| Backend | Express 5, Node.js, TypeScript |
| Database | MongoDB (native driver, no Mongoose) |
| Auth | JWT + bcryptjs |
| Testing | Jest, Supertest, mongodb-memory-server |

## Project Structure

```
instagram/
├── backend/          # Express API
│   └── src/
│       ├── routes/   # auth, posts, users, stories, conversations
│       ├── models/   # TypeScript interfaces
│       ├── middleware/
│       ├── db/       # MongoDB connection + seed
│       └── __tests__/
└── frontend/         # Next.js app
    └── src/
        ├── app/      # App Router pages
        ├── components/
        └── context/  # AuthContext
```

## Getting Started

### Prerequisites

- Node.js 18+
- MongoDB instance (local or Atlas)

### Backend

```bash
cd backend
npm install
```

Create `backend/.env`:
```
MONGODB_URI=mongodb://localhost:27017
JWT_SECRET=your_secret_here
CLIENT_URL=http://localhost:8080
PORT=3001
```

```bash
npm run dev       # development (nodemon + ts-node)
npm run seed      # seed sample data
npm test          # run tests
```

### Frontend

```bash
cd frontend
npm install
```

Create `frontend/.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:3001
```

```bash
npm run dev   # starts on http://localhost:8080
```

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login, returns JWT |
| GET | `/api/posts` | Get feed posts |
| POST | `/api/posts` | Create post (auth required) |
| GET | `/api/users/:username` | Get user profile |
| POST | `/api/users/:id/follow` | Follow a user |
| GET | `/api/stories` | Get active stories |
| POST | `/api/stories` | Upload a story |
| GET | `/api/conversations` | Get user conversations |
| POST | `/api/conversations` | Start a conversation |

## Testing

```bash
cd backend
npm test              # run all tests
npm run test:coverage # with coverage report
```

Tests use `mongodb-memory-server` — no real database needed.
