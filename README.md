# DDoS Live Map

A real-time visualization of global DDoS attacks displayed on an interactive 3D globe. This project demonstrates the flow of cyber attacks between countries using Server-Sent Events (SSE) for live data streaming.

![DDoS Live Map](https://img.shields.io/badge/status-active-success.svg)
![Python](https://img.shields.io/badge/python-3.8+-blue.svg)
![Next.js](https://img.shields.io/badge/next.js-16.1-black.svg)
![FastAPI](https://img.shields.io/badge/FastAPI-0.124-green.svg)

## Features

- 🌍 **Interactive 3D Globe** - Powered by Three.js and react-three-fiber
- ⚡ **Real-time Updates** - Server-Sent Events (SSE) for live attack streaming
- 🎨 **Beautiful Animations** - Smooth arcs showing attack paths between countries
- 🎯 **Attack Types** - Visualizes DDoS, bot, and brute-force attacks
- 📊 **Severity Levels** - Color-coded attack severity (1-5 scale)
- 🔄 **Auto-Rotate** - Globe automatically rotates for better visibility

## Architecture

### Backend (Python + FastAPI)
- **FastAPI** - High-performance async API framework
- **Server-Sent Events** - Streams attack events to frontend in real-time
- **Random Event Generator** - Simulates attacks between 10+ global locations
- **Type Safety** - Pydantic models for data validation

### Frontend (Next.js + React)
- **Next.js 16** - React framework with App Router
- **Three.js** - 3D rendering engine
- **react-three-fiber** - React renderer for Three.js
- **three-globe** - Globe visualization library
- **Tailwind CSS** - Utility-first styling
- **TypeScript** - Type-safe development

## Project Structure

```
ddos-live-map/
├── backend/                 # Python FastAPI backend
│   ├── app/
│   │   ├── main.py         # FastAPI application entry point
│   │   ├── api/
│   │   │   └── sse.py      # Server-Sent Events endpoint
│   │   ├── models/
│   │   │   └── attack_event.py  # Attack event data models
│   │   └── services/
│   │       └── event_generator.py  # Random attack generator
│   └── requirements.txt
│
└── frontend/               # Next.js frontend
    ├── src/
    │   ├── app/
    │   │   ├── page.tsx    # Main page with globe
    │   │   └── globals.css
    │   ├── components/
    │   │   └── ui/
    │   │       └── globe.tsx  # 3D Globe component
    │   └── data/
    │       └── globe.json
    └── package.json
```

## Getting Started

### Prerequisites

- **Python 3.8+**
- **Node.js 18+**
- **npm** or **yarn**

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Run the backend server:
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
# or
yarn install
```

3. Run the development server:
```bash
npm run dev
# or
yarn dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## API Endpoints

### `GET /`
Health check endpoint
- **Response**: `{"status": "ok"}`

### `GET /events/stream`
Server-Sent Events stream for attack events
- **Content-Type**: `text/event-stream`
- **Event Type**: `attack`
- **Update Interval**: ~1.5 seconds

#### Event Data Format:
```json
{
  "id": "uuid",
  "timestamp": 1703347200,
  "source": {
    "country": "US",
    "lat": 37.7749,
    "lng": -122.4194
  },
  "target": {
    "country": "CN",
    "lat": 39.9042,
    "lng": 116.4074
  },
  "attack_type": "ddos",
  "severity": 3
}
```

## Configuration

### Globe Configuration (Frontend)
Customize the globe appearance in [`frontend/src/app/page.tsx`](frontend/src/app/page.tsx):
```typescript
const globeConfig = {
  pointSize: 4,
  globeColor: "#062056",
  showAtmosphere: true,
  atmosphereColor: "#FFFFFF",
  arcTime: 1000,
  autoRotate: true,
  autoRotateSpeed: 0.5,
  // ... more options
}
```

### Locations (Backend)
Modify attack source/target locations in [`backend/app/services/event_generator.py`](backend/app/services/event_generator.py)

## Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend Framework | Next.js 16 |
| 3D Rendering | Three.js, react-three-fiber |
| Backend API | FastAPI |
| Server | Uvicorn (ASGI) |
| Type Safety | TypeScript, Pydantic |
| Styling | Tailwind CSS |
| Real-time Streaming | Server-Sent Events (SSE) |

## Development

### Backend
```bash
# Run with auto-reload
uvicorn app.main:app --reload

# Check API docs
# Open http://localhost:8000/docs
```

### Frontend
```bash
# Development mode
npm run dev

# Production build
npm run build
npm start

# Linting
npm run lint
```

## Deployment

### Backend
- Deploy to any Python ASGI-compatible hosting (AWS Lambda, Heroku, Railway, etc.)
- Configure CORS for production domain
- Set environment variables for production

### Frontend
- Deploy to Vercel (recommended for Next.js)
- Or any Node.js hosting platform (Netlify, AWS Amplify, etc.)
- Update API endpoint URL for production backend

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is open source and available under the [MIT License](LICENSE).

## Acknowledgments

- [three-globe](https://github.com/vasturiano/three-globe) for the globe visualization
- [FastAPI](https://fastapi.tiangolo.com/) for the backend framework
- [Next.js](https://nextjs.org/) for the frontend framework
