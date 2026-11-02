# Světové expedice

Rozšíření z 2. listopadu 2026 přidává 12 misí, celkem je v katalogu 35 misí a 105 hvězd. Nové destinace se odemknou po dokončení brněnské navigační větve stejně jako dosavadní světové mise. Medaile, XP, doporučení další mise, fotografie, náhled trasy a osobní rekordy používají společný systém.

| Destinace | Úkol | Doporučený stroj |
| --- | --- | --- |
| Madeira, LPMA 05 | Pobřežní zatáčka, boční vítr, dosednutí | Citation |
| Gibraltar, LXGB 09 | Přistání a zastavení před koncem dráhy | Citation |
| Sint Maarten, TNCM 10 | Přímé finále nad mořem a pláží Maho | Citation |
| San Francisco, KSFO 28R | Dlouhé stabilní přiblížení přes záliv | Boeing 787 |
| Ósaka–Kansai, RJBB 06R | Ostrovní přílet za soumraku | Boeing 787 |
| Innsbruck, LOWI 26 | Údolní sestup a dojezd do zastavení | Citation |
| Queenstown, NZQN 05 | Zatáčka z jezera Wakatipu na finále | Hornoplošník |
| Rio–Santos Dumont, SBRJ 02R | Dosednutí v první části a krátký dojezd | Hornoplošník / Citation |
| Sydney | Přesný let nad přístavem, Harbour Bridge a Opera | Hornoplošník |
| Kapské Město | Časovka od Atlantiku ke Stolové hoře | Citation |
| Monument Valley | Nízká hlídka mezi skalními věžemi | Super Hornet / hornoplošník |
| Iguazú | Říční hlídka nad kaskádami | Hornoplošník |

Každé z osmi letišť má čtyři varianty příletu podle stroje: hornoplošník má kratší trasu, dopravní letoun delší nálet a větší brány. Dosednutí je vždy na téže skutečné dráze. Identifikátor trasy i rekord rozlišuje stroj. Doporučení letadla nebrání opakování mise s jiným odemčeným strojem; samostatné kariéry nebo nové typy cílů pro každé letadlo nejsou součástí tohoto rozšíření.

Polohy, směry, rozměry a posunuté prahy drah jsou převzaté z veřejné databáze [OurAirports](https://ourairports.com/data/) (`runways.csv`, staženo 2. 11. 2026). Brány, výšky, počasí a cílové zóny jsou autorský herní návrh, nikoli publikované letové postupy. Fotografie jsou místně uložené z Wikimedia Commons; každý obrázek má odkaz na originál, autora a licenci v `src/expedition-data.js` i přímo v nabídce hry. Zdrojové výřezy jsou `src/expedition-runways.json` a `src/expedition-places.json`; obnovení dat zajišťuje `scripts/build-expedition-assets.py`. Herní běh žádné obrázky ani data drah z těchto služeb nestahuje.

Kontrola syntaxe a všech 178 testů prošly. Testy pokrývají všech 32 kombinací letiště a stroje, vzorkování povrchu při startu, správné označení dráhy v rádiu, přistání, dojezd, skóre hlídek, kariérní odemknutí a existenci fotografií. Simulovaný rovný terén nenahrazuje ruční ověření celé trasy v Google 3D. V živém prohlížeči byla ověřena nabídka 35 misí, náhled Sydney a zadání Gibraltaru. Kompletní průlety na skutečném 3D terénu zatím nejsou ověřené.
