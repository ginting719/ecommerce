import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycby5BpmcGqqB7JOGCj1th-LZ7aPSxdHcNOquk2dMeF2rudxMsOsgkth7LfRN9GSq-df47Q/exec";

  // API Proxy to Google Apps Script
  app.get("/api/inventory", async (req, res) => {
    const requestId = Math.random().toString(36).substring(7);
    console.log(`[${requestId}] Fetching inventory from: ${APPS_SCRIPT_URL}`);

    try {
      if (!APPS_SCRIPT_URL) {
        console.error(`[${requestId}] GOOGLE_APPS_SCRIPT_URL is missing`);
        return res.status(500).json({ error: "GOOGLE_APPS_SCRIPT_URL not configured" });
      }

      // Add a timeout controller
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 300000); // 5 minutes timeout for massive sheets

      try {
        const response = await fetch(APPS_SCRIPT_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: JSON.stringify({ action: "getData" }),
          signal: controller.signal,
          redirect: "follow"
        });

        clearTimeout(timeout);

        console.log(`[${requestId}] Apps Script Response: ${response.status} ${response.statusText}`);
        const contentType = response.headers.get("content-type") || "";
        const responseText = await response.text();

        if (!response.ok) {
          console.error(`[${requestId}] Apps Script error: ${response.status} - ${responseText.substring(0, 200)}`);
          return res.status(proxyStatus(response.status)).json({
            error: `Apps Script error (${response.status})`,
            details: responseText.substring(0, 200)
          });
        }

        let data;
        try {
          data = JSON.parse(responseText);
        } catch (jsonError) {
          console.error(`[${requestId}] Failed to parse Apps Script response as JSON. Content-Type: ${contentType}`);
          console.error(`[${requestId}] Body starts with: ${responseText.substring(0, 200)}`);

          if (responseText.includes("<!doctype") || responseText.includes("<html")) {
            return res.status(500).json({
              error: "Apps Script mengembalikan HTML, bukan JSON.",
              details: "Ini biasanya terjadi jika Apps Script belum di-deploy sebagai Web App dengan akses 'Anyone', atau ada error fatal pada script."
            });
          }

          return res.status(500).json({
            error: "Format data dari Apps Script tidak valid.",
            details: responseText.substring(0, 100)
          });
        }

        console.log(`[${requestId}] Inventory data parsed successfully`);
        res.json(data);
      } catch (fetchError: any) {
        clearTimeout(timeout);
        if (fetchError.name === 'AbortError') {
          console.error(`[${requestId}] Fetch timed out after 5 minutes`);
          return res.status(504).json({ error: "Koneksi ke Apps Script timeout (5 menit). Data Spreadsheet terlalu besar." });
        }
        throw fetchError;
      }
    } catch (error: any) {
      console.error(`[${requestId}] Proxy error:`, error.message);
      res.status(500).json({
        error: "Gagal terhubung ke Google Sheets.",
        details: error.message
      });
    }
  });

  // Helper to map status
  function proxyStatus(s: number) {
    return (s >= 200 && s < 600) ? s : 500;
  }

  app.post("/api/log", async (req, res) => {
    console.log("Logging to spreadsheet...");
    try {
      if (!APPS_SCRIPT_URL) {
        return res.status(500).json({ error: "GOOGLE_APPS_SCRIPT_URL not configured" });
      }

      const response = await fetch(APPS_SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body),
        redirect: "follow"
      });

      if (!response.ok) {
        throw new Error(`Apps Script Log returned status ${response.status}`);
      }

      res.json({ status: "success" });
    } catch (error: any) {
      console.error("Log proxy error detail:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/logs", async (req, res) => {
    const requestId = Math.random().toString(36).substring(7);
    console.log(`[${requestId}] Fetching ONLY logs from: ${APPS_SCRIPT_URL}`);
    
    try {
      if (!APPS_SCRIPT_URL) {
        return res.status(500).json({ error: "GOOGLE_APPS_SCRIPT_URL not configured" });
      }

      const response = await fetch(APPS_SCRIPT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({ action: "getLogs" }),
        redirect: "follow"
      });

      const responseText = await response.text();
      
      // Cek apakah response berupa HTML (biasanya error GAS atau belum login)
      if (responseText.includes("<!doctype") || responseText.includes("<html")) {
        console.error(`[${requestId}] Apps Script mengembalikan HTML di /api/logs`);
        return res.status(500).json({ 
          error: "Apps Script mengembalikan HTML.", 
          details: "Pastikan Apps Script di-deploy sebagai Web App dengan akses 'Anyone'." 
        });
      }

      try {
        const data = JSON.parse(responseText);
        console.log(`[${requestId}] Logs fetched successfully: ${data.log ? data.log.length : 0} rows`);
        res.json(data);
      } catch (parseError) {
        console.error(`[${requestId}] JSON Parse error in /api/logs:`, responseText.substring(0, 100));
        res.status(500).json({ error: "Format data log tidak valid." });
      }
    } catch (error: any) {
      console.error(`[${requestId}] Logs proxy error:`, error.message);
      res.status(500).json({ error: "Gagal mengambil data log.", details: error.message });
    }
  });

  // API routes go here
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development (MUST BE AFTER API ROUTES)
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
