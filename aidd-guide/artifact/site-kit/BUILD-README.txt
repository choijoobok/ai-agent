고객 제출 산출물 생성 안내
===========================

1. 이 폴더의 역할
-----------------

build/는 원본 문서를 고객이 열람할 수 있는 오프라인 HTML 사이트와 PDF로 조립한 파생 결과 폴더입니다.
이 폴더의 HTML과 JSON은 직접 수정하지 않습니다. 수정할 내용은 원본 Markdown, YAML, 화면 목업 또는
aidd-guide/artifact/site-kit/에 반영한 뒤 다시 생성합니다.

주요 결과:

- deliverables/       설계 산출물 + 사용자 매뉴얼 + 운영·개발 가이드를 함께 보는 전체 패키지
- deliverables-user/  일반 사용자에게 따로 전달하는 사용자 매뉴얼 독립 패키지
- deliverables/design/agent-flow.html  전체 흐름도·상세 시퀀스·설명을 연속으로 읽는 단일 파일

각 폴더의 index.html을 열면 인터넷 연결 없이 사용할 수 있습니다.
전체 패키지의 첫 화면에는 세 사이트와 Agent 처리 흐름을 여는 네 개 카드가 표시됩니다.
카드는 실제 생성 대상에서 구성하므로 사용자 매뉴얼 전용본에는 사용자 매뉴얼 카드만 표시됩니다.
설계 사이트의 연속 보기 HTML은 파일 하나만 복사해도 열립니다. 처리 묶음을 눌러 연결을 확인하고,
S 번호로 상세도에 이동하거나 아래로 계속 스크롤합니다. 그림 확대·SVG 저장·전체 인쇄를 제공합니다.
기본은 다크 모드이며 상단에서 라이트/다크를 전환합니다. 선택은 저장 가능한 환경에서 기억합니다.
이 전용본의 종류와 배치는 documents/delivery.yaml의 design.flow_views에서 설정합니다.


2. 가장 많이 쓰는 생성 명령
---------------------------

명령은 저장소 루트에서 실행합니다.

[내부 검토용 전체 사이트]
node .claude/skills/deliverable-site/build.mjs all
node .claude/skills/deliverable-site/check.mjs

[연속 보기 실제 브라우저 검증]
node .claude/skills/deliverable-site/flow-view-check.mjs
검증용 Chromium 대신 이미 설치된 Edge/Chrome을 쓰려면 --browser=msedge 또는 --browser=chrome을 붙입니다.
같은 옵션을 browser-check.mjs에도 사용할 수 있습니다.

[고객 제출용 전체 사이트]
node .claude/skills/deliverable-site/build.mjs all --release
node .claude/skills/deliverable-site/check.mjs

[일반 사용자 전용 사이트]
node .claude/skills/deliverable-site/build.mjs user --release --standalone
node .claude/skills/deliverable-site/check.mjs --root=build/deliverables-user

[문서별 PDF도 함께 생성]
node .claude/skills/deliverable-site/build.mjs all --release --pdf
node .claude/skills/deliverable-site/build.mjs user --release --standalone --pdf

PDF는 한 사이트를 거대한 파일 하나로 만들지 않고 다음 위치에 문서별로 생성합니다.

- build/deliverables/pdf/{사이트}/
- build/deliverables-user/pdf/user/


3. 대상과 옵션
--------------

대상은 명령에서 하나만 선택합니다.

- all         design, user, operations 세 사이트 모두 생성
- design      설계·검증 문서와 화면별 요건 정의서/목업 생성
- user        사용자 매뉴얼 생성. sample 메뉴는 항상 제외
- operations  운영 런북과 개발자 가이드 생성

옵션:

- 옵션 없음      내부 검토본. 목업 허용, 원본 경로와 캡처 교체 위치 등 검토 정보를 표시
- --release      고객 제출본. 내부 검토 표시를 제거하고 사용자 매뉴얼의 실제 캡처 누락 시 실패
- --standalone   선택한 사이트만 build/deliverables-{대상}/에 독립 패키지로 생성
                 all과 함께 사용할 수 없음
- --pdf          HTML과 함께 문서별 PDF 생성. Mermaid 다이어그램 렌더링 완료 후 출력

대표 조합:

- all                         전체 내부 검토
- design                     설계 사이트만 다시 확인
- user --standalone          사용자 매뉴얼 독립 검토본
- user --release --standalone  일반 사용자에게 전달할 최종 HTML 패키지
- all --release --pdf        전체 고객 제출 HTML + 문서별 PDF


4. 원본과 생성 순서
-------------------

설계 문서가 바뀌었다면 먼저 생성 문서를 갱신합니다.

node .claude/skills/doc-gen/gen.mjs

화면 요건서가 바뀌었다면 목업을 다시 만들고 검사합니다.

node .claude/skills/mockup/scaffold.mjs --write admin/system/user
node .claude/skills/mockup/scaffold.mjs --check

운영 런북 제출 전에는 다음 검사를 먼저 실행합니다.

node .claude/skills/runbook/check.mjs --release

그다음 deliverable-site 생성 명령을 실행합니다.


5. 사용자 매뉴얼 화면 이미지
----------------------------

manual.md에서는 이미지 파일명을 직접 쓰지 않고 mockup.html의 그림 키를 참조합니다.

- main 키       documents/screen/{메뉴경로}/screen.png
- 그 밖의 키   documents/screen/{메뉴경로}/screen-{키}.png

예: tab-role 키의 실제 캡처 파일
documents/screen/admin/system/user/screen-tab-role.png

실제 PNG가 없으면 내부 검토본은 목업을 표시합니다. PNG를 넣으면 같은 자리가 실제 이미지로 자동 교체됩니다.
내부 검토본의 SCR ID, 그림 번호, 현재 출처, 대체 파일 안내는 PNG를 넣어도 상태 확인을 위해 남습니다.
이 안내는 --release 고객 제출본에서만 완전히 제거됩니다.


6. PDF 생성 준비
----------------

최초 한 번 sources/frontend/에서 의존성과 Chromium을 준비합니다.

cd sources/frontend
npm install
npx playwright install chromium

준비 후 저장소 루트로 돌아와 --pdf 옵션을 사용합니다. Mermaid 다이어그램은 오프라인 자산으로
SVG 렌더링된 뒤 PDF에 들어갑니다.


7. AI에게 생성 요청하는 방법
----------------------------

스킬 이름을 몰라도 자연어로 목적과 대상을 말하면 됩니다. 대상, 검토본/제출본, PDF 필요 여부를
함께 말하면 가장 정확합니다.

요청 예시:

- "전체 산출물 HTML 사이트를 내부 검토용으로 다시 생성하고 오류를 검사해줘."
- "설계 산출물 사이트만 다시 만들어줘. 요건 정의서와 목업 탭도 확인해줘."
- "일반 사용자에게 전달할 사용자 매뉴얼 독립 패키지를 release 모드로 만들어줘."
- "사용자 매뉴얼을 HTML과 문서별 PDF로 만들어줘. 실제 캡처가 빠진 화면도 알려줘."
- "운영 런북과 개발자 가이드만 오프라인 HTML 사이트로 만들어줘."
- "사용자 관리 요건서가 바뀌었으니 목업을 다시 만들고 전체 산출물 사이트도 갱신해줘."
- "전체 고객 제출본을 release 모드로 만들고 Mermaid와 현재 페이지 인쇄까지 브라우저에서 검사해줘."

스킬을 명시하고 싶다면 다음처럼 요청할 수 있습니다.

- "$deliverable-site로 전체 고객 제출 HTML과 PDF를 생성하고 검사해줘."
- "$manual-site로 사용자 매뉴얼 독립 제출본을 만들어줘."
- "$mockup으로 사용자 관리 화면 목업을 다시 생성한 뒤 $deliverable-site를 실행해줘."

AI에게 최종 제출본을 요청할 때는 다음 세 가지를 명시하는 것을 권장합니다.

1) 대상: 전체 / 설계 / 사용자 / 운영
2) 용도: 내부 검토 / 고객 제출
3) 형식: HTML만 / HTML + 문서별 PDF


8. 제출 전 확인 사항
--------------------

- 일반 사용자에게는 build/deliverables-user/만 전달했는가
- 사용자 매뉴얼에 sample 메뉴가 없는가
- --release가 실제 캡처 누락 없이 성공했는가
- delivery-manifest.json의 error가 0건인가
- 현재 페이지 인쇄, 테마, 보기 설정, Mermaid가 브라우저에서 동작하는가
- build/ 결과물을 손으로 수정하지 않았는가

자동 브라우저 검사는 다음 명령을 사용합니다.

node .claude/skills/deliverable-site/browser-check.mjs design
node .claude/skills/deliverable-site/browser-check.mjs user --root=build/deliverables-user

