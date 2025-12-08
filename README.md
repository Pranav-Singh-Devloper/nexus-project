# Nexus: Autonomous Market Intelligence Swarm 🧠 🚀

![React](https://img.shields.io/badge/Frontend-React-blue?logo=react)
![Node](https://img-shields.io/badge/Backend-Node.js-green?logo=nodedotjs)
![Python](https://img.shields.io/badge/AI_Engine-FastAPI-yellow?logo=fastapi)
![Database](https://img.shields.io/badge/Database-Neon_Postgres-orange?logo=postgresql)
![AI](https://img.shields.io/badge/Model-Llama_3.3-purple)
![Auth](https://img.shields.io/badge/Auth-JWT_Passport-red)

**Nexus** is an Enterprise-Grade Agentic AI SaaS platform that deploys a swarm of autonomous AI agents to research, analyze, and generate comprehensive market intelligence reports. It features a microservices architecture, a secure hybrid authentication system, and advanced hybrid vector search.

---

## 🔗 Live Demo (Evaluation Links)
- **Frontend (Vercel):** [https://nexus-capstone.vercel.app](https://nexus-capstone.vercel.app)
- **Backend API (Render):** [https://nexus-backend.onrender.com](https://nexus-backend.onrender.com)
- **AI Engine Docs (Render):** [https://nexus-ai-engine.onrender.com/docs](https://nexus-ai-engine.onrender.com/docs)](https://nexus-ai-engine-hwdg.onrender.com/docs)

---

## 📝 Problem Statement (Required by Evaluation)

Founders, analysts, and investors spend significant time manually gathering fragmented data from the web to create strategy reports. This process is slow, expensive, and prone to bias.

**Nexus** solves this by orchestrating a **"Hive"** of AI agents that can take a single prompt (e.g., *"Analyze the EV market in India"*) and autonomously:
1.  **Plan** a research strategy using LangGraph.
2.  **Search** the live web using the Tavily tool.
3.  **Synthesize** findings into a professional, data-backed Markdown report.
4.  **Store** all knowledge and reports for instant semantic retrieval.

---

## ✨ Key Technical Features

### 🤖 Agentic AI Engine (Python/FastAPI)
- **Cyclic State Graph:** Built with **LangGraph**, enabling the agent to enter a recursive loop (Reason $\to$ Search $\to$ Reason $\to$ End) until a high-quality answer is found.
- **Microservices Separation:** Dedicated Python service for compute-heavy AI tasks, ensuring the Node.js API remains fast and responsive.
- **Memory Optimization:** Uses **FastEmbed (ONNX Runtime)** instead of PyTorch to reduce memory footprint by 50%, allowing stable deployment on Render's 512MB free tier.

### 🧠 Hybrid Vector Search (Node.js/Neon)
- **Semantic Understanding:** Implements **Neon pgvector** to store and query high-dimensional vector embeddings of report content.
- **Hybrid Logic:** The search endpoint combines:
    1.  **Vector Similarity** (for conceptual relevance, e.g., searching "Electric Cars" finds a report titled "Tesla Market Analysis").
    2.  **SQL Keyword Matching** (for high precision).

### 🔐 Robust Hybrid Authentication
- **Dual Method Login:** Supports both **Google OAuth 2.0** (via Passport.js) and **Manual Email/Password** (via Bcrypt).
- **Account Linking:** Automatically links a manually created account to a Google sign-in if the emails match, allowing users to use either method interchangeably.
- **Stateless Security:** Uses **Bcrypt** for hashing and **HTTP-Only Cookies** with **JWT** for secure, stateless session management.

---

## 🛠 Tech Stack

| Domain | Technology | Details |
| :--- | :--- | :--- |
| **Frontend** | React.js, Vite | Modern component-based UI with Tailwind CSS. |
| **API Gateway** | Node.js, Express.js | I/O handling, Auth, and Orchestration layer. |
| **Data & Auth** | Prisma ORM, Passport.js, JWT, Bcrypt | Database interaction, secure login, and session control. |
| **AI Core** | Python, FastAPI | Dedicated compute engine. |
| **AI Framework** | LangChain, LangGraph | State management and agent orchestration. |
| **Database** | Neon (PostgreSQL) | Serverless data storage with **pgvector** extension. |
| **Models** | Llama 3.3 (via Groq), FastEmbed | High-speed inference and optimized embeddings. |
| **DevOps** | Vercel (Client), Render (API/AI) | Free tier deployment strategy. |

---

## 🚀 Local Installation Guide

### Prerequisites
- Node.js (v18+)
- Python (v3.10+)
- Neon DB connection string
