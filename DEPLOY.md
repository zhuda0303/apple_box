# 무료로 웹에 올리기 (GitHub Pages)

이 폴더는 **추가 빌드 없이** 그대로 정적 사이트로 배포할 수 있습니다.

## 1. GitHub에 저장소 만들기

1. [GitHub](https://github.com)에 로그인합니다.
2. **New repository**로 새 저장소를 만듭니다. (이름 예: `apple-box`)
3. **Public**을 권장합니다. (무료 GitHub Pages에 유리합니다.)

## 2. 이 폴더를 푸시하기

터미널에서 **이 `fruit-box` 폴더 안**에서:

```bash
git init
git branch -M main
git add .
git commit -m "Initial game site"
git remote add origin https://github.com/본인아이디/저장소이름.git
git push -u origin main
```

이미 `git init`과 커밋이 있다면 `remote add` / `push`만 하면 됩니다.

## 3. Pages 켜기

1. GitHub 저장소 **Settings** → **Pages**
2. **Build and deployment** → Source: **GitHub Actions** 선택
3. 잠시 후 **Actions** 탭에서 워크플로가 성공하면 상단에 배포 URL이 표시됩니다.

주소 형태: `https://본인아이디.github.io/저장소이름/`

## 다른 무료 호스팅

- **Cloudflare Pages**, **Netlify**: 같은 저장소를 연결하고 “빌드 명령 없음”, **publish 디렉터리**를 저장소 루트(또는 이 폴더)로 두면 됩니다.
