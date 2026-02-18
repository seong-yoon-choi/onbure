# Notion AI Prompts (Onbure)

## 1) Chat + Requests/History Schema Sync

```text
Onbure 서버 코드 기준으로 Notion DB 스키마를 점검/보완해줘.
중요:
1) 기존 데이터/페이지는 삭제하지 말 것
2) 없는 속성만 추가할 것
3) 이미 유사 속성이 있으면 유지하고, 필요한 경우 별칭 속성만 추가할 것
4) 마지막에 DB별 "추가됨 / 이미 존재" 표로 보고할 것

[A. CHAT_REQUESTS DB]
필수 속성:
- chat_request_id : rich_text
- from_user_id : rich_text
- to_user_id : rich_text
- message : rich_text
- status : select (옵션: PENDING, ACCEPTED, DECLINED)
- created_at : date

[B. TEAM_INVITES DB]
필수 속성:
- invite_id : rich_text
- team_id : rich_text
- inviter_user_id : rich_text
- invitee_user_id : rich_text
- message : rich_text
- status : select (옵션: PENDING, ACCEPTED, DECLINED)
- created_at : date

[C. TEAM_JOIN_REQUESTS DB]
필수 속성:
- join_request_id : rich_text
- team_id : rich_text
- applicant_user_id : rich_text
- answer_1 : rich_text
- answer_2 : rich_text
- status : select (옵션: PENDING, ACCEPTED, DECLINED)
- created_at : date

[D. TEAM_MEMBERS DB]
필수 속성:
- team_id : rich_text
- user_id : rich_text
- role : select (옵션: Owner, Admin, Member)
권장 속성:
- status : select (옵션: Active, Inactive)
- joined_at : date

[E. THREADS DB]
필수 속성:
- thread_id : rich_text
- type : select (옵션: DM, TEAM)
- (아래 중 최소 1쌍)
  1) participants_user_ids : rich_text (DM용, "userId1,userId2")
  2) participants : relation -> USERS DB
- (아래 중 최소 1개)
  1) team_id : rich_text (TEAM용)
  2) team : relation -> TEAMS DB
권장 속성:
- last_message_at : date
- created_at : date
- Title 속성(기본 title)은 유지

[F. MESSAGES DB]
필수 속성:
- (아래 중 최소 1개)
  1) thread_id : rich_text
  2) thread : relation -> THREADS DB
- (아래 중 최소 1개)
  1) body_original : rich_text
  2) body : rich_text
  3) content : rich_text
권장 속성:
- message_id : rich_text
- (아래 중 최소 1개) sender_user_id : rich_text / sender : relation -> USERS DB
- created_at : date
- body_translated : rich_text
- translated_lang : rich_text
- Title 속성은 기본으로 유지

[G. USERS DB]
필수 속성:
- user_id : rich_text
- username : title (또는 title 역할 컬럼)
권장 속성:
- language : select
- skills : multi_select

[H. TEAMS DB]
필수 속성:
- team_id : rich_text
- team_name : title (또는 title 역할 컬럼)
권장 속성:
- visibility : select (옵션: Public, Private)

검증:
1) status select 옵션(PENDING/ACCEPTED/DECLINED)이 3개 DB(Chat Requests, Team Invites, Team Join Requests)에 모두 있는지 확인
2) threads.type 옵션(DM/TEAM) 확인
3) 누락 옵션이 있으면 추가
4) 최종 점검 결과를 DB별 표로 출력
```

## 2) Quick Prompt (Only Requests/History Related DBs)

```text
Onbure의 Requests/History 기능용으로 아래 4개 DB만 점검해줘.
기존 데이터 삭제 금지, 없는 속성만 추가.

DB:
1) CHAT_REQUESTS: chat_request_id, from_user_id, to_user_id, message, status(PENDING/ACCEPTED/DECLINED), created_at
2) TEAM_INVITES: invite_id, team_id, inviter_user_id, invitee_user_id, message, status(PENDING/ACCEPTED/DECLINED), created_at
3) TEAM_JOIN_REQUESTS: join_request_id, team_id, applicant_user_id, answer_1, answer_2, status(PENDING/ACCEPTED/DECLINED), created_at
4) TEAM_MEMBERS: team_id, user_id, role(Owner/Admin/Member), status(Active/Inactive), joined_at

마지막에 DB별 추가/기존 속성 표와 상태 옵션 점검 결과를 출력해줘.
```

