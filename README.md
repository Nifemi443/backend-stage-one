# Backend Wizards — Stage 1

A REST API that accepts a name, enriches it with gender, age, and nationality data from external APIs, stores the result in a PostgreSQL database, and exposes endpoints to manage profiles.

---

## Tech Stack

- **Runtime**: Node.js
- **Language**: TypeScript
- **Framework**: Express
- **Database**: PostgreSQL
- **ORM**: Prisma (with `@prisma/adapter-pg`)
- **ID Generation**: UUIDv7
- **HTTP Client**: Axios
- **Environment**: dotenv

---

## External APIs Used

| API | Purpose |
|-----|---------|
| [Genderize](https://api.genderize.io) | Predicts gender from name |
| [Agify](https://api.agify.io) | Predicts age from name |
| [Nationalize](https://api.nationalize.io) | Predicts nationality from name |

No API keys required.

---

## Getting Started

### Prerequisites

- Node.js v18+
- PostgreSQL running locally or via a hosted provider

### Installation

```bash
git clone https://github.com/yourusername/backend-wizards-stage-1.git
cd backend-wizards-stage-1
npm install
```

### Environment Setup

Create a `.env` file in the root:

```env
DATABASE_URL="postgresql://username:password@localhost:5432/yourdbname?schema=public"
PORT=3000
```

### Database Setup

```bash
npx prisma migrate dev --name init
```

### Run the Server

```bash
npm start
```

Server runs on `http://localhost:3000`.

---

## API Endpoints

### POST `/api/profiles`

Creates a new profile by enriching the provided name with external API data.

If the name already exists, returns the existing profile without creating a duplicate.

**Request Body:**
```json
{ "name": "ella" }
```

**Success (201):**
```json
{
  "status": "success",
  "data": {
    "id": "b3f9c1e2-7d4a-4c91-9c2a-1f0a8e5b6d12",
    "name": "ella",
    "gender": "female",
    "gender_probability": 0.99,
    "sample_size": 1234,
    "age": 46,
    "age_group": "adult",
    "country_id": "DK",
    "country_probability": 0.85,
    "created_at": "2026-04-01T12:00:00Z"
  }
}
```

**Already Exists (200):**
```json
{
  "status": "success",
  "message": "Profile already exists",
  "data": { ...existing profile... }
}
```

---

### GET `/api/profiles`

Returns all profiles. Supports optional query filters.

**Query Parameters** (all case-insensitive):

| Param | Example |
|-------|---------|
| `gender` | `?gender=male` |
| `country_id` | `?country_id=NG` |
| `age_group` | `?age_group=adult` |

**Success (200):**
```json
{
  "status": "success",
  "count": 2,
  "data": [
    {
      "id": "id-1",
      "name": "emmanuel",
      "gender": "male",
      "age": 25,
      "age_group": "adult",
      "country_id": "NG"
    }
  ]
}
```

---

### GET `/api/profiles/:id`

Returns a single profile by ID.

**Success (200):**
```json
{
  "status": "success",
  "data": {
    "id": "b3f9c1e2-7d4a-4c91-9c2a-1f0a8e5b6d12",
    "name": "ella",
    "gender": "female",
    "gender_probability": 0.99,
    "sample_size": 1234,
    "age": 46,
    "age_group": "adult",
    "country_id": "DK",
    "country_probability": 0.85,
    "created_at": "2026-04-01T12:00:00Z"
  }
}
```

**Not Found (404):**
```json
{ "status": "error", "message": "Profile not found" }
```

---

### DELETE `/api/profiles/:id`

Deletes a profile by ID. Returns `204 No Content` on success.

**Not Found (404):**
```json
{ "status": "error", "message": "Profile not found" }
```

---

## Error Responses

All errors follow this structure:

```json
{ "status": "error", "message": "" }
```

| Code | Meaning |
|------|---------|
| 400 | Missing or empty name |
| 404 | Profile not found |
| 422 | Invalid type |
| 502 | External API returned invalid data |
| 500 | Internal server error |

---

## Classification Logic

**Age Group** (from Agify):

| Range | Group |
|-------|-------|
| 0–12 | child |
| 13–19 | teenager |
| 20–59 | adult |
| 60+ | senior |

**Nationality**: highest probability country from Nationalize response.

---

## Testing

```bash
# Create a profile
curl -X POST http://localhost:3000/api/profiles \
  -H "Content-Type: application/json" \
  -d '{"name": "ella"}'

# Get all profiles
curl http://localhost:3000/api/profiles

# Get with filters
curl "http://localhost:3000/api/profiles?gender=female&country_id=DK"

# Get single profile
curl http://localhost:3000/api/profiles/

# Delete a profile
curl -X DELETE http://localhost:3000/api/profiles/
```