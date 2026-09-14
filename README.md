# 🚀 Rent-a-API (Merkeziyetsiz P2P API Pazar Yeri)

Rent-a-API, **%0 platform komisyonu** ile çalışan, **günlük tekil kilit (daily exclusive lock)** mantığına dayalı, merkeziyetsiz bir API pazar yeridir.

Proje "vibecoding" tarzı rastgele kodlardan uzak; **katı tip güvenliği (strict TypeScript)**, modüler bileşen yapısı, atomik veritabanı kilitleri, **AES-256-GCM** şifreleme ve deterministik fiyatlandırma formülleriyle inşa edilmiştir.

---

## 📌 1. Temel Özellikler ve Mimari

- **Framework:** Next.js 14+ (App Router), React 18, TypeScript (Strict Mode)
- **Stil & UI:** Tailwind CSS, Lucide-React ikonları, Glassmorphic Web3 Dark Theme
- **Güvenlik:** Node.js `crypto` modülü ile AES-256-GCM (Auth Tag, IV, Encrypted Data) şifreleme
- **Kilit Mekanizması:** UTC Günlük Tekil Kilit (00:00:00 - 23:59:59 UTC). Aynı gün için çakışan kiralamalarda `409 Conflict`.
- **Ters Vekil Gateway:** Kiralayana verilen `proxyToken` ile asıl sağlayıcı anahtarını istemciye açmadan istekleri yönlendiren ters proxy.

---

## 📐 2. Matematiksel Model ve Fiyatlandırma Formülü

Platform hiçbir aracılık ücreti almaz (%0 Komisyon). Kiralayanın ödediği tutarın **%100'ü doğrudan sağlayıcıya** aktarılır.

$$\text{Günlük Fiyat (\$) } = \left( \frac{\text{Günlük Kota}}{\text{Referans Birim Boyutu}} \right) \times \text{Model Taban Maliyeti} \times (1 + \text{Sağlayıcı Kâr Marjı})$$

| Model Adı | Referans Birim | Model Taban Maliyeti | Örnek Kota | Sağlayıcı Marjı (+%15) | Günlük Kiralama Fiyatı |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Claude 3.5 Sonnet** | 1.000.000 Token | \$6.00 / 1M | 5.000.000 Token | %15 | **\$34.50** |
| **GPT-4o Omnimodel** | 1.000.000 Token | \$3.50 / 1M | 4.000.000 Token | %10 | **\$15.40** |
| **DeepSeek V3** | 1.000.000 Token | \$0.50 / 1M | 15.000.000 Token | %20 | **\$9.00** |
| **Web Scraping Proxy** | 1.000 İstek | \$0.50 / 1K | 25.000 İstek | %25 | **\$15.62** |

---

## 🔒 3. Güvenlik & Kriptografi (AES-256-GCM)

1. **Şifreleme:** Sağlayıcı API anahtarını sisteme eklediğinde 96-bit rastgele IV ve 32-byte master anahtar ile `aes-256-gcm` şifrelemesi yapılır.
2. **Kimlik Doğrulama:** 128-bit authentication tag ile veri bütünlüğü garanti edilir.
3. **Gizlilik:** Ham API anahtarı istemciye **asla** gönderilmez; yalnızca `sk-ant-...98b4` şeklinde maskelenmiş sürüm gösterilir.

---

## 🔌 4. Backend Uç Noktaları (Endpoints)

### `GET /api/slots`
Aktif slotları ve bugünkü (UTC) kilit durumunu listeler.

### `POST /api/slots`
Yeni API slotu oluşturur. Sağlayıcı anahtarını AES-256-GCM ile şifreler.
```json
{
  "modelType": "claude-3-5-sonnet",
  "apiKey": "sk-ant-api03-...",
  "dailyQuota": 5000000,
  "profitMargin": 0.15,
  "providerWallet": "0x7a83B9c019cDe91823B9c41E92019448E4B9c"
}
```

### `POST /api/rent`
Atomik kiralama ve tekil kilit. Slot bugün kiralanmışsa `409 Conflict` döner. Müsaitse kilitler ve `proxyToken` üretir.
```json
{
  "slotId": "slot_sonnet_01",
  "renterWallet": "0x3d91E0A724c94801BC38F41D8B93C523091B33e"
}
```

### `POST /api/v1/proxy`
Kiracının `proxyToken` ile istek attığı ters vekil geçidi:
```bash
curl -X POST "http://localhost:3000/api/v1/proxy" \
  -H "Authorization: Bearer rap_live_your_proxy_token" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Merhaba Rent-a-API!"}'
```

---

## 🛠️ 5. Kurulum ve Çalıştırma

```bash
# Bağımlılıkları yükleyin
npm install

# Geliştirme sunucusunu başlatın
npm run dev

# Tarayıcınızda açın:
# http://localhost:3000
```
