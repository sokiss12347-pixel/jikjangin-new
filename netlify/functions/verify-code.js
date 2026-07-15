/**
 * Netlify Function: verify-code
 * 휴대폰 인증번호 확인
 *
 * 환경변수:
 *   SUPABASE_URL, SUPABASE_SERVICE_KEY
 *
 * 요청 (POST): { "phone": "010-1234-5678", "code": "123456" }
 * 응답: { ok:true } / { ok:false, error:"..." }
 */

const https = require("https");

const MAX_ATTEMPTS = 5; // 코드당 최대 시도 횟수

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify(body),
  };
}

function request(urlStr, options, payload) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        method: options.method || "GET",
        headers: options.headers || {},
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => resolve({ status: res.statusCode, body: data }));
      }
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function sbHeaders(key) {
  return {
    apikey: key,
    Authorization: "Bearer " + key,
    "Content-Type": "application/json",
  };
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { ok: false, error: "POST만 허용됩니다." });

  const SB_URL = process.env.SUPABASE_URL;
  const SB_KEY = process.env.SUPABASE_SERVICE_KEY;
  if (!SB_URL || !SB_KEY) return json(500, { ok: false, error: "서버 환경변수가 설정되지 않았습니다." });

  let phone, code;
  try {
    const b = JSON.parse(event.body || "{}");
    phone = (b.phone || "").replace(/[^0-9]/g, "");
    code = (b.code || "").replace(/[^0-9]/g, "");
  } catch (e) {
    return json(400, { ok: false, error: "잘못된 요청입니다." });
  }

  if (!phone || !/^[0-9]{6}$/.test(code)) {
    return json(400, { ok: false, error: "인증번호 6자리를 입력해주세요." });
  }

  try {
    /* 해당 번호의 가장 최근 인증 요청 1건 */
    const res = await request(
      `${SB_URL}/rest/v1/phone_verifications?phone=eq.${phone}&order=created_at.desc&limit=1`,
      { method: "GET", headers: sbHeaders(SB_KEY) }
    );
    const rows = JSON.parse(res.body || "[]");
    if (!rows.length) return json(400, { ok: false, error: "인증번호를 먼저 요청해주세요." });

    const row = rows[0];

    if (row.verified) return json(200, { ok: true, already: true });

    if (new Date(row.expires_at).getTime() < Date.now()) {
      return json(400, { ok: false, error: "인증번호가 만료되었습니다. 다시 요청해주세요." });
    }

    if ((row.attempts || 0) >= MAX_ATTEMPTS) {
      return json(429, { ok: false, error: "시도 횟수를 초과했습니다. 인증번호를 다시 요청해주세요." });
    }

    if (row.code !== code) {
      await request(
        `${SB_URL}/rest/v1/phone_verifications?id=eq.${row.id}`,
        { method: "PATCH", headers: Object.assign(sbHeaders(SB_KEY), { Prefer: "return=minimal" }) },
        JSON.stringify({ attempts: (row.attempts || 0) + 1 })
      );
      const left = MAX_ATTEMPTS - (row.attempts || 0) - 1;
      return json(400, {
        ok: false,
        error: left > 0 ? `인증번호가 일치하지 않습니다. (${left}회 남음)` : "시도 횟수를 초과했습니다.",
      });
    }

    /* 인증 성공 */
    await request(
      `${SB_URL}/rest/v1/phone_verifications?id=eq.${row.id}`,
      { method: "PATCH", headers: Object.assign(sbHeaders(SB_KEY), { Prefer: "return=minimal" }) },
      JSON.stringify({ verified: true, verified_at: new Date().toISOString() })
    );

    return json(200, { ok: true });
  } catch (err) {
    console.error(err);
    return json(500, { ok: false, error: "서버 오류가 발생했습니다." });
  }
};
