-- ============================================
-- 휴대폰 인증번호 저장 테이블
-- Supabase > SQL Editor 에 붙여넣고 RUN 하세요.
-- ============================================

create table if not exists public.phone_verifications (
  id          bigserial primary key,
  phone       text        not null,
  code        text        not null,
  expires_at  timestamptz not null,
  verified    boolean     not null default false,
  verified_at timestamptz,
  attempts    int         not null default 0,
  created_at  timestamptz not null default now()
);

-- 조회 속도용 인덱스
create index if not exists idx_phone_verifications_phone_created
  on public.phone_verifications (phone, created_at desc);

-- ============================================
-- 보안: RLS 켜고 정책은 만들지 않습니다.
-- → 브라우저(anon 키)에서는 절대 읽거나 쓸 수 없고,
--   Netlify 함수(service_role 키)만 접근합니다.
-- ============================================
alter table public.phone_verifications enable row level security;

-- ============================================
-- (선택) 오래된 인증 기록 자동 정리
--   pg_cron 확장이 있으면 하루 1번 3일 지난 기록 삭제
-- ============================================
-- create extension if not exists pg_cron;
-- select cron.schedule('cleanup_phone_verifications', '0 4 * * *',
--   $$ delete from public.phone_verifications where created_at < now() - interval '3 days' $$);
