# Aeronaut

Webový letecký simulátor. Spustit hru: **https://dalikjebuh-coder.github.io/aeronaut/**. Bez účtu aplikace a serverové databáze.


## Sdílení jedním odkazem

Kolegové otevřou veřejný odkaz v prohlížeči na telefonu nebo PC. Mapový token nasazené verze se předává automaticky přes nastavení publikování. Postup pro aktualizace, mapové připojení a omezení veřejného tokenu je v [docs/GITHUB-PAGES.md](docs/GITHUB-PAGES.md).

## Spuštění

Vyžaduje Node.js 20.19+ (ověřeno s Node.js 24).

```sh
npm install
npm start
```

Otevři http://127.0.0.1:4387. Server naslouchá pouze na lokálním počítači. Jiný port: `PORT=4388 npm start`.

## Herní menu / dva kroky

Menu má zmenšený fotografický banner a hlavní prostor věnovaný hangáru. U letadla jsou vidět maximální herní rychlost, charakter ovládání a doporučení pro pilota. Denní doba je opět v tlačítkách a počasí ve třech obrázkových kartách; bez uložené preference jsou výchozí hodnoty Den / Jasno. Pevná spodní lišta obsahuje souhrn režimu, letadla, místa, denní doby a počasí a jediné hlavní tlačítko (Vybrat lokalitu / Vzlétnout). Ve druhém kroku je tlačítko mapy vedle textového hledání; samostatná šestá karta byla odstraněna. U časovky nahrazuje města náhled pěti bran, jejich seznam, délka a osobní rekord pro vybraný stroj a podmínky.

Příprava letu má dvě obrazovky. **01 Tvůj let** obsahuje režim (volný let / brněnská časovka), hangár se čtyřmi letadly, denní dobu a počasí. Tlačítko **Vybrat lokalitu** přejde do **02 Lokalita**; let ještě nespouští. Druhý krok nabízí Brno, Prahu, Paříž, New York a San Francisco se skutečnými fotografiemi a uvedením autorů a licencí. Potom tlačítko **Vzlétnout** spustí přímo let. Zpět nebo Esc vrátí první krok a zachová volby.

**Vlastní lokalita** otevře stávající Cesium mapu přes celou obrazovku, bez vytváření druhého 3D rendereru. Tažením a kolečkem lze měnit pohled, kliknutím označit bod. Použít místo potvrdí souřadnice do druhého kroku; Zrušit / Esc zachová předchozí výběr. Potvrzení je vypnuté do prvního platného kliknutí. Pokud 3D povrch ještě není načtený, poloha se určí na elipsoidu; skutečná výška a dostupnost povrchu se ověří při startu s časovým limitem. Oblasti mezi −80° a 80° zeměpisné šířky jsou podporované.

Volný let startuje 450 m nad změřeným povrchem vybraného místa, směrem na severozápad. Časovka má vlastní pevný start před Petrovem; v jejím druhém kroku je dostupné pouze Brno a ostatní karty jsou výslovně zamčené. Radar má pevný dosah 20 km; nejsou zde ovládací prvky pro výšku, kurz ani poloměr a let nemá umělé hranice. Značka startu je vyloučená z měření povrchu a kolizí.

Pro skutečné 3D mapy je potřeba Google Photorealistic 3D Tiles (asset ID 2275207) přes Cesium ion a token s `assets:read` pro tento asset a povolenou URL aplikace, např. `http://127.0.0.1:4387`. Pro textové hledání míst token potřebuje také scope `geocode`. Vyhledávání používá Cesium ion a odesílá se až po potvrzení formuláře, nikoli při každém stisku klávesy. Výsledky jsou omezené na pět, požadavek má limit 12 sekund a staré odpovědi po změně dotazu nebo opuštění obrazovky nemohou přepsat výběr. Název vybraného výsledku se zachovává v přehledu i při startu. Atribuce poskytovatele se zobrazují u výsledků i po výběru ve scéně a při fotografování. Připojení i token fungují stejně jako dříve; mapy se streamují online. V nastavení zůstává explicitně označený offline trénink se smyšlenou krajinou, bez časovky a skutečných lokalit.

Hangáry a obrazové pozadí přípravy používají místní AI vizualizace; karty destinací skutečné fotografie. Obrázky a licence jsou evidované v [podkladech](src/images/ASSETS.md). Během letu tlačítko menu hru pozastaví; Pokračovat / Esc ji obnoví, Ukončit let odemkne novou přípravu. Herní klávesy během otevřeného menu nepohybují letadlem.

V nastavení letu lze přepínat mezi čtyřmi místně uloženými modely: [High Wing Single Light Aircraft](https://3dassets.dev/assets/aircraft-fleet-and-airfield-high-wing-single-e581e577) (`public/models/high-wing-single.glb`, CC0 1.0), [Cessna Citation](https://sketchfab.com/3d-models/1990-cessna-citation-texture-detailed-exterior-a78839624fe64900a8352cb23462350a) od BlenderCommunityHead (`public/models/citation2.glb`, CC BY 4.0), [Boeing 787-9](https://sketchfab.com/3d-models/boeing-787-9-b6711e2e698e4e469675c1154a50b7a3) od Nobilis 2 (`public/models/b789.glb`, CC BY 4.0) a [F/A-18E/F Super Hornet](https://sketchfab.com/3d-models/boeing-fa-18ef-super-hornet-f71e9fea01e24fea9b1b380161d21d38) od andertan (`public/models/fa18e.glb`, CC BY 4.0). Citation a Boeing byly [optimalizovány v God's Eye View](https://github.com/bilawalsidhu/gods-eye-view/blob/main/public/models/README.md); Super Hornet byl [upraven pro web v Airframe Archive](https://airframearchive360.com/) a pro Aeronaut byla doplněna orientace přídě. Jde o jiný model než [původně požadovaný F/A-18E s AGM-65E](https://sketchfab.com/3d-models/fa-18e-with-agm-65e-maverick-2d08fce394e24dbca103d08848a443d2), protože jeho stažení vyžaduje přihlášení ke Sketchfabu. Vybraný model se pamatuje v tomto prohlížeči. Uvedení autorů a licence CC BY 4.0 je dostupné také přímo v nastavení letu.

Google data se průběžně streamují. Aplikace nestahuje offline oblasti, neukládá 3D dlaždice do úložiště ani nemá service worker. Zachovává atribuce Cesia a Googlu. Běžnou síťovou cache řídí hlavičky poskytovatele.

V režimu Google 3D se zobrazují názvy míst z veřejné databáze [GeoNames cities15000](https://download.geonames.org/export/dump/) pod licencí [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Data byla zjednodušena na názvy, souřadnice a populaci; místní soubor `src/cities.json` obsahuje 31 765 míst včetně menších měst. Při letu se vykresluje nejvýše 36 blízkých popisků v okruhu 80 km s rozestupem alespoň 2,5 km. Každý název spojuje s polohou na mapě tenká linka se šipkou místo tečky. Databázi lze znovu vytvořit skriptem `scripts/build-cities.py` z exportu `cities15000.zip`; při letu se data nevyhledávají přes síť. Atribuce GeoNames je také v mapových kreditech.

V nastavení letu lze kombinovat denní dobu (ráno, den, podvečer, noc) s jednoduchým počasím (jasno, opar, zataženo). Opar využívá atmosférickou mlhu Cesia, zataženo tlumí osvětlení, sytost a oblohu a skrývá sluneční kotouč. Jde o vizuální režimy bez prostorových mraků, větru a vlivu na fyziku. Obě volby se ukládají v prohlížeči, zůstávají během letu stejné a platí i pro fotografie. Fotogrammetrické mapy obsahují původní denní osvětlení, proto změnu doplňuje barevné tónování scény.

## Brněnská časovka

Volba **Vyber svůj let → Časovka** přepne do Google 3D. Vyžaduje stávající připojení Cesium ion. [Brněnské památky](https://www.gotobrno.cz/wp-content/uploads/2025/04/TICBRNO_MALY-OFICIAL-2025-02-WEB.pdf) inspirovaly trasu Petrov → Špilberk → Hvězdárna na Kraví hoře → Brněnská přehrada → hrad Veveří. Souřadnice přibližují středy míst, nejde o navigační trať pro skutečné létání.

Pět svislých kruhů má poloměr 180 m a středy ve výšce 650 m nad elipsoidem WGS84. Automatický start je 900 m před Petrovem a míří do první brány; radar má dosah 20 km. Aktuální brána je žlutá, další modré a splněné zelené. HUD ukazuje další místo, kurz, vzdálenost a potřebnou změnu výšky; radar zobrazuje trasu. Průlet startem spustí čas, poslední brána jej zastaví, ostatní brány je nutné splnit v pořadí a ve směru trasy. Testuje se průnik segmentu mezi snímky s kruhovou branou včetně interpolace času, takže se počítá i rychlý průlet. Čas používá simulační sekundy; pauza a fotografování ho zastaví. Náraz ukončí pokus, R resetuje trasu i stopky. Po cíli lze dál létat.

Osobní rekord se ukládá lokálně podle verze trasy, letadla, denní doby a počasí; tyto volby jsou během pokusu uzamčené. Pro změnu herního režimu ukonči let. Brány, popisky a vodicí linie jsou vyloučené z měření povrchu a detekce kolizí. Herní prvky se při fotografování skryjí z HUD, prostorové brány zůstávají ve scéně.

## Ovládání

Šipka nahoru: klesání, šipka dolů: stoupání. Vlevo/vpravo nebo A/D: náklon a zatáčení. W/S: výkon a rychlost podle vybraného letadla, nejvýše 900 km/h. C: pohled zezadu / z kabiny. P nebo mezerník: pauza. R: nový start. Na dotykových zařízeních jsou tlačítka pod přístroji. Ztráta zaměření okna pozastaví let. Pohled z kabiny je výhled pilota bez modelovaného interiéru.

Při pozastavení se v informačním boxu zobrazí aktuální souřadnice letadla a odkaz do Google Map v nové kartě. Odkaz ukazuje na polohu letadla i během rozhlížení kamerou. V tréninkovém režimu je uvedeno, že souřadnice nereprezentují smyšlenou krajinu.

**Fotografický režim:** F nebo tlačítko v pauze zmrazí let a otevře focení přes celé okno. Tažením myši či prstem otáčíš kameru, kolečkem nebo posuvníkem měníš odstup. Lze nastavit šířku a náklon záběru, skrýt letadlo i názvy míst. H skryje panel; obnoví jej H nebo plovoucí tlačítko. Enter / Uložit snímek PNG vytvoří obrázek bez herních panelů; poslední snímek zůstane dostupný pod odkazem ke stažení. Snímek používá rozlišení aktuálního 3D plátna a přidává pod obraz údaje o poskytovatelích právě zobrazených mapových dlaždic, loga a autory zapnutých vrstev. Export čte vykreslený snímek přímo po renderu a nevyžaduje trvalý preserveDrawingBuffer. Esc / F se vrátí do pauzy; P pokračuje v letu. Původní zorný úhel a viditelnost popisků se obnoví.

Každý model má vlastní herní nastavení řízení, setrvačnosti, odezvy motoru, zrychlení a rychlostí. Jde o zjednodušené profily pro hraní; uvedené hodnoty nejsou specifikace skutečných letadel. Volba modelu mění letové vlastnosti ihned, nový start a restart použijí jeho vlastní počáteční rychlost. Podmínky přistání se zobrazují v pilotní příručce pro aktuální model.

| Letadlo | Chování | Maximum | Vzlet od | Přistání |
| --- | --- | --- | --- | --- |
| Hornoplošník | Klidné reakce, malá rychlost | 240 km/h | 100 km/h | 85–140 km/h |
| Citation | Svižné, vyvážené řízení | 760 km/h | 180 km/h | 135–230 km/h |
| Boeing 787 | Pozvolné zatáčení, velká setrvačnost i odezva motoru | 900 km/h | 260 km/h | 210–320 km/h |
| Super Hornet | Rychlé náklony, stoupání a zrychlení | 900 km/h | 220 km/h | 160–300 km/h |

Za letu se přehrává místně uložený zvuk motoru: vrtulový zvuk u hornoplošníku, proudový u Citationu, Boeingu a Super Hornetu. Hlasitost a výška zvuku se mění podle výkonu; zvuk lze ztlumit tlačítkem nebo klávesou M. Vrtulový smyčkový zvuk je [Airplane Prop Loop](https://opengameart.org/content/airplane-prop-loop), úprava AntumDeluge podle nahrávky jakobthiesen, CC BY 3.0. Proudový podklad vychází ze spektrální obálky [Jet Engine Takeoff](https://opengameart.org/content/jet-engine-takeoff) od dklon, CC BY 3.0. Původní krátká smyčka byla nahrazena 48sekundovým ustáleným hukotem bez opakovaného průletu a s potlačenými ostrými frekvencemi. Originál je uložen jako `public/audio/jet.wav`, upravený podklad jako `public/audio/jet-cruise.wav`; lze jej znovu vytvořit skriptem `scripts/build-jet-audio.py` s NumPy. Měkký stín pod letadlem se zvětšuje a zesvětluje s rostoucí výškou nad povrchem.

Při zahájení letu, novém pokusu, dosednutí a odlepení kol zazní stejná rádiová nahrávka z `public/audio/pilot-tower-radio.mp3`. Každá událost spustí nahrávku od začátku a ukončí předchozí přehrávání. Nahrávka se načte do zvukového systému po stisku tlačítka pro start. Ztlumení, ruční pauza, havárie a opuštění letu přehrávání zastaví. Výsledek přistávací mise nechá nahrávku dohrát.

Při dosednutí a odlepení kol se kamera jemně zatřese. Nastavení Pohyb kamery umožňuje otřesy vypnout.

Modely doplňují vlastní procedurální letové efekty v `src/aircraft-effects.js`: krátké průsvitné víry od konců křídel při větším náklonu a přitažení, jemný výtok za proudovými motory, přídavné spalování Super Hornetu nad 88 % skutečného výkonu motoru, poziční světla a záblesky. Hornoplošník má animovanou vrtuli s průhledným diskem pohybového rozmazání. Dlouhé kondenzační stopy se tvoří až při rychlém proudovém letu ve velké výšce (pozvolný nástup mezi 6 500 a 9 500 m). Jde o vizuální aproximaci bez simulace vlhkosti a teploty atmosféry.

Všechny efekty používají čas letu, proto se v pauze i fotografickém režimu zmrazí. Skrytí letadla v režimu focení skryje také jeho efekty. Nový let, restart a výměna modelu odstraní staré stopy. Efekty používají dvě kolekce, pevný počet 52 světelných a motorových částic a čtyři stopy s omezenou historií; po skončení životnosti se záznamy mažou. Při nastavené preferenci omezeného pohybu se potlačí blikání světel.

## Omezení prototypu

Zjednodušený letový model s asistovaným vyrovnáváním není simulace konkrétního letounu. Na rovné ploše lze přistát a znovu vzlétnout; tvrdý nebo rychlý kontakt s povrchem ukončí pokus. Výška v přístrojích je nad elipsoidem WGS84, nikoli přesná nadmořská výška. Detekce kolizí s Google daty využívá právě načtenou scénu, je orientační a nemůže nahradit kolizní síť nebo navigační data. Radar zobrazuje stopu a polohu vůči startu, nikoli samostatnou mapovou vrstvu. Provoz potřebuje WebGL a vhodný grafický výkon.

Integraci s autentizovanými Google mapami lze plně ověřit až s platným klíčem uživatele. V repozitáři není žádný klíč. Nejde o pomůcku ke skutečnému létání.

## Kontroly

```sh
npm test
npm run check
```

Zdrojové informace: [Map Tiles API](https://developers.google.com/maps/documentation/tile/overview), [pravidla](https://developers.google.com/maps/documentation/tile/policies), [API klíč](https://developers.google.com/maps/documentation/tile/get-api-key), [CesiumJS](https://cesium.com/learn/cesiumjs/).

### Nové světové mise

Katalog nyní obsahuje 28 misí, z toho čtyři v Brně a 12 světových expedic. Expedice zahrnují osm letištních příletů a čtyři lety nad významnými místy. Letištní přiblížení se přizpůsobuje vybranému stroji. Přehled destinací, zdroje dat a rozsah ověření jsou v [dokumentaci světových expedic](docs/world-expeditions.md).

Počasí nabízí jasno s viditelným sluncem, polojasno s kupovitými mraky, opar s řídkými mraky a hustou oblačnost při zatažení. Mraky jsou vykreslované přímo ve 3D scéně v omezeném okolí kamery a doplňují se během letu; ráno a večer mají teplý odstín, v noci ztmavnou a slunce se skryje. Jde o vizuální oblačnost bez simulace vlhkosti, deště a stínů mraků na mapě.
