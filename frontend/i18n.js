// English remains the source language. Capture only the initial application UI;
// user names, URDF/CSV contents and generated joint/link identifiers are never
// scanned or translated. Dynamic UI uses explicit text/attribute bindings.
const polish = {
  'MyModelRobot - Standalone URDF Viewer': 'MyModelRobot — przeglądarka robotów URDF',
  'Robot workspace': 'Edytor robota',
  'Open / import': 'Otwórz / importuj', 'Files': 'Pliki', 'Saved on this device': 'Zapis na tym urządzeniu',
  'Help and controls': 'Pomoc i sterowanie', 'Workspace tools': 'Narzędzia edytora',
  'Joints': 'Przeguby', 'Animation': 'Animacja', 'CSV needs attention': 'Sprawdź dane CSV',
  'URDF editor': 'Edytor URDF', 'Edit the definition, then apply to the preview.': 'Zmień opis, a następnie zastosuj go w podglądzie.',
  'More space': 'Powiększ edytor', 'Restore size': 'Przywróć rozmiar', 'Wrap lines': 'Zawijaj wiersze',
  'Preview up to date': 'Podgląd aktualny', 'Unapplied changes': 'Niezastosowane zmiany', 'Apply changes': 'Zastosuj zmiany',
  'Robot URDF source': 'Kod źródłowy URDF robota', 'Files & saved robots': 'Pliki i zapisane roboty',
  'URDF, STL meshes and CSV stay in this browser.': 'Pliki URDF, modele STL i dane CSV pozostają w tej przeglądarce.',
  'Open local files': 'Otwórz pliki lokalne', 'URDF and STL files': 'Pliki URDF i STL', 'Or choose a folder': 'Lub wybierz folder',
  'Select one URDF with its meshes, or add missing STL files separately.': 'Wybierz jeden plik URDF wraz z modelami lub dodaj brakujące pliki STL osobno.',
  'Robot name': 'Nazwa robota', 'Name from URDF': 'Nazwa z pliku URDF', 'Save name': 'Zapisz nazwę',
  'Save a copy': 'Zapisz kopię', 'Saved robots': 'Zapisane roboty', 'Open robot': 'Otwórz robota', 'Delete saved copy': 'Usuń zapisaną kopię',
  'Choose a saved robot': 'Wybierz zapisanego robota',
  'Applied changes update the current robot automatically. Clearing site data removes saved robots.': 'Zastosowane zmiany automatycznie aktualizują bieżącego robota. Wyczyszczenie danych witryny usuwa zapisane roboty.',
  'Examples': 'Przykłady', 'Pi robot (safe pose)': 'Robot Pi (bezpieczna pozycja)', 'Pi collision demo': 'Robot Pi — przykład kolizji',
  'Joint positions': 'Położenia przegubów', 'Joint values': 'Wartości przegubów', '{name} value': 'Wartość: {name}',
  'Drag a slider or type a value. Revolute: radians; prismatic: metres.': 'Przesuń suwak lub wpisz wartość. Przeguby obrotowe: radiany; przesuwne: metry.',
  'Detach panel': 'Odłącz panel', 'Show panel': 'Pokaż panel', 'Dock here': 'Zadokuj tutaj', 'Dock': 'Zadokuj',
  'Joint controls are detached': 'Panel przegubów jest odłączony',
  'Joint controls are in the floating panel, so you can use them alongside URDF or animation.': 'Sterowanie przegubami jest w pływającym panelu, dostępnym podczas edycji URDF lub animacji.',
  'CSV animation': 'Animacja CSV', 'Use joint names as columns, with an optional time column in seconds.': 'Użyj nazw przegubów jako nagłówków kolumn. Opcjonalna kolumna time zawiera czas w sekundach.',
  'Insert current pose as CSV': 'Wstaw bieżącą pozycję jako CSV', 'Robot poses CSV': 'Pozycje robota w CSV',
  'Paste CSV or insert a pose to begin.': 'Wklej dane CSV lub wstaw pozycję, aby rozpocząć.',
  'Paste CSV or insert the current pose to begin.': 'Wklej dane CSV lub wstaw bieżącą pozycję, aby rozpocząć.',
  'Apply CSV': 'Zastosuj CSV', 'Play': 'Odtwórz', 'Pause': 'Wstrzymaj', 'Stop': 'Zatrzymaj',
  'Previous frame': 'Poprzednia klatka', 'Next frame': 'Następna klatka', 'Add current pose': 'Dodaj bieżącą pozycję',
  'Trace a link': 'Śledź segment', 'Trace': 'Śledź', 'Clear trace': 'Wyczyść ślad', 'Frame {frame} / {count}': 'Klatka {frame} / {count}',
  'Made by': 'Autor:', 'Resize editor and preview': 'Zmień rozmiar edytora i podglądu', 'Robot preview': 'Podgląd robota',
  'Camera controls': 'Sterowanie kamerą', 'Fit robot (F when preview is focused)': 'Dopasuj widok robota (F, gdy podgląd jest aktywny)',
  'Fit robot': 'Dopasuj widok', 'Home': 'Widok początkowy', 'Zoom in': 'Przybliż', 'Zoom out': 'Oddal', 'Screenshot': 'Zrzut ekranu',
  'Move a segment with inverse kinematics; double-click a segment to start': 'Przesuń segment za pomocą kinematyki odwrotnej; kliknij go dwukrotnie, aby rozpocząć',
  'Pose tool': 'Ustaw pozycję', 'Approximate self-collision check using only URDF collision tags': 'Przybliżone wykrywanie kolizji własnych na podstawie znaczników collision w URDF',
  'Collisions': 'Kolizje', 'Place': 'Zatwierdź', 'Cancel': 'Anuluj', 'Nearer': 'Bliżej', 'Farther': 'Dalej',
  'Standard camera views': 'Standardowe widoki kamery', 'View': 'Widok', 'Custom': 'Własny', 'Isometric': 'Izometryczny',
  'Front': 'Z przodu', 'Back': 'Z tyłu', 'Left': 'Z lewej', 'Right': 'Z prawej', 'Top': 'Z góry', 'Bottom': 'Z dołu',
  'Drag to orbit · Shift / right-drag to pan · Scroll to zoom': 'Przeciągnij: obrót · Shift / prawy przycisk: przesuwanie · Kółko: zoom',
  'One finger: orbit · Two fingers: pan / zoom': 'Jeden palec: obrót · Dwa palce: przesuwanie / zoom',
  'Drag to move. Use arrow keys when focused.': 'Przeciągnij, aby przesunąć. Po zaznaczeniu użyj klawiszy strzałek.',
  'Move joint panel with arrow keys': 'Przesuń panel przegubów klawiszami strzałek',
  'Drag header to move · Resize from the corner': 'Przeciągnij nagłówek, aby przesunąć · Zmień rozmiar za narożnik',
  'Using MyModelRobot': 'Jak korzystać z MyModelRobot', 'Close help': 'Zamknij pomoc', 'Close': 'Zamknij',
  'Build and preview robots from URDF definitions and local STL meshes. Applied robots and their CSV animations are saved in this browser on this device.': 'Twórz i oglądaj roboty na podstawie opisów URDF i lokalnych modeli STL. Zastosowane roboty i ich animacje CSV są zapisywane w tej przeglądarce na tym urządzeniu.',
  'Your workspace': 'Twój obszar roboczy', 'Edit the source, then choose': 'Zmień kod, a następnie wybierz', 'or press': 'lub naciśnij',
  '. Applying keeps your camera, joint positions and CSV. Unapplied edits are marked above the editor.': '. Zastosowanie zmian zachowuje ustawienia kamery, położenia przegubów i CSV. Niezastosowane zmiany są oznaczone nad edytorem.',
  'Open a URDF with its STL files, choose a folder, or add missing meshes later. Open saved robots, rename them, or use': 'Otwórz plik URDF wraz z plikami STL, wybierz folder lub dodaj brakujące modele później. Otwieraj zapisane roboty, zmieniaj ich nazwy lub wybierz',
  'for a separate version. Warning badges indicate missing meshes.': ', aby utworzyć osobną wersję. Oznaczenia ostrzegawcze wskazują brakujące modele.',
  'Drag sliders or enter values to pose the robot. Angles are in radians and sliding distances are in metres. Choose': 'Przesuwaj suwaki lub wpisuj wartości, aby ustawić robota. Kąty podawane są w radianach, a przesunięcia w metrach. Wybierz',
  'to keep the controls visible while editing URDF or CSV. Drag its header to move, resize from the corner, or choose': ', aby zachować dostęp do sterowania podczas edycji URDF lub CSV. Przeciągnij nagłówek, zmień rozmiar za narożnik lub wybierz',
  'to return it to the tab. On phones the panel stays compact; scroll inside it for more joints.': ', aby wrócić do zakładki. Na telefonach panel pozostaje mały; przewijaj jego zawartość, aby zobaczyć pozostałe przeguby.',
  'Paste CSV with joint names as column headers, optionally starting with': 'Wklej dane CSV z nazwami przegubów w nagłówkach kolumn, opcjonalnie zaczynając od',
  'in seconds. Insert the current pose for a template. Play, step between poses, add poses, or trace a link. CSV edits save automatically; invalid CSV disables playback.': '(czas w sekundach). Wstaw bieżącą pozycję jako szablon. Odtwarzaj, przechodź między pozycjami, dodawaj je lub śledź segment. Zmiany CSV zapisują się automatycznie; niepoprawne dane blokują odtwarzanie.',
  'Pose tool (inverse kinematics)': 'Ustawianie pozycji (kinematyka odwrotna)', 'Double-click a segment, or enable': 'Kliknij segment dwukrotnie lub włącz',
  'and click one. The segment moves by its visual centre in a plane facing the camera, keeping the initial cursor offset so it does not snap when picked. Scroll or use': 'i kliknij segment. Jego środek wizualny porusza się w płaszczyźnie skierowanej do kamery. Początkowe przesunięcie względem kursora jest zachowane, więc wybranie segmentu nie powoduje skoku. Użyj kółka myszy lub przycisków',
  'Nearer/Farther': 'Bliżej/Dalej', 'to change its depth; click the preview again or choose': ', aby zmienić głębokość. Kliknij podgląd ponownie lub wybierz',
  'to keep the pose.': ', aby zachować pozycję.', 'or': 'lub',
  'restores the starting pose; Escape again exits the tool. On touch screens, enable the tool, drag a segment, then release to place it.': 'przywraca pozycję początkową; ponowne naciśnięcie Escape wyłącza narzędzie. Na ekranie dotykowym włącz narzędzie, przeciągnij segment i puść, aby zatwierdzić.',
  'IK adjusts the selected limb’s ancestor joints within their limits, keeping its branching anchor steady. Downstream joints keep their bend angles and follow the moved segment. Revolute, continuous and prismatic joints are supported. Orientation is free; joints that cannot move the centre are left unchanged. To bend an elbow, pick its forearm rather than the casing centred on its axis. A marker and outline show the target and selected segment. Unreachable targets use a best local pose and show the remaining distance. Camera movement pauses while posing; drag empty space to orbit between selections. Playback pauses when posing starts. Collision warnings remain advisory. Use the Animation tools to capture the resulting pose in CSV.': 'Kinematyka odwrotna zmienia przeguby między wybranym segmentem a nieruchomym punktem rozgałęzienia, przestrzegając ich ograniczeń. Dalsze przeguby zachowują kąty zgięcia i podążają za przesuwanym segmentem. Obsługiwane są przeguby obrotowe, obrotowe bez ograniczeń i przesuwne. Orientacja jest swobodna; przeguby, które nie mogą przesunąć środka, pozostają bez zmian. Aby zgiąć łokieć, wybierz przedramię zamiast obudowy położonej na osi przegubu. Znacznik i obrys wskazują cel oraz wybrany segment. Dla nieosiągalnego celu pokazywana jest najlepsza znaleziona pozycja i pozostała odległość. Podczas ustawiania pozycji kamera jest zablokowana; między wyborami możesz obracać widok, przeciągając puste miejsce. Rozpoczęcie ustawiania wstrzymuje animację. Ostrzeżenia o kolizjach nie blokują ruchu. Narzędzia animacji pozwalają zapisać uzyskaną pozycję w CSV.',
  'Collision warnings': 'Ostrzeżenia o kolizjach', 'Enable': 'Włącz',
  'above the preview to check shapes explicitly tagged with': 'nad podglądem, aby sprawdzać bryły jawnie oznaczone znacznikiem',
  '. Red links indicate possible overlap, and the status names the pairs. The fast check uses rotated bounding boxes, so curved and irregular shapes can give conservative warnings. Connected neighbors and fixed assemblies are ignored. Motion is never blocked.': '. Czerwone segmenty wskazują możliwe nakładanie się, a komunikat podaje ich pary. Szybki test wykorzystuje obrócone prostopadłościany otaczające, więc bryły zakrzywione i nieregularne mogą dawać nadmiarowe ostrzeżenia. Bezpośredni sąsiedzi i zespoły sztywne są pomijane. Ruch nigdy nie jest blokowany.',
  'Choose': 'Wybierz', 'Files → Pi collision demo': 'Pliki → Robot Pi — przykład kolizji',
  'to fold an arm into the torso. The Pi model includes collision shapes for its torso and complete arms.': ', aby złożyć ramię w stronę tułowia. Model Pi zawiera bryły kolizyjne tułowia i całych ramion.',
  'restores the neutral pose. Missing collision meshes produce an incomplete-check warning; visual shapes are never used as a fallback.': 'przywraca pozycję neutralną. Brak modeli kolizyjnych powoduje ostrzeżenie o niepełnym sprawdzeniu; geometria wizualna nie jest używana zastępczo.',
  'Camera and layout': 'Kamera i układ', 'Mouse:': 'Mysz:', 'Touch:': 'Dotyk:',
  'drag to orbit, Shift-drag or right-drag to pan, scroll to zoom.': 'przeciąganie obraca widok, Shift lub prawy przycisk przesuwa go, a kółko zmienia powiększenie.',
  'one finger orbits; two fingers pan and zoom.': 'jeden palec obraca widok; dwa palce przesuwają i przybliżają.',
  'centres and frames the robot;': 'wyśrodkowuje robota i dopasowuje kadr;',
  'restores an isometric view. Use the View menu for front, back, left, right, top or bottom.': 'przywraca widok izometryczny. Menu Widok udostępnia widoki z przodu, z tyłu, z lewej, z prawej, z góry i z dołu.',
  'With the preview focused:': 'Gdy podgląd jest aktywny:', 'fits,': 'dopasowuje kadr,', 'resets the view,': 'przywraca widok,', 'zoom.': 'zmieniają powiększenie.',
  'Drag the divider to resize the editor and preview. Focus it and use arrow keys for keyboard resizing.': 'Przeciągnij separator, aby zmienić rozmiar edytora i podglądu. Zaznacz go i użyj strzałek, aby zmienić rozmiar klawiaturą.',
  'expands the editor; tabs keep your draft.': 'powiększa edytor; przełączanie zakładek zachowuje szkic.',
  'Browser storage is local to this site and browser. Clearing site data removes saved robots. Screenshots capture the robot preview.': 'Dane są zapisane lokalnie dla tej witryny i przeglądarki. Wyczyszczenie danych witryny usuwa zapisane roboty. Zrzut ekranu obejmuje podgląd robota.',
  'Robot preview. Drag to orbit, Shift-drag to pan, scroll to zoom. F fits the robot.': 'Podgląd robota. Przeciągnij, aby obrócić; Shift i przeciąganie przesuwa widok, kółko zmienia powiększenie. F dopasowuje kadr.',
  'Replace the unapplied URDF edits? Apply changes first to keep them in this browser.': 'Zastąpić niezastosowane zmiany URDF? Najpierw zastosuj zmiany, aby zachować je w tej przeglądarce.',
  'Could not open example.': 'Nie udało się otworzyć przykładu.', 'Click image to close': 'Kliknij obraz, aby zamknąć',
  'Unknown or fixed joints: {names}': 'Nieznane lub nieruchome przeguby: {names}',
  'Ready to play · {poses} poses · {joints} joints · {timing}': 'Gotowe do odtworzenia · liczba pozycji: {poses} · liczba przegubów: {joints} · {timing}',
  'time in seconds': 'czas w sekundach', '0.06 s per frame': '0,06 s na klatkę',
  'Check the CSV: use joint names and equal-length rows of numbers.': 'Sprawdź CSV: użyj nazw przegubów i wierszy liczb o jednakowej długości.',
  'Click a segment to pose it. Drag empty space to orbit. On touch: drag a segment, then release.': 'Kliknij segment, aby ustawić pozycję. Przeciągnij puste miejsce, aby obrócić widok. Dotyk: przeciągnij segment i puść.',
  'Target reached': 'Cel osiągnięty', 'Best pose': 'Najlepsza pozycja', 'Solving': 'Obliczanie',
  '{name} · {state} · {distance} mm from target': '{name} · {state} · odległość od celu: {distance} mm',
  'This segment has no movable ancestors. Choose an arm or another movable segment.': 'Ten segment nie ma ruchomych przegubów nadrzędnych. Wybierz ramię lub inny ruchomy segment.',
  'IK requires a tree of joints.': 'Kinematyka odwrotna wymaga drzewa przegubów.', 'IK requires one parent per link.': 'Każdy segment musi mieć jeden segment nadrzędny.',
  'IK does not support {type} joints.': 'Kinematyka odwrotna nie obsługuje przegubów typu {type}.',
  'IK needs a valid joint axis.': 'Kinematyka odwrotna wymaga poprawnej osi przegubu.', 'IK needs valid joint limits.': 'Kinematyka odwrotna wymaga poprawnych ograniczeń przegubu.',
  'Collision check off': 'Sprawdzanie kolizji wyłączone', 'No collision shapes could be checked': 'Nie udało się sprawdzić żadnej bryły kolizyjnej',
  'No collision shapes in this URDF': 'Brak brył kolizyjnych w tym URDF',
  '{count} possible collision: {pairs}': 'Możliwe kolizje ({count}): {pairs}', '{count} possible collisions: {pairs}': 'Możliwe kolizje ({count}): {pairs}',
  'No overlaps in tagged shapes · {count} collision shapes': 'Brak kolizji oznaczonych brył · liczba brył: {count}',
  '{message} · Incomplete: {count} skipped': '{message} · Sprawdzenie niepełne: pominięto {count}',
  'Approximate rotated-box check. {warnings}': 'Przybliżony test obróconych prostopadłościanów. {warnings}',
  'Expected three finite numbers.': 'Oczekiwano trzech skończonych liczb.', 'Collision dimensions must be positive numbers.': 'Wymiary brył kolizyjnych muszą być liczbami dodatnimi.',
  'Missing or unsupported collision mesh: {file}': 'Brak lub nieobsługiwany model kolizyjny: {file}',
  'Collision mesh scale cannot be zero.': 'Skala modelu kolizyjnego nie może wynosić zero.', 'Unsupported collision geometry: {type}': 'Nieobsługiwana geometria kolizyjna: {type}',
  'Empty or invalid collision bounds.': 'Puste lub niepoprawne granice bryły kolizyjnej.',
  'Unsupported mesh: {file} (select an STL file).': 'Nieobsługiwany model: {file} (wybierz plik STL).',
  'Missing or ambiguous STL: {file}. Select its file or containing folder.': 'Brak lub niejednoznaczny plik STL: {file}. Wybierz ten plik lub zawierający go folder.',
  'Invalid mesh scale: {scale}': 'Niepoprawna skala modelu: {scale}', 'STL contains no valid triangles.': 'Plik STL nie zawiera poprawnych trójkątów.',
  'Close other MyModelRobot tabs to enable storage.': 'Zamknij pozostałe karty MyModelRobot, aby umożliwić zapis.',
  'Browser storage unavailable.': 'Pamięć przeglądarki jest niedostępna.', 'Removed from this browser.': 'Usunięto z tej przeglądarki.',
  'Robots you load are saved automatically in this browser.': 'Wczytane roboty zapisują się automatycznie w tej przeglądarce.',
  'Browser saving unavailable: {message} You can still load local files.': 'Zapis w przeglądarce jest niedostępny: {message} Nadal możesz wczytywać pliki lokalne.',
  'Select one URDF at a time, together with any STL files.': 'Wybierz jeden plik URDF naraz wraz z plikami STL.',
  'Select a URDF/XML file or STL meshes.': 'Wybierz plik URDF/XML lub modele STL.',
  '{count} STL file(s) ready. Load or paste a URDF next.': 'Pliki STL gotowe: {count}. Teraz wczytaj lub wklej URDF.',
  'Enter a valid URDF with a <robot> root.': 'Wprowadź poprawny URDF z elementem głównym <robot>.',
  'Joint {name} must reference existing parent and child links.': 'Przegub {name} musi wskazywać istniejące segmenty nadrzędny i podrzędny.',
  'Origin {attribute} needs three numbers.': 'Atrybut {attribute} elementu origin wymaga trzech liczb.', 'Mesh scale needs three numbers.': 'Skala modelu wymaga trzech liczb.',
  '{warnings} Robot saved; add missing files to complete it.': '{warnings} Robot zapisany; dodaj brakujące pliki, aby go uzupełnić.',
  'Saved “{name}” in this browser.': 'Zapisano „{name}” w tej przeglądarce.',
  'Robot loaded, but browser saving failed: {message}': 'Robot wczytany, ale zapis w przeglądarce nie powiódł się: {message}',
  '{name} copy': '{name} — kopia', 'there was something wrong with your URDF': 'Nie udało się wczytać opisu URDF.',
  'Load a local URDF and STL files, or open a robot saved in this browser.': 'Wczytaj lokalny plik URDF i pliki STL lub otwórz robota zapisanego w tej przeglądarce.',
  'Save to server': 'Zapisz na serwerze', 'Public': 'Publiczny', 'AR mode': 'Tryb AR'
};

const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const patterns = Object.keys(polish).filter(key => key.includes('{')).map(key => {
  const names = [], parts = key.split(/(\{\w+\})/);
  const expression = parts.map(part => {
    if (!/^\{\w+\}$/.test(part)) return escape(part);
    names.push(part.slice(1, -1)); return '([\\s\\S]*?)';
  }).join('');
  return { key, names, regex: new RegExp('^' + expression + '$') };
});
const semantic = new Set(['message', 'warnings', 'state', 'timing']);

export class I18n {
  constructor() {
    this.language = 'en'; this.staticText = []; this.staticAttrs = []; this.dynamic = new Map();
    try { const saved = localStorage.getItem('mymodelrobot-language'); if (saved === 'pl') this.language = saved; } catch (_) { /* The UI works without storage. */ }
  }
  t(source, params = {}) {
    const template = this.language === 'pl' ? (polish[source] ?? source) : source;
    return template.replace(/\{(\w+)\}/g, (token, name) => {
      if (!(name in params)) return token;
      const value = params[name];
      if (Array.isArray(value)) return value.map(item => semantic.has(name) ? this.message(item) : item).join(' ');
      return semantic.has(name) ? this.message(String(value)) : String(value);
    });
  }
  message(source) {
    if (this.language !== 'pl' || !source) return source;
    if (polish[source] != null) return polish[source];
    for (const { key, names, regex } of patterns) {
      const match = source.match(regex);
      if (match) return this.t(key, Object.fromEntries(names.map((name, i) => [name, match[i + 1]])));
    }
    // Diagnostics may be prefixed by a literal URDF link name or filename.
    const prefixed = source.match(/^([^:]+): ([\s\S]+)$/);
    if (prefixed) return prefixed[1] + ': ' + this.message(prefixed[2]);
    return source;
  }
  state(element) {
    if (this.dynamic.size > 100) for (const node of this.dynamic.keys()) if (!node.isConnected) this.dynamic.delete(node);
    if (!this.dynamic.has(element)) this.dynamic.set(element, { attrs: new Map() });
    return this.dynamic.get(element);
  }
  setText(element, source, params = {}) {
    this.state(element).text = { source, params };
    const translated = Object.keys(params).length ? this.t(source, params) : this.message(source);
    if (element.textContent !== translated) element.textContent = translated;
  }
  setAttr(element, attribute, source, params = {}) {
    this.state(element).attrs.set(attribute, { source, params });
    element.setAttribute(attribute, Object.keys(params).length ? this.t(source, params) : this.message(source));
  }
  init() {
    this.title = document.title;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode, source = node.nodeValue.trim();
      if (node.parentElement.closest('script, style, textarea, code, kbd, [data-i18n-skip]') || polish[source] == null) continue;
      const leading = node.nodeValue.match(/^\s*/)[0], trailing = node.nodeValue.match(/\s*$/)[0];
      this.staticText.push({ node, source, leading, trailing });
    }
    document.querySelectorAll('[title], [aria-label], [placeholder]').forEach(node => {
      if (node.closest('[data-i18n-skip]')) return;
      for (const attribute of ['title', 'aria-label', 'placeholder']) {
        const source = node.getAttribute(attribute);
        if (polish[source] != null) this.staticAttrs.push({ node, attribute, source });
      }
    });
    this.select = document.getElementById('ui-language');
    this.select.onchange = () => this.setLanguage(this.select.value);
    this.apply();
  }
  setLanguage(language) {
    this.language = language === 'pl' ? 'pl' : 'en';
    try { localStorage.setItem('mymodelrobot-language', this.language); } catch (_) { /* Session-only preference. */ }
    this.apply();
  }
  apply() {
    document.documentElement.lang = this.language; document.title = this.t(this.title); this.select.value = this.language;
    for (const { node, source, leading, trailing } of this.staticText) if (node.isConnected) {
      const translated = this.t(source);
      node.nodeValue = (/^[,.;:]/.test(translated) ? '' : leading) + translated + trailing;
    }
    for (const { node, attribute, source } of this.staticAttrs) if (node.isConnected) node.setAttribute(attribute, this.t(source));
    for (const [node, state] of this.dynamic) {
      if (!node.isConnected) { this.dynamic.delete(node); continue; }
      if (state.text) this.setText(node, state.text.source, state.text.params);
      for (const [attribute, { source, params }] of state.attrs) this.setAttr(node, attribute, source, params);
    }
  }
}
