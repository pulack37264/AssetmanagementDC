# Small Data Center Inventory

Web application to track data-center equipment, room and rack placement, management IPs, lifecycle status, warranties, repairs, invoices, and software licenses.

**→ Quick run:** see **[RUN.md](RUN.md)** for minimal steps (two terminals: server then client).

## Tech Stack

- **Frontend:** React 18, TypeScript, Vite
- **Backend:** Node.js 18+, Express
- **Database:** Microsoft SQL Server

---

## Full operational (run server + client)

1. **Start the backend** (Terminal 1):
   ```powershell
   cd server
   npm install
   npm start
   ```
   API runs at **http://localhost:3001**. Leave this running.

2. **Start the frontend** (Terminal 2):
   ```powershell
   cd client
   npm install
   npm start
   ```
   App runs at **http://localhost:5173**. Open this in your browser.

3. The client uses **http://localhost:3001/api** by default. If your API is on another port, set:
   ```powershell
   $env:VITE_API_URL='http://localhost:3001/api'
   npm start
   ```
   (Or create `client/.env` with `VITE_API_URL=http://localhost:3001/api`.)

---

## Database (Microsoft SQL Server)

The API uses **Microsoft SQL Server** only. Before running the server:

1. Create a database (e.g. `AssetManagement`) on your SQL Server.
2. Run **`server/docs/sql-server-schema.sql`** on that database (in SSMS or sqlcmd). It migrates legacy asset statuses to the data-center lifecycle and adds missing placement columns. Existing employee/assignment data is left untouched but is no longer used by the app. For the full upgrade script, use **`server/docs/full-schema.sql`**.
3. Set connection details in **`server/.env`**: `DB_SERVER`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` (and `DB_ENCRYPT` if needed).

Then open:

- **Health:** http://localhost:3001/api/health  
- **DB check:** http://localhost:3001/api/health/db  

**Test with the script (run from the `server` folder, or use the path below):**

```powershell
cd server
$env:BASE_URL='http://localhost:3001/api'; node test-api.js
```

### API endpoints (backend)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/health | Health check |
| GET | /api/health/db | Database connectivity |
| GET/POST/PUT | /api/assets | Assets |
| GET | /api/assets/:id/invoice | Download invoice PDF |
| POST | /api/assets/:id/invoice | Upload invoice PDF (multipart) |
| GET/POST | /api/repairs | Repairs |
| PUT | /api/repairs/:id/complete | Complete repair |
| GET | /api/dashboard/stats | Dashboard stats |
| GET | /api/invoices | List invoices (with asset info) |
| POST | /api/reports/inventory/email | Email selected asset or license records (Admin) |

### Roles and access

- **Admin:** full API access, including deletes and user/role management.
- **Editor:** read, create, and update access; deletes and user management are Admin-only.
- Existing accounts are migrated as **Admin**. Each protected request checks the current database role.

Admin-only account endpoints (send a Bearer token):

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/auth/users | List accounts and roles |
| POST | /api/auth/users | Create an account with `username`, `password`, and `role` (`Admin` or `Editor`) |
| PATCH | /api/auth/users/:id/role | Change an account role |
| DELETE | /api/auth/users/:id | Delete an account |

At least one Admin account must remain. An account cannot delete itself.

### Configuration

- The server loads env from **`server/.env`** (create from `server/.env.example`). Set `DB_SERVER`, `DB_USER`, `DB_PASSWORD`, and `DB_NAME` for SQL Server. For manual email, configure `INVENTORY_REPORT_TO`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, and `SMTP_PASS`. Use `PORT` to change the API port (e.g. `PORT=3002`).

### Troubleshooting (SQL Server)

- **Connection refused / ECONNREFUSED:** Ensure SQL Server is running and reachable; check `DB_SERVER` (e.g. `localhost` or `.\SQLEXPRESS` for local default instance).
- **Login failed for user:** Check `DB_USER` and `DB_PASSWORD`; ensure SQL authentication is enabled if not using Windows auth.
- **Cannot open database:** Verify `DB_NAME` exists and the user has access. Run `server/docs/sql-server-schema.sql` on that database to create tables.
- **Encryption:** For local dev without TLS, use `DB_ENCRYPT=false`. For Azure or encrypted connections, set `DB_ENCRYPT=true` if required.
