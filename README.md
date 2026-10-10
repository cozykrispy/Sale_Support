# Fusion Advantec — AI Sales Support Hub

AI-powered product search, model-aware recommendations, and portfolio management built for fast, customer-ready answers.

---

## 🚀 Quick Start: Run in a Single Command (Docker)

ผู้ตรวจสามารถรันระบบทั้งหมด (Frontend Next.js + Backend FastAPI + Database พร้อมข้อมูลเริ่มต้น) ได้ภายใน **คำสั่งเดียว**:

```bash
docker compose up --build
```

*(หรือรันแบบ Background: `docker compose up -d --build`)*

เมื่อ Container ทำงานเสร็จสมบูรณ์ สามารถเข้าใช้งานได้ที่:
- **Web Application (Next.js):** [http://localhost:3000](http://localhost:3000)
- **Swagger API Spec (FastAPI):** [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc API Spec:** [http://localhost:8000/redoc](http://localhost:8000/redoc)
- **Health Check Endpoint:** [http://localhost:8000/api/health](http://localhost:8000/api/health)

### บัญชีผู้ใช้เริ่มต้นสำหรับทดสอบ (หรือสมัครใหม่ได้ที่หน้า `/register`)
- **Username:** `admin`
- **Password:** `Admin@1234`
- *(หรือกดปุ่ม **"Fill Demo"** ที่หน้า `/login` ได้ทันที)*

### การตั้งค่า OpenRouter API Key (Optional)
ระบบสามารถรันได้ทันทีโดยไม่ต้องสร้างไฟล์ `.env` (มีระบบ Smart Catalog AI Fallback ในตัว) หากต้องการเชื่อมต่อ LLM จริงผ่าน OpenRouter สามารถตั้งค่าก่อนรันได้ดังนี้:
```bash
cp .env.example .env
# แก้ไขไฟล์ .env โดยใส่ OPENROUTER_API_KEY=sk-or-v1-...
docker compose up --build
```

---

## ✅ ความสอดคล้องตามข้อกำหนดของข้อสอบ (Requirement Coverage)

### 1) AI Backend (`./backend`)
- **Python (FastAPI):** พัฒนาด้วย FastAPI โครงสร้างสะอาด แยก `models`, `schemas`, `auth`, `ai_service`, `seed`
- **Product Suggestion + Supporting Documents + Cross-selling:** วิเคราะห์ความต้องการของลูกค้าและแนะนำครบทั้ง 3 แกนตามรูปที่ 1:
  1. **Product Suggestion:** แนะนำสินค้าที่ตรงความต้องการพร้อม Match Score (%) และเหตุผลประกอบ
  2. **Supporting Documents:** แนะนำเอกสาร Validation Reports และ Publications ที่เกี่ยวข้อง
  3. **Cross-selling:** แนะนำสินค้าพ่วงเพื่อเพิ่มยอดขาย
- **Swagger API Spec:** มีเอกสาร OpenAPI ครบถ้วนที่ `/docs`
- **Inference AI ผ่าน OpenRouter:** เชื่อมต่อ `https://openrouter.ai/api/v1/chat/completions` รองรับการเลือกโมเดลจากหน้าเว็บ (`Auto (default)`, `Gemini 2.0 Flash`, `Llama 3.3 70B`, `GPT-4o Mini`, `Claude 3.5 Haiku`)

### 2) Web App (`./frontend`)
- **TypeScript บน Next.js:** พัฒนาด้วย Next.js 14 (App Router) + TypeScript + Tailwind CSS ถอดแบบ UI ตามรูปที่ 2 และรูปที่ 3
- **RESTful API Communication:** สื่อสารผ่าน RESTful API พร้อมแนบ `Authorization: Bearer <token>`
- **Register User (`/register`):** รับค่า `Username`, `Email`, `Password` โดยเข้ารหัสรหัสผ่านด้วย **bcrypt (`$2b$`)** เสมอ (ไม่เก็บเป็น Plain Text เด็ดขาด)
- **Login & 1-Hour JWT Token (`/login`):** ยืนยันตัวตนด้วย Username และ Password และได้รับ JWT Token ที่มีอายุ **1 ชั่วโมง (`expires_in: 3600` วินาที)**
- **Protected Routes ทุกครั้ง:** ตรวจสอบ Token ทั้งที่ฝั่ง Next.js Middleware (`src/middleware.ts`) และฝั่ง FastAPI Dependency (`Depends(get_current_user)`)
- **Manage Products (เพิ่ม/ลบ/แก้ไข ผลิตภัณฑ์):** รองรับการค้นหา กรองหมวดหมู่ เพิ่มสินค้าใหม่ผ่าน Modal แก้ไข และลบสินค้า (ทั้งรายชิ้นและ Bulk Delete)

### 3) Testing (Unit Test & E2E Testing)
- **Backend Unit Tests (`pytest`):**
  ```bash
  cd backend
  pytest -v
  ```
  ทดสอบครบทั้ง Health/Swagger, การสมัครสมาชิก (ตรวจว่า DB เก็บค่า Hash ไม่ใช่ Plain Text), การ Login (ตรวจอายุ Token 1 ชั่วโมง = 3600 วินาที), การป้องกัน Protected Routes (401 Unauthorized), การทำ CRUD สินค้า และการแนะนำสินค้าด้วย AI
- **Frontend E2E Testing (`Playwright`):**
  ```bash
  cd frontend
  npx playwright test
  ```
  ทดสอบ End-to-End ตั้งแต่ Route Protection $\rightarrow$ Register $\rightarrow$ Login $\rightarrow$ AI Product Search $\rightarrow$ Add / Edit / Delete Product

### 4) Dev/Sec/Ops (`.github/workflows/ci.yml`)
เชื่อมต่อ GitHub Actions CI ทำการทดสอบและสแกนความปลอดภัยครบทั้ง 4 ด้าน:
1. **SCA (Software Composition Analysis):** สแกนช่องโหว่ของ Library/Dependencies ด้วย **Trivy (`scan-type: fs`)** และ **pip-audit**
2. **SAST (Static Application Security Testing):** สแกน Source Code ทั้ง Python และ TypeScript ด้วย **Bandit** และ **Semgrep (`p/owasp-top-ten`)**
3. **IaC (Infrastructure as Code Scan):** สแกน `Dockerfile` และ `docker-compose.yml` ด้วย **Trivy (`scan-type: config`)**
4. **DAST (Dynamic Application Security Testing):** รัน Docker Container จริงใน Pipeline แล้วสแกนหาช่องโหว่ขณะทำงานด้วย **OWASP ZAP Baseline Scan**

---

## 🎤 เอกสารสำหรับ Pitching รอบสัมภาษณ์ (10 นาที) & คำถามเทคนิค Docker
ดูรายละเอียดสคริปต์การนำเสนอครบทั้ง 5 หัวข้อ (`As Is Vs To Be`, `Architecture`, `Features`, `User Story`, `UI Flow`) พร้อมแนวคำตอบเจาะลึกเรื่อง Docker ได้ในไฟล์ [PITCHING_AND_DOCKER_QA.md](./PITCHING_AND_DOCKER_QA.md)
