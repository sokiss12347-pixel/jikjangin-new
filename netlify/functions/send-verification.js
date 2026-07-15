/**
 * Netlify Function: send-verification
 * 휴대폰 인증번호 발송 (솔라피 SOLAPI)
 *
 * 환경변수 (Netlify > Site configuration > Environment variables):
 *   SOLAPI_API_KEY     : 솔라피 API Key
 *   SOLAPI_API_SECRET  : 솔라피 API Secret
 *   SOLAPI_SENDER      : 솔라피에 등록·승인된 발신번호 (예: 18660379)
 *   SUPABASE_URL       : https://xxxx.supabase.co
 *   SUPABASE_SERVICE_KEY : Supabase service_role 키 (절대 프론트에 넣지 말 것)
 *
 * 요청 (POST): { "phone": "010-1234-5678" }
 * 응답: { ok: true } / { ok:false, error:"..." }
 */

const crypto = require("crypto");
const https = require("https");

const CODE_TTL_MIN = 3;      // 인증번호 유효시간(분)
const MAX_PER_HOUR = 5;      // 같은 번호로 1시간 내 최대 발송 횟수

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify(body),
  };
}

/* 공통 HTTPS 요청 */
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

/* Supabase REST 헬퍼 */
function sbHeaders(key) {
  return {
    apikey: key,
    Authorization: "Bearer " + key,
    "Content-Type": "application/json",
  };
}

/* 솔라피 HMAC 인증 헤더 생성 */
function solapiAuth(apiKey, apiSecret) {
  const date = new Date().toISOString();
  const salt = crypto.randomBytes(32).toString("hex");
  const signature = crypto
    .createHmac("sha256", apiSecret)
    .update(date + salt)
    .digest("hex");
  return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`;
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { ok: false, error: "POST만 허용됩니다." });

  const API_KEY = process.env.SOLAPI_API_KEY;
  const API_SECRET = process.env.SOLAPI_API_SECRET;
  const SENDER = process.env.SOLAPI_SENDER;
  const SB_URL = process.env.SUPABASE_URL;
  const SB_KEY = process.env.SUPABASE_SERVICE_KEY;

  if (!API_KEY || !API_SECRET || !SENDER || !SB_URL || !SB_KEY) {
    return json(500, { ok: false, error: "서버 환경변수가 설정되지 않았습니다." });
  }

  let phone;
  try {
    phone = (JSON.parse(event.body || "{}").phone || "").replace(/[^0-9]/g, "");
  } catch (e) {
    return json(400, { ok: false, error: "잘못된 요청입니다." });
  }

  if (!/^01[016789][0-9]{7,8}$/.test(phone)) {
    return json(400, { ok: false, error: "올바른 휴대폰 번호를 입력해주세요." });
  }

  try {
    /* 1) 남용 방지 - 최근 1시간 발송 횟수 확인 */
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const cntRes = await request(
      `${SB_URL}/rest/v1/phone_verifications?phone=eq.${phone}&created_at=gte.${since}&select=id`,
      { method: "GET", headers: sbHeaders(SB_KEY) }
    );
    const recent = JSON.parse(cntRes.body || "[]");
    if (Array.isArray(recent) && recent.length >= MAX_PER_HOUR) {
      return json(429, { ok: false, error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." });
    }

    /* 2) 인증번호 생성 + 저장 */
    const code = String(crypto.randomInt(100000, 1000000)); // 6자리
    const expiresAt = new Date(Date.now() + CODE_TTL_MIN * 60 * 1000).toISOString();

    const insRes = await request(
      `${SB_URL}/rest/v1/phone_verifications`,
      { method: "POST", headers: Object.assign(sbHeaders(SB_KEY), { Prefer: "return=minimal" }) },
      JSON.stringify({ phone, code, expires_at: expiresAt, verified: false, attempts: 0 })
    );
    if (insRes.status >= 300) {
      console.error("supabase insert fail", insRes.status, insRes.body);
      return json(500, { ok: false, error: "인증번호 저장에 실패했습니다." });
    }

    /* 3) 솔라피로 SMS 발송 */
    const payload = JSON.stringify({
      message: {
        to: phone,
        from: SENDER.replace(/[^0-9]/g, ""),
        text: `[직장인] 인증번호 ${code} 를 입력해주세요. (${CODE_TTL_MIN}분 내 유효)`,
      },
    });

    const smsRes = await request(
      "https://api.solapi.com/messages/v4/send",
      {
        method: "POST",
        headers: {
          Authorization: solapiAuth(API_KEY, API_SECRET),
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      payload
    );

    if (smsRes.status >= 300) {
      console.error("solapi fail", smsRes.status, smsRes.body);
      let msg = "문자 발송에 실패했습니다.";
      try {
        const e = JSON.parse(smsRes.body);
        if (e.errorMessage) msg += " (" + e.errorMessage + ")";
      } catch (_) {}
      return json(502, { ok: false, error: msg });
    }

    return json(200, { ok: true, ttl: CODE_TTL_MIN * 60 });
  } catch (err) {
    console.error(err);
    return json(500, { ok: false, error: "서버 오류가 발생했습니다." });
  }
};
