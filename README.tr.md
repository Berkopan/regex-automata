# Regex → Otomat

Düzenli ifadelerin sonlu otomatalara nasıl dönüştüğünü gösteren etkileşimli bir öğrenme laboratuvarı. DFA veya ε-NFA oluşturun; metnin karakter karakter işlenmesini ders kitabı biçimindeki durum diyagramında izleyin.

[Laboratuvarı aç](https://berkopan.github.io/regex-automata/) · [English](README.md)

## Bir ifadeyi keşfedin

Regex ve metin girin, **DFA** veya **NFA** seçin ve **Simülasyonu hazırla** düğmesine basın. Oynatmayı başlatın veya tek tek ilerleyin. Girdi bandı, vurgulanan oklar ve etkin durumlar her karakter okunurken neler olduğunu gösterir. Son adımda kabul veya ret gerekçesi açıklanır.

DFA için `(a|b)*abb` ve `aabb`; NFA’da paralel yolları görmek için `ab|ac` ve `ac` iyi başlangıç örnekleridir.

**Yeni metin için makineyi yeniden oluşturmanız gerekmez.** Yalnızca metni düzenlemek oynatmayı duraklatır ve simülasyonu başa alır; diyagram, yakınlaştırma ve seçili durum korunur. Regex, makine türü veya minimizasyon tercihi değiştiğinde yeniden hazırlama gerekir.

## Özellikler

- **Thompson ε-NFA yapımı:** bütün etkin yollar birlikte izlenir. Karakter tüketmeyen ε-kapanışı ayrı adımlarla gösterilir.
- **Altküme DFA dönüşümü** ve isteğe bağlı minimizasyon. Her DFA durumunun temsil ettiği özgün NFA altkümeleri incelenebilir.
- **Oynatma ve inceleme:** ileri/geri adım, hız ayarı, zaman çizelgesi, geçiş tablosu, durum ayrıntıları ve adım geçmişi. Diyagram taşınabilir, yakınlaştırılabilir ve SVG olarak kaydedilebilir.

Arayüz **TR / EN** düğmeleriyle **Türkçe ve İngilizce** kullanılabilir. Dil değiştirmek makineyi veya mevcut adımı sıfırlamaz; tarayıcı depolaması kullanılabiliyorsa tercih yerel olarak saklanır.

Arayüz açık krem tonlarındadır; diyagram oynatma sırasında yer değiştirmez. Klavye kontrolleri ve azaltılmış hareket tercihi desteklenir.

## Desteklenen sözdizimi

| Yazım | Anlam |
| --- | --- |
| `ab`, `a\|b`, `(ab)` | Ardışıklık, birleşim, gruplama |
| `a*`, `a+`, `a?` | Sıfır veya daha fazla, bir veya daha fazla, isteğe bağlı |
| `a{3}`, `a{2,4}`, `a{2,}` | Sınırlı veya alt sınırlı tekrar |
| `[abc]`, `[a-z]` | Sonlu karakter kümeleri ve aralıkları |
| `\d`, `\w`, `\s` | ASCII rakam, sözcük ve boşluk sınıfları |
| `\*`, `\[`, `\\`, `\n`, `\t` | Kaçırılmış karakterler ve kontrol karakterleri |
| `ε`, boş ifade, `()` | Boş sözcük |
| `∅` | Boş dil |

Bu bir öğrenme aracıdır; **tam bir JavaScript/PCRE regex motoru değildir**. Joker `.`, negatif sınıflar, çapalar, bayraklar, lookaround, geri başvurular ve lazy/possessive tekrarlar desteklenmez. Eşleştirme **metnin tamamı** içindir. İfadeyi `/…/` arasına almayın: burada `/` normal bir karakterdir.

Boşluklar korunur. İşleme Unicode kod noktaları üzerinden yapılır; birleşik bir grafem birden fazla adım sürebilir. `\d` ve `\w` ASCII kümelerini kullanır; `\s` yalnızca boşluk, `\t`, `\n`, `\r`, `\f`, `\v` içerir. Gerçek ε ve ∅ karakterleri için `\ε`, `\∅` yazın.

Okunabilirlik ve kaynak kullanımı için sınırlar: regex 180 kod noktası, metin 256 kod noktası, NFA 128 durum, minimizasyondan önce DFA 96 durum, alfabe 96 sembol, sonlu tekrar sınırı 24 ve iz 12.000 adım.

## Geliştirme

Çalışma zamanı bağımlılığı veya build adımı yoktur. Repoyu HTTP üzerinden sunun:

```sh
python3 -m http.server 8080
```

`http://localhost:8080` adresini açın. ES modülleri nedeniyle dosyayı doğrudan açmak yerine HTTP kullanın.

Node.js 20+ ile motor ve çeviri testleri:

```sh
npm test
```

İsteğe bağlı Chromium arayüz testleri:

```sh
python3 -m pip install playwright
python3 -m playwright install chromium
python3 tests/browser.py
```

Uygulama `src/automata.js` (algoritmalar), `src/graph.js` (SVG), `src/app.js` (etkileşim) ve `src/i18n.js` (çeviriler) dosyalarına ayrılmıştır.

Her şey tarayıcıda çalışır. Backend, harici font, CDN, analitik veya uzak eşleştirme servisi kullanılmaz; regex ve metin hiçbir yere gönderilmez.
