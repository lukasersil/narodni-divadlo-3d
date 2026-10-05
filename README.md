# Národní divadlo 3D

Interaktivní 3D model historické budovy Národního divadla v Praze (Three.js r186, WebGPU s automatickým přepnutím na WebGL 2).

Model ukazuje stavbu v sedmi etapách s plynulými přechody: základy, zdivo, střechu a kopuli, fasádu se sochami, interiéry, jevištní techniku a dokončenou budovu. Obsahuje rentgenový režim s 10 vrstvami technických systémů, podélný a vodorovný řez, den a noc, epizodu požáru z roku 1881 a klikací hotspoty v češtině i angličtině.

- **Živá ukázka:** https://claude.ai/artifact/PvU6B3GmkXCex7qjs57cfB
- **Autor:** Lukáš Eršil (@lukasersil)
- **Licence:** kód je pod licencí MIT. Podklady a textury mají vlastní licence, viz [Licence a další vývoj](#licence-a-další-vývoj).

> **English:** An interactive 3D model of the National Theatre in Prague (Three.js r186, WebGPU with a WebGL 2 fallback). It shows the construction in seven phases, an X-ray view with 10 building-services layers, long and horizontal sections, day and night, the 1881 fire and hotspots in Czech and English. Run `python3 serve.py` and open http://localhost:5173. There is no build step and nothing to install. The code is MIT-licensed; the source data and photo textures keep their own licences (CC BY, CC BY-SA, ODbL, see below).

## Spuštění

```bash
python3 serve.py
```

Pak otevřete http://localhost:5173. Server obalí `index.html` stejnou kostrou, jakou přidává hostitel artefaktu (doctype, meta viewport).

Stačí Python 3 a aktuální Chrome, Edge nebo Safari. Nic se neinstaluje ani nesestavuje, three.js se načítá z jsDelivr a písma z Google Fonts.

## Ovládání

- **Časová osa** dole: etapy stavby, posuvník a Play, které projde celou stavbu s přelety kamery.
- **Exteriér / Rentgen**: Rentgen zprůhlední plášť a ukáže vrstvy. Panel s pohledy, řezem a vrstvami je vpravo a tlačítko ☰ ho sbalí. Na mobilu je panel sbalený.
- **Řez**: podélný řez osou budovy (jako historický výkres) a vodorovný řez. V etapách interiéry a jeviště se zapne sám.
- **Noc**: noční nasvícení fasády, okna a kandelábry.
- **Požár 1881**: požár kopule a její zřícení. Tlačítkem „Obnova 1883“ se budova zase postaví.
- **CZ / EN**, **O modelu** (zdroje, licence, autor a renderer).
- **Skrytí textů**: popis etapy (při požáru karta požáru) se zavře křížkem a tlačítkem „i“ na časové ose se vrátí. Šipka vpravo na časové ose sbalí celou lištu i s popisem do záložky „Časová osa“ v rohu. Karta hotspotu se zavře křížkem.

## Struktura

| Soubor | Obsah |
|---|---|
| `index.html` | rozhraní, styly ve vizuálu značky autora, importmap (three z jsDelivr) |
| `src/main.js` | renderer (obrácený hloubkový buffer s plovoucí čárkou), kamera, světla, obloha, řezy (ClippingGroup), bloom (RenderPipeline + MRT), hlavní smyčka |
| `src/core/registry.js` | stavební hodiny T (0–7): každý díl má etapu, pořadí a režim animace (rise / grow / drop / slide / appear), chování v rentgenu a vrstvu; díly s příznakem `modern` (tramvaje, Nová scéna, dnešní reflektory) se při požáru 1881 skryjí |
| `src/core/materials.js` | procedurální textury (pískovec, bosáž, cihly, kosočtverečná břidlice se světlými hvězdami, měď, žula, mramorování a intarzie foyer), TSL efekty (noc, rentgen, proudění); tmavé poché v řezu: zdi kreslí jen líc a `addSectionInsides()` jim přidá dvojče s vnitřkem, pořadí při shodné hloubce řeší hloubkový posun (vnitřek zdi > detaily > líc zdi) |
| `src/core/geom.js` | polygony, stěny, tažené římsy, loft kopule, trámy |
| `src/config.js` | rámec budovy B (u východ, v jih, azimut 353,6°), osa hlediště `AXIS` (pootočená o 3°, viz níže), výšky, půdorysy, rozměry jeviště |
| `src/site.js` | terén, Vltava, nábřeží, ulice, most Legií, okolní budovy, stromy |
| `src/trams.js` | tramvajové koleje (Národní, most Legií, nábřeží) a jezdící soupravy 15T se zastávkou u divadla; na křížení obou tratí soupravy čekají, dokud ho druhá linka neuvolní; za koncem trati se články skryjí; jen v dnešním stavu, v noci svítí |
| `src/building/shell.js` | základy, zdivo, kamenný plášť, římsy, atika, kopule (kostra, břidlice, koruna, vikýře), střechy, předsíň pod lodžií (otevřené oblouky), jižní křídlo (atika Prozatímního divadla, Schulzův dům) |
| `src/building/facade.js` | okna s dělením po fasádách (západ: boční rizality, pět obloukových oken mezi polosloupy, průběžný balkon, podjezd; východ: arkádová galerie se žulovými sloupy a balkonem), pilastry, lodžie se sloupy, předsíň s kazetovou klenbou, balustrády, sochy (Wagnerova sousoší), trigy, kandelábry |
| `src/building/scaffold.js` | lešení (odsazené tak, aby nekolidovalo s římsou, balkony ani východní arkádou) a dva dřevěné derrickové jeřáby stojící mimo budovu, usazené na terén |
| `src/building/interior.js` | hlediště (podkova přeměřená z plánů, lóže s příčkami a sloupky, balkony, amfiteátr II. galerie), strop, lustr, portál „Národ sobě“, opona, foyer (lunety, triptych, busty, intarzie), schodiště s rameny, madly a vřeteny (polohy z Fialkových plánů) |
| `src/building/partitions.js` | vnitřní příčky všech podlaží, vektorizované z Fialkových plánů 1883; obdélníky jednoho podlaží jsou sloučené do jednoho uzavřeného tělesa bez vnitřních ploch (jinak v řezu blikaly) |
| `src/building/sculpture.js` | geometrie soch, múz, pěvců a trig |
| `src/building/stage.js` | zvedací stoly, orchestřiště, točna, provaziště, tahy, osvětlovací most, železné opony |
| `src/building/systems.js` | rentgenové vrstvy: VZT, elektro, voda, požární ochrana, osvětlení, komunikace, zákulisí, energetika |
| `src/fx/fire.js` | požár 12. 8. 1881: vždy na dokončené budově (bez lešení a dnešních doplňků), zřícení střechy, obnova 1883 |
| `src/data/content.js` | texty etap, vrstev a hotspotů (CZ/EN) |
| `src/data/site.js`, `src/data/partitions.js` | vygenerovaná data (neupravovat ručně) |
| `tools/prep_data.py` | generátor `site.js` z podkladů (vyžaduje numpy, pyproj, shapely, Pillow) |
| `tools/prep_partitions.py` | vektorizace a zaregistrování Fialkových plánů na obrys RÚIAN → `partitions.js`; vynechává části, které model staví sám (hlediště, jeviště, zadní jeviště, foyer, lodžii, prostor nad terasou). Vyžaduje numpy, scipy, scikit-image a Pillow; ladicí překryvy ukládá do `ND_DEBUG`. |
| `tools/prep_textures.py` | textury interiéru (`assets/tex_*.jpg`) z fotografií a ilustrací v podkladech (opona, strop hlediště narovnaný z fotky, zlacené reliéfy parapetů, strop foyer a lunety); jednotlivě např. `python3 tools/prep_textures.py ceiling_photo` |
| `tools/qa/` | kontrolní skripty: překryv modelu s Fialkovými půdorysy a s řezem 1914, měření podkovy, kamerové pomůcky pro prohlížeč (`browser_snippets.js`) |
| `assets/` | historické ilustrace (volné dílo) pro karty hotspotů, textury interiéru `tex_*.jpg`, `avatar.png` (fotka autora v hlavičce a v okně O modelu) |

## Vzhled

Rozhraní má vizuál značky autora (Lukáš Eršil, `@lukasersil`):

- černé plochy, bílé písmo a jediná žlutá `#FFE600` pro aktivní stav, hlavní tlačítko a jedno slovo v nadpisu;
- nadpisy v Bebas Neue verzálkami (řádkování nejméně 1,0 kvůli české diakritice), texty v DM Sans; obě písma se načítají z Google Fonts (SIL Open Font License);
- ostré rohy a eyebrow štítky se žlutým čtverečkem;
- místo loga kruhová fotka autora se žlutým prstencem v hlavičce a v okně O modelu.

Barvy vrstev v rentgenu zůstaly barevné, protože rozlišují 10 vrstev v modelu. Požár používá červenou stavovou barvu značky `#C8102E`.

## Licence a další vývoj

- **Kód** (`index.html`, `src/`, `tools/`, `serve.py`) je pod licencí MIT (soubor `LICENSE`). Můžete ho volně používat, upravovat i šířit, zachovejte jen jméno autora a text licence.
- **Podklady, textury z fotografií a mapová data** si nechávají své licence (CC BY 4.0, CC BY-SA 3.0/4.0, ODbL), viz níže. Při dalším šíření je uveďte. Úpravy textur pod CC BY-SA šiřte pod stejnou licencí.
- **Fotka autora** (`assets/avatar.png`) a jeho jméno v hlavičce patří k podpisu tohoto modelu. Pokud model šíříte jako vlastní dílo, nahraďte je.
- **Nástroje** v `tools/` čtou zdrojové podklady ze složky `~/Documents/narodni-divadlo-podklady`, která v repozitáři není. Hotová data jsou v `src/data/`.
- Průběh práce a rozhodnutí jsou v `PRUBEH_PRACE.md`.

## Podklady a licence

Podklady jsou ve složce `~/Documents/narodni-divadlo-podklady` (README a soubory ZDROJE.md).

- Půdorys: RÚIAN, ČÚZK (CC BY 4.0). Výšky, okolí a terén: IPR Praha, Budovy 3D a výškové rastry (CC BY 4.0). Řeka, most a ulice: © přispěvatelé OpenStreetMap (ODbL).
- Dispozice: J. Fialka, půdorysy a podélný řez (Šubert 1883), řez z Architektonického obzoru 1914 (volné dílo).
- Technika: technická dokumentace ND, seriál TOPIN (V. Mužík), ENESA a ND. Čísla jsou převzatá, texty vlastní.
- Ilustrace v `assets/`: Šubert 1881/1883, Světozor (volné dílo).
- Textury z fotografií (Wikimedia Commons): opona – Lehotsky (CC BY-SA 3.0); strop hlediště – Dobroš (CC BY-SA 4.0), fotka pořízená kolmo vzhůru a narovnaná homografií podle osmi rozet; strop foyer a lunety – Palickap (CC BY-SA 3.0). Malby samotné jsou volné dílo. Zlacené reliéfy parapetů a girlandy nad portálem jsou kreslené procedurálně.
- Fasády, střecha a kopule jsou porovnané s fotografiemi v `03_exterier_reference/` (autoři a licence v ZDROJE.md).

## Osa hlediště a jeviště

Hlediště a jeviště jsou souměrné podle Zítkovy osy. Ta je vůči rámci budovy pootočená o 3° a v polovině hlediště leží asi 0,5 m východně od středu rámce, uprostřed mezi bočními fasádami. Hodnoty vycházejí z Fialkových plánů zaregistrovaných na obrys RÚIAN a souhlasí se směrem hřebene kopule v OSM. Všechno, co k ose patří, je ve skupině `ctx.audRoot`: hlediště, portál, opony, jevištní věž, technika jeviště, komory VZT pod hledištěm a podélný řez. Plán: proscénium 36,6 m od severní fasády, zadní stěna jeviště 52,1 m, jeviště 21,3 m mezi zdmi a 14 m hluboké. Zadní jeviště 11 × 12 m je v bývalém Prozatímním divadle (`REAR` v config.js), v rámci budovy, ale vycentrované na osu jeviště.

Severní fasáda do Národní třídy je vůči rámci budovy pootočená o 5,3°. Foyer za lodžií je s ní rovnoběžné (`FACADE`, `facadeToB`) a začíná za vnitřním lícem obvodové zdi.

## Zjednodušení

Model je rekonstrukce v měřítku 1 : 1 z volně dostupných podkladů. Sochy, trigy, lustr a malby jsou schematické. Příčky pocházejí z plánů z roku 1883, takže neukazují pozdější přestavby (kromě zadního jeviště z roku 1983). Technické trasy jsou zakreslené podle popisu v dokumentech, ne podle prováděcích výkresů. Ty jsou jen v Archivu ND a NPÚ.
