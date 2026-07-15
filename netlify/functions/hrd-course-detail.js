/**
 * Netlify Function: hrd-course-detail
 * 고용24 국민내일배움카드 훈련과정 상세 API 프록시
 *
 * 요청 파라미터 (GET):
 *   tracseId       - 훈련과정ID (필수)
 *   tracseTme      - 회차 (필수)
 *   crseTracseSe   - 훈련유형코드 (필수)
 *   trainstCstmrId - 훈련기관ID (필수)
 */

const https = require("https");

const HRD_API_DETAIL = "https://www.work24.go.kr/cm/openApi/call/hr/callOpenApiSvcInfo210L02.do";

function fetchXml(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => resolve(data));
      res.on("error", reject);
    }).on("error", reject);
  });
}

function extractTag(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
  return match ? match[1].trim() : "";
}

exports.handler = async function(event) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json; charset=utf-8",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  const authKey = process.env.HRD_AUTH_KEY;
  if (!authKey) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: false, mock: true, message: "HRD_AUTH_KEY 미설정" }),
    };
  }

  const params = event.queryStringParameters || {};
  const { tracseId, tracseTme, crseTracseSe, trainstCstmrId } = params;

  if (!tracseId || !tracseTme || !crseTracseSe || !trainstCstmrId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ ok: false, message: "필수 파라미터 누락 (tracseId, tracseTme, crseTracseSe, trainstCstmrId)" }),
    };
  }

  const queryStr = new URLSearchParams({
    authKey,
    returnType:      "XML",
    outType:         "2",
    tracseId,
    tracseTme,
    crseTracseSe,
    trainstCstmrId,
  }).toString();

  try {
    const xml = await fetchXml(`${HRD_API_DETAIL}?${queryStr}`);

    // 상세 과정 정보 파싱
    const detail = {
      tracseId:        extractTag(xml, "tracseId"),
      tracseName:      extractTag(xml, "tracseName"),
      trainstCstmrNm:  extractTag(xml, "trainstCstmrNm"),
      totTracseTme:    extractTag(xml, "totTracseTme"),
      tracseFee:       extractTag(xml, "tracseFee"),
      realStrtDt:      extractTag(xml, "realStrtDt"),
      realEndDt:       extractTag(xml, "realEndDt"),
      address:         extractTag(xml, "address"),
      telNo:           extractTag(xml, "telNo"),
      trcoSe:          extractTag(xml, "trcoSe"),
      subTitle:        extractTag(xml, "subTitle"),
      trcseDtlCn:      extractTag(xml, "trcseDtlCn"),  // 훈련내용
      trcsePurpose:    extractTag(xml, "trcsePurpose"), // 훈련목표
      orgNm:           extractTag(xml, "orgNm"),        // 담당기관
      grade:           extractTag(xml, "grade"),
      eiEmplRate:      extractTag(xml, "eiEmplRate"),
      ncsNm:           extractTag(xml, "ncsNm"),
      ncsCd:           extractTag(xml, "ncsCd"),
      hrdNetUrl:       `https://www.work24.go.kr/hr/a/a/3100/selectTracseDetl.do?tracseId=${tracseId}&tracseTme=${tracseTme}&crseTracseSe=${crseTracseSe}&trainstCstmrId=${trainstCstmrId}`,
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: true, detail }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ ok: false, message: err.message }),
    };
  }
};
