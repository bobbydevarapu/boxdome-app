# BoxDome App

A lightweight movie management web app (Express + MongoDB) that provides user authentication, watchlist and watch-later features, profile upload, and a dashboard UI.

Live demo (Render): https://boxdome-app.onrender.com

## Features

- User signup & login (JWT)
- Profile picture upload
- Wishlist and Watch Later lists per user
- Simple contact form
- Static frontend served from `Frontend/`

## Quick start

Prerequisites:

- Node.js (v16+ recommended)
- A MongoDB connection (Atlas or self-hosted)

1. Install dependencies

```bash
npm install
```

2. Create a `.env` file at the project root with the following variables (example):

```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
TMDB_API_KEY=your_tmdb_api_key
# Optional: mail provider settings if you use contact/email features
# MAILGUN_API_KEY=
# MAILGUN_DOMAIN=
# EMAIL_FROM=
```

3. Run locally

Development (auto-restart):

```bash
npm run dev
```

Production:

```bash
npm start
```

4. Open the app

- Frontend: http://localhost:5000/
- Dashboard: http://localhost:5000/dashboard.html

## Uploads

Uploaded profile images are written to the `uploads/` folder and served at `/uploads`.

## Deployment

This project is deployed to Render at:

https://boxdome-app.onrender.com

If you deploy to Render (or similar), be sure to set the environment variables listed above in the service settings and add a persistent disk or S3 if you want to keep uploaded files between deploys.

## Notes

- The backend uses `server.js` as the entry point. The `package.json` scripts included are:
  - `start`: `node server.js`
  - `dev`: `nodemon server.js`
- If you change dependencies, run `npm install` and commit the updated `package-lock.json`.

## License

ISC
