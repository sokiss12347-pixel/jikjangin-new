/* =====================================================================
 * 직장인 — 수강신청 팝업 (상세페이지에 붙여서 사용)
 * 사용법:
 *   1) </body> 앞에 한 번만:  <script src="apply.js"></script>
 *   2) 신청 버튼:            <button onclick="openApply('교육ID')">수강신청</button>
 *   (교육ID는 어드민 > 교육 등록에서 "ID 복사")
 * ===================================================================== */
(function(){
  var SB_URL = 'https://fgllsqgzgshneforfkoy.supabase.co';
  var SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZnbGxzcWd6Z3NobmVmb3Jma295Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3NjU3NTMsImV4cCI6MjA5NTM0MTc1M30.aBaEUieQCiih3J0uv79TdhFU2cv2UWbeNZ7C9xvs54g';
  var _client = null;

  function loadScript(src){ return new Promise(function(res,rej){ var s=document.createElement('script'); s.src=src; s.onload=res; s.onerror=rej; document.head.appendChild(s); }); }
  async function client(){
    if(_client) return _client;
    if(!window.supabase || !window.supabase.createClient){ await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js'); }
    _client = window.supabase.createClient(SB_URL, SB_KEY);
    return _client;
  }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  function dot(s){ if(!s) return ''; var p=String(s).split('-'); return p.length===3?(p[0]+'.'+p[1]+'.'+p[2]):String(s); }

  function ensureStyles(){
    if(document.getElementById('apply-css')) return;
    var st=document.createElement('style'); st.id='apply-css';
    st.textContent =
      '.apply-ov{position:fixed;inset:0;background:rgba(15,23,42,.5);display:flex;align-items:center;justify-content:center;z-index:99999;padding:16px;font-family:"Noto Sans KR",-apple-system,sans-serif;}'+
      '.apply-modal{background:#fff;border-radius:16px;max-width:440px;width:100%;padding:24px 22px;box-shadow:0 20px 50px rgba(0,0,0,.25);max-height:90vh;overflow:auto;}'+
      '.apply-modal h3{font-size:18px;font-weight:900;margin:0 0 4px;color:#1E293B;}'+
      '.apply-sub{font-size:13px;color:#64748B;margin-bottom:18px;}'+
      '.apply-modal label{display:block;font-size:12px;font-weight:700;color:#475569;margin:0 0 6px;}'+
      '.apply-modal select{width:100%;padding:12px 13px;border:1.5px solid #E2E8F0;border-radius:9px;font-size:14px;font-family:inherit;background:#fff;margin-bottom:14px;color:#1E293B;}'+
      '.apply-modal select:focus{outline:none;border-color:#005BFF;}'+
      '.apply-row{display:flex;gap:10px;margin-top:6px;}'+
      '.apply-btn{flex:1;padding:13px;border-radius:9px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;border:none;}'+
      '.apply-go{background:#005BFF;color:#fff;}.apply-go:disabled{background:#9DB8FF;cursor:default;}'+
      '.apply-cancel{background:#fff;color:#475569;border:1.5px solid #E2E8F0;}'+
      '.apply-msg{font-size:13px;margin-top:6px;}.apply-msg.err{color:#EF4444;}.apply-msg.ok{color:#065F46;}'+
      '.apply-empty{font-size:14px;color:#64748B;text-align:center;padding:18px 0;}';
    document.head.appendChild(st);
  }

  function close(){ var o=document.querySelector('.apply-ov'); if(o) o.remove(); }

  window.openApply = async function(programId){
    if(!programId){ alert('교육 ID가 지정되지 않았습니다.'); return; }
    ensureStyles();
    // 모달 뼈대
    var ov=document.createElement('div'); ov.className='apply-ov';
    ov.innerHTML='<div class="apply-modal"><h3>수강 신청</h3><div class="apply-sub" id="ap-title">불러오는 중…</div><div id="ap-body"><div class="apply-empty">잠시만 기다려주세요…</div></div></div>';
    ov.addEventListener('click', function(e){ if(e.target===ov) close(); });
    document.body.appendChild(ov);
    var body=ov.querySelector('#ap-body');

    var sb = await client();

    // 로그인 확인
    var sres = await sb.auth.getSession();
    var session = sres.data && sres.data.session;
    if(!session || !session.user){
      body.innerHTML='<div class="apply-empty">신청은 로그인 후 가능합니다.</div>'+
        '<div class="apply-row"><button class="apply-btn apply-cancel" id="ap-x">닫기</button><button class="apply-btn apply-go" id="ap-login">로그인하러 가기</button></div>';
      body.querySelector('#ap-x').onclick=close;
      body.querySelector('#ap-login').onclick=function(){ location.href='login.html'; };
      return;
    }
    var uid=session.user.id, uemail=session.user.email||'';

    // 교육 + 회차 조회
    var pr = await sb.from('programs').select('*').eq('id', programId).single();
    if(pr.error || !pr.data){ ov.querySelector('#ap-title').textContent='교육 정보를 찾을 수 없습니다.'; body.innerHTML='<div class="apply-row"><button class="apply-btn apply-cancel" id="ap-x">닫기</button></div>'; body.querySelector('#ap-x').onclick=close; return; }
    var prog=pr.data;
    ov.querySelector('#ap-title').textContent=prog.title;

    var sr = await sb.from('program_sessions').select('*').eq('program_id', programId).eq('status','모집중').order('start_date',{ascending:true});
    var sessions=(sr.data||[]);
    if(sessions.length===0){ body.innerHTML='<div class="apply-empty">현재 모집 중인 일정이 없습니다.<br>잠시 후 다시 확인해주세요.</div><div class="apply-row"><button class="apply-btn apply-cancel" id="ap-x">닫기</button></div>'; body.querySelector('#ap-x').onclick=close; return; }

    // 지역 목록(중복 제거)
    var regions=[]; sessions.forEach(function(s){ if(regions.indexOf(s.region)===-1) regions.push(s.region); });

    body.innerHTML=
      '<label>지역 선택</label><select id="ap-region"><option value="">지역을 선택하세요</option>'+regions.map(function(r){return '<option value="'+esc(r)+'">'+esc(r)+'</option>';}).join('')+'</select>'+
      '<label>일정 선택</label><select id="ap-sess" disabled><option value="">먼저 지역을 선택하세요</option></select>'+
      '<div class="apply-msg" id="ap-msg"></div>'+
      '<div class="apply-row"><button class="apply-btn apply-cancel" id="ap-x">취소</button><button class="apply-btn apply-go" id="ap-go" disabled>신청하기</button></div>';

    var selRegion=body.querySelector('#ap-region'), selSess=body.querySelector('#ap-sess'), goBtn=body.querySelector('#ap-go'), msg=body.querySelector('#ap-msg');
    body.querySelector('#ap-x').onclick=close;

    selRegion.onchange=function(){
      var rg=this.value;
      if(!rg){ selSess.disabled=true; selSess.innerHTML='<option value="">먼저 지역을 선택하세요</option>'; goBtn.disabled=true; return; }
      var list=sessions.filter(function(s){return s.region===rg;});
      selSess.disabled=false;
      selSess.innerHTML='<option value="">일정을 선택하세요</option>'+list.map(function(s){
        var lab=dot(s.start_date)+' ~ '+dot(s.end_date)+(s.time_slot?(' · '+esc(s.time_slot)):'')+(s.capacity!=null?(' (정원 '+s.capacity+')'):'');
        return '<option value="'+esc(s.id)+'">'+lab+'</option>';
      }).join('');
      goBtn.disabled=true;
    };
    selSess.onchange=function(){ goBtn.disabled = !this.value; };

    goBtn.onclick=async function(){
      var sid=selSess.value; if(!sid) return;
      var s=sessions.filter(function(x){return x.id===sid;})[0]; if(!s) return;
      goBtn.disabled=true; goBtn.textContent='신청 중…';
      // 학생 이름
      var pname=''; try{ var pp=await sb.from('profiles').select('name').eq('id',uid).single(); if(pp.data) pname=pp.data.name||''; }catch(e){}
      var rec={
        user_id: uid,
        program_id: programId,
        session_id: sid,
        class_slug: programId,            // 교육 식별자
        class_title: prog.title,
        region: s.region,
        start_date: s.start_date,
        end_date: s.end_date,
        status: '상담대기',
        student_email: uemail,
        student_name: pname
      };
      var ins=await sb.from('class_applications').insert(rec);
      if(ins.error){ msg.className='apply-msg err'; msg.textContent='신청 실패: '+ins.error.message; goBtn.disabled=false; goBtn.textContent='신청하기'; return; }
      body.innerHTML='<div class="apply-empty">✅ 신청이 접수되었습니다!<br><b>'+esc(prog.title)+'</b><br>'+esc(s.region)+' · '+dot(s.start_date)+' ~ '+dot(s.end_date)+'<br><br>마이페이지 &gt; 수강 신청에서 확인할 수 있어요.<br>운영자 확인 후 안내드립니다.</div>'+
        '<div class="apply-row"><button class="apply-btn apply-cancel" id="ap-x2">닫기</button><button class="apply-btn apply-go" id="ap-my">마이페이지로</button></div>';
      body.querySelector('#ap-x2').onclick=close;
      body.querySelector('#ap-my').onclick=function(){ location.href='mypage.html'; };
    };
  };
})();
