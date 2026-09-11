# Deploy Sui Cleaner — Render (free) + custom domain

## 1. Render — web service (5 минут, бесплатно)

1. Зарегистрируйтесь на https://render.com (можно через GitHub-аккаунт).
2. **New → Blueprint** → выберите репозиторий `sui-cleaner` (файл `render.yaml`
   уже в корне — Render сам подставит build/start/healthcheck).
   Либо вручную **New → Web Service**: Build Command `npm install && npm run build`,
   Start Command `npm run start`.
3. План **Free**.
4. Во вкладке **Environment** задайте переменные:
   - `NETWORK` = `mainnet`
   - `SUI_RPC_URL` = `https://sui.publicnode.com` (или своя нода)
   - `SERVICE_FEE_ADDRESS` = `0x…` адрес treasury — **обязательно**,
     иначе real cleanup останется заблокирован (fail-safe).
5. **Deploy**. Проверка: `https://<ваш-сервис>.onrender.com/api/config`
   должен вернуть JSON (`{"serviceFeeConfigured": true, ...}`).

> Free-план засыпает после ~15 минут без трафика: первый визит после паузы
> грузится 30–60 секунд. Чтобы сна не было вообще — настройте пингер
> (раздел «Не даём Render заснуть» ниже). Для боевого режима позже можно
> перейти на Starter ($7/мес) — код менять не нужно.

## 1b. Не даём Render заснуть (обязательно на Free)

Одного GitHub Actions (`Keep Render awake`) **недостаточно**: cron гитхаба
ходит с опозданиями 10–30+ минут под нагрузкой и вообще отключается после
60 дней без коммитов. Один пропуск >15 минут — и сервис снова спит.
Поэтому схема такая: **внешний пингер — основной, GitHub Actions — запасной.**

1. Зарегистрируйтесь на https://cron-job.org (бесплатно, интервал от 1 мин)
   или https://uptimerobot.com (бесплатно, интервал 5 мин).
2. Создайте задачу: `GET https://<ваш-сервис>.onrender.com/api/ping`
   каждые 5 минут (на cron-job.org можно каждую 1–2 минуты — надёжнее).
3. Ожидаемый ответ: `200 {"ok":true,...}`. Эндпоинт лёгкий — RPC не трогает.
4. Проверка: в дашборде Render вкладка **Logs** — каждые 5 минут должны быть
   `GET /api/ping 200`. Если пропуски >15 минут — сайт уснёт, смотрите логи
   пингера.
5. (Опционально) Если URL сервиса отличается от `sui-cleaner.onrender.com`,
   задайте секрет репозитория **Settings → Secrets → Actions →
   `RENDER_PING_URL`** = полный URL вашего `/api/ping`, чтобы и запасной
   GitHub-пингер бил в правильный адрес.

## 2. Свой домен (куплен за крипту, напр. Porkbun/Namecheap)

1. В Render: сервис → **Settings → Custom Domain → Add** → введите домен.
2. Render покажет DNS-запись (обычно `CNAME` на `*.onrender.com`).
3. У регистратора (Porkbun: Domain Management → DNS) добавьте эту запись.
4. Подождите 5–60 минут (DNS + авто-HTTPS от Render). Готово.

## 3. Что проверить после деплоя

- `/` — лендинг грузится, фон на месте.
- `/app?demo=true` — демо-скан на 47 объектов.
- `/api/config` — `serviceFeeConfigured: true`.
- Кошелёк подключается, dry-run симуляция проходит.

## 4. Важно

- НИКОГДА не коммитьте `.env` и реальные ключи — только dashboard Render.
- AI-панель работает с ключом пользователя (вводит сам в UI), серверу
  отдельный AI-ключ не нужен.
