const https = require("https");

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

exports.handler = async function(event) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json; charset=utf-8",
  };

  const authKey = process.env.HRD_AUTH_KEY;
  if (!authKey) {
    return { statusCode: 200, headers, body: JSON.stringify({ error: "HRD_AUTH_KEY 없음" }) };
  }

  // 파라미터 여러 조합 테스트
  const url1 = `https://m.work24.go.kr/cm/openApi/call/hr/callOpenApiSvcInfo210L01.do?authKey=${authKey}&returnType=XML&outType=1&pageNum=1&pageSize=5&srchTracseSe=A&srchTrco=C0061`;
  
  try {
    const xml = await fetchXml(url1);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ url: url1.replace(authKey, '***'), rawXml: xml.substring(0, 2000) })
    };
  } catch(err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
