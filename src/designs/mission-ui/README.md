# Výběr mise — tři návrhy vzhledu

Samostatná návrhová stránka: http://127.0.0.1:4387/designs/mission-ui/index.html

- **A / Horizont**: filmový obraz, tmavý svislý seznam a zlatý akcent. Doporučený směr pro vizuálně působivou leteckou hru.
- **B / Atlas**: světlé plochy, větší fotografické řádky a jasně oddělené podrobnosti. Prioritou je klid a čitelnost.
- **C / Vektor**: tmavý technický směr s mátovým akcentem a schématem skutečné trasy. Prioritou je herní výzva.

Všechny varianty používají stejné mise a stav výběru. Přepínače A/B/C (také klávesy A, B, C) mění pouze vzhled. Funguje filtrování typu mise, svislý seznam, klávesy nahoru/dolů a tři obtížnosti. Schéma ve variantě C odpovídá vybrané variantě trasy. Tlačítko Vzlétnout demonstruje primární akci, neotevírá skutečný let. Výběr a vzhled se zapisují pouze do URL této stránky.

Hlavní hra ani její uložené volby se tímto náhledem nemění. Stránka nevyžaduje Cesium ani přístupový token. Fotografie se znovu používají ze současné hry a jejich zdroje a licence jsou dostupné pod náhledem.

Zjednodušení: bez technických údajů o výškách a průměrech bran, bez opakovaných instrukcí a odstavců. Hlavní hierarchie je mise → jedna krátká věta → podmínky a délka → obtížnost → start. Velikosti písma jsou obecně 17–22 px pro ovládání, 19–24 px pro položky a 43–78 px pro titul mise na desktopu. Svislý seznam je zachovaný ve všech návrzích.

Kontrola: syntaktická kontrola skriptu, data všech 15 misí a 45 obtížnostních variant, existence fotografií a prvků DOM, dostupnost HTML/CSS/JS z běžícího serveru. Živý vzhled v prohlížeči nebyl automatizovaně vizuálně ověřen.
