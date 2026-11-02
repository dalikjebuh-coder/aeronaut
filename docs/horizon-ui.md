# Horizont — schválený směr A

Varianta A z `src/designs/mission-ui/` je použita v hlavní aplikaci. Samostatný návrh zůstává dostupný pro srovnání. Hra nyní načítá společnou vrstvu `src/horizon.css` za původními styly.

## Rozhraní

- Hangár: fotografické náhledy vlevo, vybrané letadlo vpravo, větší názvy a stručnější doporučení. Výchozí varianta ukazuje celou fotografii letadla v hangáru s jemným odhalením při výběru. Přepínač nad snímkem umožňuje porovnat původní animovaný náhled.
- Režim: dvě velké fotografické volby, Volný let a Mise.
- Mise: fotografie přes pozadí, svislý seznam vlevo, výrazný název a krátký popis vpravo. Podmínky, délka a tři obtížnosti jsou přímo vidět; trasa a podrobná pravidla jsou rozbalovací. Hratelné jsou zatím jen Brno: Hladké přistání → Pět tváří Brna → Nad moravskými hrady. Další dvě se otevírají po dokončení předchozí mise na libovolnou obtížnost. Zamčené položky jsou průhlednější a mají viditelný zámek; ostatní světové mise zůstávají v seznamu.
- Volný let: vlevo hledání a mřížka pěti fotografických lokalit s šestou kartou pro vlastní bod na mapě. Vpravo je kompaktní vybraný start a panel podmínek. Původní fotografické karty počasí jsou zachované, vybrané volby jsou výrazně označené. Před vzletem ukazuje spodní lišta souhrn nastavení. Rozložení používá samostatný `free-flight.css`, na mobilu se bloky řadí pod sebe a tlačítko Vzlétnout zůstává dostupné.
- Let: větší přístroje a navigace. Nastavení a akce jsou v herním menu, které otevírá ikona v rohu nebo Esc; během letu se spodní lišta nezobrazuje.
- Směr letu ukazuje číslo kurzu i světovou stranu. Pokyny k další bráně, vzdálenost a změna výšky jsou u radaru; velký navigační panel pod kompasem byl odstraněn. Radar má zvýrazněnou spojnici k další bráně a popis orientace: sever nahoře, bílá šipka jako letadlo.
- Levý detailní panel průběhu mise je odstraněný. Po finále přistávací mise zůstávají v aktuálním oznámení konkrétní rychlost, maximální klesání a směr dráhy, včetně připomenutí srovnat křídla a příď. Limity odpovídají vybranému letadlu; pokyny se zobrazují do dosednutí.
- Objevovací mise vyžaduje jediný průlet žlutým kuželem nad památkou, bez čekání a omezení rychlosti. Kužel odpovídá skutečné oblasti započítání; po průletu se přesune k dalšímu cíli a navštívené místo má zelené potvrzení. Památka se okamžitě zapíše do stejné sbírky jako ve volném letu, i při vypnutém průvodci. Hláška potvrzuje výsledek a říká, ke které památce pokračovat. Duplicitní návštěvy nezvyšují počet položek sbírky.
- Kamera se chvěje pouze při prudkých manévrech nebo krátkých náhodných turbulencích. Přímý let je klidný i při vysoké rychlosti. Turbulence jsou častější při zataženém počasí, mají pozvolný průběh a nevznikají těsně nad zemí. Informační panel vysvětlí příčinu chvění; společné uspořádání hlášek zachovává viditelnost pokynů k přistání. Chvění lze nadále vypnout v menu.
- Herní menu seskupuje pokračování, fotografování a sbírku míst, nastavení a ukončení letu. V nastavení lze přepnout pohled za letadlem, vzdálenější pohled nebo pohled shora; volba se uloží v prohlížeči. Během letu přepíná tyto tři pohledy také klávesa C. P nebo mezerník pozastaví let s malým indikátorem bez otevření menu. Při pauze lze dál rozhlížet scénu tažením a přibližovat kolečkem; po havárii se zobrazí jen nový pokus a ukončení letu.
- `flight-ui-layout.js` sleduje skutečnou výšku zdrojů map. Přístroje a dotykové ovládání jim uvolňují prostor i při zalomení na menší obrazovce.
- Havárie má krátký záběr na místo nárazu s ohnivou koulí, úlomky a kouřem. Po 1,5 sekundy se ukáže nabídka dalšího pokusu. Restart i ukončení vyčistí efekt; při omezeném pohybu v systému je výbuch tlumenější a bez letících úlomků.
- Autoři modelů a fotografie jsou dostupní v rozbalovacím přehledu. Podklady map si ponechávají vlastní uvedení zdrojů.

Na menších oknech se seznam a detail mise řadí pod sebe. Na počítači zůstává samostatné posouvání seznamu i detailu. Zvýraznění je zlaté, plochy tmavě modré. Motiv respektuje omezení animací v nastavení systému.

## Zachované chování

Změny nemění letovou fyziku, modely, zvuk, trasy, bodování, uložené rekordy ani připojení map. Ovládání pauzy tažením myši a zoom zůstávají. Pohled z kabiny byl na přání uživatele odstraněn; hra používá tři vnější kamery. Automatická karta „Nad čím prolétáte“ se stále objevuje jen do 500 m a nemá frontu starých upozornění. Texty karet jsou kratší; atlas má nadále podrobnější popis.

## Ověření

- Kontrola syntaxe všech aplikačních modulů.
- Automatické testy zahrnují popisy všech 45 variant misí, postupné odemykání Brna, zamčené světové mise, obnovení uloženého postupu, rozměry zdrojů map, otevření menu ikonou a Esc, opakování klávesy, pasivní pauzu, foto režim, havárii, ukončení letu a výpočet směru a dalšího bodu mise.
- Struktura HTML: původní ID zachovaná, žádná duplicitní ID, vyvážené značky a všechny přímé odkazy na prvky nalezené.
- Ověřené odpovědi běžícího místního serveru pro hlavní stránku, styl a nový modul popisů.

Vizuálně ověřeno v místním prohlížeči při offline tréninku: běžný let bez spodní lišty a otevřené herní menu.
Rozložení nové navigace bylo vizuálně zkontrolováno na místním náhledu se stejnými styly a skutečným vykreslováním radaru. Živý let s online mapami pro tuto úpravu ověřen nebyl.

Hlášení prudkého manévru a náhodné turbulence byla ověřena při skutečném offline letu. Automatické testy ověřují klidný přímý let při všech rychlostech, chvění při prudkých změnách řízení, průběh turbulence a respektování pauzy, přistání i vypnutí chvění.
