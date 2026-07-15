const https = require("https");

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => resolve(data));
      res.on("error", reject);
    }).on("error", reject);
  });
}

exports.handler = async function(event) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json; charset=utf-8",
  };

  const authKey = process.env.HRD_AUTH_KEY;
  if (!authKey) {
    return { statusCode: 200, headers, body: JSON.stringify({ error: "HRD_AUTH_KEY 없음" }) };
  }

  // 여러 URL 테스트
  const urls = [
    `https://www.work24.go.kr/cm/openApi/call/hr/callOpenApiSvcInfo210L01.do?authKey=${authKey}&returnType=XML&outType=1&pageNum=1&pageSize=3&srchTracseSe=A`,
    `https://m.work24.go.kr/cm/openApi/call/hr/callOpenApiSvcInfo210L01.do?authKey=${authKey}&returnType=XML&outType=1&pageNum=1&pageSize=3&srchTracseSe=A`,
    `https://hrd.work24.go.kr/cm/openApi/call/hr/callOpenApiSvcInfo210L01.do?authKey=${authKey}&returnType=XML&outType=1&pageNum=1&pageSize=3&srchTracseSe=A`,
  ];

  const results = {};
  for (const url of urls) {
    try {
      const res = await fetchUrl(url);
      const domain = url.split('/')[2];
      results[domain] = res.substring(0, 300);
    } catch(e) {
      const domain = url.split('/')[2];
      results[domain] = 'ERROR: ' + e.message;
    }
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify(results, null, 2)
  };
};
