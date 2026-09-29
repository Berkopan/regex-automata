# Regex → Otomat

Düzenli ifadeyi sonlu bir otomata dönüştüren, ardından metni karakter karakter işleyen sade bir web laboratuvarı. Arayüz Türkçedir.

Solda ifade, metin ve kontroller; sağda ders kitabı biçiminde SVG durum diyagramı vardır. Gradyan, kart duvarı, force-layout hareketi veya dekoratif animasyon yoktur. Durumlar yerinde kalır; yalnızca o adımın okları, ok üzerinde ilerleyen küçük işaretler ve etkin durumlar vurgulanır.

## Çalıştırma

Build veya paket kurulumu gerekmez. Repo kökünde:

```sh
python3 -m http.server 8080
```

Tarayıcıda `http://localhost:8080` adresini açın. ES modülleri nedeniyle `index.html` dosyasını `file://` ile açmak yerine bir statik sunucu kullanın. `npm start` aynı Python sunucusunu başlatır.

1. Regex ve metni yazın; DFA veya NFA seçin.
2. **Simülasyonu hazırla** ile makineyi oluşturun. Bu aşamada metin henüz işlenmez.
3. **Simülasyonu başlat** ile oynatın veya **İleri** ile tek adım ilerleyin.
4. Duraklatma, geri adım, başa dönme, hız seçimi ve zaman kaydırıcısını kullanın.

Bir giriş değiştiğinde eski simülasyon iptal edilir ve başlatma düğmesi yeniden hazırlanana kadar devre dışı kalır. Regex'ten oluşturulan makine, test metninden bağımsızdır.

## GitHub Pages

Bu repo doğrudan kök dizinden yayınlanabilir; özel bir Actions workflow'u veya build çıktısı gerekmez.

**Settings → Pages → Build and deployment** bölümünde:

- **Source:** Deploy from a branch
- **Branch:** main
- **Folder:** / (root)
- **Save**

Yayın tamamlandığında proje adresi `https://berkopan.github.io/regex-automata/` olur. Pages ayarını repo sahibi etkinleştirmelidir; kodun eklenmesi tek başına Pages'i açmaz. Tüm uygulama dosyaları göreli yollarla yüklenir. `.nojekyll` dosyası repoya dahildir.

GitHub'ın resmi yönergesi: <https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site>

## Makine ve simülasyon

- **NFA:** Thompson yapımı bir ε-NFA oluşturulur. Tek bir rastgele yol seçilmez; tüm etkin durumlar birlikte tutulur. ε-kapanışı, yeni durumlar eklendikçe ayrı dalgalar/adımlar hâlinde gösterilir. ε geçişleri karakter tüketmez ve ziyaret edilmiş durum takibi döngüleri sonlandırır.
- **DFA:** Erişilebilir ε-kapalı NFA altkümeleri determinize edilir. DFA, kendi sonlu Σ alfabesi üzerinde tamdır; gerekirse tuzak durum oluşturulur. Alfabe dışındaki karakter reddedilir, diyagrama sonradan bir geçiş eklenmez.
- **Minimizasyon:** Varsayılan olarak eşdeğer DFA durumları bölümleme iyileştirmesiyle birleştirilir. Seçeneği kapatarak doğrudan altküme DFA'sını inceleyebilirsiniz. Birleştirilmiş durumların özgün NFA altkümeleri ayrı ayrı korunur ve tabloda gösterilir.
- **Kabul:** Metnin tamamı işlendikten ve son ε-kapanışı tamamlandıktan sonra etkin durum kümesinin kabul durumlarıyla kesişimi denetlenir. Aradaki bir kabul durumuna uğramak, tüm girdinin kabul edildiği anlamına gelmez.

Dairelere tıklayarak durum bilgilerini; alttaki bölümleri açarak geçiş tablosunu, makine tanımını, DFA/NFA karşılıklarını ve son 12 adımı görebilirsiniz. Önceki adımlar kaydırıcıdan erişilebilir. Diyagram taşınabilir, yakınlaştırılabilir ve bağımsız SVG olarak kaydedilebilir. İşletim sisteminin azaltılmış hareket tercihi desteklenir.

Klavye: `Space` oynat/duraklat, `←` / `→` adım, `Home` başa dön, `Ctrl/⌘ + Enter` hazırla. Metin alanlarında yazarken gezinme kısayolları devreye girmez. Diyagram odaktayken `+`, `-`, `0` yakınlaştırma ve sığdırma içindir.

## Desteklenen regex altkümesi

| Yazım | Anlam |
| --- | --- |
| `ab` | Ardışıklık |
| `a\|b` | Birleşim |
| `(ab)` | Gruplama |
| `a*`, `a+`, `a?` | Tekrar / isteğe bağlı öğe |
| `a{3}`, `a{2,4}`, `a{2,}` | Sınırlı / alt sınırlı tekrar |
| `[abc]`, `[a-z]` | Sonlu karakter sınıfları |
| `\d`, `\w`, `\s` | ASCII sınıfları |
| `\*`, `\[`, `\\` | Kaçırılmış metakarakterler |
| `\n`, `\t`, `\r`, `\f`, `\v` | Kontrol karakterleri |
| `ε`, boş ifade, `()` | Boş sözcük |
| `∅` | Boş dil |
| `\ε`, `\∅` | Gerçek ε ve ∅ karakterleri |

Öncelik: tekrar → ardışıklık → birleşim. Boş alternatifler (`a|`) ε olarak yorumlanır. Karakterler Unicode kod noktalarıdır; örneğin 🙂 bir adımdır. Birleşik grafemler birden çok kod noktası içerebilir. Girdi kırpılmaz; boşluklar ve satır sonları korunur.

`\d` = `[0-9]`, `\w` = `[A-Za-z0-9_]`; `\s` yalnızca normal boşluk, sekme, satır sonu, carriage return, form feed ve vertical tab içerir. Bunlar tam Unicode sınıfları değildir.

Bu bir JavaScript/PCRE regex motoru değildir. Joker `.`, negatif sınıflar, `^` / `$` çapaları, lookaround, geri başvurular, lazy/possessive tekrarlar ve bayraklar desteklenmez. İfadeyi `/.../` arasına almayın: `/` normal bir karakterdir. Eşleşme her zaman **metnin tamamı** içindir; substring araması yapılmaz. Desteklenmeyen sözdizimi sessizce farklı yorumlanmak yerine hata verir (normal bir karakter olan `/` hariç).

Okunabilirlik ve tarayıcı kaynaklarını korumak için sınırlar: regex 180 kod noktası, NFA 128 durum, determinize edilmiş DFA 96 durum, alfabe 96 sembol, girdi 256 kod noktası, sonlu tekrar sayısı 24 ve simülasyon 12.000 adım. DFA sınırı minimizasyondan önce uygulanır; büyük bir dönüşümde NFA seçilebilir.

## Testler

Motor testleri yalnızca Node.js 20+ gerektirir; `npm install` gerekmez:

```sh
npm test
```

24 test; ayrıca sabit tohumla üretilen 200 regex × 63 metin × 3 makine çeşidi için 37.800 karşılaştırma içerir. Desteklenen ortak altkümede bağımsız native `RegExp` sonucu ile NFA, DFA ve minimal DFA karşılaştırılır. Uygulamanın eşleştirmesi native `RegExp` ile yapılmaz.

İsteğe bağlı 16 Chromium arayüz testi:

```sh
python3 -m pip install playwright
python3 -m playwright install chromium
python3 tests/browser.py
```

Sistemde `chromium` / `chromium-browser` varsa otomatik kullanılır; başka bir yol için `CHROMIUM_PATH` belirtilebilir. Testler gerçek ES modüllerini yerel Blob URL'lerinden yükler; ağ veya canlı Pages kurulumu gerektirmez. Ekran görüntüleri ve SVG çıktısı, Git'e alınmayan `test-results/` klasörüne yazılır.

## Dosyalar

- `src/automata.js`: ayrıştırıcı, Thompson yapımı, altküme dönüşümü, minimizasyon, simülasyon izi.
- `src/graph.js`: sabit katmanlı yerleşim, SVG çizimi, geçiş animasyonu, taşıma/yakınlaştırma ve dışa aktarım.
- `src/app.js`: form, oynatma yaşam döngüsü, girdi bandı ve açıklamalar.
- `index.html`, `styles.css`: erişilebilir, duyarlı arayüz.
- `tests/`: motor ve tarayıcı regresyon testleri.

Çalışma zamanı bağımlılığı, harici font, CDN, analitik veya backend yoktur. Regex ve metin tarayıcı dışına gönderilmez.

Algoritmalar için okuma: Russ Cox, [Regular Expression Matching Can Be Simple And Fast](https://swtch.com/~rsc/regexp/regexp1.html). Bu repo algoritmaların bağımsız bir JavaScript uygulamasıdır.
