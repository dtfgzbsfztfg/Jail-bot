# 디스코드 감옥 봇 (Jail Bot)

관리자가 `/warn`으로 규칙 위반을 누적시키면, 설정한 횟수에 도달했을 때 자동으로
**해당 유저 전용 감옥 채널**이 생성되고 다른 채널은 볼 수 없게 됩니다.
다른 유저들은 `/visit`으로 면회를 신청할 수 있으며, 한 사람당 면회 가능 횟수는 제한됩니다.

## 1. 준비물

- Node.js 18 이상
- 디스코드 개발자 포털(https://discord.com/developers/applications) 에서 만든 봇 애플리케이션

## 2. 봇 초대 시 필요한 권한

봇을 서버에 초대할 때 아래 권한(Permissions)을 꼭 포함해주세요.

- 역할 관리 (Manage Roles)
- 채널 관리 (Manage Channels)
- 채널 보기 / 메시지 보내기 / 메시지 기록 보기
- 슬래시 명령어(Application Commands) — OAuth2 URL 생성 시 `applications.commands` 스코프 체크

> ⚠️ **중요**: 봇의 역할(Role)이 서버 역할 목록에서 "죄수" 역할보다 **위쪽**에 위치해야
> 정상적으로 역할을 부여/해제하고 채널 권한을 편집할 수 있어요. (서버 설정 > 역할 에서 순서 확인)

개발자 포털의 Bot 탭에서 별도 인텐트를 켤 필요는 없습니다. (Guilds 인텐트만 사용)

## 3. 설치

```bash
npm install
cp .env.example .env
```

`.env` 파일을 열어 아래 값을 채워주세요.

- `DISCORD_TOKEN` : Bot 탭의 토큰
- `CLIENT_ID` : General Information의 Application ID
- `GUILD_ID` : (선택) 테스트할 서버 ID. 채우면 명령어가 즉시 반영되고, 비워두면 전역 등록(최대 1시간 소요)

## 4. 슬래시 명령어 등록 & 실행

```bash
npm run deploy   # 슬래시 명령어를 디스코드에 등록
npm start        # 봇 실행
```

## 5. 명령어 목록

### 스태프(관리) 명령어
| 명령어 | 설명 |
|---|---|
| `/warn user reason` | 유저에게 위반 경고 1회 부여. 기준 횟수 도달 시 자동으로 감옥 생성 |
| `/warnlist user` | 유저의 현재 경고 횟수 확인 |
| `/resetwarns user` | 경고 횟수 초기화 |
| `/release user` | 감옥에서 즉시 석방 (채널 삭제) |
| `/jail-config threshold` | 몇 회 위반 시 감옥에 가는지 설정 (기본값 3회) |
| `/visit-config limit` | 1인당 면회 가능 횟수 설정 (기본값 1회) |
| `/staff-role role` | 위 명령어들을 쓸 수 있는 스태프 역할 지정 (서버 관리자만 가능) |

스태프 역할을 지정하지 않으면, "관리자(Administrator)" 권한을 가진 사람만 관리 명령어를 쓸 수 있습니다.

### 일반 유저 명령어
| 명령어 | 설명 |
|---|---|
| `/visit target` | 감옥에 있는 유저를 면회 (채널 입장 권한을 임시로 얻음) |
| `/visitstatus target` | 특정 수감자에 대해 내가 면회를 몇 번 썼는지 확인 |
| `/jail-settings` | 현재 감옥행 기준 / 면회 제한 횟수 확인 |

## 6. 동작 방식 요약

1. `/warn`으로 경고가 쌓여 설정한 기준(`threshold`)에 도달하면:
   - "🔒 감옥" 카테고리(없으면 자동 생성) 아래에 `감옥-닉네임` 채널이 생성됩니다.
   - 해당 유저에게 "죄수" 역할이 부여되고, 이 역할은 감옥 채널을 제외한 **모든 채널을 볼 수 없게** 됩니다.
   - 이후 새로 만들어지는 채널도 자동으로 죄수 역할에게는 숨겨집니다.
   - 경고 횟수는 자동으로 0으로 초기화됩니다.
2. 다른 유저가 `/visit target:@수감자`를 실행하면:
   - 해당 수감자와의 면회 사용 횟수를 확인하고, 제한(`visitLimit`) 이내면 그 감옥 채널을 볼 수 있는 권한을 부여합니다.
   - 제한을 초과하면 더 이상 면회할 수 없습니다.
3. `/release`로 석방하면 죄수 역할이 제거되고, 감옥 채널은 잠시 후 자동 삭제되며 면회 기록도 초기화됩니다.

## 7. 데이터 저장

별도 데이터베이스 없이 `data.json` 파일에 서버별로 경고/감옥/면회 기록이 저장됩니다.
봇을 여러 서버에서 쓰더라도 서버별로 독립적으로 관리됩니다.

## 8. Railway로 배포하기

### 8-1. 레포 준비
이 프로젝트 폴더를 GitHub 레포에 올려주세요. (`.gitignore`에 `node_modules`, `.env`, `data.json`이 이미 제외되어 있어요)

```bash
git init
git add .
git commit -m "init"
git remote add origin <내 깃허브 레포 주소>
git push -u origin main
```

### 8-2. Railway 프로젝트 생성
1. https://railway.app 에서 **New Project → Deploy from GitHub repo** 선택 후 이 레포를 연결합니다.
2. Node 프로젝트로 자동 인식되어 `npm install` → `npm start`가 자동 실행됩니다. (Start Command를 따로 지정할 필요 없음)

### 8-3. 환경변수 설정
프로젝트 → **Variables** 탭에서 아래 값을 추가하세요.

| 변수명 | 값 |
|---|---|
| `DISCORD_TOKEN` | 봇 토큰 |
| `CLIENT_ID` | 애플리케이션 ID |
| `GUILD_ID` | (선택) 테스트 서버 ID. 넣으면 명령어가 즉시 반영됨 |
| `DATA_DIR` | `/data` (아래 8-4의 볼륨 마운트 경로와 동일하게) |

### 8-4. Volume 연결 (필수, 데이터 유지용)
Railway는 재배포/재시작 시 컨테이너 파일시스템이 초기화되기 때문에, `data.json`을 그냥 두면
경고/감옥/면회 기록이 날아가요. 이를 막으려면:

1. 프로젝트 서비스 → **Volumes** 탭 → **New Volume**
2. Mount path를 `/data` 로 지정
3. 위 8-3에서 넣은 `DATA_DIR=/data`와 경로를 맞춰주면, `data.json`이 이 볼륨 안에 저장되어
   재배포해도 유지됩니다.

### 8-5. 배포 확인
Deploy 로그에 아래처럼 뜨면 정상입니다.

```
서버(...)에 명령어 등록 완료! (즉시 반영됩니다)
로그인 완료: 봇이름#0000
```

이후 코드를 수정해서 `git push`만 하면 Railway가 자동으로 재배포합니다. (`npm start`가
`deploy-commands.js`를 먼저 실행하므로 슬래시 명령어도 매번 자동으로 최신 상태로 갱신돼요.)

## 9. 커스터마이징 팁

- 감옥 카테고리 이름, "죄수" 역할 이름은 `index.js` 상단의 `JAIL_CATEGORY_NAME`, `PRISONER_ROLE_NAME` 값을 수정하면 바뀝니다.
- 공지사항 채널처럼 수감자도 계속 볼 수 있게 하고 싶은 채널이 있다면, `lockOtherChannelsFor` 함수에서 해당 채널 ID를 예외 처리하도록 조건을 추가하면 됩니다.
