# 📱 Сборка Android-приложения для Google Play

## ✅ Текущий статус

Android-приложение **готово к сборке**. Все файлы настроены, код синхронизирован с Android проектом.

---

## 🚀 Как собрать APK для Google Play

### ⭐ Вариант 1: GitHub Actions (рекомендуется)

**Автоматическая сборка** при каждом push в GitHub!

#### Как это работает:

1. **Загрузите код в GitHub** (если ещё не загружен):
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/ваш-username/ваш-репозиторий.git
   git push -u origin main
   ```

2. **GitHub Actions автоматически соберёт APK**:
   - ✅ Установит все зависимости
   - ✅ Соберёт веб-приложение
   - ✅ Синхронизирует с Android
   - ✅ Скомпилирует APK
   - ✅ Сохранит APK для скачивания

3. **Скачайте готовый APK**:
   - Откройте ваш репозиторий на GitHub
   - Перейдите во вкладку **Actions**
   - Выберите последний успешный workflow
   - Скачайте артефакт **app-debug**

#### Ручной запуск сборки:

Если нужно собрать APK без push:

1. Откройте **Actions** → **Build Android APK**
2. Нажмите **Run workflow** → **Run workflow**
3. Через 5-10 минут скачайте APK из артефактов

**Преимущества:**
- 🚀 Полностью автоматическая сборка
- ☁️ Не нужен мощный компьютер или Android Studio
- 💰 Бесплатно (2000 минут в месяц)
- 📦 История всех версий APK

---

### Вариант 2: Локальная сборка (требует Android Studio)

Если у вас установлен Android Studio:

```bash
# 1. Обновить веб-код (если были изменения)
npm run build

# 2. Синхронизировать с Android проектом
npx cap sync android

# 3. Собрать APK (debug версия для тестирования)
cd android && ./gradlew assembleDebug

# APK будет здесь: android/app/build/outputs/apk/debug/app-debug.apk
```

### Вариант 3: Сборка production версии (для публикации)

Для загрузки в Google Play нужна **подписанная release-версия**:

```bash
# 1. Создать ключ подписи (один раз)
keytool -genkey -v -keystore my-release-key.keystore -alias my-key-alias -keyalg RSA -keysize 2048 -validity 10000

# 2. Настроить подпись в android/app/build.gradle
# (добавить секцию signingConfigs)

# 3. Собрать release APK
cd android && ./gradlew assembleRelease

# Подписанный APK: android/app/build/outputs/apk/release/app-release.apk
```

---

## 📦 Что дальше?

### 1. **Загрузка в Google Play Console**

1. Зарегистрируйтесь на [Google Play Console](https://play.google.com/console) ($25 разово)
2. Создайте новое приложение
3. Заполните информацию:
   - **Название**: Пуэр Паб
   - **Описание**: Магазин премиального китайского чая Пуэр
   - **Категория**: Покупки
   - **Скриншоты**: Сделайте скриншоты приложения
4. Загрузите APK или AAB файл
5. Отправьте на модерацию

### 2. **Информация о приложении**

**Package ID**: `com.puerpub.app`  
**App Name**: Пуэр Паб  
**Version**: 1.0.0

### 3. **Требования Google Play**

- ✅ Privacy Policy (политика конфиденциальности)
- ✅ App Icon (иконка приложения) - уже есть
- ✅ Screenshots (скриншоты) - нужно сделать
- ✅ Feature Graphic (баннер) - опционально
- ✅ Store Listing (описание в магазине)

---

## 🔄 Обновление приложения

При изменении веб-кода:

```bash
# 1. Пересобрать веб-приложение
npm run build

# 2. Синхронизировать с Android
npx cap sync android

# 3. Пересобрать APK
cd android && ./gradlew assembleRelease
```

---

## 💡 Полезные команды

```bash
# Открыть Android проект в Android Studio (если установлен)
npx cap open android

# Запустить на эмуляторе/устройстве
npx cap run android

# Проверить установленные плагины
npx cap ls

# Обновить Capacitor
npm install @capacitor/core @capacitor/cli @capacitor/android@latest
```

---

## 🌐 Что работает в приложении?

- ✅ Весь функционал сайта
- ✅ Каталог товаров
- ✅ Корзина и оформление заказа
- ✅ Личный кабинет
- ✅ Программа лояльности
- ✅ Офлайн-режим (через PWA)

**100% одинаковый код** - сайт, PWA и Android-приложение используют одну кодовую базу! 🚀

---

## 📝 Примечания

- Android проект находится в папке `android/` (исключен из git)
- При изменении кода нужно **всегда** запускать `npm run build && npx cap sync`
- Для iOS понадобится Mac и Xcode (команда: `npx cap add ios`)
