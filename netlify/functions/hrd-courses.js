/**
 * Netlify Function: hrd-courses
 * 고용24 국민내일배움카드 훈련과정 목록 API 프록시
 *
 * 환경변수 (Netlify Dashboard > Site Settings > Environment Variables):
 *   HRD_AUTH_KEY  : 고용24 OPEN API 인증키
 *
 * 요청 파라미터 (GET):
 *   keyword   - 검색어 (과정명)
 *   region    - 지역코드 (예: 11=서울, 26=부산, 28=인천, 27=대구, 29=광주, 30=대전, 31=울산, 36=세종, 41=경기, 42=충북, 43=충남, 44=전북, 45=전남, 46=경북, 47=경남, 48=제주, 00=전국)
 *   trngType  - 훈련유형 (C0061=내일배움카드 일반, C0055=원격, C0105=K-디지털)
 *   pageNum   - 페이지번호 (기본 1)
 *   pageSize  - 페이지당 건수 (기본 20, 최대 100)
 */

const https = require("https");

// 고용24 API 기본 URL
const HRD_API_BASE = "https://m.work24.go.kr/cm/openApi/call/hr/callOpenApiSvcInfo210L01.do";

// 지역코드 매핑
const REGION_CODES = {
  "00": "전국", "11": "서울", "26": "부산", "27": "대구", "28": "인천",
  "29": "광주", "30": "대전", "31": "울산", "36": "세종", "41": "경기",
  "42": "충북", "43": "충남", "44": "전북", "45": "전남", "46": "경북",
  "47": "경남", "48": "제주",
};

// 훈련유형 코드
const TRNG_TYPE_CODES = {
  "C0061": "내일배움카드(일반)",
  "C0055": "내일배움카드(원격)",
  "C0105": "K-디지털트레이닝",
};

/**
 * URL에서 XML 데이터 가져오기
 */
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

/**
 * XML 태그 값 추출
 */
function extractTag(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
  return match ? match[1].trim() : "";
}

/**
 * XML에서 여러 항목 추출
 */
function extractAll(xml, tag) {
  const results = [];
  const regex = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "g");
  let match;
  while ((match = regex.exec(xml)) !== null) {
    results.push(match[1].trim());
  }
  return results;
}

/**
 * 훈련과정 XML 파싱
 */
function parseCourseList(xml) {
  const items = [];
  const srchList = extractAll(xml, "srchList");

  srchList.forEach((item) => {
    // XML 내부 태그가 CDATA 방식이므로 직접 파싱
    const raw = item.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
    items.push({
      tracseId:        extractTag(raw, "tracseId"),      // 훈련과정ID
      tracseName:      extractTag(raw, "tracseName"),    // 훈련과정명
      trainstCstmrNm:  extractTag(raw, "trainstCstmrNm"),// 훈련기관명
      totTracseTme:    extractTag(raw, "totTracseTme"),  // 총 훈련시간
      realEndDt:       extractTag(raw, "realEndDt"),     // 훈련종료일
      realStrtDt:      extractTag(raw, "realStrtDt"),    // 훈련시작일
      tracseFee:       extractTag(raw, "tracseFee"),     // 훈련비
      ncsCd:           extractTag(raw, "ncsCd"),         // NCS코드
      ncsNm:           extractTag(raw, "ncsNm"),         // NCS분류명
      address:         extractTag(raw, "address"),       // 훈련장소 주소
      subTitle:        extractTag(raw, "subTitle"),      // 훈련과정 요약
      crseTracseSe:    extractTag(raw, "crseTracseSe"),  // 훈련유형코드
      eiEmplRate:      extractTag(raw, "eiEmplRate"),    // 취업률
      perTrco:         extractTag(raw, "perTrco"),       // 1인당 훈련비
      trcoSe:          extractTag(raw, "trcoSe"),        // 훈련구분(집체/원격)
      grade:           extractTag(raw, "grade"),         // 훈련기관 등급
      trainstCstmrId:  extractTag(raw, "trainstCstmrId"),// 훈련기관ID (상세링크용)
    });
  });

  return items;
}

exports.handler = async function(event) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json; charset=utf-8",
  };

  // OPTIONS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  const authKey = process.env.HRD_AUTH_KEY;

  // 인증키 없으면 목업 데이터 반환
  if (!authKey) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: false,
        mock: true,
        message: "HRD_AUTH_KEY 환경변수가 설정되지 않았습니다. 목업 데이터를 반환합니다.",
        total: 0,
        courses: [],
      }),
    };
  }

  const params = event.queryStringParameters || {};
  const keyword  = params.keyword  || "";
  const region   = params.region   || "00";
  const trngType = params.trngType || "C0061";
  const pageNum  = parseInt(params.pageNum  || "1",  10);
  const pageSize = parseInt(params.pageSize || "20", 10);

  // API URL 조합
  const queryStr = new URLSearchParams({
    authKey,
    returnType:   "XML",
    outType:      "1",           // 목록
    pageNum:      String(pageNum),
    pageSize:     String(Math.min(pageSize, 100)),
    srchTracseSe: "A",           // A=전체, B=훈련생모집중
    srchTrco:     trngType,      // 훈련유형
    srchKeco1Cd:  region !== "00" ? region : "", // 지역
    srchWord:     keyword,       // 검색어
    sort:         "ASC",
    sortCol:      "TRCS_SE",
  }).toString();

  const apiUrl = `${HRD_API_BASE}?${queryStr}`;

  try {
    const xml = await fetchXml(apiUrl);

    // 에러 체크
    const returnCode = extractTag(xml, "returnCode");
    if (returnCode && returnCode !== "200") {
      const returnMsg = extractTag(xml, "returnMsg");
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ ok: false, message: returnMsg || "API 오류", total: 0, courses: [] }),
      };
    }

    const totalCount = parseInt(extractTag(xml, "totalCount") || "0", 10);
    const courses    = parseCourseList(xml);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok:       true,
        total:    totalCount,
        pageNum,
        pageSize,
        region:   REGION_CODES[region] || "전국",
        trngType: TRNG_TYPE_CODES[trngType] || trngType,
        courses,
      }),
    };
  } catch (err) {
    console.error("HRD API error:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ ok: false, message: "서버 오류: " + err.message, total: 0, courses: [] }),
    };
  }
};
