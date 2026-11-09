# minigame
미니게임센터

체스, 오목, 카드 게임(블랙잭·솔리테어·원카드·하이로우·짝 맞추기), 화투(맞고·고스톱)를 모아 둔 웹 미니게임센터입니다.

## 실행
빌드 없이 `index.html`을 브라우저로 열면 됩니다.

## 구조
- `index.html` — 메인 화면
- `assets/style.css` — 스타일 (라이트/다크 테마)
- `assets/games.js` — 게임 목록 데이터. 게임을 완성하면 `status`를 `"ready"`로 바꾸고 `url` 경로에 페이지를 추가하세요.
- `assets/main.js` — 목록 렌더링, 분류 필터, 최근 플레이, 테마 전환
- `games/` — 게임 페이지

## 안드로이드 앱
- 최신 APK: https://minigame-lyart.vercel.app/download/minigame-center.apk
- `android/` — 웹 파일을 앱 안에 넣어 WebView로 띄우는 앱 프로젝트입니다. 오프라인에서도 동작합니다.
- 빌드: Android SDK(플랫폼 35, build-tools 35.0.0)와 JDK 17 이상이 필요합니다.
  1. `android/local.properties`에 `sdk.dir=<SDK 경로>`를 적습니다.
  2. 서명 키가 있으면 `android/keystore.properties`에 `storeFile`, `storePassword`, `keyAlias`, `keyPassword`를 적습니다. 없으면 디버그 키로 서명됩니다.
  3. `cd android && ./gradlew assembleRelease`를 실행합니다. 결과물은 `android/app/build/outputs/apk/release/app-release.apk`입니다.
- 앱을 업데이트하면 `android/app/build.gradle.kts`의 `versionCode`를 1 올리고, 처음과 같은 서명 키로 빌드해야 기존 앱 위에 설치됩니다.
