# FlyAtlas — pilotní kariéra

## Cíl a hranice

Z 28 **aktuálně aktivních** misí vzniká souvislá kariéra. Hráč začíná jako kadet, bezpečným dokončením letů postupuje k hodnosti šéfpilota. Medaile, osobní rekordy a bonusové cíle tvoří dobrovolné mistrovství. Volný let je oddělený režim. Nepřibývá měna, inventář ani nové ovládání.

## Kapitoly a pořadí

Pořadí je v `src/campaign.js`; každý identifikátor z `MISSIONS` se v něm vyskytuje právě jednou. Výběr respektuje typ cíle a náročnost existujících tras; nepřepisuje jejich parametry.

| Kapitola | Mise v pořadí | Povýšení po dokončení |
| --- | --- | --- |
| I První křídla (1–5) | `first-takeoff`, `brno-landing`, `brno-discovery`, `brno`, `prague` | Pilot |
| II První služba (6–11) | `fuji`, `giza`, `rio`, `iceland`, `stmaarten`, `kansai` | Zkušený pilot |
| III Za hranicí komfortu (12–17) | `sf`, `paris`, `nyc`, `sydney-harbour`, `grandcanyon`, `cape-peninsula` | Velitel letu |
| IV Pod tlakem (18–23) | `canyon-patrol`, `sfo-arrival`, `queenstown`, `madeira`, `innsbruck`, `monument-valley` | Kapitán |
| V Velitelská zkouška (24–28) | `matterhorn`, `gibraltar`, `santos-dumont`, `iguazu`, `everest` | Šéfpilot |

## Herní smyčka

1. Kariérní obrazovka ukazuje **jeden další let** s fotografií, krátkou situací a tlačítkem pro briefing. Vedle je jen aktuální hodnost a kapitola. Celý seznam 28 misí a pětibodová cesta jsou v samostatném přehledu „Celá kariéra“; deník má vlastní tlačítko. Globus zůstává jen ve volném letu. Dokončené mise lze opakovat z kariérního přehledu.
2. Briefing ukazuje fotografii, konkrétní úkol, počasí, **náročnost mise** a volbu letadla před startem. Vybraný model přepočítá skutečnou trasu i náhled; zamčené modely zůstávají nedostupné. Náročnost je pouze informativní: kariérní mise si zachovávají již vyladěné trasy a žádný nový přepínač obtížnosti nevzniká. Část „Plán letu a hodnocení“ je při otevření rozbalená: trasa má mapu a čitelné body, medaile mají hranice a XP na jednom místě, dobrovolná výzva je zvlášť. Podrobná pravidla a rada instruktorky jsou až v druhém rozbalovacím bloku. V briefingu se neopakuje místo, typ mise, příběhová věta ani informace o odemčení dalšího letu.
3. Bezpečný úspěšný dolet uloží medaili a otevře první nedokončenou misi. Jedna hvězda stačí. Vyšší hvězdy ani rekord nikdy nejsou podmínkou pokračování.
4. Výsledek ukáže jen dokončenou misi, hvězdy za aktuální let a výrazné tlačítko k dalšímu briefingu. Pilotní průkaz s insignií se krátce odhalí pouze při skutečném povýšení. Nově odemčená mise se oznámí jedním řádkem. Opakování, návrat na mise a volný let zůstávají nenápadnými akcemi. Čas, body, XP, úrovně a komentář instruktorky ve výsledku nejsou.
5. Pilotní deník ukazuje hodnost, 28 letů, nejlepší medaile, rekordy zvoleného stroje a pět kapitolních odznaků.
6. Samostatná **Sbírka odznaků** v hlavní liště, herním menu a deníku ukazuje pět kapitolních odznaků a osm odznaků za letecké výkony. Má počítadlo, filtry Všechny/Získané/Chybí a u každého zamčeného odznaku krátkou podmínku. Nezískané insignie jsou černobílé a průsvitné; získané mají vlastní barevnou vektorovou grafiku. Po dokončení mise se nově získaný odznak ukáže i na výsledku. Odznaky nemění kariérní odemykání ani XP.

## Hodnosti, odměny, ukládání

Hodnost vychází z počtu úspěšně dokončených aktivních misí: 0 Kadet, 5 Pilot, 11 Zkušený pilot, 17 Velitel letu, 23 Kapitán, 28 Šéfpilot. XP z medailí zůstávají kvůli odemykání letadel, ale neurčují hodnost. Kapitolní odznak vyžaduje dokončit všechny mise v dané kapitole. Při návratu starého hráče se již hotové mise automaticky započtou; žádná medaile ani rekord se nemaže nebo nepřepisuje. Čtou se dosavadní `aeronaut.mission-medal.v2.*`, `aeronaut.mission-completed.v1.*` a existující klíče osobních rekordů. Vyřazené letištní mise se stále počítají do XP pro letadla, ale ne do 28 letů kariéry. Pokud prohlížeč uložení odmítne, výsledek to sdělí a nenabízí falešný posun.

Šest výkonových odznaků se zpětně odvozuje z hotových misí a medailí: první vzlet, první zlato, noční Paříž, boční vítr na Madeiře, náročné přistání (Innsbruck/Gibraltar/Santos Dumont) a stříbro v nízkém letu. Další dva vyžadují zaznamenanou událost: skutečný úspěšný dolet po výpadku motoru (`aeronaut.achievement.v1.engine-out`) a průlet turbulencí pod zataženou oblohou (`aeronaut.achievement.v1.cloud-turbulence`). Staré záznamy neobsahují důkaz těchto dvou událostí, proto se nepřidělují zpětně. Hra nyní nemá samostatnou bouřku ani blesky; odznak se proto přesně jmenuje „Skrz turbulenci“.

## Grafika a další produkce

Aktuální implementace používá existující místní letecké ilustrace a fotografie z projektu jako kapitlové hero obrazy a fotografie misí. Kredity fotografií jsou u misí a v dosavadních zdrojích (`src/images/ASSETS.md`, `docs/world-expeditions.md`). Šest samostatných vektorových insignií `src/images/rank-0.svg` až `rank-5.svg` ukazuje vždy **pouze dosaženou hodnost**; zlatá insignie pro povýšení je `src/images/flyatlas-wings.svg`. Portrét instruktorky má funkční monogramový fallback. Vizuální mapa kariéry funguje i bez dalších obrázků.

Pro finální art direction připravit pět sjednocených hero obrázků (fotorealistické, cinematic aviation, 16:9, tmavá navy/zlatá atmosféra, **bez textu v obrázku**):

- I: lehký cvičný letoun na ranní dráze v Brně, instruktorka v pozadí, první světlo.
- II: civilní letoun nad pobřežím a horami, služební let za úsvitu.
- III: kokpit při nočním letu nad městem, opar, navigační světla.
- IV: letoun na finále mezi horami a mořem v dramatickém počasí.
- V: letoun před himálajskou masou při východu slunce, široký finální záběr.

Další asset: portrét Evy Novotné v letecké uniformě v hangáru, přirozený výraz, fotografický realismus, čtvercový ořez, bez nápisů. Po získání práv k obrázkům stačí nahradit cesty v `src/campaign.js` a monogram v `src/campaign.css`; hra má nyní funkční zástupnou grafiku.

## Ověření

`npm run check`, `npm test`, `npm run build`. Testy kontrolují úplnost 28 misí, postupné odemykání, osm dokončených letů bez kapitánské hodnosti, migraci medailí, opakovatelnost a XP, nezměněné letové scénáře a HTML nabídku. V místním prohlížeči byla zkontrolována kariérní obrazovka, mobilní rozložení, briefing a deník. Kompletní ruční proletění všech 28 misí nad online mapami vyžaduje mapový přístup a další herní QA.
