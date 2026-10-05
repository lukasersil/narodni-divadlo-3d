# Průběh práce – kolo „detaily a opravy podle podkladů“ (dokončeno 3. 10. 2026)

> „Koukni na celý výtvor, přidej detaily a oprav chyby – všechny nákresy a podklady jsem přikládal v prvním promptu.“

Kolo je hotové a publikované: artefakt https://claude.ai/artifact/PvU6B3GmkXCex7qjs57cfB, **verze 5** („Hlediště, foyer, fasády, kopule“); interiér doplněn ve **verzích 6 a 7**, revize před vydáním ve **verzi 8**, sedadla galerie ve **verzi 9**, vizuál značky autora ve **verzi 10**, menší písmo a skrývání panelů ve **verzi 11**, oprava blikání příček ve **verzi 12** a celého řezu ve **verzi 13** (viz níže). Model se načte bez chyb i varování v konzoli. Prověřené jsou etapy 0–7, všech 8 pohledů, rentgen se všemi vrstvami, podélný řez, noc, požár s obnovou, EN a mobil (390 × 844).

## Co se v kole změnilo

**Hlediště a interiér** (podle Fialkových plánů a řezu 1914)
- Podkova je přeměřená z plánů a patra mají výšky podle řezu 1914.
- Lóže mají příčky, sloupky a lampy. Přibyly balkony s řadami sedadel a amfiteátr II. galerie s kolonádou.
- Portál, opona, strop a lustr jsou upravené podle fotek.
- Foyer dostal lunety, Ženíškův triptych, busty, lustry a intarzovanou podlahu.
- Zadní řady II. galerie jsou oříznuté podél atiky; dřív vylézaly ven z budovy.
- Horní část zdi podkovy je ztenčená a nosníky nad hledištěm zkrácené; kvůli 3° pootočení osy vyčnívaly z atiky.
- Dvě schodiště se posunula dovnitř: v SZ pylonu (vyčnívalo z fasády) a východní boční (kolidovalo se zdí podkovy).

**Fasády**
- Západ:
  - pylon,
  - 3 obdélníková okna s římsami a malými okny nad nimi,
  - 5 obloukových oken mezi obřími polosloupy,
  - 3 obdélníková okna,
  - pole spojovacího křídla s velkým obloukovým oknem nad portálem.
  - Dál: průběžný balkon v 9,0 m, v přízemí trojice malých oken, herecký vchod, podjezd se 3 prosklenými oblouky a průjezdy v čelech.
  - Wagnerova sousoší stojí na v ≈ 11 a 47, samostatné sochy na v ≈ 5, 16,5 a 41.
- Východ:
  - arkádová galerie s 11 oblouky na štíhlých žulových iónských sloupech, s balustrádou, archivoltami, maskarony a závěsnými lampami,
  - za ní dvojice oken s lunetami a dveře,
  - nahoře balkon.
  - Hlavní patro má obdélníková okna s římsami a malými okny nad nimi.
- Sever:
  - pod lodžií je 5 otevřených oblouků do předsíně s kazetovou segmentovou klenbou, s lampami a se dveřmi na schodech,
  - pylony mají dveře s frontonem, niku, čtvercové okénko a ovál.
- Jih:
  - Prozatímní divadlo má atiku v líci fasády, balustrádu, obelisky a valbovou střechu,
  - Schulzův dům má nízkou střechu za balustrádou,
  - bez vikýřů a komínů.

**Střecha a kopule**
- Kopuli kryje kosočtverečná břidlice se světle šedými kříži místo zlatých hvězd (fotka z terasy). Mapování UV je souvislé, plášť má 12 řad.
- Vikýře: tmavé čelo, zlacený oválný rám, voluty a palmeta.
- Balustráda na patě kopule byla schovaná v římse atiky; teď stojí na ní, se zlacenými vázami v rozích.
- Na severu jsou 3 dveře z atiky na terasu. Střešní terasa je z kamenné dlažby.
- Koruna s hroty do 46,8 m.

**Dokumentace**
- README: popis modulů, textury a kredity.
- „O modelu“ v CZ i EN: fotky Palickap (CC BY-SA 3.0) a zmínka o srovnávacích fotkách.

## Navazující kolo „pokračuj s tím, co zbývá v interiéru“ (verze 6)

- **Strop hlediště**:
  - textura je narovnaná z fotky pořízené kolmo vzhůru (Dobroš, CC BY-SA 4.0), homografie podle 8 rozet na porfyrovém pásu (`ceiling_photo()` v `tools/prep_textures.py`);
  - kartuše mají světle modré nebe (posun barev jen v nenasycených pixelech uvnitř kartuší);
  - mříž má Ø 4,4 m (dřív 3 m) a nad ní je tmavý límec;
  - rozety na r 8,2 jsou tmavé se zlaceným obvodem na krémovém terči (podle fotky).
- **Parapety**: zlacený reliéf, kosočtverečná mřížka s okřídlenými génii a palmetami (balkony, I. galerie); akantové úponky s medailony (lóže v přízemí, proscéniové lóže). II. galerie má kuželkovou balustrádu.
- **Světla**: kulatá zapuštěná světla v podhledech balkonů, růžová nástěnná světla v lóžích (vrstva Osvětlení).
- **Lóže**: rudé sametové závěsy u každého sloupku se zlacenou úvazkou.
- **Varhanní lóže**: v nejvyšším patře u portálu na obou stranách zlacený rám mezi pilastry a 13 cínových píšťal.
- **Stěna nad portálem**: řada malovaných girland s červenými stuhami pod stropní římsou.
- Text hotspotu „Strop“ je upravený a v „O modelu“ je kredit fotky stropu.

## Verze 7: zrcadla a reflektory

- **Zrcadla**: v každé lóži na zadní stěně vedle dveří (na druhé straně než nástěnné světlo), zlacený rám 0,48 × 1,3 m s římsou a hřebínkem, kovové sklo odráží RoomEnvironment.
- **Reflektory** (dnešní stav, objeví se až od etapy 6; vrstva Osvětlení), černé lucerny se třmenem mířené na jeviště:
  - na trubkách před parapety u portálu: II. balkon 3 lucerny na každé straně, I. galerie 6;
  - ve II. galerii 2 stojany po 3 lucernách;
  - v nejvyšší proscéniové lóži hnízdo se 4 lucernami.
- U stojanů ve II. galerii ubylo pár sedadel v boční řadě.

## Verze 8: hloubková revize před vydáním (3. 10. 2026)

- **Tramvaje**: na křížení obou tratí u předmostí platí blokování. Souprava čeká, dokud křížení neopustí souprava druhé linky. V simulaci 20 minut provozu nedošlo k žádnému průniku a nejdelší čekání bylo 22 s včetně zastávky. Články za koncem trati se skryjí, nehromadí se v jednom bodě.
- **Jeřáby**:
  - staré měly břemeno 20 m od stožáru, tedy uvnitř budovy;
  - teď jsou to dva stiff-leg derricky mimo budovu (západní na nábřežní ulici, východní v Divadelní), usazené na terén;
  - výložník končí vně lešení.
- **Lešení** je odsazené 1,5 m od zdi a na východě 2,8 m, aby se nesrazilo s římsou, balkony, sloupy lodžie a arkádou. Kolem atiky je 1,1 m.
- **Požár**:
  - vždy na dokončené budově bez lešení a řezu; dnešní doplňky, které v roce 1881 neexistovaly (tramvaje, Nová scéna, reflektory – příznak `modern`), jsou skryté;
  - kouř startuje nad střechou;
  - nové spuštění během obnovy vrátí střechu;
  - obnova respektuje rentgen.
- **Opravy z kontroly kódu**:
  - Play uprostřed přechodu pokračuje od aktuálního času;
  - řez při průjezdu přes etapy 5–6 nebliká;
  - nulová velikost okna nespamuje chyby WebGPU;
  - karta hotspotu se zavře, když hotspot nepatří do režimu nebo etapy;
  - lanka tahů provaziště během spouštění končí u roštu.
- **Mobil a přístupnost**:
  - karty mají border-box, karta požáru nepřekrývá časovou osu;
  - na telefonu je jen rok aktuální etapy;
  - O modelu má fokus a past na Tab, Esc vrací fokus;
  - větší dotykové cíle hotspotů.
- **Texty** (korektura proti podkladům):
  - lustr: významově obrácená věta o halogenech;
  - „skrápěcí (drenčerové) zařízení“;
  - „foyeru“;
  - točna bez rozporu 14 m vs kazeta;
  - nosníky v minulém čase;
  - deska „pod zdmi“;
  - Tulkovy lunety;
  - kotelna v krytém dvoře;
  - strojovny VZT;
  - EN časy a formulace;
  - popisky jezdců řezu s desetinnou čárkou;
  - EN popisek fotky požáru a chybová hláška;
  - „Od řeky“, „Dome“, „Ceiling and chandelier“;
  - „O modelu“ už netvrdí „skutečný postup stavby“.
- **Detaily**:
  - lyry s palmovými ratolestmi ve cviklech východní arkády;
  - Myslbekovo sousoší Opery a Činohry nad hereckým vchodem;
  - kandelábry v Divadelní posunuté od arkády.

## Verze 9

- Sedadla boční řady II. galerie u portálu jsou zpět v historických etapách. Zmizí až při přechodu do dnešního stavu (T ≈ 6,35–6,4), těsně předtím, než se na jejich místě objeví stojany s reflektory (T ≈ 6,58). Jde o samostatné instance s `remove: 6`.

## Promo video (3. 10. 2026)

- **Výstup**:
  - `video/narodni-divadlo-promo.mp4` (master, CRF 18);
  - `video/narodni-divadlo-promo-web.mp4` (CRF 23);
  - obě 1920 × 1080, 30 fps, 65,9 s, bez zvuku; od verze 12 natočené ve 4K a zmenšené.
- **Vzhled (od verze 11 aplikace)**:
  - titulky jsou černý box se žlutým pruhem vlevo, nadpis je v Bebas Neue, podtitulek v DM Sans;
  - úvodní a závěrečná karta: ztmavená scéna, velký nadpis s jedním žlutým slovem, žlutá linka, závěrečná výzva ve žlutém obdélníku;
  - klik je žlutý kruh.
- **Vodoznak**: vpravo nahoře černý box s kruhovou fotkou, „LUKÁŠ ERŠIL“ a „@lukasersil“. Autor v hlavičce aplikace je ve videu skrytý, aby jméno nebylo na obrazovce dvakrát. Lišta a boční panel jsou posunuté pod vodoznak.
- **Scény**:
  1. titulek a otáčení;
  2. stavba 1868–1883;
  3. hlediště, strop a lustr;
  4. řez;
  5. rentgen přímo v řezu: vzduchotechnika, elektro, osvětlení, jevištní mechanizace a požární bezpečnost postupně, pak všech 10 vrstev;
  6. noc z řeky;
  7. požár 1881;
  8. obnova, hotspot a EN;
  9. závěrečná karta.
- **Natáčení**: skripty jsou v `.playwright-mcp/promo/` (nepublikovat). Playwright s falešnými hodinami snímá snímek po snímku.
  - `setup.js` otevře stránku 1920 × 1080 a vloží titulky a vodoznak.
  - `sN.body.js` jsou scény a `python3 mk.py sN 0` z nich sestaví `sN.js` s knihovnou `lib_fn.js`.
  - Scéna se spouští přes `browser_run_code_unsafe`: fetch `http://localhost:5173/.playwright-mcp/promo/sN.js` + `eval`.
  - Bez Playwright MCP stačí `node render.cjs` (Chrome přes playwright-core z npx cache, spustí `setup.js` a scény 1–9 za sebou, ve 4K asi 18 minut).
  - Snímky jdou do `OUT` v `lib_fn.js`. Je to dočasná složka, před dalším renderem ji změnit.
- **Střih**:
  ```bash
  python3 assemble.py <složka se snímky>
  ```
  Průlet kamery západní zdí při letu do hlediště (snímky 741–749) nahradí 10snímkovou prolínačkou a zakóduje obě MP4.

## Verze 10: vizuál značky Lukáše Eršila (3. 10. 2026)

> „Potřebuji změnit font, vypadá to moc generovaně… v 3D aplikaci změň všechno s textem dle mého brandu a to samé to logo i vodoznak.“

Podklad je brand kit v `~/Desktop/personal-os/brand`, odkud se jen četlo. Platí `COLOR-ROLES.md`, `config/brand-config.md` a `brand-guide.html`.

- **Písmo**:
  - místo Cormorant a IBM Plex jsou Bebas Neue (nadpisy verzálkami, roky na časové ose, čísla hotspotů) a DM Sans (texty, ovládání);
  - obě písma jsou z Google Fonts, protože artefakt jiný zdroj písma spolehlivě nepustí.
- **Barvy**:
  - černé plochy (`rgba(0,0,0,.88)`, linky `#333`), bílé písmo, vedlejší text `#CCC` a `#999`;
  - žlutá `#FFE600` jen pro aktivní stav, Play, „Obnova 1883“, eyebrow štítky a jedno slovo v nadpisu;
  - požár má stavovou červenou `#C8102E`;
  - barvy rentgenových vrstev zůstaly, ale jen jako čtverečky v legendě, popisky jsou bílé.
- **Tvary**:
  - ostré rohy;
  - eyebrow se žlutým čtverečkem;
  - čtverečky místo teček na časové ose;
  - žluté odrážky v okně O modelu;
  - žádné rozmazané sklo ani přechody.
- **Logo**: hlavička je černý blok s eyebrow „Stavba 1868–1883 · interaktivní model“, nadpisem „NÁRODNÍ DIVADLO.“ se žlutým „DIVADLO.“ a autorem.
  - Načítací obrazovka: „NÁROD SOBĚ.“ se žlutou linkou.
- **Podpis autora**: kruhová fotka se žlutým prstencem (`assets/avatar.png`, zmenšená `profile-lukasersil-circle.png`) a vedle ní „LUKÁŠ ERŠIL“ a „@lukasersil“ podle patičky carouselů.
  - Je v hlavičce a v patičce okna O modelu („Autor modelu“ / „Model author“).
  - Na telefonu zůstává jen fotka vedle názvu.
- **Rozložení**:
  - mezi 761 a 1100 px se skryje eyebrow v hlavičce, aby nenarazila do lišty;
  - karta požáru se drží pod hlavičkou: na nízkých obrazovkách se zmenší fotka a karta se případně posouvá.
- **Ověřeno**:
  - 1280 × 760 (výchozí stav, rentgen s řezem, karty hotspotů, požár, O modelu, EN s nocí), 900 × 700, 390 × 844 a načítací obrazovka;
  - písma s českou diakritikou se načtou a konzole je bez chyb.
- **Promo video** je přetočené v novém vizuálu (viz Promo video).

## Verze 11: menší písmo a skrývání informativních panelů (3. 10. 2026)

> „Udělej ty texty menší a musí jít například spodní lišta s roky schovat včetně vykřížkování všech textů, které jsou informativní.“

- **Menší písmo**: typografická škála je v tokenech `--fs-*` na `:root`.

  | Prvek | Předtím | Teď |
  |---|---|---|
  | Název v hlavičce | 46 px | 30 px |
  | Nadpisy karet | 32–36 px | 24 px |
  | O modelu | 44 px | 34 px |
  | Text | 13,5 px | 12,5 px |
  | Ovládání | 13 px | 12 px |
  | Eyebrow | 11 px | 10 px |
  | Roky na ose | 15 px | 13 px |
  | Tlačítko Play | 44 px | 38 px |

  Panely, avatar a hotspoty se zmenšily úměrně.
- **Zavírání a skrývání**:
  - popis etapy má křížek a vpravo na časové ose přibylo tlačítko „i“, které ho ukáže a skryje;
  - během požáru stejně funguje karta požáru, která má také křížek;
  - šipka vpravo na časové ose sbalí celou spodní lištu i s popisem do záložky „Časová osa“ vlevo dole;
  - karty nad lištou (hotspot, požár) se po sbalení posunou níž (`--above-tl`);
  - panel s pohledy a vrstvami jde sbalit tlačítkem ☰ i na počítači, v rentgenu a řezu se sám otevře.
- **Renderer**: údaj „Renderer: WebGPU“ zmizel z hlavní obrazovky a je dole v okně O modelu.
- **Ověřeno**:
  - 1280 × 760: výchozí stav, zavřený popis, čistý pohled bez lišty a panelu, požár s křížkem a návratem přes „i“, karta hotspotu, rentgen s řezem, O modelu;
  - 390 × 844: stejné ovládání, žádné vodorovné posouvání;
  - konzole je bez chyb.

## Verze 12: blikání v řezu (5. 10. 2026)

> „Jsou tam poblikající části například v řezu. Koukni na to a oprav to.“

- **Příčina**:
  - vnitřní příčky (`partitions.js`) byly 4 334 kvádry a obrys každé zdi tvořila řada dotýkajících se obdélníků (přes 4 500 společných stěn);
  - řez ukazuje vnitřek zdí jako tmavou výplň (poché, zadní strany ploch);
  - na každém styku ležela tmavá vnitřní plocha jednoho kvádru přesně na světlé ploše sousedního a grafická karta mezi nimi při pohybu kamery přeskakovala (z-fighting), takže se objevovalo černobílé šrafování.
- **Oprava**: obdélníky jednoho podlaží se slučují do jednoho uzavřeného tělesa.
  - Postup: mřížka přes hrany obdélníků, každá buňka má výšku zdi, které patří.
  - Zůstávají jen vnější stěny a horní a spodní plocha.
  - Síť je vodotěsná, bez T-spojů: hrany na každé linii mřížky sdílejí stejné vrcholy a svislé stěny jsou dělené v každé výšce zdí podlaží. Jinak by na hranách svítily jednotlivé pixely.
  - Kontrolní skript: 0 nenavázaných hran ve všech 7 tělesech, plochy míří ven, objem sedí s daty.
  - Obě podlaží přízemí (2,2 m a 2,96 m) se dotýkají, proto tvoří jedno těleso s různou výškou zdí.
  - Tělesa jsou 1 cm nad stropem a 2 cm pod stropem nad sebou, aby se nepotkala s deskou ani s podlažím nad nimi.
  - Příčky vyrůstají po podlažích (dřív po jednotlivých kvádrech) a dál se omítají spolu s cihlovými zdmi (interior.js).
  - Počet trojúhelníků: 93 tisíc (dřív 52 tisíc v kvádrech).
- **Ověřeno**:
  - stejný záběr řezu s kamerou posunutou o 0, 3 a 6 cm: dřív se šrafování pokaždé měnilo, teď jsou tmavé plochy stálé;
  - mapa problikávajících pixelů v průletu řezem: velké plochy v příčkách zmizely;
  - stavba (cihly, omítka), rentgen, konzole bez chyb.
- **Pozor:** blikání mimo příčky (zdi na deskách, foyer a další) tahle verze neopravila, viz verze 13.
- **Video**:
  - natáčí se v dvojnásobném rozlišení (3840 × 2160, `deviceScaleFactor: 2`) a `assemble.py` ho plošným filtrem průměruje na 1080p;
  - tenké detaily (sedadla, zábradlí, lustr) se při pohybu netřpytí;
  - render se v závěrečné kartě přerušil, takže je karta o 0,4 s kratší a video má 65,5 s.

## Verze 13: blikání v řezu, úplná oprava (5. 10. 2026)

> „Vždyť to tam pořád bliká v tom řezu.“

Verze 12 opravila jen příčky. Zbytek blikání byl chybně připsán pohybu kamery, protože kontrola měřila jen rozdíly mezi snímky videa.

- **Nová kontrola** (`zfight.cjs`, Chrome přes playwright-core):
  - stejný záběr se vykreslí třikrát, s blízkou rovinou kamery 0,5, 0,5007 a 0,4993 m;
  - poloha ploch na obrazovce se tím nemění, změní se jen pixely, kde se dvě plochy přou o stejnou hloubku (z-fighting);
  - pro shluky takových pixelů se vystřelí paprsek a vypíšou se plochy do 4 mm od první (objekt, materiál, líc nebo rub, poloha);
  - testuje se 17 záběrů řezu: všechny záběry řezu z videa, pohled shora, foyer, jižní část, vodorovný řez 9 m a 14 m, hlediště zblízka.
- **Nález**:
  - před opravou 500 až 7 000 blikajících pixelů na záběr v souvislých plochách;
  - zeď hlediště stojí přesně na betonové desce, základové zdi na podkladní desce, pásy zdiva na sobě;
  - okenní rámy jsou přesně v líci fasády, dveře, pilastry a hlavice ve foyer přesně na stěně;
  - zlacený pás IV. pořadí je přesně ve výšce stropu, světlíky na hřebeni střechy, štít malířského sálu pod měděnou plochou;
  - zrcadla v lóžích jsou 1 až 1,5 mm od stěny.
- **Oprava**:
  - **Obrácený hloubkový buffer s plovoucí čárkou** (`reversedDepthBuffer: true`): přesnost ≈ 0,01 mm i na 100 m (dřív ≈ 1 mm), takže plochy pár milimetrů od sebe už neblikají.
  - **Vnitřek zdí jako dvojče**:
    - materiály zdí (cihla, omítka, kámen, bosáž, beton, lomový kámen) kreslí jen líc, stíny dál z obou stran;
    - `addSectionInsides()` přidá každé takové zdi dvojče se stejnou geometrií, které kreslí jen rub jednou tmavou barvou;
    - v rentgenu se dvojče schová (registry.js).
  - **Pořadí při shodné hloubce** přes hardwarový posun hloubky (polygon offset), který nechává grafické kartě rychlý časný test hloubky:
    - vnitřek zdi +256, detaily 0, líc zdí (včetně obkladu foyer a stěn lóží) −64 jednotek;
    - s plovoucí hloubkou to odpovídá zhruba 0,6 až 2 mm na 60 m a roste to se vzdáleností;
    - tmavý řez tak vždy zakryje plochu ležící na něm a rám nebo štuk vždy zakryje zeď, na které leží;
    - záložní WebGL 2 bez obrácené hloubky používá −8 a +2 jednotky.
  - **Geometrie**:
    - dveře, sklo, pilastry a hlavice ve foyer 1 cm od stěny (sklo mezi dveřmi a soklem);
    - zlacený pás IV. pořadí 1 cm pod stropem;
    - světlíky Prozatímního divadla 1 cm nad hřebenem;
    - štít malířského sálu 2 cm pod měděnou plochou atiky.
- **Ověřeno**:
  - po opravě 2 až 14 osamocených pixelů na záběr (ze 2 milionů), žádný shluk, paprsky nenašly žádnou dvojici ploch ve stejné hloubce;
  - zbytek jsou jednotlivé body na průsečnicích ploch;
  - exteriér, rentgen i s vrstvou konstrukce, stavba s řezem, noc a požár vypadají jako dřív, konzole bez chyb (jen chybějící favicon lokálního serveru).
- **Výkon** (medián, 1920 × 1080, bez post-processingu):
  - pohled na budovu 43,6 ms (dřív 47,9 ms), řez 52,8 (47,4), ulice 46,5 (41,2), hlediště 38,1 (33,7);
  - první pokus s hloubkou počítanou v shaderu byl až 3× pomalejší, protože vypínal časný test hloubky; proto vznikla dvojčata.
- **Video** je natočené znovu v jednom běhu (`render.cjs`, 4K → 1080p, celých 65,9 s).
  - Porovnání stejných šesti snímků ze scény s řezem: ve verzi 12 se ve foyer střídala dveřní plocha se stěnou, teď je obraz stálý.

## Náměty na další kolo (nic z toho není rozbité)

- Východní atika: případný předsazený blok se 4 okny na v ≈ 31–42 (jistota podkladů je nízká).
- Západ: boční rizality vystupují asi o 1 m. Teď jsou v líci, protože by šlo o zásah do `FP.main`.
- Reliéfy ve cviklech arkád (lyry s palmami) a maskarony jsou zatím jen bloky.

## Jak navázat

```bash
cd ~/Documents/narodni-divadlo-3d && python3 serve.py
```

- Model běží na http://localhost:5173. Kontrola probíhá v prohlížeči Playwright (1280 × 760).
- Při focení skrýt tramvaje (`__nd.scene.getObjectByName('trams').visible = false`), jinak projíždějí před kamerou.
- Pomůcky: obsah `tools/qa/browser_snippets.js` (`__qa.secView()`, `__qa.ortho('west')`, `__qa.vp(...)`, `__qa.reset()`).
- Překryv řezu s výkresem 1914:
  ```bash
  python3 tools/qa/section_overlay.py <render.png> <out>
  ```
- Překryv s půdorysy:
  ```bash
  OUT=<out> SC=60 python3 tools/qa/plan_overlay.py <1–7> <crop>
  ```
- Po změně výšek podlaží nebo výjimek přegenerovat příčky:
  ```bash
  ND_DEBUG=/tmp/nd_dbg python3 tools/prep_partitions.py
  ```
- Publikace: `index.html` s mapou `files` = všechny `src/**`, nové `assets/*` přidat jmenovitě. Nepublikovat `tools/` ani `.playwright-mcp/`.
