/**
 * Cloudflare Worker: Proxy Intelligente per Orario Scolastico
 * Architettura "Terza Via":
 * 1. Protezione del server della scuola (Edge Cache di 5 minuti, massimo 1 richiesta/5min a monte).
 * 2. Stale-If-Error / Fallback su Cache Edge: Se il server del liceo è offline (503, 500, timeout),
 *    il worker restituisce l'ultima versione valida memorizzata invece di un errore 503.
 * 3. Nessuna cache sui browser mobile: Risponde al client con "no-store, no-cache", costringendo
 *    gli smartphone a chiedere sempre a Cloudflare (tempo di risposta ~15ms senza toccare il liceo).
 * 4. Preflight CORS universale per evitare blocchi preflight del browser.
 */

export default {
  async fetch(request, env, ctx) {
    const ALLOWED_ORIGIN = "*";
    const TARGET_URL = "https://liceocuneo.it/orario/oraedt.xml";
    
    // 1. Controllo metodo HTTP
    if (request.method !== "GET" && request.method !== "OPTIONS") {
      return new Response("Method not allowed", { 
        status: 405,
        headers: { "Access-Control-Allow-Origin": ALLOWED_ORIGIN }
      });
    }

    // 2. Gestione Preflight (OPTIONS) permissiva: accetta qualsiasi header del browser
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "*", // Evita qualsiasi rifiuto CORS preflight
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    // 3. Inizializzazione Cache di emergenza (Cloudflare Cache API)
    const cache = caches.default;
    // Chiave cache statica interna (normalizzata, indipendente da query params del client)
    const cacheKey = new Request("https://orario-pellicano.edge-cache/oraedt.xml", { method: "GET" });

    // Funzione helper per iniettare gli header CORS e anti-caching per i dispositivi mobili
    function buildClientResponse(body, status = 200, extraHeaders = {}) {
      const headers = new Headers({
        "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Expose-Headers": "X-Cache-Status, X-Upstream-Status",
        "Content-Type": "application/xml; charset=utf-8",
        // Forza i browser mobile a non memorizzare localmente su disco,
        // garantendo che chiedano sempre a Cloudflare
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        "Pragma": "no-cache",
        "Expires": "0",
        ...extraHeaders
      });

      return new Response(body, { status, headers });
    }

    // 4. Tentativo di recupero dall'upstream con Edge Caching di 5 minuti
    let upstreamResponse = null;
    let fetchError = null;

    try {
      // Timeout di 8 secondi per non bloccare il client se il server della scuola non risponde
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      upstreamResponse = await fetch(TARGET_URL, {
        signal: controller.signal,
        cf: {
          cacheTtl: 300, // Caching edge di 5 minuti su Cloudflare
          cacheEverything: true,
        },
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) OrarioPellicanoProxy/2.0",
          "Accept": "application/xml, text/xml, */*"
        }
      });

      clearTimeout(timeoutId);
    } catch (err) {
      fetchError = err;
    }

    // 5. Verifica della risposta upstream
    if (upstreamResponse && upstreamResponse.ok) {
      const xmlText = await upstreamResponse.text();

      // Validazione minima del payload XML
      if (xmlText && xmlText.includes("<Attivita")) {
        // Salviamo in background la copia valida nella cache edge con validità 7 giorni
        // come salvagente in caso di guasti futuri del liceo
        const backupResponse = new Response(xmlText, {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=604800", // 7 giorni per la Cache API interna
          }
        });
        ctx.waitUntil(cache.put(cacheKey, backupResponse));

        return buildClientResponse(xmlText, 200, {
          "X-Cache-Status": "FRESH-OR-EDGE-HIT",
          "X-Upstream-Status": upstreamResponse.status.toString()
        });
      }
    }

    // 6. TERZA VIA: Se il server del liceo è offline (503, 500, timeout o errore di rete)
    // Recuperiamo l'ultima versione funzionante salvata nella cache edge di Cloudflare
    const cachedBackup = await cache.match(cacheKey);
    if (cachedBackup) {
      const backupText = await cachedBackup.text();
      return buildClientResponse(backupText, 200, {
        "X-Cache-Status": "STALE-FALLBACK",
        "X-Upstream-Status": upstreamResponse ? upstreamResponse.status.toString() : (fetchError ? fetchError.name : "FAIL")
      });
    }

    // 7. Se non esiste nemmeno una copia in cache edge (es. primo avvio assoluto e server giù)
    const status = upstreamResponse ? upstreamResponse.status : 502;
    return buildClientResponse(
      `<error><code>${status}</code><message>Server scolastico non raggiungibile e nessuna cache disponibile</message></error>`,
      status,
      {
        "X-Cache-Status": "UNAVAILABLE",
        "Content-Type": "application/xml; charset=utf-8"
      }
    );
  }
};
