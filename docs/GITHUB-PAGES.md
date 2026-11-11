# Sdílení Aeronautu přes GitHub Pages

Veřejná hra: **https://dalikjebuh-coder.github.io/aeronaut/**. Repozitář: **https://github.com/dalikjebuh-coder/aeronaut**.

Hra se sestavuje do `dist/`, včetně modelů, zvuků a Cesium knihoven. Návštěvníci nepotřebují účet GitHub. Mapové připojení nasazené verze zajišťuje společný token z nastavení publikování.

## Publikování

1. Vytvoř repozitář `aeronaut`. Pro GitHub Pages na bezplatném účtu musí být veřejný; zdrojový kód a přiložené soubory pak může kdokoli číst.
2. Nahraj pouze soubory tohoto projektu. Zahrň `src/`, `public/`, `scripts/`, `tests/`, `.github/`, `.gitignore`, `package.json`, `package-lock.json`, `README.md` a dokumentaci. Nepublikuj osobní snímky `token-approval.jpg`, `connection-preview.jpg`, `preview.jpg`, interní předání `NAVAZANI.md`, `node_modules/`, `dist/` ani jiné složky z počítače.
3. V Settings → Pages nastav Source na **GitHub Actions**.
4. V Cesium ion vytvoř samostatný token pro veřejnou hru. Povol `assets:read` jen pro Google Photorealistic 3D Tiles (asset 2275207) a přidej `geocode` pro vyhledávání míst. V Allowed URLs nastav `https://dalikjebuh-coder.github.io/`. Safari u požadavků na Cesium předává doménu bez cesty `/aeronaut/`. Pokud Cesium při změně nastavení vydá novou hodnotu tokenu, aktualizuj ji také na GitHubu a spusť nové nasazení.
5. V GitHub Settings → Secrets and variables → Actions ulož tento token jako repository secret **CESIUM_ION_TOKEN**. Nikdy nepoužívej administrátorský token. Přestože vstup je GitHub secret, sestavená hra tento veřejný mapový token potřebuje v prohlížeči a návštěvníci ho mohou přečíst. Proto je omezení URL a oprávnění nutné.
6. Nahraj větev `main` nebo v Actions ručně spusť **Publish Aeronaut to GitHub Pages**. Pracovní postup ověří hru, sestaví ji a publikuje. Finální adresu potvrdí výsledek úlohy deploy.
7. Otevři odkaz v čistém prohlížeči bez uloženého tokenu. Ověř připojení map, start mise a ovládání na telefonu i PC. Bez nakonfigurovaného tokenu stránka poběží, ale mapy budou dál vyžadovat připojení.

Další změny na větvi `main` automaticky aktualizují web. Výsledky hráče se ukládají v jeho prohlížeči a mezi zařízeními se nesynchronizují. Původní místní výsledky se na novou webovou adresu nepřenesou.

## Místní ověření sestavení

```sh
npm ci
npm run check
npm test
PAGES_BASE_PATH=/aeronaut npm run build
```

Pro vlastní doménu nebo stránku v kořeni použij `PAGES_BASE_PATH=/`. Workflow zjistí cestu automaticky přes `actions/configure-pages`.

## Cena

GitHub Pages podporuje bezplatné zveřejnění veřejného repozitáře v rámci svých limitů. Mapy se účtují a omezují samostatně přes Cesium ion; ověř plán, způsobilost a čerpání účtu před širším sdílením. Žádný placený plán nebyl v rámci této přípravy aktivován.

- https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages
- https://cesium.com/learn/ion/cesium-ion-access-tokens/
- https://cesium.com/platform/cesium-ion/pricing/
