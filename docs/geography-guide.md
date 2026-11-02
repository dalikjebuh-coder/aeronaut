# Automatické objevy a sbírka míst

Při aktivním letu se průletem místa sama vysune fotografická karta z pravého okraje. Obsahuje fotografii, název, jednu až dvě krátké zajímavosti, oblast, vzdálenost a postup ve sbírce. Není potřeba kliknout na mapu, popisek ani atlas. Karta má nadpis „Nad čím prolétáte“ a zobrazí se jen v aktuálním vodorovném okruhu 500 m od místa. Po opuštění okruhu se hned skryje, bez čekání na animaci nebo konec časovače. Nejvýše po 12 sekundách herního času sama zajede. Ze současných průletů se ukáže nejbližší místo; ostatní se nezařazují do fronty a později se nezobrazují. Získání do sbírky není závislé na zobrazení karty; všechna skutečně přelétnutá místa se uloží.

Klávesa G a tlačítko Průvodce zapínají popisky a karty; výchozí nastavení je zapnuté a uživatelská volba se pamatuje. Karty nyní fungují i v misích a na menších obrazovkách. Při pauze, v menu a při fotografování jsou skryté. Zobrazení bere ohled na reduced-motion nastavení. Pauza neposouvá dobu zobrazení ani nespouští nové objevy.

## Pevná sbírka

Atlas je dostupný tlačítkem **Sbírka** v hlavním menu, během letu a z pauzy; otevření pozastaví let. Pojmenovaná sbírka **Svět pod křídly** má 29 předem známých míst, rozdělených do oblastí. Ukazuje počet navštívených i chybějících míst, procenta a grafický postup. Lze filtrovat všechna / navštívená / chybějící, oblast a text. Nenavštívená místa mají tlumenou fotografii, název a stav CHYBÍ; zajímavosti se odemknou průletem.

Počet 29 se vztahuje pouze k tomuto katalogu. Další místa získaná z Wikipedie se zobrazují jako **bonusové objevy** a nemění jmenovatel dokončení sbírky. Není tak prezentován nepravdivý celkový počet všech zajímavostí na světě.

Každé katalogové místo má skutečnou fotografii uloženou lokálně, krátký český text a údaje o autorovi, licenci a stránce souboru. Úplný manifest je v `src/geography-places.json`. Fotografie byly získány přes volně licencované náhledy Wikipedie/Commons; Brno používá již dříve použitou panoramatickou fotografii od JiriMatejicek. Zdrojové soubory nejsou upravené; UI používá běžný ořez přes object-fit. Obnovení fotografií a autorských údajů zajišťuje `scripts/build-geography-photos.py`.

## Průlet a uchování postupu

Místo se získá při letu do 500 m ve vodorovném směru a méně než 3 km nad dostupným terénem. Vyhodnocuje se i úsek mezi vzorky polohy, aby rychlý průlet nezmizel mezi snímky. Dlouhý skok, teleport, pohyb během pauzy ani chybějící výška terénu se jako průlet nezapočítají. Souřadnice odpovídají bodu článku; nejde o přesné hranice objektu ani ověření jeho přímé viditelnosti.

Stejné místo se opakovaně nehlásí při kroužení nad ním. Při dalším příletu po opuštění okolí a nejméně 90 sekundách může znovu ukázat informaci jako známé místo; počet ve sbírce se nezvýší.

Trvalá množina navštívených identifikátorů (`aeronaut.visited.v2`) je oddělená od posledních 300 uložených popisů (`aeronaut.discoveries.v1`). Dokončení základní sbírky proto nezmizí při postupném přidávání bonusových míst. Staré záznamy se převezmou při načtení. Postup je místní pro tento prohlížeč. Selhání úložiště neblokuje hru; v takovém případě zůstává jen v paměti relace.

## Online místa a zdroje

Další místa získává veřejné [MediaWiki API Geosearch](https://www.mediawiki.org/wiki/API:Geosearch) v okruhu 10 km kolem letadla. Dávka spojuje souřadnice, úvodní texty a [PageImages](https://www.mediawiki.org/wiki/Extension:PageImages) nejvýše 20 článků. Přednost má čeština, při nedostatku výsledků se postupně doplní angličtina (označená v odkazu na zdroj). Blízké anglické duplikáty českých míst se potlačují. Popis automaticky načteného místa je zkrácen přibližně na jednu větu do 180 znaků. Fotografie se zobrazuje při dostupnosti náhledu; selhání obrázku neblokuje text ani průběh letu.

Fotografie katalogu mají ověřené autorské údaje z [Imageinfo](https://www.mediawiki.org/wiki/API:Imageinfo); online náhledy odkazují přímo na soubor a jeho autory/licenci. Texty jsou uvedené pod CC BY-SA 4.0 s odkazy na články a označením zkrácení nebo shrnutí. Fotografie mají vlastní licence, zobrazené u fotografie.

Požadavky běží postupně, nejvýše jednou za 30 sekund a po posunu o 3,5 km. Prohlížeč posílá zaokrouhlenou aktuální polohu, neposílá Cesium token ani přihlášení. Používá origin=* pro [CORS](https://www.mediawiki.org/wiki/API:Cross-site_requests) a Api-User-Agent. Cache uchovává posledních 24 oblastí. Při chybách se čekání prodlouží; požadavek má devítisekundový limit. Výpadek Wikipedie neblokuje let ani spuštění 3D map a katalogových 29 fotografií zůstává dostupných lokálně.

Scéna zobrazuje nejvýše devět popisků se vzájemným odstupem alespoň 350 m. Současné názvy měst z GeoNames jsou zachované. Popisky se vylučují z výškových a kolizních dotazů a při fotografování jsou skryté. V kabině respektují hloubku scény.

Ověření zahrnuje automatické spuštění karet, kontrolu aktuální vzdálenosti i před dalším vzorkováním, odstranění fronty, změnu fotografie a krátkého textu, filtry a přepočet chybějících míst, přechody pauza/foto, skutečné objekty Cesium, detekci průletu mezi vzorky, odmítnutí teleportu, migraci a obnovu postupu, pevný jmenovatel sbírky, lokální fotografie a jejich autorské údaje, chybu načítání fotky, CORS a živé odpovědi Wikipedie. Kontrolní přehled fotografií byl vizuálně prohlédnut. Živý WebGL render nebyl vizuálně ověřen.
