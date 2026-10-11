# Sales Support Hub

ระบบสนับสนุนงานขาย (Sales Support) สำหรับค้นหาและแนะนำสินค้าตามความต้องการของลูกค้า พร้อมระบบจัดการแคตตาล็อกสินค้า

---

## 🛠 Tech Stack

- **Backend:** FastAPI (Python), SQLite, SQLAlchemy, JWT Authentication
- **Frontend:** Next.js (App Router, TypeScript), Tailwind CSS
- **Container:** Docker, Docker Compose

---

## 🚀 วิธีติดตั้งและรันระบบ

### 1. รันด้วย Docker Compose (แนะนำ)

รันคำสั่งเดียวเพื่อเริ่มการทำงานทั้ง Frontend และ Backend:

```bash
docker compose up --build
```

เมื่อระบบเริ่มทำงานแล้ว สามารถเข้าใช้งานได้ที่:
- **Web App:** [http://localhost:3000](http://localhost:3000)
- **API Docs (Swagger):** [http://localhost:8000/docs](http://localhost:8000/docs)

---

### 2. รันแบบแยกเครื่อง (Local Development)

#### Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate       # บน Windows
# source venv/bin/activate  # บน macOS/Linux
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

#### Frontend
```bash
cd frontend
npm install
npm run dev
```

---

## 🔑 บัญชีเข้าสู่ระบบสำหรับทดสอบ

| ข้อมูล | ค่าเริ่มต้น |
| :--- | :--- |
| **Username** | `admin` |
| **Password** | `Admin@1234` |

*(หรือสามารถสมัครสมาชิกใหม่ได้ที่หน้า `/register`)*

---

## ⚙️ Environment Variables (ตัวแปรระบบ)

คัดลอกไฟล์ตัวอย่าง `.env.example` เป็น `.env`:

```bash
cp .env.example .env
```

| ตัวแปร | ความหมาย | ค่าเริ่มต้น |
| :--- | :--- | :--- |
| `SECRET_KEY` | คีย์สำหรับเข้ารหัส JWT Token | กำหนดเอง |
| `OPENROUTER_API_KEY` | API Key สำหรับระบบแนะนำสินค้า (ไม่ใส่ก็ได้ ระบบมี fallback ภายใน) | - |

---

## 📁 โครงสร้างโปรเจกต์

```text
Sale_Support/
├── backend/            # FastAPI REST API
│   ├── app/            # Source code (Auth, Products, Search, Database)
│   ├── tests/          # Unit tests
│   └── Dockerfile
├── frontend/           # Next.js Web Application
│   ├── src/app/        # หน้าเว็บ (Login, Register, Dashboard)
│   ├── src/lib/        # API Client
│   └── Dockerfile
└── docker-compose.yml  # ไฟล์ตั้งค่า Docker รวมระบบ
```
