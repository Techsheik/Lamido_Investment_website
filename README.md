# 💰 Lamido Crypto Trading Community

**A full-stack crypto investment and trading community platform built for local investors.**

> Built with React · TypeScript · Supabase · Tailwind CSS · Shadcn UI

---

## 🔗 Live Demo

👉 [lamidoinvestmentwebsite.vercel.app](https://lamidoinvestmentwebsite.vercel.app)

---

## 📌 What is this?

Lamido Crypto Trading Community is a web platform designed for local crypto investors to manage investments, track portfolios, and interact within a trading community. It features a full admin panel, server-side API, secure authentication, and a clean modern UI.

---

## ✨ Key Features

- **User Authentication** — Secure login and registration with Supabase Auth
- **Investment Dashboard** — Track portfolio performance and transaction history
- **Admin Panel** — Full control over users, investments, and platform activity
- **Transaction Management** — Record, verify, and manage crypto transactions
- **Payment Proof Upload** — Users upload receipts for admin verification
- **Real-time Database** — Powered by Supabase with Row Level Security (RLS)
- **Webhook Support** — Automated event handling via webhook integration
- **Responsive UI** — Clean, mobile-friendly design with Tailwind CSS + Shadcn UI
- **End-to-End Tests** — Playwright test suite for critical user flows

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite + TypeScript |
| UI | Tailwind CSS + Shadcn UI |
| Backend/DB | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Server | Node.js Express API |
| Testing | Playwright |
| Deployment | Vercel |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Supabase account

### Installation

```bash
# Clone the repo
git clone https://github.com/Techsheik/Lamido_Investment_website.git
cd Lamido_Investment_website

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Add your Supabase URL and anon key

# Start development server
npm run dev
```

### Running Tests

```bash
npx playwright test
```

---

## 📁 Project Structure

```
Lamido_Investment_website/
├── src/
│   ├── components/        # Reusable UI components
│   ├── pages/             # Route-level pages
│   └── hooks/             # Custom React hooks
├── server/                # Express API server
├── api/                   # API utility functions
├── supabase/              # DB migrations & config
├── tests/                 # Playwright test suite
└── public/                # Static assets
```

---

## 👤 Author

**Abdullahi Musa Ibrahim**
Backend Engineer · AI/ML Builder
[GitHub](https://github.com/Techsheik)

---

## 📄 License

This project is licensed under the MIT License.
