# Установка на iPhone через Xcode (Swift Package Manager)

Обёртка на [Capacitor](https://capacitorjs.com) с **Swift Package Manager** — без CocoaPods. Тот же веб-код, нативная оболочка, подпись **бесплатным Apple ID**.

## Что нужно

| | |
|---|---|
| **Mac** | Xcode из App Store |
| **iPhone** | кабель USB |
| **Apple ID** | обычный, бесплатный |
| **Интернет** | для загрузки пакетов GitHub в Xcode (один раз) |

CocoaPods **не нужен**.

### Ограничения бесплатного Apple ID

- Приложение живёт **~7 дней**, потом снова **Run (▶)** в Xcode.
- До **3** таких приложений на телефоне.
- На чужие iPhone без Mac не поставить.

---

## Шаг 1. Xcode

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
```

Откройте Xcode один раз и примите лицензию.

---

## Шаг 2. Создать iOS-проект (SPM)

Из папки проекта — **по одной команде на строку**:

```bash
cd "/Users/lustinaleksej/Claude/Projects/Веб приложение Карточки"
npm install
```

Если папки `ios/` ещё нет или там остался CocoaPods:

```bash
npm run ios:reset-spm
```

Если `ios/` уже на SPM (есть `ios/App/CapApp-SPM/`):

```bash
npm run ios:sync
```

Заполните `js/config.js` (из `js/config.example.js`), если нужно облако.

---

## Шаг 3. Один раз в Xcode — привязать пакет

```bash
npm run ios:open
```

Откроется **`ios/App/App.xcodeproj`** (не `.xcworkspace`).

### 3a. Package Dependency

1. Слева выберите проект **App** (синяя иконка).
2. Вкладка **Package Dependencies**.
3. Кнопка **+** → **Add Local…**
4. Выберите папку **`ios/App/CapApp-SPM`** → **Add Package** → ещё раз **Add Package**.

### 3b. Файл debug.xcconfig

1. Вкладка **Info** у проекта **App**.
2. **Configurations** → **Debug** → **+** (или правый клик) → **Add Configuration File…**
3. Выберите **`ios/debug.xcconfig`**.
4. Тип: **xcconfig**.

Если Xcode спросит — привяжите `debug.xcconfig` к таргету **App**.

После `npm run ios:sync` Capacitor обновляет `CapApp-SPM/Package.swift` — в Xcode: **File → Packages → Reset Package Caches**, если сборка ругается на зависимости.

---

## Шаг 4. Установка на iPhone

1. Подключите iPhone, разблокируйте, **Доверять** компьютеру.
2. Сверху в Xcode выберите **ваш iPhone**.
3. **Signing & Capabilities** → **Automatically manage signing** → ваш **Apple ID**.
4. Уникальный **Bundle Identifier** (например `ru.kartochki.app.вашеимя`).
5. **Run (▶)**.

На iPhone: **Настройки → Основные → VPN и управление устройством** → **Доверять** разработчику.

---

## Обновление после правок в коде

```bash
npm run ios:sync
```

В Xcode снова **Run (▶)**.

---

## Команды npm

| Команда | Когда |
|---------|--------|
| `npm run ios:reset-spm` | Первый раз или переход с CocoaPods (удаляет `ios/`, создаёт заново с SPM) |
| `npm run ios:sync` | После изменений в веб-коде |
| `npm run ios:open` | Открыть Xcode |

---

## Частые проблемы

**`pod install` / `cdn.cocoapods.org`**  
Вы на SPM — CocoaPods не используется. Выполните `npm run ios:reset-spm`.

**Ошибки Signing**  
Смените Bundle Identifier на уникальный.

**Пустой экран**  
Проверьте `js/config.js` и что `npm run ios:sync` прошёл без ошибок.

**Package not found**  
В Xcode: **File → Packages → Reset Package Caches**, проверьте интернет (нужен доступ к `github.com`).

**Режим «Голос»**  
Разрешения микрофона добавляются скриптом `patch-ios-plist` при `ios:sync`.  
На iOS/Android используется нативный `@capgo/capacitor-speech-recognition` (SFSpeechRecognizer); в браузере — Web Speech API.

---

Документация Capacitor: [Swift Package Manager](https://capacitorjs.com/docs/ios/spm)
